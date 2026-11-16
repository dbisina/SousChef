import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { rankFeed, type FeedCandidate } from '@souschef/native';
import type { Page, Post } from '@shared';
import { DAY_MS, makeApp, register, type TestApp } from './helpers';
import { call, createRecipe } from './recipeHelpers';
import { makePost } from './socialHelpers';
import { decodeCursor, encodeCursor } from '../src/social/forYou';

let t: TestApp;
beforeAll(async () => {
  t = await makeApp({ ACCESS_TOKEN_TTL_SECONDS: String(60 * 86400) });
});
afterAll(() => t.close());
beforeEach(() => t.reset());

type Who = Awaited<ReturnType<typeof register>>;
const forYou = async (who: Who | undefined, query = '') => (await call(t, 'GET', `/v1/feed/for-you${query}`, who)).json<Page<Post>>();
const titles = (page: Page<Post>) => page.items.map((p) => p.title);

describe('the Rust ranker, through the addon', () => {
  const candidate = (id: string, overrides: Partial<FeedCandidate> = {}): FeedCandidate => ({
    id, authorId: `author-${id}`, ageHours: 1, likes: 0, comments: 0, saves: 0, views: 0, authorAffinity: 0, hasRecipe: false, ...overrides,
  });

  it('orders by engagement, freshness and affinity, and respects the limit', () => {
    const posts = [candidate('quiet'), candidate('loved', { likes: 40 }), candidate('old', { likes: 40, ageHours: 100 }), candidate('friend', { likes: 20, authorAffinity: 1 })];
    // A followed author's modest post leads, then the well-liked fresh one; the quiet and the old ones trail.
    expect(rankFeed(posts, 2)).toEqual(['friend', 'loved']);
    expect(rankFeed(posts, 4).slice(0, 2)).toEqual(['friend', 'loved']);
    expect(rankFeed(posts, 4).slice(2).sort()).toEqual(['old', 'quiet']);
  });

  it('spreads out one author, and handles empty input', () => {
    const posts = [candidate('a1', { authorId: 'same', likes: 50 }), candidate('a2', { authorId: 'same', likes: 50 }), candidate('b1', { likes: 30 })];
    expect(rankFeed(posts, 3)).toEqual(['a1', 'b1', 'a2']);
    expect(rankFeed([], 5)).toEqual([]);
  });
});

