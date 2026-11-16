import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Challenge, Community, CommunityEvent, CommunityMember, CommunitySummary, Conversation, JoinCommunityResponse, Page, Post } from '@shared';
import { DAY_MS, makeApp, register, type TestApp } from './helpers';
import { call, makeAdmin } from './recipeHelpers';
import { finishedUpload, newId } from './socialHelpers';

let t: TestApp;
beforeAll(async () => {
  t = await makeApp({ ACCESS_TOKEN_TTL_SECONDS: String(60 * 86400) });
});
afterAll(() => t.close());
beforeEach(() => t.reset());

type Who = Awaited<ReturnType<typeof register>>;
const inDays = (n: number) => new Date(Date.now() + n * DAY_MS).toISOString();

async function make(owner: Who, overrides: Record<string, unknown> = {}): Promise<Community> {
  const res = await call(t, 'POST', '/v1/communities', owner, { name: 'Jollof Lovers', description: 'All about jollof', visibility: 'public', ...overrides });
  if (res.statusCode !== 201) throw new Error(`create community failed: ${res.statusCode} ${res.body}`);
  return res.json<Community>();
}
const join = (who: Who, c: Community) => call(t, 'POST', `/v1/communities/${c.id}/join`, who);
const members = async (who: Who, c: Community, query = '') => (await call(t, 'GET', `/v1/communities/${c.id}/members${query}`, who)).json<Page<CommunityMember>>();
const get = async (who: Who | undefined, c: Community) => (await call(t, 'GET', `/v1/communities/${c.id}`, who)).json<Community>();

describe('creating', () => {
  it('makes you the owner and gives the community a chat room with you in it', async () => {
    const ama = await register(t);
    const photo = await finishedUpload(t, ama, 'avatar', 'image/png');
    const c = await make(ama, { photoUploadId: photo.id });
    expect(c).toMatchObject({ name: 'Jollof Lovers', visibility: 'public', memberCount: 1, photoUrl: photo.publicUrl, viewer: { status: 'member', role: 'owner' } });
    expect(c.conversationId).not.toBeNull();
    const room = (await call(t, 'GET', `/v1/conversations/${c.conversationId}`, ama)).json<Conversation>();
    expect(room).toMatchObject({ kind: 'community', title: 'Jollof Lovers', isAdmin: true });
  });

  it('needs a sign-in and sensible input, and limits how many a person starts', async () => {
    const ama = await register(t);
    expect((await call(t, 'POST', '/v1/communities', undefined, { name: 'Nope', visibility: 'public' })).statusCode).toBe(401);
    expect((await call(t, 'POST', '/v1/communities', ama, { name: 'ab', visibility: 'public' })).statusCode).toBe(400);
    expect((await call(t, 'POST', '/v1/communities', ama, { name: 'Fine name', visibility: 'secret' })).statusCode).toBe(400);
    expect((await call(t, 'POST', '/v1/communities', ama, { name: 'Fine name', visibility: 'public', photoUploadId: randomUUID() })).statusCode).toBe(400);
    await t.db.community.createMany({ data: Array.from({ length: 10 }, (_, i) => ({ name: `c${i}`, createdById: ama.user.id })) });
    expect((await call(t, 'POST', '/v1/communities', ama, { name: 'One too many', visibility: 'public' })).statusCode).toBe(409);
  });
});

