import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FeedPreferences, Page, Post, RecordFeedEventsResponse } from '@shared';
import { Maintenance } from '../src/jobs/maintenance';
import { MAX_EVENTS_PER_DAY } from '../src/recommend/events';
import { DAY_MS, makeApp, register, type TestApp } from './helpers';
import { call, createRecipe } from './recipeHelpers';
import { makePost } from './socialHelpers';

let t: TestApp;
beforeAll(async () => {
  t = await makeApp({ ACCESS_TOKEN_TTL_SECONDS: String(60 * 86400), RATE_LIMIT_MAX: '100000' });
});
afterAll(() => t.close());
beforeEach(() => t.reset());

type Who = Awaited<ReturnType<typeof register>>;
const send = (who: Who | undefined, events: unknown[]) => call(t, 'POST', '/v1/feed/events', who, { events });
const stored = (userId: string) => t.db.feedEvent.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } });

describe('recording what people do with the feed', () => {
  it('keeps events about real posts, with the author and recipe worked out by the server', async () => {
    const [kemi, ama] = [await register(t, { displayName: 'Kemi' }), await register(t, { displayName: 'Ama' })] as [Who, Who];
    const recipe = await createRecipe(t, kemi);
    const post = await makePost(t, kemi, { recipeId: recipe.id });
    const res = await send(ama, [
      { kind: 'impression', postId: post.id },
      { kind: 'view', postId: post.id, dwellMs: 4200 },
      { kind: 'save', postId: post.id },
    ]);
    expect(res.statusCode).toBe(200);
    expect(res.json<RecordFeedEventsResponse>()).toEqual({ accepted: 3 });
    const rows = await stored(ama.user.id);
    expect(rows.map((r) => r.kind)).toEqual(['impression', 'view', 'save']);
    expect(rows.every((r) => r.postId === post.id && r.authorId === kemi.user.id && r.recipeId === recipe.id)).toBe(true);
    expect(rows[1]?.dwellMs).toBe(4200);
  });

  it('keeps recipe events that have no post (cook mode), and drops events about nothing real', async () => {
    const [kemi, ama] = [await register(t), await register(t)] as [Who, Who];
    const recipe = await createRecipe(t, kemi);
    const res = await send(ama, [
      { kind: 'cook_start', recipeId: recipe.id },
      { kind: 'cook_finish', recipeId: recipe.id },
      { kind: 'like', postId: randomUUID() },
      { kind: 'cook_start', recipeId: randomUUID() },
      { kind: 'view' },
    ]);
    expect(res.json<RecordFeedEventsResponse>()).toEqual({ accepted: 2 });
    expect((await stored(ama.user.id)).map((r) => [r.kind, r.recipeId, r.authorId])).toEqual([
      ['cook_start', recipe.id, kemi.user.id],
      ['cook_finish', recipe.id, kemi.user.id],
    ]);
  });

  it('counts a post shown twice in one batch once, and caps a silly dwell time', async () => {
    const [kemi, ama] = [await register(t), await register(t)] as [Who, Who];
    const post = await makePost(t, kemi);
    await send(ama, [
      { kind: 'impression', postId: post.id },
      { kind: 'impression', postId: post.id },
      { kind: 'view', postId: post.id, dwellMs: 20 * 3_600_000 },
    ]);
    const rows = await stored(ama.user.id);
    expect(rows.filter((r) => r.kind === 'impression')).toHaveLength(1);
    expect(rows.find((r) => r.kind === 'view')?.dwellMs).toBe(10 * 60_000);
  });

  it('needs sign-in and a valid batch', async () => {
    const ama = await register(t);
    expect((await send(undefined, [{ kind: 'impression', postId: randomUUID() }])).statusCode).toBe(401);
    expect((await send(ama, [{ kind: 'dance', postId: randomUUID() }])).statusCode).toBe(400);
    expect((await send(ama, [{ kind: 'impression', postId: 'not-an-id' }])).statusCode).toBe(400);
    expect((await send(ama, Array.from({ length: 51 }, () => ({ kind: 'impression', postId: randomUUID() })))).statusCode).toBe(400);
    expect((await send(ama, [])).json<RecordFeedEventsResponse>()).toEqual({ accepted: 0 });
  });

  it('stops recording when a person is past the day\'s cap', async () => {
    const [kemi, ama] = [await register(t), await register(t)] as [Who, Who];
    const post = await makePost(t, kemi);
    await t.db.feedEvent.createMany({ data: Array.from({ length: MAX_EVENTS_PER_DAY }, () => ({ userId: ama.user.id, kind: 'impression', postId: post.id })) });
    expect((await send(ama, [{ kind: 'save', postId: post.id }])).json<RecordFeedEventsResponse>()).toEqual({ accepted: 0 });
    expect(await t.db.feedEvent.count({ where: { userId: ama.user.id } })).toBe(MAX_EVENTS_PER_DAY);
  });
});

