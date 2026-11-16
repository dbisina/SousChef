import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { ChatEvent, Conversation, Message, ServerFrame } from '@shared';
import { ExpoPushSender, messagePreview } from '../src/chat/push';
import { makeApp, register, type TestApp } from './helpers';
import { call } from './recipeHelpers';
import { Phone, isEvent } from './wsHelpers';

let t: TestApp;
const phones: Phone[] = [];
beforeAll(async () => {
  t = await makeApp(
    { ACCESS_TOKEN_TTL_SECONDS: String(60 * 86400) },
    // Short timings so the waiting tests are quick. The heartbeat is slow: no test needs it.
    { hub: { authTimeoutMs: 300, heartbeatMs: 60_000, sessionCheckMs: 100, typingMinIntervalMs: 200 } },
  );
});
afterAll(() => t.close());
beforeEach(() => t.reset());
afterEach(() => {
  phones.splice(0).forEach((p) => p.close());
});

type Who = Awaited<ReturnType<typeof register>>;
const connect = async (who: Who): Promise<Phone> => {
  const p = await Phone.signedIn(t, who);
  phones.push(p);
  return p;
};
const newId = () => `c-${randomUUID()}`;
async function direct(a: Who, b: Who) {
  return (await call(t, 'POST', '/v1/conversations', a, { kind: 'direct', userId: b.user.id })).json<Conversation>();
}
const say = (who: Who, convo: Conversation, text: string) =>
  call(t, 'POST', `/v1/conversations/${convo.id}/messages`, who, { kind: 'text', text, clientId: newId() });
const eventOf = <T extends ChatEvent['type']>(f: ServerFrame, type: T) => (f.type === 'event' && f.event.type === type ? (f.event as Extract<ChatEvent, { type: T }>) : null);

describe('signing in to the live connection', () => {
  it('must send its token first, and is then told who it is', async () => {
    const ama = await register(t);
    const phone = await Phone.open(t);
    phones.push(phone);
    phone.send({ type: 'auth', token: ama.tokens.accessToken });
    const ready = await phone.waitFor<Extract<ServerFrame, { type: 'ready' }>>((f) => f.type === 'ready');
    expect(ready.userId).toBe(ama.user.id);
    expect(Date.parse(ready.serverTime)).not.toBeNaN();
  });

  it('closes a connection that sends a bad token', async () => {
    const phone = await Phone.open(t);
    phones.push(phone);
    phone.send({ type: 'auth', token: 'not-a-token' });
    expect(await phone.waitForClose()).toMatchObject({ code: 4401 });
    expect(phone.frames[0]).toMatchObject({ type: 'error', code: 'unauthorized' });
  });

  it('closes a connection that does anything before signing in', async () => {
    const phone = await Phone.open(t);
    phones.push(phone);
    phone.send({ type: 'ping' });
    expect(await phone.waitForClose()).toMatchObject({ code: 4401 });
  });

  it('closes a connection that never signs in', async () => {
    const phone = await Phone.open(t);
    phones.push(phone);
    expect(await phone.waitForClose()).toMatchObject({ code: 4408 });
  });

  it('closes a connection that sends something it cannot read', async () => {
    const ama = await register(t);
    const phone = await connect(ama);
    phone.ws.send('this is not json');
    expect(await phone.waitForClose()).toMatchObject({ code: 4400 });

    const other = await connect(await register(t));
    other.send({ type: 'typing', conversationId: 'nope', typing: true });
    expect(await other.waitForClose()).toMatchObject({ code: 4400 });
  });

  it('answers a ping', async () => {
    const phone = await connect(await register(t));
    phone.send({ type: 'ping' });
    await phone.waitFor((f) => f.type === 'pong');
  });

  it('lets one person connect from several phones, and drops the oldest of a sixth', async () => {
    const ama = await register(t);
    const first = await connect(ama);
    for (let i = 0; i < 4; i++) await connect(ama);
    expect(first.closed).toBeNull();
    await connect(ama);
    expect(await first.waitForClose()).toMatchObject({ code: 4409 });
  });

  it('is closed after the person logs out', async () => {
    const ama = await register(t);
    const phone = await connect(ama);
    await call(t, 'POST', '/v1/auth/logout-all', ama);
    expect(await phone.waitForClose()).toMatchObject({ code: 4401 });
  });
});