describe('joining and leaving', () => {
  it('lets anyone join a public community at once, and counts them once', async () => {
    const [ama, kemi] = [await register(t), await register(t)] as [Who, Who];
    const c = await make(ama);
    expect((await join(kemi, c)).json<JoinCommunityResponse>()).toEqual({ status: 'member' });
    expect((await join(kemi, c)).json<JoinCommunityResponse>()).toEqual({ status: 'member' });
    const seen = await get(kemi, c);
    expect(seen).toMatchObject({ memberCount: 2, viewer: { status: 'member', role: 'member' } });
    expect(seen.conversationId).toBe(c.conversationId);
    expect((await call(t, 'POST', `/v1/communities/${c.id}/join`)).statusCode).toBe(401);
    expect((await call(t, 'POST', `/v1/communities/${randomUUID()}/join`, kemi)).statusCode).toBe(404);
  });

  it('counts exactly when many people join at once', async () => {
    const ama = await register(t);
    const c = await make(ama);
    const crowd = await Promise.all(Array.from({ length: 8 }, () => register(t)));
    await Promise.all(crowd.flatMap((p) => [join(p, c), join(p, c)]));
    expect((await get(ama, c)).memberCount).toBe(9);
  });

  it('puts the new member in the chat room, and takes them out when they leave', async () => {
    const [ama, kemi] = [await register(t), await register(t)] as [Who, Who];
    const c = await make(ama);
    await join(kemi, c);
    expect((await call(t, 'GET', `/v1/conversations/${c.conversationId}`, kemi)).statusCode).toBe(200);
    expect((await call(t, 'DELETE', `/v1/communities/${c.id}/membership`, kemi)).statusCode).toBe(204);
    expect((await call(t, 'GET', `/v1/conversations/${c.conversationId}`, kemi)).statusCode).toBe(404);
    expect((await get(ama, c)).memberCount).toBe(1);
    expect((await call(t, 'DELETE', `/v1/communities/${c.id}/membership`, kemi)).statusCode).toBe(404);
  });

  it('does not let the owner leave', async () => {
    const ama = await register(t);
    const c = await make(ama);
    expect((await call(t, 'DELETE', `/v1/communities/${c.id}/membership`, ama)).statusCode).toBe(400);
  });

  it('holds a request to join a private community until an admin approves it', async () => {
    const [ama, kemi] = [await register(t), await register(t, { displayName: 'Kemi' })] as [Who, Who];
    const c = await make(ama, { visibility: 'private' });
    expect((await join(kemi, c)).json<JoinCommunityResponse>()).toEqual({ status: 'pending' });
    const waiting = await get(kemi, c);
    expect(waiting).toMatchObject({ memberCount: 1, conversationId: null, viewer: { status: 'pending' } });
    expect((await call(t, 'GET', `/v1/conversations/${c.conversationId}`, kemi)).statusCode).toBe(404);

    expect((await members(ama, c, '?pending=true')).items.map((m) => m.user.displayName)).toEqual(['Kemi']);
    expect((await call(t, 'POST', `/v1/communities/${c.id}/members/${kemi.user.id}/approve`, kemi)).statusCode).toBe(403);
    expect((await call(t, 'POST', `/v1/communities/${c.id}/members/${kemi.user.id}/approve`, ama)).statusCode).toBe(204);
    expect(await get(kemi, c)).toMatchObject({ memberCount: 2, conversationId: c.conversationId, viewer: { status: 'member' } });
    expect((await call(t, 'GET', `/v1/conversations/${c.conversationId}`, kemi)).statusCode).toBe(200);
    expect((await call(t, 'POST', `/v1/communities/${c.id}/members/${kemi.user.id}/approve`, ama)).statusCode).toBe(404); // nothing left to approve
  });

  it('lets a person withdraw a request, and an admin turn one down', async () => {
    const [ama, kemi, tunde] = [await register(t), await register(t), await register(t)] as [Who, Who, Who];
    const c = await make(ama, { visibility: 'private' });
    await join(kemi, c);
    await join(tunde, c);
    expect((await call(t, 'DELETE', `/v1/communities/${c.id}/membership`, kemi)).statusCode).toBe(204);
    expect((await call(t, 'DELETE', `/v1/communities/${c.id}/members/${tunde.user.id}`, ama)).statusCode).toBe(204);
    expect((await members(ama, c, '?pending=true')).items).toEqual([]);
    expect((await get(ama, c)).memberCount).toBe(1);
  });
});

