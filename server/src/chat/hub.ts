import type { FastifyBaseLogger } from 'fastify';
import type { RawData, WebSocket } from 'ws';
import { z } from 'zod';
import type { ChatEvent, ClientFrame, ServerFrame } from '@shared';
import type { AuthService } from '../auth/service';
import type { Db } from '../db';
import { AppError } from '../errors';
import type { ChatEvents } from './events';
import type { PushNotifier } from './push';
import type { ChatService } from './service';

export interface HubOptions {
  /** How long a new connection has to send its sign-in frame. */
  authTimeoutMs: number;
  /** How often idle connections are pinged; one that does not answer by the next round is dropped. */
  heartbeatMs: number;
  /** How often connections are checked against their sign-in, so logging out closes them. */
  sessionCheckMs: number;
  /** A sixth phone signing in closes the oldest connection. */
  maxConnectionsPerUser: number;
  /** Typing notices from one connection in one conversation are passed on at most this often. */
  typingMinIntervalMs: number;
}

export const defaultHubOptions: HubOptions = {
  authTimeoutMs: 10_000,
  heartbeatMs: 30_000,
  sessionCheckMs: 60_000,
  maxConnectionsPerUser: 5,
  typingMinIntervalMs: 1_000,
};

const frameSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('auth'), token: z.string().min(1).max(4000) }),
  z.object({ type: z.literal('ping') }),
  z.object({ type: z.literal('ack'), conversationId: z.uuid(), seq: z.number().int().min(0) }),
  z.object({ type: z.literal('typing'), conversationId: z.uuid(), typing: z.boolean() }),
]) satisfies z.ZodType<ClientFrame>;

interface Connection {
  socket: WebSocket;
  userId: string | null;
  sessionId: string | null;
  alive: boolean;
  authTimer: NodeJS.Timeout | null;
  lastTyping: Map<string, number>;
}

/**
 * Keeps track of who is connected and delivers chat events to them as they happen. Everything it sends can also be had
 * by asking for messages after a number, so a missed event (a dropped connection) loses nothing.
 */
export class ChatHub implements ChatEvents {
  private readonly everyone = new Set<Connection>();
  private readonly signedIn = new Map<string, Set<Connection>>();
  private chat: ChatService | null = null;
  private notifier: PushNotifier | null = null;
  private timers: NodeJS.Timeout[] = [];

  constructor(
    private readonly db: Db,
    private readonly auth: AuthService,
    private readonly log: Pick<FastifyBaseLogger, 'warn' | 'debug'>,
    private readonly options: HubOptions = defaultHubOptions,
    private readonly now: () => Date = () => new Date(),
  ) {}

  /** The chat service needs the hub to announce events and the hub needs the service to mark delivery, so they meet here. */
  attach(chat: ChatService, notifier: PushNotifier | null): void {
    this.chat = chat;
    this.notifier = notifier;
  }

  start(): void {
    this.timers.push(setInterval(() => this.heartbeat(), this.options.heartbeatMs).unref());
    this.timers.push(setInterval(() => void this.checkSessions(), this.options.sessionCheckMs).unref());
  }

  stop(): void {
    for (const t of this.timers) clearInterval(t);
    this.timers = [];
    for (const c of this.everyone) {
      if (c.authTimer) clearTimeout(c.authTimer);
      c.socket.terminate();
    }
    this.everyone.clear();
    this.signedIn.clear();
  }

  isOnline(userId: string): boolean {
    return (this.signedIn.get(userId)?.size ?? 0) > 0;
  }

  /* ------------------------------------------------------------------ announcing events */

  publish(userIds: string[], event: ChatEvent): void {
    const targets = [...new Set(userIds)];
    const frame = JSON.stringify({ type: 'event', event } satisfies ServerFrame);
    for (const id of targets) this.sendRaw(id, frame);
    if (event.type === 'message.new') {
      this.afterNewMessage(targets, event.message).catch((err) => this.log.warn({ err }, 'could not finish handling a new message'));
    }
  }

  /** Phones that are connected have the message now (delivered); the others get a notification. */
  private async afterNewMessage(members: string[], message: Extract<ChatEvent, { type: 'message.new' }>['message']): Promise<void> {
    const online = members.filter((id) => this.isOnline(id));
    const offline = members.filter((id) => !this.isOnline(id));
    await Promise.all([
      ...online.filter((id) => id !== message.sender.id).map((id) => this.chat?.markDelivered(id, message.conversationId, message.seq)),
      this.notifier?.messageNew(message, offline),
    ]);
  }

  private sendRaw(userId: string, frame: string): void {
    for (const c of this.signedIn.get(userId) ?? []) if (c.socket.readyState === 1) c.socket.send(frame);
  }

  private send(c: Connection, frame: ServerFrame): void {
    if (c.socket.readyState === 1) c.socket.send(JSON.stringify(frame));
  }

  /* ------------------------------------------------------------------ one connection */

  /** Called for each new WebSocket. It must sign in before anything else. */
  accept(socket: WebSocket): void {
    const c: Connection = { socket, userId: null, sessionId: null, alive: true, authTimer: null, lastTyping: new Map() };
    this.everyone.add(c);
    c.authTimer = setTimeout(() => socket.close(4408, 'sign in first'), this.options.authTimeoutMs);
    socket.on('message', (data: RawData) => void this.onFrame(c, data));
    socket.on('pong', () => {
      c.alive = true;
    });
    socket.on('close', () => this.drop(c));
    socket.on('error', () => socket.terminate());
  }