describe('live messages', () => {
  it('reaches both people the moment a message is sent, and nobody else', async () => {
    const [ama, kemi, outsider] = [await register(t), await register(t), await register(t)] as [Who, Who, Who];
    const convo = await direct(ama, kemi);
    const [phoneAma, phoneKemi, phoneOut] = [await connect(ama), await connect(kemi), await connect(outsider)] as [Phone, Phone, Phone];

    await say(ama, convo, 'Dinner at eight?');
    const atKemi = eventOf(await phoneKemi.waitFor(isEvent('message.new')), 'message.new');
    expect(atKemi?.message).toMatchObject({ kind: 'text', text: 'Dinner at eight?', seq: 1, status: null });
    const atAma = eventOf(await phoneAma.waitFor(isEvent('message.new')), 'message.new');
    expect(atAma?.message.id).toBe(atKemi?.message.id);
    await phoneOut.expectNone(isEvent('message.new'));
  });

  it('marks it delivered by itself when the other phone is connected, and the sender hears about it', async () => {
    const ama = await register(t);
    const kemi = await register(t);
    const convo = await direct(ama, kemi);
    const phoneAma = await connect(ama);
    await connect(kemi);
    await say(ama, convo, 'hello');
    const receipt = eventOf(await phoneAma.waitFor(isEvent('receipt')), 'receipt');
    expect(receipt).toMatchObject({ userId: kemi.user.id, delivered: 1 });
    const status = (await call(t, 'GET', `/v1/conversations/${convo.id}/messages`, ama)).json<{ items: Message[] }>().items[0]?.status;
    expect(status).toBe('delivered');
  });

  it('does not mark it delivered when the other person is offline', async () => {
    const ama = await register(t);
    const kemi = await register(t);
    const convo = await direct(ama, kemi);
    const phoneAma = await connect(ama);
    await say(ama, convo, 'hello');
    await phoneAma.expectNone(isEvent('receipt'), 250);
    const status = (await call(t, 'GET', `/v1/conversations/${convo.id}/messages`, ama)).json<{ items: Message[] }>().items[0]?.status;
    expect(status).toBe('sent');
  });

  it('carries reactions, deletions and read receipts', async () => {
    const ama = await register(t);
    const kemi = await register(t);
    const convo = await direct(ama, kemi);
    const phoneAma = await connect(ama);
    await connect(kemi);
    const msg = (await say(ama, convo, 'rate my plating')).json<Message>();
    await phoneAma.waitFor(isEvent('message.new'));

    await call(t, 'PUT', `/v1/conversations/${convo.id}/messages/${msg.id}/reactions/${encodeURIComponent('🔥')}`, kemi);
    expect(eventOf(await phoneAma.waitFor(isEvent('reaction')), 'reaction')).toMatchObject({ emoji: '🔥', active: true, count: 1, userId: kemi.user.id });

    await call(t, 'POST', `/v1/conversations/${convo.id}/read`, kemi, { seq: 1 });
    await phoneAma.waitFor((f) => eventOf(f, 'receipt')?.read === 1);

    await call(t, 'DELETE', `/v1/conversations/${convo.id}/messages/${msg.id}`, ama);
    expect(eventOf(await phoneAma.waitFor(isEvent('message.deleted')), 'message.deleted')).toMatchObject({ messageId: msg.id });
  });

  it('tells a person they were added to a group', async () => {
    const [ama, kemi] = [await register(t), await register(t)] as [Who, Who];
    const phoneKemi = await connect(kemi);
    const group = (await call(t, 'POST', '/v1/conversations', ama, { kind: 'group', title: 'Cooks', memberIds: [kemi.user.id] })).json<Conversation>();
    expect(eventOf(await phoneKemi.waitFor(isEvent('conversation.updated')), 'conversation.updated')?.conversationId).toBe(group.id);
  });

  it('delivers a second device\'s copy too', async () => {
    const ama = await register(t);
    const kemi = await register(t);
    const convo = await direct(ama, kemi);
    const [one, two] = [await connect(kemi), await connect(kemi)] as [Phone, Phone];
    await say(ama, convo, 'both phones');
    await one.waitFor(isEvent('message.new'));
    await two.waitFor(isEvent('message.new'));
  });

  it('accepts an acknowledgement from the phone', async () => {
    const ama = await register(t);
    const kemi = await register(t);
    const convo = await direct(ama, kemi);
    await say(ama, convo, 'one');
    const phoneAma = await connect(ama);
    const phoneKemi = await connect(kemi);
    phoneKemi.send({ type: 'ack', conversationId: convo.id, seq: 1 });
    expect(eventOf(await phoneAma.waitFor(isEvent('receipt')), 'receipt')).toMatchObject({ userId: kemi.user.id, delivered: 1 });
    phoneKemi.send({ type: 'ack', conversationId: randomUUID(), seq: 1 });
    await phoneKemi.waitFor((f) => f.type === 'error' && f.code === 'not_found');
  });
});

