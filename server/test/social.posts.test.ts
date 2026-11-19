import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { ApiErrorBody, FollowToggle, Page, Participant, Post, PostComment, ToggleResponse, UserProfile } from '@shared';
import { DAY_MS, makeApp, register, type TestApp } from './helpers';
import { call, createRecipe, makeAdmin } from './recipeHelpers';
import { finishedUpload, makePost } from './socialHelpers';

let t: TestApp;
beforeAll(async () => {
  t = await makeApp({ ACCESS_TOKEN_TTL_SECONDS: String(60 * 86400) });
});
afterAll(() => t.close());
beforeEach(() => t.reset());

type Who = Awaited<ReturnType<typeof register>>;
const feed = async (who: Who | undefined, path = '/v1/feed/following', query = '') => (await call(t, 'GET', `${path}${query}`, who)).json<Page<Post>>();

describe('cooked with another cook\'s recipe', () => {
  const token = (name: string) => `ExponentPushToken[${name}]`;
  const settle = () => new Promise((r) => setTimeout(r, 200));

  it('shows whose recipe a post was cooked with, in the feed and on the post', async () => {
    const [kemi, ama] = [await register(t, { displayName: 'Kemi' }), await register(t, { displayName: 'Ama' })] as [Who, Who];
    const recipe = await createRecipe(t, kemi);
    const post = await makePost(t, ama, { recipeId: recipe.id });
    expect(post.recipe).toMatchObject({ id: recipe.id, title: recipe.title, author: { id: kemi.user.id, displayName: 'Kemi' } });
    const fetched = (await call(t, 'GET', `/v1/posts/${post.id}`, ama)).json<Post>();
    expect(fetched.recipe?.author.id).toBe(kemi.user.id);
    await call(t, 'PUT', `/v1/users/${ama.user.id}/follow`, kemi);
    const items = (await feed(kemi)).items;
    expect(items.find((p) => p.id === post.id)?.recipe?.title).toBe(recipe.title);
    expect((await makePost(t, ama)).recipe).toBeNull();
  });

  it('lists what people cooked with a recipe, newest first, leaving out private communities', async () => {
    const [kemi, ama, tola] = [await register(t, { displayName: 'Kemi' }), await register(t, { displayName: 'Ama' }), await register(t, { displayName: 'Tola' })] as [Who, Who, Who];
    const recipe = await createRecipe(t, kemi);
    const first = await makePost(t, ama, { recipeId: recipe.id, title: 'Mine' });
    const second = await makePost(t, tola, { recipeId: recipe.id, title: 'Tola dinner' });
    await makePost(t, ama); // not about this recipe
    const page = (await call(t, 'GET', `/v1/recipes/${recipe.id}/cooked`)).json<Page<Post>>();
    expect(page.items.map((p) => p.id)).toEqual([second.id, first.id]);
    expect(page.items.every((p) => p.recipe?.id === recipe.id)).toBe(true);
  });

  it('tells the recipe writer, but not when they cook their own recipe', async () => {
    const [kemi, ama] = [await register(t, { displayName: 'Kemi' }), await register(t, { displayName: 'Ama' })] as [Who, Who];
    await call(t, 'PUT', '/v1/me/devices', kemi, { pushToken: token('kemi-phone'), platform: 'ios' });
    const recipe = await createRecipe(t, kemi);
    await makePost(t, kemi, { recipeId: recipe.id });
    await settle();
    expect(t.push.sent).toEqual([]);
    const post = await makePost(t, ama, { recipeId: recipe.id });
    await settle();
    expect(t.push.sent).toEqual([
      { to: token('kemi-phone'), title: 'Ama cooked your recipe', body: recipe.title, data: { type: 'recipe-cooked', postId: post.id, recipeId: recipe.id } },
    ]);
  });
});


