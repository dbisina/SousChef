import type { Message } from '@shared';
import type { FastifyBaseLogger } from 'fastify';
import type { Db } from '../db';

export interface PushMessage {
  /** An Expo push token. */
  to: string;
  title: string;
  body: string;
  data: Record<string, string>;
}

/** Sends notifications to phones. Expo's service in production; a fake in tests. */
export interface PushSender {
  /** Returns the tokens the service says no longer work (the app was removed), so they can be forgotten. */
  send(messages: PushMessage[]): Promise<{ invalidTokens: string[] }>;
}

const EXPO_TOKEN = /^Expo(nent)?PushToken\[[^\]]+\]$/;
const EXPO_URL = 'https://exp.host/--/api/v2/push/send';
/** Expo accepts up to 100 notifications per request. */
const CHUNK = 100;

/** Expo's push service, reached with plain `fetch` (no key is needed to send). */
export class ExpoPushSender implements PushSender {
  constructor(
    private readonly log: Pick<FastifyBaseLogger, 'warn'>,
    private readonly request: typeof fetch = fetch,
    private readonly accessToken?: string,
  ) {}

  async send(messages: PushMessage[]): Promise<{ invalidTokens: string[] }> {
    const valid = messages.filter((m) => EXPO_TOKEN.test(m.to));
    const invalidTokens: string[] = [];
    for (let i = 0; i < valid.length; i += CHUNK) {
      const chunk = valid.slice(i, i + CHUNK);
      try {
        const res = await this.request(EXPO_URL, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            accept: 'application/json',
            ...(this.accessToken ? { authorization: `Bearer ${this.accessToken}` } : {}),
          },
          body: JSON.stringify(chunk.map((m) => ({ ...m, sound: 'default', priority: 'high', channelId: 'messages' }))),
        });
        if (!res.ok) {
          this.log.warn({ status: res.status }, 'push service refused a batch');
          continue;
        }
        const body = (await res.json()) as { data?: { status: string; details?: { error?: string } }[] };
        // Tickets come back in the same order as the messages sent.
        body.data?.forEach((ticket, index) => {
          if (ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered') invalidTokens.push((chunk[index] as PushMessage).to);
        });
      } catch (err) {
        this.log.warn({ err }, 'could not reach the push service');
      }
    }
    return { invalidTokens };
  }
}

/** Short text for a notification or a conversation row. */
export function messagePreview(m: Message): string {
  if (m.deleted) return 'Message deleted';
  switch (m.kind) {
    case 'text':
      return m.text.slice(0, 120);
    case 'recipe-card':
      return `Sent a recipe: ${m.title}`.slice(0, 120);
    case 'voice':
      return 'Voice message';
    case 'image':
      return m.caption ? `Photo: ${m.caption}`.slice(0, 120) : 'Photo';
  }
}

/** Decides who gets a notification for a new message, and sends it. */
export class PushNotifier {
  constructor(
    private readonly db: Db,
    private readonly sender: PushSender,
    private readonly log: Pick<FastifyBaseLogger, 'warn'>,
  ) {}

  /** `offline`: members with no live connection. The sender and anyone who muted the chat are skipped. */
  async messageNew(message: Message, offline: string[]): Promise<void> {
    const candidates = offline.filter((id) => id !== message.sender.id);
    if (candidates.length === 0) return;
    const [members, convo] = await Promise.all([
      this.db.conversationMember.findMany({ where: { conversationId: message.conversationId, userId: { in: candidates }, muted: false }, select: { userId: true } }),
      this.db.conversation.findUnique({ where: { id: message.conversationId }, select: { kind: true, title: true } }),
    ]);
    if (members.length === 0 || !convo) return;
    const devices = await this.db.device.findMany({ where: { userId: { in: members.map((m) => m.userId) } }, select: { pushToken: true } });
    if (devices.length === 0) return;

    const group = convo.kind !== 'DIRECT';
    const title = group ? (convo.title ?? 'Group chat') : message.sender.displayName;
    const body = group ? `${message.sender.displayName}: ${messagePreview(message)}` : messagePreview(message);
    const { invalidTokens } = await this.sender.send(
      devices.map((d) => ({ to: d.pushToken, title, body, data: { type: 'message', conversationId: message.conversationId, messageId: message.id } })),
    );
    if (invalidTokens.length > 0) {
      await this.db.device.deleteMany({ where: { pushToken: { in: invalidTokens } } });
      this.log.warn({ count: invalidTokens.length }, 'forgot push tokens the service rejected');
    }
  }

  /** Tells a recipe's writer that someone cooked it and shared the result. */
  async recipeCooked(n: { recipeAuthorId: string; cookName: string; recipeTitle: string; postId: string; recipeId: string }): Promise<void> {
    const devices = await this.db.device.findMany({ where: { userId: n.recipeAuthorId }, select: { pushToken: true } });
    if (devices.length === 0) return;
    const { invalidTokens } = await this.sender.send(
      devices.map((d) => ({ to: d.pushToken, title: `${n.cookName} cooked your recipe`, body: n.recipeTitle.slice(0, 120), data: { type: 'recipe-cooked', postId: n.postId, recipeId: n.recipeId } })),
    );
    if (invalidTokens.length > 0) await this.db.device.deleteMany({ where: { pushToken: { in: invalidTokens } } });
  }
}
