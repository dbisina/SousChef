// The live connection and the chat requests, against stand-ins.
jest.mock('expo-secure-store', () => ({ getItemAsync: async () => null, setItemAsync: async () => undefined, deleteItemAsync: async () => undefined }));

import { api, resetApiForTests } from '@/lib/api';
import { ChatSocket, type SocketLike, type SocketState } from '@/lib/chatSocket';
import * as chat from '@/services/chatApi';

/** A WebSocket stand-in the test drives by hand. */
class FakeSocket implements SocketLike {
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: unknown }) => void) | null = null;
  onclose: ((e: { code: number }) => void) | null = null;
  onerror: (() => void) | null = null;
  sent: unknown[] = [];
  closedWith: number | undefined;
  constructor(readonly url: string) {}
  send(data: string) { this.sent.push(JSON.parse(data)); }
  close(code?: number) { this.closedWith = code; }
  // test helpers
  open() { this.onopen?.(); }
  receive(frame: object) { this.onmessage?.({ data: JSON.stringify(frame) }); }
  drop(code = 1006) { this.onclose?.({ code }); }
}

// (Timers are faked in these tests, so wait for pending promises directly instead of on a timer.)
const flush = async () => {
  for (let i = 0; i < 10; i++) await Promise.resolve();
};

function setup(extra: { token?: () => Promise<string | null>; pingMs?: number } = {}) {
  const sockets: FakeSocket[] = [];
  const log = { events: [] as unknown[], typing: [] as unknown[], presence: [] as unknown[], resyncs: 0, states: [] as SocketState[] };
  const socket = new ChatSocket({
    url: 'wss://api.test/v1/ws',
    getToken: extra.token ?? (async () => 'tok-1'),
    onEvent: (e) => log.events.push(e),
    onTyping: (c, u, t) => log.typing.push([c, u, t]),
    onPresence: (u, o) => log.presence.push([u, o]),
    onResync: () => { log.resyncs++; },
    onState: (s) => log.states.push(s),
    createSocket: (url) => { const s = new FakeSocket(url); sockets.push(s); return s; },
    pingMs: extra.pingMs ?? 25_000,
    random: () => 1,
  });
  return { socket, sockets, log };
}
const ready = (online: string[] = []) => ({ type: 'ready', userId: 'me', serverTime: 'x', online });

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