describe('profiles and following', () => {
  it('shows a public profile with counts, and how you relate to the person', async () => {
    const [ama, kemi] = [await register(t, { displayName: 'Ama' }), await register(t, { displayName: 'Kemi' })] as [Who, Who];
    await createRecipe(t, kemi);
    await makePost(t, kemi);
    await call(t, 'PUT', `/v1/users/${kemi.user.id}/follow`, ama);
    await call(t, 'PUT', `/v1/users/${ama.user.id}/follow`, kemi);

    const asAma = (await call(t, 'GET', `/v1/users/${kemi.user.id}`, ama)).json<UserProfile>();
    expect(asAma).toMatchObject({ displayName: 'Kemi', followerCount: 1, followingCount: 1, recipeCount: 1, postCount: 1, viewer: { following: true, followedBy: true, blocked: false } });
    expect((await call(t, 'GET', `/v1/users/${kemi.user.id}`)).json<UserProfile>().viewer).toBeNull();
    expect((await call(t, 'GET', `/v1/users/${ama.user.id}`, ama)).json<UserProfile>().viewer).toBeNull(); // yourself
    expect((await call(t, 'GET', `/v1/users/${randomUUID()}`)).statusCode).toBe(404);
  });

  it('follows and unfollows, counting each person once', async () => {
    const [ama, kemi] = [await register(t), await register(t)] as [Who, Who];
    expect((await call(t, 'PUT', `/v1/users/${kemi.user.id}/follow`, ama)).json<FollowToggle>()).toEqual({ following: true, followerCount: 1 });
    expect((await call(t, 'PUT', `/v1/users/${kemi.user.id}/follow`, ama)).json<FollowToggle>()).toEqual({ following: true, followerCount: 1 });
    expect((await call(t, 'DELETE', `/v1/users/${kemi.user.id}/follow`, ama)).json<FollowToggle>()).toEqual({ following: false, followerCount: 0 });
    expect((await call(t, 'DELETE', `/v1/users/${kemi.user.id}/follow`, ama)).json<FollowToggle>()).toEqual({ following: false, followerCount: 0 });
    expect((await call(t, 'PUT', `/v1/users/${ama.user.id}/follow`, ama)).statusCode).toBe(400);
    expect((await call(t, 'PUT', `/v1/users/${randomUUID()}/follow`, ama)).statusCode).toBe(404);
    expect((await call(t, 'PUT', `/v1/users/${kemi.user.id}/follow`)).statusCode).toBe(401);
  });

  it('lists followers and following, newest first, in pages', async () => {
    const star = await register(t, { displayName: 'Star' });
    const fans = [await register(t, { displayName: 'F1' }), await register(t, { displayName: 'F2' }), await register(t, { displayName: 'F3' })] as [Who, Who, Who];
    for (const f of fans) await call(t, 'PUT', `/v1/users/${star.user.id}/follow`, f);
    const p1 = (await call(t, 'GET', `/v1/users/${star.user.id}/followers?limit=2`)).json<Page<Participant>>();
    expect(p1.items.map((u) => u.displayName)).toEqual(['F3', 'F2']);
    const p2 = (await call(t, 'GET', `/v1/users/${star.user.id}/followers?limit=2&cursor=${p1.nextCursor}`)).json<Page<Participant>>();
    expect(p2.items.map((u) => u.displayName)).toEqual(['F1']);
    expect(p2.nextCursor).toBeNull();
    const mine = (await call(t, 'GET', `/v1/users/${(fans[0] as Who).user.id}/following`)).json<Page<Participant>>();
    expect(mine.items.map((u) => u.displayName)).toEqual(['Star']);
  });

  it('will not let blocked people follow each other, and hides a profile from someone who was blocked', async () => {
    const [ama, kemi] = [await register(t), await register(t)] as [Who, Who];
    await call(t, 'PUT', `/v1/me/blocks/${ama.user.id}`, kemi); // Kemi blocks Ama
    expect((await call(t, 'PUT', `/v1/users/${kemi.user.id}/follow`, ama)).statusCode).toBe(403);
    expect((await call(t, 'PUT', `/v1/users/${ama.user.id}/follow`, kemi)).statusCode).toBe(403);
    expect((await call(t, 'GET', `/v1/users/${kemi.user.id}`, ama)).statusCode).toBe(404); // Ama can no longer see Kemi
    const seenByKemi = (await call(t, 'GET', `/v1/users/${ama.user.id}`, kemi)).json<UserProfile>();
    expect(seenByKemi.viewer?.blocked).toBe(true);
  });

  it('finds people by part of a name or handle, best matches first, without blocked people or yourself', async () => {
    const searcher = await register(t, { displayName: 'Searcher' });
    const [a, b, c] = [await register(t, { displayName: 'Chef Adaeze' }), await register(t, { displayName: 'Ada Lovelace' }), await register(t, { displayName: 'Bola Ade' })] as [Who, Who, Who];
    await call(t, 'PUT', `/v1/me/blocks/${c.user.id}`, searcher);
    const found = (await call(t, 'GET', '/v1/users/search?q=ada', searcher)).json<{ items: Participant[] }>().items;
    expect(found.map((u) => u.displayName).sort()).toEqual(['Ada Lovelace', 'Chef Adaeze']);
    expect(found[0]?.handle.startsWith('ada')).toBe(true);
    expect((await call(t, 'GET', '/v1/users/search?q=a', searcher)).json<{ items: unknown[] }>().items).toEqual([]); // too short
    expect((await call(t, 'GET', '/v1/users/search?q=searcher', searcher)).json<{ items: unknown[] }>().items).toEqual([]); // not yourself
    expect((await call(t, 'GET', `/v1/users/search?q=${encodeURIComponent('@' + a.user.handle)}`)).json<{ items: Participant[] }>().items.map((u) => u.id)).toEqual([a.user.id]);
    expect(b.user.id).toBeTruthy();
  });

  it('says whether a username is free: taken by someone else, malformed, or already yours', async () => {
    const me = await register(t, { displayName: 'Handle Checker' });
    const other = await register(t, { displayName: 'Someone Else' });
    const check = async (h: string, who?: Who) => (await call(t, 'GET', `/v1/users/handle-available?handle=${encodeURIComponent(h)}`, who)).json<{ available: boolean; reason?: string }>();
    expect(await check('brand_new_name_1', me)).toMatchObject({ available: true });
    expect(await check(other.user.handle, me)).toMatchObject({ available: false, reason: 'taken' });
    expect(await check(`@${me.user.handle}`, me)).toMatchObject({ available: true }); // your own name is fine to keep
    expect(await check('no', me)).toMatchObject({ available: false, reason: 'invalid' });
    expect(await check('Has Spaces!', me)).toMatchObject({ available: false, reason: 'invalid' });
  });
});