describe('who can see what', () => {
  it('shows a private community\'s name to everyone but its members, posts, challenges and events only to members', async () => {
    const [ama, kemi, outsider] = [await register(t), await register(t), await register(t)] as [Who, Who, Who];
    const c = await make(ama, { visibility: 'private' });
    await join(kemi, c);
    await call(t, 'POST', `/v1/communities/${c.id}/members/${kemi.user.id}/approve`, ama);
    await call(t, 'POST', `/v1/communities/${c.id}/events`, ama, { title: 'Cook-along', startsAt: inDays(3) });

    expect((await get(outsider, c)).name).toBe('Jollof Lovers');
    expect((await call(t, 'GET', `/v1/communities/${c.id}/members`, outsider)).statusCode).toBe(404);
    expect((await call(t, 'GET', `/v1/communities/${c.id}/posts`, outsider)).statusCode).toBe(404);
    expect((await call(t, 'GET', `/v1/communities/${c.id}/events`, outsider)).statusCode).toBe(404);
    expect((await call(t, 'GET', `/v1/communities/${c.id}/challenges`)).statusCode).toBe(404);
    expect((await call(t, 'GET', `/v1/communities/${c.id}/events`, kemi)).json<{ items: CommunityEvent[] }>().items).toHaveLength(1);
    expect((await call(t, 'GET', `/v1/communities/${c.id}/members`, kemi)).statusCode).toBe(200);
  });

  it('lists public communities, plus private ones you are in, and finds them by name', async () => {
    const [ama, kemi] = [await register(t), await register(t)] as [Who, Who];
    const open = await make(ama, { name: 'Open Kitchen' });
    const closed = await make(ama, { name: 'Closed Kitchen', visibility: 'private' });
    await make(ama, { name: 'Baking Club' });
    const names = async (who: Who | undefined, q = '') => (await call(t, 'GET', `/v1/communities${q}`, who)).json<Page<CommunitySummary>>().items.map((c) => c.name);

    expect(await names(kemi)).toEqual(['Baking Club', 'Open Kitchen']);
    expect(await names(undefined)).toEqual(['Baking Club', 'Open Kitchen']);
    expect(await names(ama)).toEqual(['Baking Club', 'Closed Kitchen', 'Open Kitchen']);
    expect(await names(ama, '?q=kitchen')).toEqual(['Closed Kitchen', 'Open Kitchen']);
    await join(kemi, closed); // asking is enough to see it listed
    expect(await names(kemi)).toContain('Closed Kitchen');
    expect(open.id).toBeTruthy();
    const page1 = (await call(t, 'GET', '/v1/communities?limit=2', ama)).json<Page<CommunitySummary>>();
    expect((await call(t, 'GET', `/v1/communities?limit=2&cursor=${page1.nextCursor}`, ama)).json<Page<CommunitySummary>>().items).toHaveLength(1);
  });

  it('lists the communities you belong to', async () => {
    const [ama, kemi] = [await register(t), await register(t)] as [Who, Who];
    const a = await make(ama, { name: 'First' });
    await make(ama, { name: 'Second' });
    await join(kemi, a);
    expect((await call(t, 'GET', '/v1/me/communities', kemi)).json<{ items: CommunitySummary[] }>().items.map((c) => c.name)).toEqual(['First']);
    expect((await call(t, 'GET', '/v1/me/communities', ama)).json<{ items: CommunitySummary[] }>().items).toHaveLength(2);
  });
});

