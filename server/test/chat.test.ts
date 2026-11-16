import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { ApiErrorBody, Conversation, Message, MessagePage, Page, UploadTicket } from '@shared';
import { makeApp, register, type TestApp } from './helpers';
import { call } from './recipeHelpers';

let t: TestApp;
beforeAll(async () => {
  t = await makeApp({ ACCESS_TOKEN_TTL_SECONDS: String(60 * 86400) });
});
afterAll(() => t.close());
beforeEach(() => t.reset());

type Who = Awaited<ReturnType<typeof register>>;
const newId = () => `c-${randomUUID()}`;

async function direct(a: Who, b: Who) {
  const res = await call(t, 'POST', '/v1/conversations', a, { kind: 'direct', userId: b.user.id });
  return { res, convo: res.json<Conversation>() };
}
const say = (who: Who, convo: Conversation, text: string, clientId = newId(), extra: object = {}) =>
  call(t, 'POST', `/v1/conversations/${convo.id}/messages`, who, { kind: 'text', text, clientId, ...extra });
const history = async (who: Who, convo: Conversation, query = '') =>
  (await call(t, 'GET', `/v1/conversations/${convo.id}/messages${query}`, who)).json<MessagePage>();

describe('starting a chat', () => {
  it('needs a sign-in', async () => {
    expect((await call(t, 'GET', '/v1/conversations')).statusCode).toBe(401);
  });

  it('opens a direct chat, and the same two people always get the same one', async () => {
    const ama = await register(t, { displayName: 'Ama' });
    const kemi = await register(t, { displayName: 'Kemi' });
    const first = await direct(ama, kemi);
    expect(first.res.statusCode).toBe(201);
    expect(first.convo).toMatchObject({ kind: 'direct', title: 'Kemi', unread: 0, lastSeq: 0, lastMessage: null, isAdmin: false });
    expect(first.convo.members.map((m) => m.displayName).sort()).toEqual(['Ama', 'Kemi']);

    const again = await direct(kemi, ama); // started from the other side
    expect(again.res.statusCode).toBe(200);
    expect(again.convo.id).toBe(first.convo.id);
    expect(again.convo.title).toBe('Ama');
    expect(t.events.ofType('conversation.updated')).toHaveLength(1);
  });

  it('opens it only once when both people start it at the same moment', async () => {
    const ama = await register(t);
    const kemi = await register(t);
    const [a, b] = await Promise.all([direct(ama, kemi), direct(kemi, ama)]);
    expect(a.convo.id).toBe(b.convo.id);
    expect(await t.db.conversation.count()).toBe(1);
  });

  it('refuses a chat with yourself, a stranger who does not exist, or someone who blocked you', async () => {
    const ama = await register(t);
    const kemi = await register(t);
    expect((await direct(ama, ama)).res.statusCode).toBe(400);
    expect((await call(t, 'POST', '/v1/conversations', ama, { kind: 'direct', userId: randomUUID() })).statusCode).toBe(400);
    await call(t, 'PUT', `/v1/me/blocks/${ama.user.id}`, kemi);
    const blocked = await direct(ama, kemi);
    expect(blocked.res.statusCode).toBe(403);
  });

  it('makes a group with the creator as admin', async () => {
    const [ama, kemi, tunde] = [await register(t, { displayName: 'Ama' }), await register(t, { displayName: 'Kemi' }), await register(t, { displayName: 'Tunde' })] as [Who, Who, Who];
    const res = await call(t, 'POST', '/v1/conversations', ama, { kind: 'group', title: 'Sunday cooks', memberIds: [kemi.user.id, tunde.user.id] });
    expect(res.statusCode).toBe(201);
    const group = res.json<Conversation>();
    expect(group).toMatchObject({ kind: 'group', title: 'Sunday cooks', isAdmin: true });
    expect(group.members).toHaveLength(3);
    const asKemi = (await call(t, 'GET', `/v1/conversations/${group.id}`, kemi)).json<Conversation>();
    expect(asKemi.isAdmin).toBe(false);
    expect((await call(t, 'POST', '/v1/conversations', ama, { kind: 'group', title: '', memberIds: [kemi.user.id] })).statusCode).toBe(400);
    expect((await call(t, 'POST', '/v1/conversations', ama, { kind: 'group', title: 'Ghosts', memberIds: [randomUUID()] })).statusCode).toBe(400);
  });

  it('keeps conversations private to their members', async () => {
    const [ama, kemi, outsider] = [await register(t), await register(t), await register(t)] as [Who, Who, Who];
    const { convo } = await direct(ama, kemi);
    expect((await call(t, 'GET', `/v1/conversations/${convo.id}`, outsider)).statusCode).toBe(404);
    expect((await call(t, 'GET', `/v1/conversations/${convo.id}/messages`, outsider)).statusCode).toBe(404);
    expect((await say(outsider, convo, 'hi')).statusCode).toBe(404);
    expect((await call(t, 'POST', `/v1/conversations/${convo.id}/read`, outsider, { seq: 1 })).statusCode).toBe(404);
    expect((await call(t, 'GET', '/v1/conversations', outsider)).json<Page<Conversation>>().items).toEqual([]);
  });
});