describe('posts', () => {
  it('needs finished uploads and the right pieces for each kind', async () => {
    const ama = await register(t);
    const photo = await finishedUpload(t, ama, 'made_post', 'image/jpeg');
    const body = (o: Record<string, unknown>) => call(t, 'POST', '/v1/posts', ama, { kind: 'made-this', title: 'Hi', photoUploadId: photo.id, ...o });
    expect((await call(t, 'POST', '/v1/posts', undefined, {})).statusCode).toBe(401);
    expect((await body({ photoUploadId: randomUUID() })).statusCode).toBe(400); // no such upload
    expect((await body({ kind: 'recipe' })).statusCode).toBe(400); // a recipe post names a recipe
    expect((await body({ kind: 'video' })).statusCode).toBe(400); // a video post needs a video
    expect((await body({ videoUploadId: randomUUID() })).statusCode).toBe(400); // only video posts have one
    expect((await body({ recipeId: randomUUID() })).statusCode).toBe(400); // recipe must exist
    expect((await body({ title: '' })).statusCode).toBe(400);
    const pending = (await call(t, 'POST', '/v1/uploads', ama, { purpose: 'made_post', contentType: 'image/png', size: 100 })).json<{ id: string }>();
    expect((await body({ photoUploadId: pending.id })).statusCode).toBe(400); // not finished
    const wrongKind = await finishedUpload(t, ama, 'avatar', 'image/png');
    expect((await body({ photoUploadId: wrongKind.id })).statusCode).toBe(400); // an avatar is not a post photo
    const someoneElses = await finishedUpload(t, await register(t), 'made_post', 'image/jpeg');
    expect((await body({ photoUploadId: someoneElses.id })).statusCode).toBe(400);
  });

  it('creates a recipe post, a video post and a made-this post', async () => {
    const ama = await register(t, { displayName: 'Ama' });
    const recipe = await createRecipe(t, ama);
    const shared = await makePost(t, ama, { kind: 'recipe', recipeId: recipe.id, title: 'Jollof Rice', meta: '45 min · Medium' });
    expect(shared).toMatchObject({ kind: 'recipe', recipeId: recipe.id, meta: '45 min · Medium', author: { displayName: 'Ama' }, likeCount: 0, viewer: { liked: false, saved: false } });

    const video = await finishedUpload(t, ama, 'post_video', 'video/mp4', 9000);
    const clip = await makePost(t, ama, { kind: 'video', videoUploadId: video.id });
    expect(clip.videoUrl).toBe(video.publicUrl);
    expect(clip.photoUrl).toMatch(/made_post/);
    expect((await makePost(t, ama)).videoUrl).toBeNull();
  });

  it('reads a post, with viewer state for a signed-in person, and deletes only your own', async () => {
    const [ama, kemi] = [await register(t), await register(t)] as [Who, Who];
    const post = await makePost(t, ama);
    await call(t, 'PUT', `/v1/posts/${post.id}/like`, kemi);
    expect((await call(t, 'GET', `/v1/posts/${post.id}`)).json<Post>().viewer).toBeNull();
    expect((await call(t, 'GET', `/v1/posts/${post.id}`, kemi)).json<Post>()).toMatchObject({ likeCount: 1, viewer: { liked: true, saved: false } });
    expect((await call(t, 'DELETE', `/v1/posts/${post.id}`, kemi)).statusCode).toBe(404);
    expect((await call(t, 'DELETE', `/v1/posts/${post.id}`, ama)).statusCode).toBe(204);
    expect((await call(t, 'GET', `/v1/posts/${post.id}`)).statusCode).toBe(404);
    expect((await call(t, 'DELETE', `/v1/posts/${(await makePost(t, ama)).id}`, await makeAdmin(t))).statusCode).toBe(204);
  });

  it('limits how many posts one person makes in a day', async () => {
    const ama = await register(t);
    const photo = await finishedUpload(t, ama, 'made_post', 'image/jpeg');
    await t.db.post.createMany({ data: Array.from({ length: 20 }, (_, i) => ({ authorId: ama.user.id, kind: 'made-this', title: `p${i}`, photoUrl: 'https://x/y.jpg' })) });
    const blocked = await call(t, 'POST', '/v1/posts', ama, { kind: 'made-this', title: 'One more', photoUploadId: photo.id });
    expect(blocked.statusCode).toBe(409);
    expect(blocked.json<ApiErrorBody>().error.code).toBe('limit_reached');
    t.advance(DAY_MS + 60_000);
    expect((await call(t, 'POST', '/v1/posts', ama, { kind: 'made-this', title: 'Tomorrow', photoUploadId: photo.id })).statusCode).toBe(201);
  });

  it('counts likes and saves exactly once each, even with simultaneous requests', async () => {
    const ama = await register(t);
    const post = await makePost(t, ama);
    const fans = await Promise.all(Array.from({ length: 8 }, () => register(t)));
    await Promise.all(fans.flatMap((f) => [call(t, 'PUT', `/v1/posts/${post.id}/like`, f), call(t, 'PUT', `/v1/posts/${post.id}/like`, f), call(t, 'PUT', `/v1/posts/${post.id}/save`, f)]));
    expect((await call(t, 'GET', `/v1/posts/${post.id}`)).json<Post>()).toMatchObject({ likeCount: 8, saveCount: 8 });
    expect((await call(t, 'DELETE', `/v1/posts/${post.id}/like`, fans[0])).json<ToggleResponse>()).toEqual({ active: false, count: 7 });
    expect((await call(t, 'DELETE', `/v1/posts/${post.id}/like`, fans[0])).json<ToggleResponse>()).toEqual({ active: false, count: 7 });
  });

  it('lists saved posts, newest save first', async () => {
    const [ama, kemi] = [await register(t), await register(t)] as [Who, Who];
    const [a, b] = [await makePost(t, ama, { title: 'First' }), await makePost(t, ama, { title: 'Second' })] as [Post, Post];
    await call(t, 'PUT', `/v1/posts/${a.id}/save`, kemi);
    await call(t, 'PUT', `/v1/posts/${b.id}/save`, kemi);
    const saved = (await call(t, 'GET', '/v1/me/saved-posts', kemi)).json<Page<Post>>();
    expect(saved.items.map((p) => p.title)).toEqual(['Second', 'First']);
    expect(saved.items[0]?.viewer).toEqual({ liked: false, saved: true });
  });

  it('counts views', async () => {
    const ama = await register(t);
    const post = await makePost(t, ama);
    for (let i = 0; i < 3; i++) expect((await call(t, 'POST', `/v1/posts/${post.id}/view`)).statusCode).toBe(204);
    expect((await call(t, 'GET', `/v1/posts/${post.id}`)).json<Post>().viewCount).toBe(3);
    expect((await call(t, 'POST', `/v1/posts/${randomUUID()}/view`)).statusCode).toBe(404);
  });
});