describe('typing and presence', () => {
  it('passes typing to the others in the conversation, but not back to the typist or to outsiders', async () => {
    const [ama, kemi, outsider] = [await register(t), await register(t), await register(t)] as [Who, Who, Who];
    const convo = await direct(ama, kemi);
    const [phoneAma, phoneKemi, phoneOut] = [await connect(ama), await connect(kemi), await connect(outsider)] as [Phone, Phone, Phone];
    phoneAma.send({ type: 'typing', conversationId: convo.id, typing: true });
    expect(await phoneKemi.waitFor((f) => f.type === 'typing')).toMatchObject({ conversationId: convo.id, userId: ama.user.id, typing: true });
    await phoneAma.expectNone((f) => f.type === 'typing');
    await phoneOut.expectNone((f) => f.type === 'typing');
  });

  it('thins out a stream of typing notices, but always passes "stopped"', async () => {
    const ama = await register(t);
    const kemi = await register(t);
    const convo = await direct(ama, kemi);
    const phoneAma = await connect(ama);
    const phoneKemi = await connect(kemi);
    for (let i = 0; i < 5; i++) phoneAma.send({ type: 'typing', conversationId: convo.id, typing: true });
    phoneAma.send({ type: 'typing', conversationId: convo.id, typing: false });
    await phoneKemi.waitFor((f) => f.type === 'typing' && !f.typing);
    expect(phoneKemi.frames.filter((f) => f.type === 'typing' && f.typing)).toHaveLength(1);
  });

  it('ignores typing in a conversation you are not in', async () => {
    const [ama, kemi, outsider] = [await register(t), await register(t), await register(t)] as [Who, Who, Who];
    const convo = await direct(ama, kemi);
    const phoneKemi = await connect(kemi);
    const phoneOut = await connect(outsider);
    phoneOut.send({ type: 'typing', conversationId: convo.id, typing: true });
    await phoneOut.waitFor((f) => f.type === 'error' && f.code === 'not_found');
    await phoneKemi.expectNone((f) => f.type === 'typing');
  });

  it('shows who is online when you connect, and tells friends when you arrive and leave', async () => {
    const ama = await register(t);
    const kemi = await register(t);
    const stranger = await register(t);
    await direct(ama, kemi);
    const phoneAma = await Phone.signedIn(t, ama);
    phones.push(phoneAma);
    const strangerPhone = await connect(stranger);

    const phoneKemi = await Phone.open(t);
    phones.push(phoneKemi);
    phoneKemi.send({ type: 'auth', token: kemi.tokens.accessToken });
    const ready = await phoneKemi.waitFor<Extract<ServerFrame, { type: 'ready' }>>((f) => f.type === 'ready');
    expect(ready.online).toEqual([ama.user.id]); // not the stranger
    expect(await phoneAma.waitFor((f) => f.type === 'presence')).toMatchObject({ userId: kemi.user.id, online: true });

    phoneKemi.close();
    await phoneAma.waitFor((f) => f.type === 'presence' && !f.online);
    await strangerPhone.expectNone((f) => f.type === 'presence');
  });

  it('says someone went offline only when their last connection closes', async () => {
    const ama = await register(t);
    const kemi = await register(t);
    await direct(ama, kemi);
    const phoneAma = await connect(ama);
    const [k1, k2] = [await connect(kemi), await connect(kemi)] as [Phone, Phone];
    await phoneAma.waitFor((f) => f.type === 'presence' && f.online);
    k1.close();
    await phoneAma.expectNone((f) => f.type === 'presence' && !f.online, 250);
    k2.close();
    await phoneAma.waitFor((f) => f.type === 'presence' && !f.online);
  });
});