describe('sending messages', () => {
  it('numbers messages 1, 2, 3 and tells both people', async () => {
    const ama = await register(t, { displayName: 'Ama' });
    const kemi = await register(t);
    const { convo } = await direct(ama, kemi);
    const first = (await say(ama, convo, 'Hello')).json<Message>();
    const second = (await say(kemi, convo, 'Hi Ama')).json<Message>();
    expect([first.seq, second.seq]).toEqual([1, 2]);
    expect(first).toMatchObject({ kind: 'text', text: 'Hello', status: 'sent', deleted: false, reactions: [] });
    expect(first.sender.displayName).toBe('Ama');

    const live = t.events.ofType('message.new');
    expect(live).toHaveLength(2);
    expect(live[0]?.userIds.sort()).toEqual([ama.user.id, kemi.user.id].sort());
    expect(live[0]?.event.message).toMatchObject({ seq: 1, status: null, reactions: [] });
  });

  it('stores a retry once and returns the same message', async () => {
    const ama = await register(t);
    const kemi = await register(t);
    const { convo } = await direct(ama, kemi);
    const clientId = newId();
    const a = await say(ama, convo, 'Once', clientId);
    const b = await say(ama, convo, 'Once', clientId);
    expect(a.statusCode).toBe(201);
    expect(b.statusCode).toBe(200);
    expect(b.json<Message>().id).toBe(a.json<Message>().id);
    expect((await history(ama, convo)).items).toHaveLength(1);
    expect(t.events.ofType('message.new')).toHaveLength(1);
  });

  it('keeps numbers gapless and unique when many messages are sent at once', async () => {
    const ama = await register(t);
    const kemi = await register(t);
    const { convo } = await direct(ama, kemi);
    const results = await Promise.all(Array.from({ length: 20 }, (_, i) => say(i % 2 ? ama : kemi, convo, `m${i}`)));
    expect(results.every((r) => r.statusCode === 201)).toBe(true);
    const seqs = (await history(ama, convo, '?limit=100')).items.map((m) => m.seq);
    expect(seqs).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
    expect((await call(t, 'GET', `/v1/conversations/${convo.id}`, ama)).json<Conversation>().lastSeq).toBe(20);
  });

  it('survives the same retry arriving twice at the same moment', async () => {
    const ama = await register(t);
    const kemi = await register(t);
    const { convo } = await direct(ama, kemi);
    const clientId = newId();
    const results = await Promise.all(Array.from({ length: 6 }, () => say(ama, convo, 'Race', clientId)));
    expect(new Set(results.map((r) => r.json<Message>().id)).size).toBe(1);
    expect((await history(ama, convo)).items).toHaveLength(1);
  });

  it('refuses empty text, a short client id, and a reply to a message elsewhere', async () => {
    const [ama, kemi, tunde] = [await register(t), await register(t), await register(t)] as [Who, Who, Who];
    const { convo } = await direct(ama, kemi);
    const other = (await direct(ama, tunde)).convo;
    const elsewhere = (await say(ama, other, 'over here')).json<Message>();
    expect((await say(ama, convo, '   ')).statusCode).toBe(400);
    expect((await say(ama, convo, 'x', 'short')).statusCode).toBe(400);
    expect((await say(ama, convo, 'x', newId(), { replyToId: elsewhere.id })).statusCode).toBe(400);
  });

  it('refuses a message between people once one has blocked the other', async () => {
    const ama = await register(t);
    const kemi = await register(t);
    const { convo } = await direct(ama, kemi);
    expect((await say(ama, convo, 'before')).statusCode).toBe(201);
    await call(t, 'PUT', `/v1/me/blocks/${kemi.user.id}`, ama);
    expect((await say(ama, convo, 'after')).statusCode).toBe(403);
    expect((await say(kemi, convo, 'after too')).statusCode).toBe(403);
    await call(t, 'DELETE', `/v1/me/blocks/${kemi.user.id}`, ama);
    expect((await say(kemi, convo, 'friends again')).statusCode).toBe(201);
  });

  it('slows down someone sending far too fast', async () => {
    const ama = await register(t);
    const kemi = await register(t);
    const { convo } = await direct(ama, kemi);
    const statuses: number[] = [];
    for (let i = 0; i < 32; i++) statuses.push((await say(ama, convo, `spam ${i}`)).statusCode);
    expect(statuses.slice(0, 30).every((s) => s === 201)).toBe(true);
    expect(statuses.slice(30)).toEqual([429, 429]);
    // After the window passes they can send again.
    t.advance(11_000);
    expect((await say(ama, convo, 'calm now')).statusCode).toBe(201);
  });

  it('sends a recipe card', async () => {
    const ama = await register(t);
    const kemi = await register(t);
    const { convo } = await direct(ama, kemi);
    const res = await call(t, 'POST', `/v1/conversations/${convo.id}/messages`, ama, {
      kind: 'recipe-card', clientId: newId(), title: 'Jollof Rice', meta: '45 min · Medium', photoUrl: 'https://img.example.com/j.jpg',
    });
    expect(res.json<Message>()).toMatchObject({ kind: 'recipe-card', title: 'Jollof Rice', recipeId: null, photoUrl: 'https://img.example.com/j.jpg' });
  });
});