describe('running a community', () => {
  it('lets an admin edit it, which renames the chat room too', async () => {
    const [ama, kemi] = [await register(t), await register(t)] as [Who, Who];
    const c = await make(ama);
    await join(kemi, c);
    expect((await call(t, 'PATCH', `/v1/communities/${c.id}`, kemi, { name: 'Hijacked' })).statusCode).toBe(403);
    const edited = (await call(t, 'PATCH', `/v1/communities/${c.id}`, ama, { name: 'Jollof Fans', visibility: 'private' })).json<Community>();
    expect(edited).toMatchObject({ name: 'Jollof Fans', visibility: 'private' });
    expect((await call(t, 'GET', `/v1/conversations/${c.conversationId}`, ama)).json<Conversation>().title).toBe('Jollof Fans');
    expect((await call(t, 'PATCH', `/v1/communities/${c.id}`, ama, {})).statusCode).toBe(400);
  });

  it('lets the owner make admins; admins can approve and remove members but not other admins', async () => {
    const [owner, admin, other, member] = [await register(t), await register(t), await register(t), await register(t)] as [Who, Who, Who, Who];
    const c = await make(owner);
    for (const p of [admin, other, member]) await join(p, c);
    expect((await call(t, 'PUT', `/v1/communities/${c.id}/members/${admin.user.id}/role`, admin, { role: 'admin' })).statusCode).toBe(403); // not yours to give
    expect((await call(t, 'PUT', `/v1/communities/${c.id}/members/${admin.user.id}/role`, owner, { role: 'admin' })).statusCode).toBe(204);
    await call(t, 'PUT', `/v1/communities/${c.id}/members/${other.user.id}/role`, owner, { role: 'admin' });
    expect((await call(t, 'DELETE', `/v1/communities/${c.id}/members/${other.user.id}`, admin)).statusCode).toBe(403); // an admin cannot remove an admin
    expect((await call(t, 'DELETE', `/v1/communities/${c.id}/members/${owner.user.id}`, admin)).statusCode).toBe(403); // nor the owner
    expect((await call(t, 'DELETE', `/v1/communities/${c.id}/members/${member.user.id}`, admin)).statusCode).toBe(204);
    expect((await call(t, 'DELETE', `/v1/communities/${c.id}/members/${other.user.id}`, owner)).statusCode).toBe(204);
    expect((await call(t, 'PUT', `/v1/communities/${c.id}/members/${owner.user.id}/role`, owner, { role: 'member' })).statusCode).toBe(400);
    expect((await get(owner, c)).memberCount).toBe(2);
    // The chat room reflects the role.
    expect((await call(t, 'GET', `/v1/conversations/${c.conversationId}`, admin)).json<Conversation>().isAdmin).toBe(true);
  });

  it('lets only the owner (or staff) delete it, with its chat room and posts', async () => {
    const [ama, kemi] = [await register(t), await register(t)] as [Who, Who];
    const c = await make(ama);
    await join(kemi, c);
    await call(t, 'POST', '/v1/posts', kemi, { kind: 'made-this', title: 'In the community', communityId: c.id, photoUploadId: (await finishedUpload(t, kemi, 'made_post', 'image/jpeg')).id });
    expect((await call(t, 'DELETE', `/v1/communities/${c.id}`, kemi)).statusCode).toBe(403);
    expect((await call(t, 'DELETE', `/v1/communities/${c.id}`, ama)).statusCode).toBe(204);
    expect((await call(t, 'GET', `/v1/communities/${c.id}`)).statusCode).toBe(404);
    expect((await call(t, 'GET', `/v1/conversations/${c.conversationId}`, ama)).statusCode).toBe(404);
    expect(await t.db.post.count()).toBe(0);
    const other = await make(ama, { name: 'Another one' });
    expect((await call(t, 'DELETE', `/v1/communities/${other.id}`, await makeAdmin(t))).statusCode).toBe(204);
  });
});

describe('posting inside a community', () => {
  async function upload(who: Who) {
    return (await finishedUpload(t, who, 'made_post', 'image/jpeg')).id;
  }
  const post = async (who: Who, body: Record<string, unknown>) =>
    call(t, 'POST', '/v1/posts', who, { kind: 'made-this', title: 'My dish', photoUploadId: await upload(who), ...body });

  it('needs membership', async () => {
    const [ama, kemi] = [await register(t), await register(t)] as [Who, Who];
    const c = await make(ama, { visibility: 'private' });
    expect((await post(kemi, { communityId: c.id })).statusCode).toBe(403);
    await join(kemi, c); // only asked
    expect((await post(kemi, { communityId: c.id })).statusCode).toBe(403);
    expect((await post(ama, { communityId: c.id })).json<Post>().communityId).toBe(c.id);
    expect((await post(ama, { challengeId: randomUUID() })).statusCode).toBe(400); // a challenge needs its community
  });

  it('keeps a private community\'s posts out of feeds and profiles for outsiders', async () => {
    const [ama, kemi, outsider] = [await register(t), await register(t), await register(t)] as [Who, Who, Who];
    const priv = await make(ama, { visibility: 'private', name: 'Secret Supper' });
    const open = await make(ama, { name: 'Open Supper' });
    await join(kemi, priv);
    await call(t, 'POST', `/v1/communities/${priv.id}/members/${kemi.user.id}/approve`, ama);
    const secret = (await post(ama, { communityId: priv.id, title: 'Secret dish' })).json<Post>();
    await post(ama, { communityId: open.id, title: 'Public dish' });
    await post(ama, { title: 'Plain dish' });

    const titles = async (who: Who | undefined, path: string) => (await call(t, 'GET', path, who)).json<Page<Post>>().items.map((p) => p.title).sort();
    expect(await titles(outsider, '/v1/feed/discover')).toEqual(['Plain dish', 'Public dish']);
    expect(await titles(undefined, '/v1/feed/discover')).toEqual(['Plain dish', 'Public dish']);
    expect(await titles(kemi, '/v1/feed/discover')).toEqual(['Plain dish', 'Public dish', 'Secret dish']);
    expect(await titles(outsider, `/v1/users/${ama.user.id}/posts`)).toEqual(['Plain dish', 'Public dish']);
    expect((await call(t, 'GET', `/v1/posts/${secret.id}`, outsider)).statusCode).toBe(404);
    expect((await call(t, 'GET', `/v1/posts/${secret.id}`)).statusCode).toBe(404);
    expect((await call(t, 'GET', `/v1/posts/${secret.id}`, kemi)).statusCode).toBe(200);
    expect((await call(t, 'GET', `/v1/posts/${secret.id}`, await makeAdmin(t))).statusCode).toBe(200);
    expect(await titles(kemi, `/v1/communities/${priv.id}/posts`)).toEqual(['Secret dish']);
    expect((await call(t, 'PUT', `/v1/posts/${secret.id}/like`, outsider)).statusCode).toBe(404);
  });

  it('loses sight of a private community\'s posts after leaving it', async () => {
    const [ama, kemi] = [await register(t), await register(t)] as [Who, Who];
    const priv = await make(ama, { visibility: 'private' });
    await join(kemi, priv);
    await call(t, 'POST', `/v1/communities/${priv.id}/members/${kemi.user.id}/approve`, ama);
    const p = (await post(ama, { communityId: priv.id })).json<Post>();
    await call(t, 'PUT', `/v1/posts/${p.id}/save`, kemi);
    expect((await call(t, 'GET', '/v1/me/saved-posts', kemi)).json<Page<Post>>().items).toHaveLength(1);
    await call(t, 'DELETE', `/v1/communities/${priv.id}/membership`, kemi);
    expect((await call(t, 'GET', '/v1/me/saved-posts', kemi)).json<Page<Post>>().items).toEqual([]);
  });
});