describe('the personalisation switch', () => {
  it('is on by default, and turning it off forgets what was seen but keeps "not interested" choices', async () => {
    const [kemi, ama] = [await register(t), await register(t)] as [Who, Who];
    const [a, b] = [await makePost(t, kemi), await makePost(t, kemi)];
    expect((await call(t, 'GET', '/v1/me/feed-preferences', ama)).json<FeedPreferences>()).toEqual({ personalised: true });
    await send(ama, [{ kind: 'view', postId: a.id, dwellMs: 3000 }, { kind: 'save', postId: a.id }, { kind: 'hide', postId: b.id }]);
    expect(await t.db.feedEvent.count({ where: { userId: ama.user.id } })).toBe(3);

    expect((await call(t, 'PUT', '/v1/me/feed-preferences', ama, { personalised: false })).json<FeedPreferences>()).toEqual({ personalised: false });
    expect((await stored(ama.user.id)).map((r) => r.kind)).toEqual(['hide']);

    // from now on only "not interested" is kept
    const res = await send(ama, [{ kind: 'view', postId: a.id, dwellMs: 9000 }, { kind: 'like', postId: a.id }, { kind: 'hide', postId: a.id }]);
    expect(res.json<RecordFeedEventsResponse>()).toEqual({ accepted: 1 });
    expect((await stored(ama.user.id)).map((r) => r.kind)).toEqual(['hide', 'hide']);

    expect((await call(t, 'PUT', '/v1/me/feed-preferences', ama, { personalised: true })).json<FeedPreferences>()).toEqual({ personalised: true });
    expect((await call(t, 'PUT', '/v1/me/feed-preferences', ama, { personalised: 'yes' })).statusCode).toBe(400);
    expect((await call(t, 'GET', '/v1/me/feed-preferences')).statusCode).toBe(401);
  });
});

describe('"not interested"', () => {
  it('takes that post out of the person\'s For You feed, and no one else\'s', async () => {
    const [kemi, ama, tola] = [await register(t), await register(t), await register(t)] as [Who, Who, Who];
    const [keep, drop] = [await makePost(t, kemi, { title: 'Keep me' }), await makePost(t, kemi, { title: 'Drop me' })];
    const ids = async (who: Who) => (await call(t, 'GET', '/v1/feed/for-you', who)).json<Page<Post>>().items.map((p) => p.id).sort();
    expect(await ids(ama)).toEqual([keep.id, drop.id].sort());
    await send(ama, [{ kind: 'hide', postId: drop.id }]);
    expect(await ids(ama)).toEqual([keep.id]);
    expect(await ids(tola)).toEqual([keep.id, drop.id].sort());
  });
});

describe('keeping the table small and private', () => {
  it('purges events older than 30 days and keeps newer ones', async () => {
    const [kemi, ama] = [await register(t), await register(t)] as [Who, Who];
    const post = await makePost(t, kemi);
    const ago = (days: number) => new Date(Date.now() - days * DAY_MS);
    await t.db.feedEvent.createMany({
      data: [
        { userId: ama.user.id, kind: 'view', postId: post.id, createdAt: ago(31) },
        { userId: ama.user.id, kind: 'view', postId: post.id, createdAt: ago(29) },
      ],
    });
    const counts = await new Maintenance(t.db).purge();
    expect(counts.feedEvents).toBe(1);
    expect(await t.db.feedEvent.count({ where: { userId: ama.user.id } })).toBe(1);
  });

  it('is deleted with the account', async () => {
    const [kemi, ama] = [await register(t), await register(t)] as [Who, Who];
    const post = await makePost(t, kemi);
    await send(ama, [{ kind: 'save', postId: post.id }]);
    expect(await t.db.feedEvent.count({ where: { userId: ama.user.id } })).toBe(1);
    await t.db.user.delete({ where: { id: ama.user.id } });
    expect(await t.db.feedEvent.count({ where: { userId: ama.user.id } })).toBe(0);
  });
});