describe('voice notes and photos', () => {
  async function upload(who: Who, purpose: string, contentType: string): Promise<UploadTicket> {
    const ticket = (await call(t, 'POST', '/v1/uploads', who, { purpose, contentType, size: 5000 })).json<UploadTicket>();
    t.storage.put(new URL(ticket.publicUrl).pathname.slice(1), 5000, contentType);
    await call(t, 'POST', `/v1/uploads/${ticket.id}/complete`, who);
    return ticket;
  }

  it('sends a voice note from the sender\'s own finished voice upload', async () => {
    const ama = await register(t);
    const kemi = await register(t);
    const { convo } = await direct(ama, kemi);
    const voice = await upload(ama, 'voice', 'audio/mp4');
    const res = await call(t, 'POST', `/v1/conversations/${convo.id}/messages`, ama, { kind: 'voice', clientId: newId(), uploadId: voice.id, durationSec: 12, waveform: [10, 40, 80, 30] });
    expect(res.statusCode).toBe(201);
    expect(res.json<Message>()).toMatchObject({ kind: 'voice', url: voice.publicUrl, durationSec: 12, waveform: [10, 40, 80, 30] });
  });

  it('sends a photo, with a caption', async () => {
    const ama = await register(t);
    const kemi = await register(t);
    const { convo } = await direct(ama, kemi);
    const photo = await upload(ama, 'chat_image', 'image/jpeg');
    const res = await call(t, 'POST', `/v1/conversations/${convo.id}/messages`, ama, { kind: 'image', clientId: newId(), uploadId: photo.id, caption: 'Look at this' });
    expect(res.json<Message>()).toMatchObject({ kind: 'image', url: photo.publicUrl, caption: 'Look at this' });
  });

  it('refuses an upload that is unfinished, someone else\'s, or the wrong kind', async () => {
    const ama = await register(t);
    const kemi = await register(t);
    const { convo } = await direct(ama, kemi);
    const pending = (await call(t, 'POST', '/v1/uploads', ama, { purpose: 'voice', contentType: 'audio/mp4', size: 100 })).json<UploadTicket>();
    const hers = await upload(kemi, 'voice', 'audio/mp4');
    const photo = await upload(ama, 'chat_image', 'image/png');
    const send = (uploadId: string, kind = 'voice') =>
      call(t, 'POST', `/v1/conversations/${convo.id}/messages`, ama, { kind, clientId: newId(), uploadId, durationSec: 5, waveform: [] });
    expect((await send(pending.id)).statusCode).toBe(400);
    expect((await send(hers.id)).statusCode).toBe(400);
    expect((await send(photo.id)).statusCode).toBe(400); // a photo is not a voice note
    expect((await send(randomUUID())).statusCode).toBe(400);
  });
});