describe('challenges and events', () => {
  async function setup() {
    const [ama, kemi] = [await register(t), await register(t)] as [Who, Who];
    const c = await make(ama);
    await join(kemi, c);
    return { ama, kemi, c };
  }

  it('lets an admin start a challenge; members enter it by posting; entries are counted', async () => {
    const { ama, kemi, c } = await setup();
    const res = await call(t, 'POST', `/v1/communities/${c.id}/challenges`, ama, { title: '30 minute dinners', endsAt: inDays(7) });
    expect(res.statusCode).toBe(201);
    const ch = res.json<Challenge>();
    expect(ch).toMatchObject({ title: '30 minute dinners', entries: 0, active: true });
    expect((await call(t, 'POST', `/v1/communities/${c.id}/challenges`, kemi, { title: 'Nope', endsAt: inDays(7) })).statusCode).toBe(403);
    expect((await call(t, 'POST', `/v1/communities/${c.id}/challenges`, ama, { title: 'In the past', endsAt: inDays(-1) })).statusCode).toBe(400);

    const photo = async (who: Who) => (await finishedUpload(t, who, 'made_post', 'image/jpeg')).id;
    for (const who of [kemi, ama]) {
      expect((await call(t, 'POST', '/v1/posts', who, { kind: 'made-this', title: 'Entry', communityId: c.id, challengeId: ch.id, photoUploadId: await photo(who) })).statusCode).toBe(201);
    }
    const listed = (await call(t, 'GET', `/v1/communities/${c.id}/challenges`)).json<{ items: Challenge[] }>().items;
    expect(listed[0]).toMatchObject({ id: ch.id, entries: 2 });
  });

  it('refuses entries to an ended challenge or one from another community, lists running challenges first', async () => {
    const { ama, c } = await setup();
    const other = await make(ama, { name: 'Other place' });
    const running = (await call(t, 'POST', `/v1/communities/${c.id}/challenges`, ama, { title: 'Running', endsAt: inDays(5) })).json<Challenge>();
    const soon = (await call(t, 'POST', `/v1/communities/${c.id}/challenges`, ama, { title: 'Ending soon', endsAt: inDays(1) })).json<Challenge>();
    const photo = async () => (await finishedUpload(t, ama, 'made_post', 'image/jpeg')).id;
    const enter = async (body: Record<string, unknown>) => call(t, 'POST', '/v1/posts', ama, { kind: 'made-this', title: 'E', photoUploadId: await photo(), ...body });

    expect((await enter({ communityId: other.id, challengeId: running.id })).statusCode).toBe(400);
    t.advance(2 * DAY_MS);
    expect((await enter({ communityId: c.id, challengeId: soon.id })).statusCode).toBe(400); // ended
    expect((await enter({ communityId: c.id, challengeId: running.id })).statusCode).toBe(201);
    const listed = (await call(t, 'GET', `/v1/communities/${c.id}/challenges`)).json<{ items: Challenge[] }>().items;
    expect(listed.map((x) => [x.title, x.active])).toEqual([['Running', true], ['Ending soon', false]]);
    expect((await call(t, 'DELETE', `/v1/communities/${c.id}/challenges/${soon.id}`, ama)).statusCode).toBe(204);
    expect((await call(t, 'DELETE', `/v1/communities/${c.id}/challenges/${soon.id}`, ama)).statusCode).toBe(404);
  });

  it('lists upcoming events soonest first, and lets only an admin add or remove them', async () => {
    const { ama, kemi, c } = await setup();
    const later = (await call(t, 'POST', `/v1/communities/${c.id}/events`, ama, { title: 'Later', startsAt: inDays(10) })).json<CommunityEvent>();
    await call(t, 'POST', `/v1/communities/${c.id}/events`, ama, { title: 'Sooner', detail: 'Bring a pot', startsAt: inDays(2) });
    await call(t, 'POST', `/v1/communities/${c.id}/events`, ama, { title: 'Past', startsAt: inDays(-3) });
    expect((await call(t, 'POST', `/v1/communities/${c.id}/events`, kemi, { title: 'Nope', startsAt: inDays(1) })).statusCode).toBe(403);
    expect((await call(t, 'POST', `/v1/communities/${c.id}/events`, ama, { title: 'x', startsAt: 'someday' })).statusCode).toBe(400);
    const upcoming = (await call(t, 'GET', `/v1/communities/${c.id}/events`)).json<{ items: CommunityEvent[] }>().items;
    expect(upcoming.map((e) => e.title)).toEqual(['Sooner', 'Later']);
    expect(upcoming[0]?.detail).toBe('Bring a pot');
    expect((await call(t, 'DELETE', `/v1/communities/${c.id}/events/${later.id}`, kemi)).statusCode).toBe(403);
    expect((await call(t, 'DELETE', `/v1/communities/${c.id}/events/${later.id}`, ama)).statusCode).toBe(204);
  });
});