describe('notifications for people who are not connected', () => {
  const token = (name: string) => `ExponentPushToken[${name}]`;
  const register_ = (who: Who, name: string) => call(t, 'PUT', '/v1/me/devices', who, { pushToken: token(name), platform: 'ios' });
  /** The notification is sent in the background after the message call returns. */
  const settle = () => new Promise((r) => setTimeout(r, 200));

  it('sends one to an offline recipient, with the sender\'s name and the message', async () => {
    const ama = await register(t, { displayName: 'Ama' });
    const kemi = await register(t);
    await register_(kemi, 'kemi-phone');
    const convo = await direct(ama, kemi);
    await say(ama, convo, 'Dinner at eight?');
    await settle();
    expect(t.push.sent).toEqual([
      { to: token('kemi-phone'), title: 'Ama', body: 'Dinner at eight?', data: { type: 'message', conversationId: convo.id, messageId: expect.any(String) } },
    ]);
  });

  it('does not send to someone who is connected, the sender, or someone who muted the chat', async () => {
    const [ama, kemi, tunde] = [await register(t, { displayName: 'Ama' }), await register(t), await register(t)] as [Who, Who, Who];
    for (const [who, name] of [[ama, 'ama'], [kemi, 'kemi'], [tunde, 'tunde']] as const) await register_(who, name);
    const group = (await call(t, 'POST', '/v1/conversations', ama, { kind: 'group', title: 'Cooks', memberIds: [kemi.user.id, tunde.user.id] })).json<Conversation>();
    await call(t, 'PUT', `/v1/conversations/${group.id}/mute`, tunde, { muted: true });
    await connect(kemi);
    await say(ama, group, 'who is cooking?');
    await settle();
    expect(t.push.sent).toEqual([]); // Ama sent it, Kemi is online, Tunde muted it
  });

  it('names the group and the sender in a group chat, and describes non-text messages', async () => {
    const [ama, kemi] = [await register(t, { displayName: 'Ama' }), await register(t)] as [Who, Who]
    await register_(kemi, 'kemi');
    const group = (await call(t, 'POST', '/v1/conversations', ama, { kind: 'group', title: 'Cooks', memberIds: [kemi.user.id] })).json<Conversation>();
    await say(ama, group, 'hi all');
    await call(t, 'POST', `/v1/conversations/${group.id}/messages`, ama, { kind: 'recipe-card', clientId: newId(), title: 'Jollof Rice', meta: '45 min' });
    await settle();
    expect(t.push.sent.map((m) => [m.title, m.body])).toEqual([['Cooks', 'Ama: hi all'], ['Cooks', 'Ama: Sent a recipe: Jollof Rice']]);
  });

  it('forgets a phone the push service says no longer exists', async () => {
    const ama = await register(t);
    const kemi = await register(t);
    await register_(kemi, 'gone');
    await register_(kemi, 'alive');
    t.push.invalid.add(token('gone'));
    const convo = await direct(ama, kemi);
    await say(ama, convo, 'ping');
    await settle();
    expect((await t.db.device.findMany({ select: { pushToken: true } })).map((d) => d.pushToken)).toEqual([token('alive')]);
  });
});