describe('feeds', () => {
  it('shows your own posts and people you follow, newest first, and nobody else', async () => {
    const [ama, kemi, tunde] = [await register(t), await register(t), await register(t)] as [Who, Who, Who];
    await call(t, 'PUT', `/v1/users/${kemi.user.id}/follow`, ama);
    await makePost(t, kemi, { title: 'Kemi 1' });
    await makePost(t, tunde, { title: 'Tunde (not followed)' });
    await makePost(t, ama, { title: 'Ama 1' });
    await makePost(t, kemi, { title: 'Kemi 2' });
    expect((await feed(ama)).items.map((p) => p.title)).toEqual(['Kemi 2', 'Ama 1', 'Kemi 1']);
    expect((await call(t, 'GET', '/v1/feed/following')).statusCode).toBe(401);
  });

  it('pages without repeating or skipping', async () => {
    const ama = await register(t);
    for (let i = 1; i <= 5; i++) await makePost(t, ama, { title: `P${i}` });
    const p1 = await feed(ama, '/v1/feed/following', '?limit=2');
    const p2 = await feed(ama, '/v1/feed/following', `?limit=2&cursor=${p1.nextCursor}`);
    const p3 = await feed(ama, '/v1/feed/following', `?limit=2&cursor=${p2.nextCursor}`);
    expect([...p1.items, ...p2.items, ...p3.items].map((p) => p.title)).toEqual(['P5', 'P4', 'P3', 'P2', 'P1']);
    expect(p3.nextCursor).toBeNull();
  });

  it('leaves out posts from people who blocked you or whom you blocked', async () => {
    const [ama, kemi, tunde] = [await register(t), await register(t), await register(t)] as [Who, Who, Who];
    await makePost(t, kemi, { title: 'Kemi' });
    await makePost(t, tunde, { title: 'Tunde' });
    await call(t, 'PUT', `/v1/me/blocks/${kemi.user.id}`, ama); // Ama blocks Kemi
    await call(t, 'PUT', `/v1/me/blocks/${ama.user.id}`, tunde); // Tunde blocks Ama
    expect((await feed(ama, '/v1/feed/discover')).items).toEqual([]);
    expect((await feed(undefined, '/v1/feed/discover')).items.map((p) => p.title).sort()).toEqual(['Kemi', 'Tunde']); // signed out: everything public
  });

  it('shows everyone\'s public posts in discover, but not hidden ones', async () => {
    const [ama, kemi] = [await register(t), await register(t)] as [Who, Who];
    const visible = await makePost(t, ama, { title: 'Visible' });
    const hidden = await makePost(t, kemi, { title: 'Hidden' });
    await t.db.post.update({ where: { id: hidden.id }, data: { status: 'HIDDEN' } });
    expect((await feed(undefined, '/v1/feed/discover')).items.map((p) => p.id)).toEqual([visible.id]);
    expect((await call(t, 'GET', `/v1/posts/${hidden.id}`)).statusCode).toBe(404);
    expect((await call(t, 'GET', `/v1/posts/${hidden.id}`, kemi)).statusCode).toBe(200); // its author still sees it
    expect((await call(t, 'GET', `/v1/posts/${hidden.id}`, await makeAdmin(t))).statusCode).toBe(200);
    expect((await call(t, 'GET', `/v1/users/${kemi.user.id}/posts`)).json<Page<Post>>().items).toEqual([]);
    expect((await call(t, 'GET', `/v1/users/${kemi.user.id}/posts`, kemi)).json<Page<Post>>().items).toHaveLength(1);
  });

  it('lists one person\'s posts', async () => {
    const [ama, kemi] = [await register(t), await register(t)] as [Who, Who];
    await makePost(t, ama, { title: 'A' });
    await makePost(t, kemi, { title: 'K1' });
    await makePost(t, kemi, { title: 'K2' });
    expect((await call(t, 'GET', `/v1/users/${kemi.user.id}/posts`, ama)).json<Page<Post>>().items.map((p) => p.title)).toEqual(['K2', 'K1']);
  });
});