describe('the chat room and deleted accounts', () => {
  it('lets members talk in the room', async () => {
    const [ama, kemi] = [await register(t), await register(t)] as [Who, Who];
    const c = await make(ama);
    await join(kemi, c);
    const sent = await call(t, 'POST', `/v1/conversations/${c.conversationId}/messages`, kemi, { kind: 'text', text: 'Hello everyone', clientId: newId() });
    expect(sent.statusCode).toBe(201);
    expect((await call(t, 'GET', `/v1/conversations/${c.conversationId}/messages`, ama)).json<{ items: unknown[] }>().items).toHaveLength(1);
  });

  it('keeps the member count right when a member deletes their account', async () => {
    const [ama, kemi] = [await register(t), await register(t)] as [Who, Who];
    const c = await make(ama);
    await join(kemi, c);
    expect((await get(ama, c)).memberCount).toBe(2);
    expect((await call(t, 'DELETE', '/v1/me', kemi, { password: 'correct horse battery' })).statusCode).toBe(204);
    expect((await get(ama, c)).memberCount).toBe(1);
  });

  it('hands a community to someone else when its owner deletes their account (an admin first)', async () => {
    const [ama, kemi, tunde] = [await register(t), await register(t), await register(t)] as [Who, Who, Who];
    const c = await make(ama);
    await join(kemi, c);
    await join(tunde, c);
    await call(t, 'PUT', `/v1/communities/${c.id}/members/${tunde.user.id}/role`, ama, { role: 'admin' }); // joined later than Kemi, but is an admin
    expect((await call(t, 'DELETE', '/v1/me', ama, { password: 'correct horse battery' })).statusCode).toBe(204);
    expect(await get(kemi, c)).toMatchObject({ memberCount: 2, viewer: { role: 'member' } });
    expect((await get(tunde, c)).viewer).toMatchObject({ role: 'owner' });
  });

  it('removes a community, and its chat room, when its last member deletes their account', async () => {
    const ama = await register(t);
    const c = await make(ama);
    expect((await call(t, 'DELETE', '/v1/me', ama, { password: 'correct horse battery' })).statusCode).toBe(204);
    expect(await t.db.community.count()).toBe(0);
    expect(await t.db.conversation.count()).toBe(0);
    expect((await call(t, 'GET', `/v1/communities/${c.id}`)).statusCode).toBe(404);
  });
});