describe('reading history and catching up', () => {
  async function talk(count: number) {
    const ama = await register(t);
    const kemi = await register(t);
    const { convo } = await direct(ama, kemi);
    for (let i = 1; i <= count; i++) await say(i % 2 ? ama : kemi, convo, `message ${i}`);
    return { ama, kemi, convo };
  }

  it('gives the latest messages oldest first, and pages back with beforeSeq', async () => {
    const { ama, convo } = await talk(7);
    const latest = await history(ama, convo, '?limit=3');
    expect(latest.items.map((m) => m.seq)).toEqual([5, 6, 7]);
    expect(latest.hasMore).toBe(true);
    const older = await history(ama, convo, '?limit=3&beforeSeq=5');
    expect(older.items.map((m) => m.seq)).toEqual([2, 3, 4]);
    const oldest = await history(ama, convo, '?limit=3&beforeSeq=2');
    expect(oldest.items.map((m) => m.seq)).toEqual([1]);
    expect(oldest.hasMore).toBe(false);
  });

  it('catches up with everything after a number, oldest first', async () => {
    const { kemi, convo } = await talk(7);
    const missed = await history(kemi, convo, '?afterSeq=4&limit=2');
    expect(missed.items.map((m) => m.seq)).toEqual([5, 6]);
    expect(missed.hasMore).toBe(true);
    const rest = await history(kemi, convo, '?afterSeq=6');
    expect(rest.items.map((m) => m.seq)).toEqual([7]);
    expect(rest.hasMore).toBe(false);
    expect((await history(kemi, convo, '?afterSeq=7')).items).toEqual([]);
    expect((await call(t, 'GET', `/v1/conversations/${convo.id}/messages?afterSeq=1&beforeSeq=5`, kemi)).statusCode).toBe(400);
  });
});

describe('read and delivery', () => {
  it('counts unread, clears it when read, and shows ticks to the sender', async () => {
    const ama = await register(t);
    const kemi = await register(t);
    const { convo } = await direct(ama, kemi);
    await say(ama, convo, 'one');
    await say(ama, convo, 'two');
    const three = (await say(ama, convo, 'three')).json<Message>();

    const list = (await call(t, 'GET', '/v1/conversations', kemi)).json<Page<Conversation>>().items;
    expect(list[0]).toMatchObject({ unread: 3, lastSeq: 3 });
    expect(list[0]?.lastMessage).toMatchObject({ preview: 'three', senderId: ama.user.id });
    expect((await call(t, 'GET', '/v1/conversations', ama)).json<Page<Conversation>>().items[0]?.unread).toBe(0); // their own

    expect((await history(ama, convo)).items.map((m) => m.status)).toEqual(['sent', 'sent', 'sent']);
    await call(t, 'POST', `/v1/conversations/${convo.id}/delivered`, kemi, { seq: 2 });
    expect((await history(ama, convo)).items.map((m) => m.status)).toEqual(['delivered', 'delivered', 'sent']);
    t.events.published.length = 0;
    expect((await call(t, 'POST', `/v1/conversations/${convo.id}/read`, kemi, { seq: 3 })).statusCode).toBe(204);
    expect((await history(ama, convo)).items.map((m) => m.status)).toEqual(['read', 'read', 'read']);
    expect((await call(t, 'GET', `/v1/conversations/${convo.id}`, kemi)).json<Conversation>().unread).toBe(0);
    expect(t.events.ofType('receipt')[0]?.event).toMatchObject({ userId: kemi.user.id, read: 3, delivered: 3 });
    expect(three.status).toBe('sent');
  });

  it('never moves backwards or past the latest message, and says nothing when nothing changed', async () => {
    const ama = await register(t);
    const kemi = await register(t);
    const { convo } = await direct(ama, kemi);
    await say(ama, convo, 'one');
    await say(ama, convo, 'two');
    await call(t, 'POST', `/v1/conversations/${convo.id}/read`, kemi, { seq: 99 });
    expect((await call(t, 'GET', `/v1/conversations/${convo.id}`, kemi)).json<Conversation>().unread).toBe(0);
    t.events.published.length = 0;
    await call(t, 'POST', `/v1/conversations/${convo.id}/read`, kemi, { seq: 1 });
    expect(t.events.ofType('receipt')).toHaveLength(0);
    expect((await call(t, 'GET', `/v1/conversations/${convo.id}`, kemi)).json<Conversation>().unread).toBe(0);
  });

  it('shows "read" in a group only when everyone else has read it', async () => {
    const [ama, kemi, tunde] = [await register(t), await register(t), await register(t)] as [Who, Who, Who];
    const group = (await call(t, 'POST', '/v1/conversations', ama, { kind: 'group', title: 'Cooks', memberIds: [kemi.user.id, tunde.user.id] })).json<Conversation>();
    await say(ama, group, 'dinner?');
    const status = async () => (await history(ama, group)).items[0]?.status;
    await call(t, 'POST', `/v1/conversations/${group.id}/read`, kemi, { seq: 1 });
    expect(await status()).toBe('sent'); // Tunde's phone does not have it yet
    await call(t, 'POST', `/v1/conversations/${group.id}/delivered`, tunde, { seq: 1 });
    expect(await status()).toBe('delivered'); // everyone's phone has it, but only Kemi has read it
    await call(t, 'POST', `/v1/conversations/${group.id}/read`, tunde, { seq: 1 });
    expect(await status()).toBe('read');
  });

  it('orders the conversation list by the latest message', async () => {
    const [ama, kemi, tunde] = [await register(t, { displayName: 'Ama' }), await register(t, { displayName: 'Kemi' }), await register(t, { displayName: 'Tunde' })] as [Who, Who, Who];
    const withKemi = (await direct(ama, kemi)).convo;
    const withTunde = (await direct(ama, tunde)).convo;
    await say(ama, withKemi, 'first');
    await say(ama, withTunde, 'second');
    expect((await call(t, 'GET', '/v1/conversations', ama)).json<Page<Conversation>>().items.map((c) => c.title)).toEqual(['Tunde', 'Kemi']);
    await say(ama, withKemi, 'third');
    const page1 = (await call(t, 'GET', '/v1/conversations?limit=1', ama)).json<Page<Conversation>>();
    expect(page1.items.map((c) => c.title)).toEqual(['Kemi']);
    const page2 = (await call(t, 'GET', `/v1/conversations?limit=1&cursor=${page1.nextCursor}`, ama)).json<Page<Conversation>>();
    expect(page2.items.map((c) => c.title)).toEqual(['Tunde']);
    expect(page2.nextCursor).toBeNull();
  });
});