describe('Expo push service', () => {
  const log = { warn: () => undefined };
  const msg = (to: string) => ({ to, title: 't', body: 'b', data: { type: 'message' } });

  it('posts messages in batches of 100, skipping tokens that are not Expo tokens', async () => {
    const batches: unknown[][] = [];
    const fake = (async (_url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string) as unknown[];
      batches.push(body);
      return new Response(JSON.stringify({ data: body.map(() => ({ status: 'ok' })) }), { status: 200 });
    }) as unknown as typeof fetch;
    const sender = new ExpoPushSender(log, fake);
    const messages = [...Array.from({ length: 150 }, (_, i) => msg(`ExponentPushToken[${i}]`)), msg('some-fcm-token'), msg('ExpoPushToken[new-style]')];
    const result = await sender.send(messages);
    expect(result.invalidTokens).toEqual([]);
    expect(batches.map((b) => b.length)).toEqual([100, 51]);
    expect(JSON.stringify(batches)).not.toContain('some-fcm-token');
    expect(batches[0]?.[0]).toMatchObject({ sound: 'default', priority: 'high', channelId: 'messages' });
  });

  it('reports tokens whose ticket says DeviceNotRegistered, matched by position', async () => {
    const fake = (async () =>
      new Response(JSON.stringify({ data: [{ status: 'ok' }, { status: 'error', details: { error: 'DeviceNotRegistered' } }, { status: 'error', details: { error: 'MessageRateExceeded' } }] }), { status: 200 })) as unknown as typeof fetch;
    const result = await new ExpoPushSender(log, fake).send([msg('ExponentPushToken[a]'), msg('ExponentPushToken[b]'), msg('ExponentPushToken[c]')]);
    expect(result.invalidTokens).toEqual(['ExponentPushToken[b]']);
  });

  it('carries on after a failed batch, and sends the access token when there is one', async () => {
    let calls = 0;
    let auth: string | null = null;
    const fake = (async (_u: string, init: RequestInit) => {
      calls++;
      auth = (init.headers as Record<string, string>)['authorization'] ?? null;
      if (calls === 1) throw new Error('network down');
      return new Response('{}', { status: 500 });
    }) as unknown as typeof fetch;
    const messages = Array.from({ length: 120 }, (_, i) => msg(`ExponentPushToken[${i}]`));
    await expect(new ExpoPushSender(log, fake, 'secret-token').send(messages)).resolves.toEqual({ invalidTokens: [] });
    expect(calls).toBe(2);
    expect(auth).toBe('Bearer secret-token');
  });

  it('describes each kind of message briefly', () => {
    const base = { id: 'i', conversationId: 'c', seq: 1, clientId: 'x', createdAt: '', deleted: false, replyTo: null, reactions: [], status: null, sender: {} as never };
    expect(messagePreview({ ...base, kind: 'text', text: 'a'.repeat(300) })).toHaveLength(120);
    expect(messagePreview({ ...base, kind: 'voice', url: '', durationSec: 3, waveform: [] })).toBe('Voice message');
    expect(messagePreview({ ...base, kind: 'image', url: '', caption: '' })).toBe('Photo');
    expect(messagePreview({ ...base, kind: 'image', url: '', caption: 'Look' })).toBe('Photo: Look');
    expect(messagePreview({ ...base, deleted: true, kind: 'text', text: 'secret' })).toBe('Message deleted');
  });
});