describe('the live connection', () => {
  it('signs in with the first frame, then reports ready', async () => {
    const { socket, sockets, log } = setup();
    socket.start();
    await flush();
    expect(sockets).toHaveLength(1);
    expect(sockets[0]?.url).toBe('wss://api.test/v1/ws');
    sockets[0]!.open();
    expect(sockets[0]!.sent).toEqual([{ type: 'auth', token: 'tok-1' }]);
    expect(socket.currentState).toBe('authenticating');
    sockets[0]!.receive(ready(['u2']));
    expect(socket.currentState).toBe('ready');
    expect([...socket.onlineIds]).toEqual(['u2']);
    expect(log.states).toEqual(['connecting', 'authenticating', 'ready']);
    socket.stop();
  });

  it('passes events, typing and presence on, and keeps the online list current', async () => {
    const { socket, sockets, log } = setup();
    socket.start();
    await flush();
    sockets[0]!.open();
    sockets[0]!.receive(ready(['u2']));
    sockets[0]!.receive({ type: 'event', event: { type: 'conversation.updated', conversationId: 'c1' } });
    sockets[0]!.receive({ type: 'typing', conversationId: 'c1', userId: 'u2', typing: true });
    sockets[0]!.receive({ type: 'presence', userId: 'u3', online: true });
    sockets[0]!.receive({ type: 'presence', userId: 'u2', online: false });
    sockets[0]!.receive({ type: 'pong' });
    sockets[0]!.onmessage?.({ data: 'not json' }); // ignored
    expect(log.events).toEqual([{ type: 'conversation.updated', conversationId: 'c1' }]);
    expect(log.typing).toEqual([['c1', 'u2', true]]);
    expect(log.presence).toEqual([['u3', true], ['u2', false]]);
    expect([...socket.onlineIds]).toEqual(['u3']);
    socket.stop();
  });

  it('sends typing and acknowledgements only once ready', async () => {
    const { socket, sockets } = setup();
    socket.start();
    await flush();
    socket.sendTyping('c1', true); // not ready: dropped
    sockets[0]!.open();
    socket.ack('c1', 3);
    expect(sockets[0]!.sent).toHaveLength(1); // just the sign-in
    sockets[0]!.receive(ready());
    socket.sendTyping('c1', true);
    socket.ack('c1', 3);
    expect(sockets[0]!.sent.slice(1)).toEqual([{ type: 'typing', conversationId: 'c1', typing: true }, { type: 'ack', conversationId: 'c1', seq: 3 }]);
    socket.stop();
  });

  it('pings to stay connected', async () => {
    const { socket, sockets } = setup({ pingMs: 1000 });
    socket.start();
    await flush();
    sockets[0]!.open();
    sockets[0]!.receive(ready());
    jest.advanceTimersByTime(3100);
    expect(sockets[0]!.sent.filter((f) => (f as { type: string }).type === 'ping')).toHaveLength(3);
    socket.stop();
  });

  it('reconnects after a drop with growing waits, and asks for a catch-up only the second time', async () => {
    const { socket, sockets, log } = setup();
    socket.start();
    await flush();
    sockets[0]!.open();
    sockets[0]!.receive(ready());
    expect(log.resyncs).toBe(0); // the first connection has nothing to catch up on

    sockets[0]!.drop();
    expect(socket.currentState).toBe('waiting');
    jest.advanceTimersByTime(999);
    expect(sockets).toHaveLength(1);
    jest.advanceTimersByTime(1);
    await flush();
    expect(sockets).toHaveLength(2);

    sockets[1]!.drop(); // failed before it even opened: wait twice as long
    jest.advanceTimersByTime(1999);
    expect(sockets).toHaveLength(2);
    jest.advanceTimersByTime(1);
    await flush();
    expect(sockets).toHaveLength(3);

    sockets[2]!.open();
    sockets[2]!.receive(ready());
    expect(log.resyncs).toBe(1);
    sockets[2]!.drop(); // a good connection resets the wait
    jest.advanceTimersByTime(1000);
    await flush();
    expect(sockets).toHaveLength(4);
    socket.stop();
  });

  it('never waits more than half a minute', async () => {
    const { socket, sockets } = setup();
    socket.start();
    await flush();
    for (let i = 0; i < 10; i++) {
      sockets.at(-1)!.drop();
      jest.advanceTimersByTime(30_000);
      await flush();
    }
    expect(sockets.length).toBe(11);
    socket.stop();
  });

  it('stays down when another connection of the account replaced it', async () => {
    const { socket, sockets } = setup();
    socket.start();
    await flush();
    sockets[0]!.open();
    sockets[0]!.receive(ready());
    sockets[0]!.drop(4409);
    jest.advanceTimersByTime(120_000);
    await flush();
    expect(sockets).toHaveLength(1);
    expect(socket.currentState).toBe('idle');
  });

  it('gets a fresh token for each attempt, and retries later when signed out', async () => {
    let asked = 0;
    const { socket, sockets } = setup({ token: async () => (asked++ === 0 ? null : 'tok-2') });
    socket.start();
    await flush();
    expect(sockets).toHaveLength(0); // no token yet
    expect(socket.currentState).toBe('waiting');
    jest.advanceTimersByTime(1000);
    await flush();
    expect(sockets).toHaveLength(1);
    sockets[0]!.open();
    expect(sockets[0]!.sent[0]).toEqual({ type: 'auth', token: 'tok-2' });
    socket.stop();
  });

  it('stop closes the connection and cancels a pending retry', async () => {
    const { socket, sockets } = setup();
    socket.start();
    await flush();
    sockets[0]!.open();
    sockets[0]!.receive(ready());
    sockets[0]!.drop();
    socket.stop();
    jest.advanceTimersByTime(60_000);
    await flush();
    expect(sockets).toHaveLength(1);
    expect(socket.currentState).toBe('idle');

    const second = setup();
    second.socket.start();
    await flush();
    second.socket.stop();
    expect(second.sockets[0]?.closedWith).toBe(1000);
  });
});