describe('the for-you feed', () => {
  it('works signed out and signed in, and needs no sign-in', async () => {
    const ama = await register(t);
    await makePost(t, ama, { title: 'Hello' });
    expect(titles(await forYou(undefined))).toEqual(['Hello']);
    expect(titles(await forYou(ama))).toEqual(['Hello']);
    expect((await forYou(undefined)).items[0]?.viewer).toBeNull();
    expect((await forYou(ama)).items[0]?.viewer).toEqual({ liked: false, saved: false });
  });

  it('puts what people engaged with ahead of what nobody has reacted to', async () => {
    const [ama, fans] = [await register(t), await Promise.all(Array.from({ length: 4 }, () => register(t)))] as [Who, Who[]];
    const quiet = await makePost(t, ama, { title: 'Quiet' });
    const loved = await makePost(t, ama, { title: 'Loved' });
    for (const f of fans) await call(t, 'PUT', `/v1/posts/${loved.id}/like`, f);
    await call(t, 'PUT', `/v1/posts/${loved.id}/save`, fans[0]);
    expect(titles(await forYou(undefined))).toEqual(['Loved', 'Quiet']);
    expect(quiet.id).toBeTruthy();
  });

  it('lifts people you follow and people whose posts you liked', async () => {
    const [me, followed, liked, stranger] = [await register(t), await register(t), await register(t), await register(t)] as [Who, Who, Who, Who];
    const fan = await register(t);
    await makePost(t, stranger, { title: 'Stranger' });
    await makePost(t, liked, { title: 'Liked author' });
    await makePost(t, followed, { title: 'Followed author' });
    // Equal engagement for all three.
    for (const author of [stranger, liked, followed]) {
      const post = (await call(t, 'GET', `/v1/users/${author.user.id}/posts`)).json<Page<Post>>().items[0] as Post;
      await call(t, 'PUT', `/v1/posts/${post.id}/like`, fan);
    }
    await call(t, 'PUT', `/v1/users/${followed.user.id}/follow`, me);
    const likedBefore = (await call(t, 'GET', `/v1/users/${liked.user.id}/posts`)).json<Page<Post>>().items[0] as Post;
    await call(t, 'PUT', `/v1/posts/${likedBefore.id}/like`, me);
    await call(t, 'DELETE', `/v1/posts/${likedBefore.id}/like`, me); // the like is gone, so is the lift, until they like again
    await call(t, 'PUT', `/v1/posts/${likedBefore.id}/like`, me);

    // fan already liked each once; me liked "Liked author" once more, so it has a bit more engagement too.
    const order = titles(await forYou(me));
    expect(order.indexOf('Followed author')).toBeLessThan(order.indexOf('Stranger'));
    expect(order.indexOf('Liked author')).toBeLessThan(order.indexOf('Stranger'));
    expect(order.indexOf('Followed author')).toBe(0);
  });

  it('does not let one author fill the first page', async () => {
    const [busy, other, third] = [await register(t), await register(t), await register(t)] as [Who, Who, Who];
    for (let i = 0; i < 4; i++) await makePost(t, busy, { title: `Busy ${i}` });
    await makePost(t, other, { title: 'Other' });
    await makePost(t, third, { title: 'Third' });
    const first3 = titles(await forYou(undefined, '?limit=3'));
    expect(first3).toContain('Other');
    expect(first3).toContain('Third');
  });

  it('leaves out old posts, hidden posts, blocked people and private communities\' posts', async () => {
    const [me, fresh, old, hidden, blocked, member] = [await register(t), await register(t), await register(t), await register(t), await register(t), await register(t)] as [Who, Who, Who, Who, Who, Who];
    await makePost(t, fresh, { title: 'Fresh' });
    const oldPost = await makePost(t, old, { title: 'Old' });
    await t.db.post.update({ where: { id: oldPost.id }, data: { createdAt: new Date(Date.now() - 8 * DAY_MS) } });
    const hiddenPost = await makePost(t, hidden, { title: 'Hidden' });
    await t.db.post.update({ where: { id: hiddenPost.id }, data: { status: 'HIDDEN' } });
    await makePost(t, blocked, { title: 'Blocked' });
    await call(t, 'PUT', `/v1/me/blocks/${blocked.user.id}`, me);
    const secret = (await call(t, 'POST', '/v1/communities', member, { name: 'Secret club', visibility: 'private' })).json<{ id: string }>();
    await makePost(t, member, { title: 'Secret', communityId: secret.id });

    expect(titles(await forYou(me))).toEqual(['Fresh']);
    expect(titles(await forYou(undefined)).sort()).toEqual(['Blocked', 'Fresh']); // signed out: the block is yours, not everyone's
  });

  it('pages without repeating or skipping, even when new posts arrive in between', async () => {
    const ama = await register(t);
    for (let i = 1; i <= 7; i++) await makePost(t, ama, { title: `P${i}` });
    const p1 = await forYou(undefined, '?limit=3');
    expect(p1.items).toHaveLength(3);
    await makePost(t, ama, { title: 'Arrived late' });
    const p2 = await forYou(undefined, `?limit=3&cursor=${p1.nextCursor}`);
    const p3 = await forYou(undefined, `?limit=3&cursor=${p2.nextCursor}`);
    const all = [...titles(p1), ...titles(p2), ...titles(p3)];
    expect(new Set(all).size).toBe(7);
    expect(all).not.toContain('Arrived late');
    expect(p3.nextCursor).toBeNull();
  });

  it('refuses a cursor it did not make', async () => {
    expect((await call(t, 'GET', '/v1/feed/for-you?cursor=not-a-cursor')).statusCode).toBe(400);
    expect((await call(t, 'GET', `/v1/feed/for-you?cursor=${encodeURIComponent(Buffer.from('{"asOf":"x","offset":-1}').toString('base64url'))}`)).statusCode).toBe(400);
  });

  it('gives a small lift to a post that shares a recipe', async () => {
    const ama = await register(t);
    const recipe = await createRecipe(t, ama);
    await makePost(t, ama, { title: 'Plain' });
    const author2 = await register(t);
    await makePost(t, author2, { title: 'With recipe', kind: 'recipe', recipeId: (await createRecipe(t, author2)).id });
    expect(titles(await forYou(undefined))[0]).toBe('With recipe');
    expect(recipe.id).toBeTruthy();
  });
});

describe('cursors', () => {
  it('round-trip, and reject anything else', () => {
    const c = { asOf: '2026-11-15T12:00:00.000Z', offset: 20 };
    expect(decodeCursor(encodeCursor(c))).toEqual(c);
    for (const bad of ['', '!!!', Buffer.from('{}').toString('base64url'), Buffer.from('{"asOf":"2026-11-15","offset":1.5}').toString('base64url')]) {
      expect(decodeCursor(bad)).toBeNull();
    }
  });
});
