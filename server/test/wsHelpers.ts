import { WebSocket } from 'ws';
import type { AuthResponse, ClientFrame, ServerFrame } from '@shared';
import type { TestApp } from './helpers';

/** A phone, as far as the server can tell: a WebSocket that collects what it is sent. */
export class Phone {
  readonly frames: ServerFrame[] = [];
  closed: { code: number; reason: string } | null = null;
  private readonly waiters: (() => void)[] = [];

  private constructor(readonly ws: WebSocket) {
    ws.on('message', (data) => {
      this.frames.push(JSON.parse(data.toString()) as ServerFrame);
      this.waiters.splice(0).forEach((w) => w());
    });
    ws.on('close', (code, reason) => {
      this.closed = { code, reason: reason.toString() };
      this.waiters.splice(0).forEach((w) => w());
    });
  }

  /** A real connection to the server over a local port, the way a phone would connect. */
  static async open(t: TestApp): Promise<Phone> {
    const ws = new WebSocket(await t.wsUrl());
    const phone = new Phone(ws);
    await new Promise<void>((resolve, reject) => {
      ws.once('open', () => resolve());
      ws.once('error', reject);
    });
    return phone;
  }

  /** Opens a connection and signs in with the person's access token. */
  static async signedIn(t: TestApp, who: AuthResponse): Promise<Phone> {
    const phone = await Phone.open(t);
    phone.send({ type: 'auth', token: who.tokens.accessToken });
    await phone.waitFor((f) => f.type === 'ready');
    return phone;
  }

  send(frame: ClientFrame | Record<string, unknown>): void {
    this.ws.send(JSON.stringify(frame));
  }

  /** Resolves with the first frame (already received or yet to come) that matches. */
  async waitFor<T extends ServerFrame = ServerFrame>(match: (f: ServerFrame) => boolean, ms = 2000, from = 0): Promise<T> {
    const deadline = Date.now() + ms;
    for (;;) {
      const found = this.frames.slice(from).find(match);
      if (found) return found as T;
      if (this.closed) throw new Error(`connection closed (${this.closed.code}) while waiting`);
      const left = deadline - Date.now();
      if (left <= 0) throw new Error(`no matching frame within ${ms} ms; got ${JSON.stringify(this.frames.map((f) => f.type))}`);
      await new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, left);
        this.waiters.push(() => {
          clearTimeout(timer);
          resolve();
        });
      });
    }
  }

  /** Asserts nothing matching arrives for a short while. */
  async expectNone(match: (f: ServerFrame) => boolean, ms = 150): Promise<void> {
    const from = this.frames.length;
    await new Promise((r) => setTimeout(r, ms));
    const hit = this.frames.slice(from).find(match);
    if (hit) throw new Error(`unexpected frame: ${JSON.stringify(hit)}`);
  }

  async waitForClose(ms = 2000): Promise<{ code: number; reason: string }> {
    const deadline = Date.now() + ms;
    while (!this.closed) {
      if (Date.now() > deadline) throw new Error('the connection did not close');
      await new Promise((r) => setTimeout(r, 10));
    }
    return this.closed;
  }

  close(): void {
    if (!this.closed) this.ws.close();
  }
}

export const isEvent = (type: string) => (f: ServerFrame) => f.type === 'event' && f.event.type === type;