describe('reactions, replies and deleting', () => {
  it('adds and removes reactions, grouped with counts and "mine"', async () => {
    const ama = await register(t);
    const kemi = await register(t);
    const { convo } = await direct(ama, kemi);
    const msg = (await say(ama, convo, 'nice')).json<Message>();
    const react = (who: Who, emoji: string, method: 'PUT' | 'DELETE' = 'PUT') =>
      call(t, method, `/v1/conversations/${convo.id}/messages/${msg.id}/reactions/${encodeURIComponent(emoji)}`, who);

    expect((await react(kemi, '❤️')).statusCode).toBe(204);
    await react(kemi, '❤️'); // again: no change
    await react(ama, '❤️');
    await react(ama, '🔥');
    const asKemi = (await history(kemi, convo)).items[0] as Message;
    expect(asKemi.reactions).toEqual([{ emoji: '❤️', count: 2, mine: true }, { emoji: '🔥', count: 1, mine: false }]);

    await react(kemi, '❤️', 'DELETE');
    expect(((await history(ama, convo)).items[0] as Message).reactions).toEqual([{ emoji: '❤️', count: 1, mine: true }, { emoji: '🔥', count: 1, mine: true }]);
    const events = t.events.ofType('reaction');
    expect(events.map((e) => [e.event.emoji, e.event.active, e.event.count])).toEqual([['❤️', true, 1], ['❤️', true, 2], ['🔥', true, 1], ['❤️', false, 1]]);
  });

  it('accepts one emoji only', async () => {
    const ama = await register(t);
    const kemi = await register(t);
    const { convo } = await direct(ama, kemi);
    const msg = (await say(ama, convo, 'x')).json<Message>();
    const put = (e: string) => call(t, 'PUT', `/v1/conversations/${convo.id}/messages/${msg.id}/reactions/${encodeURIComponent(e)}`, kemi);
    expect((await put('😂')).statusCode).toBe(204);
    expect((await put('👍🏽')).statusCode).toBe(204); // skin tone is still one emoji
    expect((await put('🇳🇬')).statusCode).toBe(204); // so is a flag
    expect((await put('1️⃣')).statusCode).toBe(204); // and a keycap
    expect((await put('ab')).statusCode).toBe(400);
    expect((await put('😂😂')).statusCode).toBe(400);
    expect((await put('A')).statusCode).toBe(400);
  });

  it('shows what a reply answers', async () => {
    const ama = await register(t);
    const kemi = await register(t);
    const { convo } = await direct(ama, kemi);
    const original = (await say(ama, convo, 'Which rice should I buy for jollof?')).json<Message>();
    const reply = (await say(kemi, convo, 'Basmati', newId(), { replyToId: original.id })).json<Message>();
    expect(reply.replyTo).toEqual({ id: original.id, senderId: ama.user.id, preview: 'Which rice should I buy for jollof?' });
  });

  it('lets the sender delete a message, keeps its place in the order, and leaves the content gone', async () => {
    const ama = await register(t);
    const kemi = await register(t);
    const { convo } = await direct(ama, kemi);
    const secret = (await say(ama, convo, 'my password is hunter2')).json<Message>();
    await say(kemi, convo, 'ok');
    expect((await call(t, 'DELETE', `/v1/conversations/${convo.id}/messages/${secret.id}`, kemi)).statusCode).toBe(403);
    expect((await call(t, 'DELETE', `/v1/conversations/${convo.id}/messages/${secret.id}`, ama)).statusCode).toBe(204);
    expect((await call(t, 'DELETE', `/v1/conversations/${convo.id}/messages/${secret.id}`, ama)).statusCode).toBe(204); // again: fine

    const items = (await history(kemi, convo)).items;
    expect(items.map((m) => m.seq)).toEqual([1, 2]);
    expect(items[0]).toMatchObject({ deleted: true, kind: 'text', text: '' });
    expect(JSON.stringify(items)).not.toContain('hunter2');
    expect(await t.db.message.findFirst({ where: { id: secret.id } })).toMatchObject({ body: {} });
    expect(t.events.ofType('message.deleted')).toHaveLength(1); // the repeat delete changed nothing, so said nothing
    expect((await call(t, 'GET', '/v1/conversations', kemi)).json<Page<Conversation>>().items[0]?.lastMessage?.preview).toBe('ok');
  });
});