describe('the chat requests', () => {
  const reply = (status: number, body?: unknown) => ({ ok: status < 300, status, json: async () => body ?? null }) as Response;
  const tokens = { accessToken: 'a1', accessTokenExpiresAt: new Date(Date.now() + 900_000).toISOString(), refreshToken: 'r1' };
  let server: jest.Mock;
  const sent = (i: number) => {
    const [url, init] = server.mock.calls[i] as [string, RequestInit];
    return { method: init.method, path: new URL(String(url)).pathname, search: new URL(String(url)).search, body: init.body ? JSON.parse(String(init.body)) : undefined };
  };

  beforeEach(async () => {
    jest.useRealTimers();
    process.env.EXPO_PUBLIC_API_URL = 'https://api.test/';
    resetApiForTests();
    server = jest.fn();
    global.fetch = server as unknown as typeof fetch;
    await api().setTokens(tokens);
  });
  afterAll(() => {
    delete process.env.EXPO_PUBLIC_API_URL;
  });

  it('builds the live address from the server address', () => {
    expect(chat.liveUrl()).toBe('wss://api.test/v1/ws');
    process.env.EXPO_PUBLIC_API_URL = 'http://localhost:3000';
    expect(chat.liveUrl()).toBe('ws://localhost:3000/v1/ws');
  });

  it('sends a message with the phone\'s own id so a resend is harmless', async () => {
    server.mockResolvedValueOnce(reply(201, { id: 'm1', seq: 4 }));
    await chat.apiSendMessage('c1', { clientId: 'cl-1', kind: 'text', text: 'Hi' });
    expect(sent(0)).toMatchObject({ method: 'POST', path: '/v1/conversations/c1/messages', body: { clientId: 'cl-1', kind: 'text', text: 'Hi' } });
  });

  it('catches up on everything missed, page by page', async () => {
    server
      .mockResolvedValueOnce(reply(200, { items: [{ seq: 6 }, { seq: 7 }], hasMore: true }))
      .mockResolvedValueOnce(reply(200, { items: [{ seq: 8 }], hasMore: false }));
    const missed = await chat.apiMessagesAfter('c1', 5);
    expect(missed.map((m) => m.seq)).toEqual([6, 7, 8]);
    expect(sent(0).search).toBe('?afterSeq=5&limit=100');
    expect(sent(1).search).toBe('?afterSeq=7&limit=100');
  });

  it('lists conversations across pages, and starts a chat', async () => {
    server
      .mockResolvedValueOnce(reply(200, { items: [{ id: 'a' }], nextCursor: 'n1' }))
      .mockResolvedValueOnce(reply(200, { items: [{ id: 'b' }], nextCursor: null }));
    expect((await chat.apiConversations()).map((c) => c.id)).toEqual(['a', 'b']);
    expect(sent(1).search).toContain('cursor=n1');
    server.mockResolvedValueOnce(reply(201, { id: 'c9' }));
    await chat.apiStartConversation({ kind: 'direct', userId: 'u2' });
    expect(sent(2)).toMatchObject({ method: 'POST', path: '/v1/conversations', body: { kind: 'direct', userId: 'u2' } });
  });

  it('marks read and delivered, reacts, mutes and blocks', async () => {
    server.mockResolvedValue(reply(200, { active: true, count: 1 }));
    await chat.apiMarkRead('c1', 9);
    await chat.apiMarkDelivered('c1', 9);
    await chat.apiSetReaction('c1', 'm1', '❤️', true);
    await chat.apiSetReaction('c1', 'm1', '❤️', false);
    await chat.apiMute('c1', true);
    await chat.apiSetBlocked('u2', true);
    await chat.apiSetBlocked('u2', false);
    expect(Array.from({ length: 7 }, (_, i) => `${sent(i).method} ${decodeURIComponent(sent(i).path)}`)).toEqual([
      'POST /v1/conversations/c1/read',
      'POST /v1/conversations/c1/delivered',
      'PUT /v1/conversations/c1/messages/m1/reactions/❤️',
      'DELETE /v1/conversations/c1/messages/m1/reactions/❤️',
      'PUT /v1/conversations/c1/mute',
      'PUT /v1/me/blocks/u2',
      'DELETE /v1/me/blocks/u2',
    ]);
    expect(sent(0).body).toEqual({ seq: 9 });
  });

  it('gives the live connection a fresh token from the app\'s sign-in', async () => {
    expect(await api().accessToken()).toBe('a1');
    server.mockResolvedValueOnce(reply(200, { user: {}, tokens: { ...tokens, accessToken: 'a2', refreshToken: 'r2' } }));
    await api().setTokens({ ...tokens, accessTokenExpiresAt: new Date(Date.now() + 5_000).toISOString() });
    expect(await api().accessToken()).toBe('a2'); // about to run out: refreshed first
    resetApiForTests();
    expect(await (async () => { process.env.EXPO_PUBLIC_API_URL = 'https://api.test'; return api().accessToken(); })()).toBeNull(); // nothing saved
  });
});