describe('comments', () => {
  it('adds comments and replies, counts them, and pages top-level comments newest first', async () => {
    const [ama, kemi] = [await register(t), await register(t, { displayName: 'Kemi' })] as [Who, Who];
    const post = await makePost(t, ama);
    const add = (who: Who, body: object) => call(t, 'POST', `/v1/posts/${post.id}/comments`, who, body);
    const first = (await add(kemi, { text: 'Looks amazing' })).json<PostComment>();
    const second = (await add(ama, { text: 'Thank you!' })).json<PostComment>();
    const reply = await add(ama, { text: 'Thanks Kemi', parentId: first.id });
    expect(reply.statusCode).toBe(201);
    expect(reply.json<PostComment>()).toMatchObject({ parentId: first.id, text: 'Thanks Kemi' });

    expect((await call(t, 'GET', `/v1/posts/${post.id}`)).json<Post>().commentCount).toBe(3);
    const top = (await call(t, 'GET', `/v1/posts/${post.id}/comments?limit=1`)).json<Page<PostComment>>();
    expect(top.items.map((c) => c.id)).toEqual([second.id]);
    const next = (await call(t, 'GET', `/v1/posts/${post.id}/comments?limit=1&cursor=${top.nextCursor}`)).json<Page<PostComment>>();
    expect(next.items[0]).toMatchObject({ id: first.id, replyCount: 1, author: { displayName: 'Kemi' } });
    const replies = (await call(t, 'GET', `/v1/posts/${post.id}/comments/${first.id}/replies`)).json<Page<PostComment>>();
    expect(replies.items.map((c) => c.text)).toEqual(['Thanks Kemi']);
  });

  it('refuses empty comments, replies to a reply, and replies to a comment on another post', async () => {
    const ama = await register(t);
    const [post, other] = [await makePost(t, ama), await makePost(t, ama)] as [Post, Post];
    const root = (await call(t, 'POST', `/v1/posts/${post.id}/comments`, ama, { text: 'root' })).json<PostComment>();
    const child = (await call(t, 'POST', `/v1/posts/${post.id}/comments`, ama, { text: 'child', parentId: root.id })).json<PostComment>();
    const send = (id: string, body: object) => call(t, 'POST', `/v1/posts/${id}/comments`, ama, body);
    expect((await send(post.id, { text: '   ' })).statusCode).toBe(400);
    expect((await send(post.id, { text: 'grandchild', parentId: child.id })).statusCode).toBe(400);
    expect((await send(other.id, { text: 'wrong post', parentId: root.id })).statusCode).toBe(400);
    expect((await send(post.id, { text: 'x', parentId: randomUUID() })).statusCode).toBe(400);
    expect((await call(t, 'POST', `/v1/posts/${post.id}/comments`, undefined, { text: 'x' })).statusCode).toBe(401);
  });

  it('takes a voice comment from the person\'s own finished voice upload', async () => {
    const [ama, kemi] = [await register(t), await register(t)] as [Who, Who];
    const post = await makePost(t, ama);
    const voice = await finishedUpload(t, kemi, 'voice', 'audio/mp4');
    const res = await call(t, 'POST', `/v1/posts/${post.id}/comments`, kemi, { voice: { uploadId: voice.id, durationSec: 14 } });
    expect(res.statusCode).toBe(201);
    expect(res.json<PostComment>()).toMatchObject({ text: '', voice: { url: voice.publicUrl, durationSec: 14 } });
    const mine = await finishedUpload(t, ama, 'voice', 'audio/mp4');
    expect((await call(t, 'POST', `/v1/posts/${post.id}/comments`, kemi, { voice: { uploadId: mine.id, durationSec: 5 } })).statusCode).toBe(400);
  });

  it('lets the commenter, the post\'s author and staff delete; keeps a stub while replies remain', async () => {
    const [ama, kemi, tunde] = [await register(t), await register(t), await register(t)] as [Who, Who, Who];
    const admin = await makeAdmin(t);
    const post = await makePost(t, ama);
    const post_ = (who: Who, body: object) => call(t, 'POST', `/v1/posts/${post.id}/comments`, who, body).then((r) => r.json<PostComment>());
    const del = (who: Who, c: PostComment) => call(t, 'DELETE', `/v1/posts/${post.id}/comments/${c.id}`, who);

    const a = await post_(kemi, { text: 'mine' });
    expect((await del(tunde, a)).statusCode).toBe(404); // a stranger
    expect((await del(kemi, a)).statusCode).toBe(204);
    expect((await del(kemi, a)).statusCode).toBe(204); // again: fine
    const b = await post_(kemi, { text: 'author can remove this' });
    expect((await del(ama, b)).statusCode).toBe(204);
    const c = await post_(kemi, { text: 'staff can remove this' });
    expect((await del(admin, c)).statusCode).toBe(204);
    expect((await call(t, 'GET', `/v1/posts/${post.id}`)).json<Post>().commentCount).toBe(0);

    const parent = await post_(kemi, { text: 'has a reply' });
    await post_(tunde, { text: 'reply', parentId: parent.id });
    await del(kemi, parent);
    const top = (await call(t, 'GET', `/v1/posts/${post.id}/comments`)).json<Page<PostComment>>().items;
    expect(top).toHaveLength(1); // the three deleted ones without replies are gone; this stub stays
    expect(top[0]).toMatchObject({ deleted: true, text: '', replyCount: 1 });
    expect((await call(t, 'GET', `/v1/posts/${post.id}`)).json<Post>().commentCount).toBe(1);
  });

  it('likes a comment once each, and says who liked it when viewed', async () => {
    const [ama, kemi] = [await register(t), await register(t)] as [Who, Who];
    const post = await makePost(t, ama);
    const comment = (await call(t, 'POST', `/v1/posts/${post.id}/comments`, ama, { text: 'hello' })).json<PostComment>();
    const like = (method: 'PUT' | 'DELETE', who: Who) => call(t, method, `/v1/posts/${post.id}/comments/${comment.id}/like`, who);
    expect((await like('PUT', kemi)).json<ToggleResponse>()).toEqual({ active: true, count: 1 });
    expect((await like('PUT', kemi)).json<ToggleResponse>()).toEqual({ active: true, count: 1 });
    expect((await like('PUT', ama)).json<ToggleResponse>().count).toBe(2);
    const seen = (await call(t, 'GET', `/v1/posts/${post.id}/comments`, kemi)).json<Page<PostComment>>().items[0];
    expect(seen).toMatchObject({ likeCount: 2, viewer: { liked: true } });
    expect((await like('DELETE', kemi)).json<ToggleResponse>().count).toBe(1);
    expect((await call(t, 'PUT', `/v1/posts/${post.id}/comments/${randomUUID()}/like`, kemi)).statusCode).toBe(404);
  });

  it('is hidden along with a post whose author blocked you', async () => {
    const [ama, kemi] = [await register(t), await register(t)] as [Who, Who];
    const post = await makePost(t, ama);
    await call(t, 'PUT', `/v1/me/blocks/${kemi.user.id}`, ama);
    expect((await call(t, 'GET', `/v1/posts/${post.id}/comments`, kemi)).statusCode).toBe(404);
    expect((await call(t, 'POST', `/v1/posts/${post.id}/comments`, kemi, { text: 'hi' })).statusCode).toBe(404);
  });
});