describe('groups', () => {
  async function setup() {
    const [ama, kemi, tunde, ife] = [await register(t, { displayName: 'Ama' }), await register(t, { displayName: 'Kemi' }), await register(t, { displayName: 'Tunde' }), await register(t, { displayName: 'Ife' })] as [Who, Who, Who, Who];
    const group = (await call(t, 'POST', '/v1/conversations', ama, { kind: 'group', title: 'Cooks', memberIds: [kemi.user.id] })).json<Conversation>();
    return { ama, kemi, tunde, ife, group };
  }

  it('lets only an admin rename, add and remove', async () => {
    const { ama, kemi, tunde, group } = await setup();
    expect((await call(t, 'PATCH', `/v1/conversations/${group.id}`, kemi, { title: 'Mine' })).statusCode).toBe(403);
    expect((await call(t, 'POST', `/v1/conversations/${group.id}/members`, kemi, { userIds: [tunde.user.id] })).statusCode).toBe(403);
    expect((await call(t, 'PATCH', `/v1/conversations/${group.id}`, ama, { title: 'Cooks United' })).json<Conversation>().title).toBe('Cooks United');
    const added = (await call(t, 'POST', `/v1/conversations/${group.id}/members`, ama, { userIds: [tunde.user.id, tunde.user.id] })).json<Conversation>();
    expect(added.members).toHaveLength(3);
    expect((await call(t, 'DELETE', `/v1/conversations/${group.id}/members/${tunde.user.id}`, kemi)).statusCode).toBe(403);
    expect((await call(t, 'DELETE', `/v1/conversations/${group.id}/members/${tunde.user.id}`, ama)).statusCode).toBe(204);
    expect((await call(t, 'GET', `/v1/conversations/${group.id}`, tunde)).statusCode).toBe(404);
  });

  it('lets anyone leave, and hands the group to someone else if the last admin goes', async () => {
    const { ama, kemi, group } = await setup();
    expect((await call(t, 'DELETE', `/v1/conversations/${group.id}/members/${ama.user.id}`, ama)).statusCode).toBe(204);
    expect((await call(t, 'GET', `/v1/conversations/${group.id}`, ama)).statusCode).toBe(404);
    expect((await call(t, 'GET', `/v1/conversations/${group.id}`, kemi)).json<Conversation>().isAdmin).toBe(true);
    expect((await call(t, 'DELETE', `/v1/conversations/${group.id}/members/${kemi.user.id}`, kemi)).statusCode).toBe(204);
    expect(await t.db.conversation.count()).toBe(0); // the last person left
  });

  it('does not let a direct chat be changed or left', async () => {
    const ama = await register(t);
    const kemi = await register(t);
    const { convo } = await direct(ama, kemi);
    expect((await call(t, 'PATCH', `/v1/conversations/${convo.id}`, ama, { title: 'x' })).statusCode).toBe(400);
    expect((await call(t, 'DELETE', `/v1/conversations/${convo.id}/members/${ama.user.id}`, ama)).statusCode).toBe(400);
  });

  it('mutes a conversation for one person only', async () => {
    const { ama, kemi, group } = await setup();
    expect((await call(t, 'PUT', `/v1/conversations/${group.id}/mute`, kemi, { muted: true })).statusCode).toBe(204);
    expect((await call(t, 'GET', `/v1/conversations/${group.id}`, kemi)).json<Conversation>().muted).toBe(true);
    expect((await call(t, 'GET', `/v1/conversations/${group.id}`, ama)).json<Conversation>().muted).toBe(false);
  });

  it('tells everyone involved when the group changes', async () => {
    const { ama, tunde, group } = await setup();
    t.events.published.length = 0;
    await call(t, 'POST', `/v1/conversations/${group.id}/members`, ama, { userIds: [tunde.user.id] });
    const updates = t.events.ofType('conversation.updated');
    expect(updates).toHaveLength(1);
    expect(updates[0]?.userIds).toContain(tunde.user.id);
  });
});