  private async onFrame(c: Connection, data: RawData): Promise<void> {
    let frame: ClientFrame;
    try {
      frame = frameSchema.parse(JSON.parse(Array.isArray(data) ? Buffer.concat(data).toString() : data.toString()));
    } catch {
      this.send(c, { type: 'error', code: 'bad_frame', message: 'Could not read that' });
      c.socket.close(4400, 'bad frame');
      return;
    }
    try {
      if (frame.type === 'auth') return await this.signIn(c, frame.token);
      if (!c.userId) {
        this.send(c, { type: 'error', code: 'unauthorized', message: 'Sign in first' });
        c.socket.close(4401, 'sign in first');
        return;
      }
      switch (frame.type) {
        case 'ping':
          this.send(c, { type: 'pong' });
          return;
        case 'ack':
          await this.chat?.markDelivered(c.userId, frame.conversationId, frame.seq);
          return;
        case 'typing':
          await this.relayTyping(c, c.userId, frame.conversationId, frame.typing);
          return;
      }
    } catch (err) {
      if (err instanceof AppError && err.code === 'not_found') {
        this.send(c, { type: 'error', code: 'not_found', message: err.message });
        return;
      }
      this.log.warn({ err }, 'live connection frame failed');
    }
  }

  private async signIn(c: Connection, token: string): Promise<void> {
    const claims = await this.auth.authenticate(`Bearer ${token}`);
    if (c.socket.readyState !== 1) return; // gone while we checked
    if (!claims) {
      this.send(c, { type: 'error', code: 'unauthorized', message: 'Sign in again' });
      c.socket.close(4401, 'unauthorized');
      return;
    }
    if (c.authTimer) clearTimeout(c.authTimer);
    c.authTimer = null;
    c.userId = claims.userId;
    c.sessionId = claims.sessionId;

    const set = this.signedIn.get(claims.userId) ?? new Set<Connection>();
    const first = set.size === 0;
    set.add(c);
    this.signedIn.set(claims.userId, set);
    if (set.size > this.options.maxConnectionsPerUser) {
      const oldest = set.values().next().value as Connection;
      oldest.socket.close(4409, 'replaced by a newer connection');
    }

    const friends = await this.coMembers(claims.userId);
    this.send(c, { type: 'ready', userId: claims.userId, serverTime: this.now().toISOString(), online: friends.filter((id) => this.isOnline(id)) });
    if (first) for (const id of friends) this.sendRaw(id, JSON.stringify({ type: 'presence', userId: claims.userId, online: true } satisfies ServerFrame));
  }

  private async relayTyping(c: Connection, userId: string, conversationId: string, typing: boolean): Promise<void> {
    const last = c.lastTyping.get(conversationId) ?? 0;
    const at = Date.now();
    // "Stopped typing" always goes through; a stream of "typing" notices is thinned out.
    if (typing && at - last < this.options.typingMinIntervalMs) return;
    c.lastTyping.set(conversationId, at);
    const members = await this.db.conversationMember.findMany({ where: { conversationId }, select: { userId: true } });
    if (!members.some((m) => m.userId === userId)) throw new AppError(404, 'not_found', 'Conversation not found');
    const frame = JSON.stringify({ type: 'typing', conversationId, userId, typing } satisfies ServerFrame);
    for (const m of members) if (m.userId !== userId) this.sendRaw(m.userId, frame);
  }

  private drop(c: Connection): void {
    if (c.authTimer) clearTimeout(c.authTimer);
    this.everyone.delete(c);
    if (!c.userId) return;
    const set = this.signedIn.get(c.userId);
    set?.delete(c);
    if (set && set.size === 0) {
      this.signedIn.delete(c.userId);
      const userId = c.userId;
      void this.coMembers(userId).then((friends) => {
        for (const id of friends) this.sendRaw(id, JSON.stringify({ type: 'presence', userId, online: false } satisfies ServerFrame));
      });
    }
  }

  /** The people this person shares a conversation with. */
  private async coMembers(userId: string): Promise<string[]> {
    const rows = await this.db.$queryRaw<{ userId: string }[]>`
      SELECT DISTINCT b."userId" FROM "ConversationMember" a
      JOIN "ConversationMember" b ON b."conversationId" = a."conversationId" AND b."userId" <> a."userId"
      WHERE a."userId" = ${userId}::uuid LIMIT 1000`;
    return rows.map((r) => r.userId);
  }

  /* ------------------------------------------------------------------ housekeeping */

  private heartbeat(): void {
    for (const c of this.everyone) {
      if (!c.alive) {
        c.socket.terminate();
        continue;
      }
      c.alive = false;
      c.socket.ping();
    }
  }

  /** A connection lives on after its access token expires, but not after the person logs out. */
  private async checkSessions(): Promise<void> {
    const ids = [...new Set([...this.everyone].map((c) => c.sessionId).filter((s): s is string => s !== null))];
    if (ids.length === 0) return;
    try {
      const live = new Set(
        (await this.db.session.findMany({ where: { id: { in: ids }, revokedAt: null, expiresAt: { gt: this.now() } }, select: { id: true } })).map((s) => s.id),
      );
      for (const c of this.everyone) if (c.sessionId && !live.has(c.sessionId)) c.socket.close(4401, 'signed out');
    } catch (err) {
      this.log.warn({ err }, 'could not check live sign-ins');
    }
  }
}

/** Sends every announcement to each of the listeners. */
export function tee(...targets: ChatEvents[]): ChatEvents {
  return {
    publish(userIds, event) {
      for (const t of targets) t.publish(userIds, event);
    },
  };
}