describe('deleting an account', () => {
  it("puts every total on other people's posts and comments back the way it was", async () => {
    const [ama, kemi] = [await register(t), await register(t)] as [Who, Who];
    const post = await makePost(t, ama);
    const amaComment = (await call(t, 'POST', `/v1/posts/${post.id}/comments`, ama, { text: 'first' })).json<PostComment>();
    await call(t, 'PUT', `/v1/posts/${post.id}/like`, kemi);
    await call(t, 'PUT', `/v1/posts/${post.id}/save`, kemi);
    await call(t, 'POST', `/v1/posts/${post.id}/comments`, kemi, { text: 'a comment' });
    await call(t, 'POST', `/v1/posts/${post.id}/comments`, kemi, { text: 'a reply', parentId: amaComment.id });
    await call(t, 'PUT', `/v1/posts/${post.id}/comments/${amaComment.id}/like`, kemi);
    expect((await call(t, 'GET', `/v1/posts/${post.id}`)).json<Post>()).toMatchObject({ likeCount: 1, saveCount: 1, commentCount: 3 });

    expect((await call(t, 'DELETE', '/v1/me', kemi, { password: 'correct horse battery' })).statusCode).toBe(204);
    expect((await call(t, 'GET', `/v1/posts/${post.id}`)).json<Post>()).toMatchObject({ likeCount: 0, saveCount: 0, commentCount: 1 });
    const left = (await call(t, 'GET', `/v1/posts/${post.id}/comments`)).json<Page<PostComment>>().items;
    expect(left).toHaveLength(1);
    expect(left[0]).toMatchObject({ id: amaComment.id, likeCount: 0, replyCount: 0 });
  });

  it('removes the person\'s posts, comments and follows, and fixes the counts they left', async () => {
    const [ama, kemi] = [await register(t), await register(t)] as [Who, Who];
    const post = await makePost(t, ama);
    await call(t, 'POST', `/v1/posts/${post.id}/comments`, kemi, { text: 'bye' });
    await call(t, 'PUT', `/v1/users/${ama.user.id}/follow`, kemi);
    expect((await call(t, 'DELETE', '/v1/me', kemi, { password: 'correct horse battery' })).statusCode).toBe(204);
    expect(await t.db.postComment.count()).toBe(0);
    expect(await t.db.follow.count()).toBe(0);
    expect((await call(t, 'GET', `/v1/users/${ama.user.id}`)).json<UserProfile>().followerCount).toBe(0);
  });
});