describe('blocking', () => {
  it('lists, blocks and unblocks, and refuses blocking yourself or a stranger', async () => {
    const ama = await register(t, { displayName: 'Ama' });
    const kemi = await register(t, { displayName: 'Kemi' });
    expect((await call(t, 'PUT', `/v1/me/blocks/${kemi.user.id}`, ama)).statusCode).toBe(204);
    await call(t, 'PUT', `/v1/me/blocks/${kemi.user.id}`, ama); // again: fine
    const list = (await call(t, 'GET', '/v1/me/blocks', ama)).json<{ items: { user: { displayName: string } }[] }>().items;
    expect(list.map((b) => b.user.displayName)).toEqual(['Kemi']);
    expect((await call(t, 'GET', '/v1/me/blocks', kemi)).json<{ items: unknown[] }>().items).toEqual([]);
    expect((await call(t, 'PUT', `/v1/me/blocks/${ama.user.id}`, ama)).statusCode).toBe(400);
    expect((await call(t, 'PUT', `/v1/me/blocks/${randomUUID()}`, ama)).statusCode).toBe(400);
    expect((await call(t, 'DELETE', `/v1/me/blocks/${kemi.user.id}`, ama)).statusCode).toBe(204);
    expect((await call(t, 'GET', '/v1/me/blocks', ama)).json<{ items: unknown[] }>().items).toEqual([]);
  });
});

describe('deleting an account', () => {
  it('removes the person\'s messages and memberships, and keeps the other person\'s side', async () => {
    const ama = await register(t);
    const kemi = await register(t);
    const { convo } = await direct(ama, kemi);
    await say(ama, convo, 'from Ama');
    await say(kemi, convo, 'from Kemi');
    expect((await call(t, 'DELETE', '/v1/me', ama, { password: 'correct horse battery' })).statusCode).toBe(204);
    expect(await t.db.message.count({ where: { senderId: ama.user.id } })).toBe(0);
    // Ama's message is gone; Kemi's stays, with its original number.
    expect((await history(kemi, convo)).items.map((m) => m.seq)).toEqual([2]);
  });
});

describe('unexpected input', () => {
  it('answers a malformed id with a 400 and an error body', async () => {
    const ama = await register(t);
    const res = await call(t, 'GET', '/v1/conversations/not-an-id', ama);
    expect(res.statusCode).toBe(400);
    expect(res.json<ApiErrorBody>().error.code).toBe('validation_error');
  });
});
