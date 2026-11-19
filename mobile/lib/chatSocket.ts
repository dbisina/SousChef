// The live connection to the enplace server (WebSocket /v1/ws): new messages, receipts, typing, who is online, and game
// updates. It only listens; messages are sent with normal requests (see services/chatApi.ts).
//
// It signs in with the access token as the first frame, answers pings, and reconnects by itself with growing waits.
// After a reconnect it says `resync`, because events were missed meanwhile: the store then asks for "messages after N".
import type { ChatEvent, ClientFrame, ServerFrame } from '@shared/index';

export type SocketState = 'idle' | 'connecting' | 'authenticating' | 'ready' | 'waiting';

/** The few parts of a WebSocket this needs, so tests can use a stand-in. */
export interface SocketLike {
  onopen: (() => void) | null;
  onmessage: ((e: { data: unknown }) => void) | null;
  onclose: ((e: { code: number }) => void) | null;
  onerror: (() => void) | null;
  send(data: string): void;
  close(code?: number): void;
}

export interface ChatSocketOptions {
  /** ws:// or wss:// address of /v1/ws. */
  url: string;
  /** A current access token, or null when signed out. */
  getToken: () => Promise<string | null>;
  onEvent: (event: ChatEvent) => void;
  onTyping?: (conversationId: string, userId: string, typing: boolean) => void;
  onPresence?: (userId: string, online: boolean) => void;
  /** Called after every connection that follows an earlier one: fetch what was missed. */
  onResync?: () => void;
  onState?: (state: SocketState) => void;
  createSocket?: (url: string) => SocketLike;
  /** Milliseconds between pings while connected; the server drops connections that go quiet. */
  pingMs?: number;
  /** For tests. */
  random?: () => number;
}

const MAX_WAIT_MS = 30_000;

export class ChatSocket {
  private socket: SocketLike | null = null;
  private state: SocketState = 'idle';
  private wanted = false;
  private attempt = 0;
  private everReady = false;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private online = new Set<string>();

  constructor(private readonly opts: ChatSocketOptions) {}

  get currentState(): SocketState {
    return this.state;
  }

  /** Who the server said is online right now. */
  get onlineIds(): ReadonlySet<string> {
    return this.online;
  }

  start(): void {
    if (this.wanted) return;
    this.wanted = true;
    void this.connect();
  }

  stop(): void {
    this.wanted = false;
    this.clearTimers();
    const socket = this.socket;
    this.socket = null;
    socket?.close(1000);
    this.setState('idle');
  }

  sendTyping(conversationId: string, typing: boolean): void {
    this.send({ type: 'typing', conversationId, typing });
  }

  /** Tells the server this phone has everything in the conversation up to `seq`. */
  ack(conversationId: string, seq: number): void {
    this.send({ type: 'ack', conversationId, seq });
  }

  /* ------------------------------------------------------------------ */

  private send(frame: ClientFrame): void {
    if (this.state === 'ready') this.socket?.send(JSON.stringify(frame));
  }

  private setState(state: SocketState): void {
    if (this.state === state) return;
    this.state = state;
    this.opts.onState?.(state);
  }

  private clearTimers(): void {
    if (this.retryTimer) clearTimeout(this.retryTimer);
    if (this.pingTimer) clearInterval(this.pingTimer);
    this.retryTimer = null;
    this.pingTimer = null;
  }

  private async connect(): Promise<void> {
    if (!this.wanted) return;
    this.setState('connecting');
    let token: string | null = null;
    try {
      token = await this.opts.getToken();
    } catch {
      token = null;
    }
    if (!this.wanted) return;
    if (!token) {
      // Signed out (or the refresh failed): nothing to connect with. Try again later in case the person signs in.
      this.scheduleRetry();
      return;
    }

    const socket = (this.opts.createSocket ?? ((u: string) => new WebSocket(u) as unknown as SocketLike))(this.opts.url);
    this.socket = socket;
    socket.onopen = () => {
      this.setState('authenticating');
      socket.send(JSON.stringify({ type: 'auth', token } satisfies ClientFrame));
    };
    socket.onmessage = (e) => this.handle(e.data);
    socket.onclose = (e) => this.closed(socket, e.code);
    socket.onerror = () => undefined; // a failed connection also closes, which is where it is handled
  }

  private handle(raw: unknown): void {
    let frame: ServerFrame;
    try {
      frame = JSON.parse(String(raw)) as ServerFrame;
    } catch {
      return;
    }
    switch (frame.type) {
      case 'ready': {
        this.attempt = 0;
        this.online = new Set(frame.online);
        this.setState('ready');
        this.startPing();
        if (this.everReady) this.opts.onResync?.();
        this.everReady = true;
        return;
      }
      case 'event':
        this.opts.onEvent(frame.event);
        return;
      case 'typing':
        this.opts.onTyping?.(frame.conversationId, frame.userId, frame.typing);
        return;
      case 'presence':
        if (frame.online) this.online.add(frame.userId);
        else this.online.delete(frame.userId);
        this.opts.onPresence?.(frame.userId, frame.online);
        return;
      case 'pong':
      case 'error':
        return;
    }
  }

  private startPing(): void {
    if (this.pingTimer) clearInterval(this.pingTimer);
    this.pingTimer = setInterval(() => this.send({ type: 'ping' }), this.opts.pingMs ?? 25_000);
  }

  private closed(socket: SocketLike, code: number): void {
    if (this.socket !== socket) return; // an old connection we already moved on from
    this.socket = null;
    this.clearTimers();
    this.online.clear();
    if (!this.wanted) return;
    // 4409: another connection of this account replaced this one (a second phone or a duplicate). Fighting it would
    // make the two take turns forever, so stay down until start() is called again.
    if (code === 4409) {
      this.wanted = false;
      this.setState('idle');
      return;
    }
    this.scheduleRetry();
  }

  private scheduleRetry(): void {
    this.setState('waiting');
    const base = Math.min(MAX_WAIT_MS, 1000 * 2 ** this.attempt++);
    const jitter = 0.5 + (this.opts.random ?? Math.random)() * 0.5; // between half and full, so phones do not all return at once
    this.retryTimer = setTimeout(() => void this.connect(), Math.round(base * jitter));
  }
}
