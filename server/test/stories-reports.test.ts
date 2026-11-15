import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { AdminReport, Conversation, Message, Page, PostComment, Story, StoryGroup, StoryViewer } from '@shared';
import { buildApp } from '../src/app';
import { AUTO_HIDE_REPORTS } from '../src/social/reports';
import { DAY_MS, makeApp, register, testConfig, type TestApp } from './helpers';
import { call, createRecipe, makeAdmin } from './recipeHelpers';
import { finishedUpload, makePost, newId } from './socialHelpers';

let t: TestApp;
beforeAll(async () => {
  t = await makeApp({ ACCESS_TOKEN_TTL_SECONDS: String(60 * 86400) });
});
afterAll(() => t.close());
beforeEach(() => t.reset());

type Who = Awaited<ReturnType<typeof register>>;

async function postStory(who: Who, overrides: Record<string, unknown> = {}): Promise<Story> {
  const photo = await finishedUpload(t, who, 'story', 'image/jpeg');
  const res = await call(t, 'POST', '/v1/stories', who, { photoUploadId: photo.id, ...overrides });
  if (res.statusCode !== 201) throw new Error(`story failed: ${res.statusCode} ${res.body}`);
  return res.json<Story>();
}
const tray = async (who: Who) => (await call(t, 'GET', '/v1/stories', who)).json<{ groups: StoryGroup[] }>().groups;
const follow = (a: Who, b: Who) => call(t, 'PUT', `/v1/users/${b.user.id}/follow`, a);

describe('posting a story', () => {
  it('needs a sign-in and a finished story photo', async () => {
    const ama = await register(t);
    expect((await call(t, 'POST', '/v1/stories', undefined, {})).statusCode).toBe(401);
    const avatar = await finishedUpload(t, ama, 'avatar', 'image/png');
    expect((await call(t, 'POST', '/v1/stories', ama, { photoUploadId: avatar.id })).statusCode).toBe(400);
    expect((await call(t, 'POST', '/v1/stories', ama, { photoUploadId: randomUUID() })).statusCode).toBe(400);
    expect((await call(t, 'POST', '/v1/stories', ama, { photoUploadId: (await finishedUpload(t, ama, 'story', 'image/png')).id, recipeId: randomUUID() })).statusCode).toBe(400);
  });

  it('lasts 24 hours and can point at a recipe', async () => {
    const ama = await register(t);
    const recipe = await createRecipe(t, ama);
    const story = await postStory(ama, { recipeId: recipe.id });
    expect(story).toMatchObject({ recipeId: recipe.id, viewCount: 0, seen: true });
    expect(Date.parse(story.expiresAt) - Date.parse(story.createdAt)).toBe(24 * 3_600_000);
  });

  it('limits how many a person posts in a day', async () => {
    const ama = await register(t);
    const photo = await finishedUpload(t, ama, 'story', 'image/jpeg');
    await t.db.story.createMany({ data: Array.from({ length: 30 }, () => ({ authorId: ama.user.id, photoUrl: 'https://x/y.jpg', expiresAt: new Date(Date.now() + DAY_MS) })) });
    expect((await call(t, 'POST', '/v1/stories', ama, { photoUploadId: photo.id })).statusCode).toBe(409);
  });
});

describe('the story tray', () => {
  it('shows you and the people you follow who have a story up, and no one else', async () => {
    const [ama, kemi, tunde, stranger] = [await register(t), await register(t), await register(t), await register(t)] as [Who, Who, Who, Who];
    await follow(ama, kemi);
    await follow(ama, tunde);
    await postStory(kemi);
    await postStory(stranger); // not followed
    await postStory(ama);
    const groups = await tray(ama);
    expect(groups.map((g) => g.author.id)).toEqual([ama.user.id, kemi.user.id]); // Tunde has none, the stranger is not followed
    expect((await call(t, 'GET', '/v1/stories')).statusCode).toBe(401);
  });

  it('puts your own first, then people with something new, and groups several stories oldest first', async () => {
    const [ama, kemi, tunde] = [await register(t), await register(t), await register(t)] as [Who, Who, Who];
    await follow(ama, kemi);
    await follow(ama, tunde);
    const k1 = await postStory(kemi);
    const k2 = await postStory(kemi);
    await postStory(tunde);
    await postStory(ama);
    await call(t, 'POST', `/v1/stories/${(await tray(ama)).find((g) => g.author.id === tunde.user.id)?.stories[0]?.id}/view`, ama);

    const groups = await tray(ama);
    expect(groups.map((g) => g.author.id)).toEqual([ama.user.id, kemi.user.id, tunde.user.id]); // Kemi unseen before Tunde (seen)
    expect(groups[0]?.hasUnseen).toBe(false); // your own never counts as unseen
    expect(groups[1]?.stories.map((s) => s.id)).toEqual([k1.id, k2.id]);
    expect(groups[1]).toMatchObject({ hasUnseen: true });
    expect(groups[2]).toMatchObject({ hasUnseen: false });
  });

  it('drops a story when its 24 hours are up', async () => {
    const [ama, kemi] = [await register(t), await register(t)] as [Who, Who];
    await follow(ama, kemi);
    await postStory(kemi);
    expect(await tray(ama)).toHaveLength(1);
    t.advance(23 * 3_600_000);
    expect(await tray(ama)).toHaveLength(1);
    t.advance(2 * 3_600_000);
    expect(await tray(ama)).toEqual([]);
  });

  it('leaves out people who blocked you or whom you blocked', async () => {
    const [ama, kemi, tunde] = [await register(t), await register(t), await register(t)] as [Who, Who, Who];
    await follow(ama, kemi);
    await follow(ama, tunde);
    await postStory(kemi);
    await postStory(tunde);
    await call(t, 'PUT', `/v1/me/blocks/${kemi.user.id}`, ama);
    await call(t, 'PUT', `/v1/me/blocks/${ama.user.id}`, tunde);
    expect(await tray(ama)).toEqual([]);
    expect((await call(t, 'GET', `/v1/users/${kemi.user.id}/stories`, ama)).statusCode).toBe(404);
  });

  it('shows one person\'s stories', async () => {
    const [ama, kemi] = [await register(t), await register(t)] as [Who, Who];
    expect((await call(t, 'GET', `/v1/users/${kemi.user.id}/stories`, ama)).json<{ group: StoryGroup | null }>().group).toBeNull();
    const s = await postStory(kemi);
    expect((await call(t, 'GET', `/v1/users/${kemi.user.id}/stories`, ama)).json<{ group: StoryGroup }>().group.stories.map((x) => x.id)).toEqual([s.id]);
  });
});

describe('seeing a story', () => {
  it('counts each viewer once, shows the count and the viewers to the author only', async () => {
    const [ama, kemi, tunde] = [await register(t, { displayName: 'Ama' }), await register(t, { displayName: 'Kemi' }), await register(t, { displayName: 'Tunde' })] as [Who, Who, Who];
    const story = await postStory(ama);
    for (const who of [kemi, kemi, tunde]) expect((await call(t, 'POST', `/v1/stories/${story.id}/view`, who)).statusCode).toBe(204);
    await call(t, 'POST', `/v1/stories/${story.id}/view`, ama); // your own does not count
    // Fix the order explicitly: two views a few milliseconds apart must not decide this test by luck.
    await t.db.storyView.updateMany({ where: { viewerId: kemi.user.id }, data: { viewedAt: new Date(Date.now() - 60_000) } });

    const mine = (await call(t, 'GET', `/v1/users/${ama.user.id}/stories`, ama)).json<{ group: StoryGroup }>().group.stories[0];
    expect(mine).toMatchObject({ viewCount: 2, seen: true });
    const asKemi = (await call(t, 'GET', `/v1/users/${ama.user.id}/stories`, kemi)).json<{ group: StoryGroup }>().group.stories[0];
    expect(asKemi).toMatchObject({ viewCount: null, seen: true });

    const viewers = (await call(t, 'GET', `/v1/stories/${story.id}/viewers`, ama)).json<Page<StoryViewer>>();
    expect(viewers.items.map((v) => v.user.displayName)).toEqual(['Tunde', 'Kemi']);
    expect((await call(t, 'GET', `/v1/stories/${story.id}/viewers`, kemi)).statusCode).toBe(404);
  });

  it('stays exact when many people look at once', async () => {
    const ama = await register(t);
    const story = await postStory(ama);
    const fans = await Promise.all(Array.from({ length: 8 }, () => register(t)));
    await Promise.all(fans.flatMap((f) => [call(t, 'POST', `/v1/stories/${story.id}/view`, f), call(t, 'POST', `/v1/stories/${story.id}/view`, f)]));
    expect((await call(t, 'GET', `/v1/users/${ama.user.id}/stories`, ama)).json<{ group: StoryGroup }>().group.stories[0]?.viewCount).toBe(8);
  });

  it('cannot be viewed once expired, or by someone blocked', async () => {
    const [ama, kemi] = [await register(t), await register(t)] as [Who, Who];
    const story = await postStory(ama);
    await call(t, 'PUT', `/v1/me/blocks/${kemi.user.id}`, ama);
    expect((await call(t, 'POST', `/v1/stories/${story.id}/view`, kemi)).statusCode).toBe(404);
    await call(t, 'DELETE', `/v1/me/blocks/${kemi.user.id}`, ama);
    expect((await call(t, 'POST', `/v1/stories/${story.id}/view`, kemi)).statusCode).toBe(204);
    t.advance(25 * 3_600_000);
    expect((await call(t, 'POST', `/v1/stories/${story.id}/view`, kemi)).statusCode).toBe(404);
  });
});

describe('removing stories', () => {
  it('lets the author or staff delete, and removes the photo', async () => {
    const [ama, kemi] = [await register(t), await register(t)] as [Who, Who];
    const a = await postStory(ama);
    const b = await postStory(ama);
    expect((await call(t, 'DELETE', `/v1/stories/${a.id}`, kemi)).statusCode).toBe(404);
    expect((await call(t, 'DELETE', `/v1/stories/${a.id}`, ama)).statusCode).toBe(204);
    expect(t.storage.deleted).toHaveLength(1);
    expect((await call(t, 'DELETE', `/v1/stories/${b.id}`, await makeAdmin(t))).statusCode).toBe(204);
    expect(t.storage.deleted).toHaveLength(2);
  });

  it('sweeps stories that ended more than an hour ago, with their photos', async () => {
    const ama = await register(t);
    const old = await postStory(ama);
    const fresh = await (async () => {
      t.advance(25 * 3_600_000 + 5 * 60_000); // old ended 1h05 ago
      return postStory(ama);
    })();
    const later = await buildApp({ config: testConfig(), db: t.db, storage: t.storage, pushSender: null, now: () => new Date(Date.now() + 25 * 3_600_000 + 5 * 60_000) });
    await later.app.ready();
    try {
      expect(await later.stories.sweepExpired()).toBe(1);
      expect(await t.db.story.findUnique({ where: { id: old.id } })).toBeNull();
      expect(await t.db.story.findUnique({ where: { id: fresh.id } })).not.toBeNull();
      expect(t.storage.deleted).toHaveLength(1);
    } finally {
      await later.app.close();
    }
  });
});

describe('reporting', () => {
  const report = (who: Who | undefined, body: Record<string, unknown>) => call(t, 'POST', '/v1/reports', who, { reason: 'spam', ...body });

  it('needs a sign-in, a real target, and refuses your own content', async () => {
    const [ama, kemi] = [await register(t), await register(t)] as [Who, Who];
    const post = await makePost(t, ama);
    expect((await report(undefined, { targetType: 'post', targetId: post.id })).statusCode).toBe(401);
    expect((await report(kemi, { targetType: 'post', targetId: randomUUID() })).statusCode).toBe(404);
    expect((await report(ama, { targetType: 'post', targetId: post.id })).statusCode).toBe(403);
    expect((await report(ama, { targetType: 'user', targetId: ama.user.id })).statusCode).toBe(403);
    expect((await report(kemi, { targetType: 'post', targetId: post.id, reason: 'rude' })).statusCode).toBe(400);
    expect((await report(kemi, { targetType: 'recipe', targetId: post.id })).statusCode).toBe(400);
    expect((await report(kemi, { targetType: 'post', targetId: post.id })).statusCode).toBe(202);
  });

  it('counts a person once per thing, however many times they report it', async () => {
    const [ama, kemi] = [await register(t), await register(t)] as [Who, Who];
    const post = await makePost(t, ama);
    for (let i = 0; i < 4; i++) await report(kemi, { targetType: 'post', targetId: post.id });
    expect(await t.db.report.count()).toBe(1);
    expect((await call(t, 'GET', `/v1/posts/${post.id}`)).statusCode).toBe(200); // one person alone does not hide it
  });

  it('hides a post once enough different people report it, but not before', async () => {
    const ama = await register(t);
    const post = await makePost(t, ama);
    const reporters = await Promise.all(Array.from({ length: AUTO_HIDE_REPORTS }, () => register(t)));
    for (const r of reporters.slice(0, AUTO_HIDE_REPORTS - 1)) await report(r, { targetType: 'post', targetId: post.id });
    expect((await call(t, 'GET', `/v1/posts/${post.id}`)).statusCode).toBe(200);
    await report(reporters[AUTO_HIDE_REPORTS - 1], { targetType: 'post', targetId: post.id });
    expect((await call(t, 'GET', `/v1/posts/${post.id}`)).statusCode).toBe(404);
    expect((await call(t, 'GET', `/v1/posts/${post.id}`, ama)).statusCode).toBe(200); // its author still sees it
  });

  it('can report a comment, a person, a story and a message from a conversation you are in', async () => {
    const [ama, kemi, outsider] = [await register(t), await register(t), await register(t)] as [Who, Who, Who];
    const post = await makePost(t, ama);
    const comment = (await call(t, 'POST', `/v1/posts/${post.id}/comments`, ama, { text: 'buy my stuff' })).json<PostComment>();
    const story = await postStory(ama);
    const convo = (await call(t, 'POST', '/v1/conversations', ama, { kind: 'direct', userId: kemi.user.id })).json<Conversation>();
    const message = (await call(t, 'POST', `/v1/conversations/${convo.id}/messages`, ama, { kind: 'text', text: 'spam spam', clientId: newId() })).json<Message>();

    for (const [type, id] of [['comment', comment.id], ['user', ama.user.id], ['story', story.id], ['message', message.id]] as const) {
      expect((await report(kemi, { targetType: type, targetId: id })).statusCode).toBe(202);
    }
    // Someone outside the conversation cannot even see that the message exists.
    expect((await report(outsider, { targetType: 'message', targetId: message.id })).statusCode).toBe(404);
  });
});

describe('the moderation queue', () => {
  async function setup() {
    const [ama, kemi, tunde] = [await register(t, { displayName: 'Ama' }), await register(t, { displayName: 'Kemi' }), await register(t, { displayName: 'Tunde' })] as [Who, Who, Who];
    return { ama, kemi, tunde, admin: await makeAdmin(t) };
  }
  const queue = async (admin: Who, query = '') => (await call(t, 'GET', `/v1/admin/reports${query}`, admin)).json<Page<AdminReport>>();
  const act = (admin: Who, id: string, action: string) => call(t, 'POST', `/v1/admin/reports/${id}/action`, admin, { action });

  it('is for staff only', async () => {
    const { ama } = await setup();
    expect((await call(t, 'GET', '/v1/admin/reports')).statusCode).toBe(401);
    expect((await call(t, 'GET', '/v1/admin/reports', ama)).statusCode).toBe(403);
    expect((await call(t, 'POST', `/v1/admin/reports/${randomUUID()}/action`, ama, { action: 'hide' })).statusCode).toBe(403);
  });

  it('lists reports newest first with who reported, how many, and a snapshot of the thing', async () => {
    const { ama, kemi, tunde, admin } = await setup();
    const post = await makePost(t, ama, { title: 'Questionable post' });
    await report_(kemi, 'post', post.id, 'abuse');
    await report_(tunde, 'post', post.id, 'spam');
    await report_(kemi, 'user', ama.user.id, 'other');

    const all = await queue(admin);
    expect(all.items).toHaveLength(3);
    const onPost = all.items.find((r) => r.targetType === 'post' && r.reporter.displayName === 'Kemi');
    expect(onPost).toMatchObject({ reason: 'abuse', status: 'open', reportCount: 2, target: { summary: 'Questionable post', authorId: ama.user.id, hidden: false } });
    expect(all.items.find((r) => r.targetType === 'user')?.target?.summary).toContain('(Ama)');
    expect((await queue(admin, '?type=user')).items).toHaveLength(1);
    expect((await queue(admin, '?status=actioned')).items).toEqual([]);
    const page = await queue(admin, '?limit=2');
    expect(page.items).toHaveLength(2);
    expect((await queue(admin, `?limit=2&cursor=${page.nextCursor}`)).items).toHaveLength(1);
  });

  function report_(who: Who, type: string, id: string, reason: string) {
    return call(t, 'POST', '/v1/reports', who, { targetType: type, targetId: id, reason });
  }

  it('hides a post and closes every report about it, then restores it', async () => {
    const { ama, kemi, tunde, admin } = await setup();
    const post = await makePost(t, ama);
    await report_(kemi, 'post', post.id, 'abuse');
    await report_(tunde, 'post', post.id, 'abuse');
    const first = (await queue(admin)).items[0] as AdminReport;

    const hidden = (await act(admin, first.id, 'hide')).json<AdminReport>();
    expect(hidden).toMatchObject({ status: 'actioned', resolution: 'hidden', target: { hidden: true } });
    expect((await queue(admin, '?status=open')).items).toEqual([]);
    expect(await t.db.report.count({ where: { status: 'ACTIONED', resolvedById: admin.user.id } })).toBe(2);
    expect((await call(t, 'GET', `/v1/posts/${post.id}`)).statusCode).toBe(404);

    const restored = (await act(admin, first.id, 'restore')).json<AdminReport>();
    expect(restored.target?.hidden).toBe(false);
    expect((await call(t, 'GET', `/v1/posts/${post.id}`)).statusCode).toBe(200);
  });

  it('removes a reported comment and message, and expires a reported story', async () => {
    const { ama, kemi, admin } = await setup();
    const post = await makePost(t, ama);
    const comment = (await call(t, 'POST', `/v1/posts/${post.id}/comments`, ama, { text: 'bad comment' })).json<PostComment>();
    const story = await postStory(ama);
    const convo = (await call(t, 'POST', '/v1/conversations', ama, { kind: 'direct', userId: kemi.user.id })).json<Conversation>();
    const msg = (await call(t, 'POST', `/v1/conversations/${convo.id}/messages`, ama, { kind: 'text', text: 'bad message', clientId: newId() })).json<Message>();
    for (const [type, id] of [['comment', comment.id], ['story', story.id], ['message', msg.id]] as const) await report_(kemi, type, id, 'abuse');

    for (const r of (await queue(admin)).items) expect((await act(admin, r.id, 'hide')).statusCode).toBe(200);

    expect((await call(t, 'GET', `/v1/posts/${post.id}/comments`)).json<Page<PostComment>>().items).toEqual([]);
    expect((await call(t, 'GET', `/v1/users/${ama.user.id}/stories`, kemi)).json<{ group: unknown }>().group).toBeNull();
    const history = (await call(t, 'GET', `/v1/conversations/${convo.id}/messages`, kemi)).json<{ items: Message[] }>().items;
    expect(history[0]).toMatchObject({ deleted: true });
    expect(JSON.stringify(history)).not.toContain('bad message');
  });

  it('dismisses a report without changing anything, and refuses actions that make no sense', async () => {
    const { ama, kemi, admin } = await setup();
    const post = await makePost(t, ama);
    await report_(kemi, 'post', post.id, 'other');
    await report_(kemi, 'user', ama.user.id, 'other');
    const items = (await queue(admin)).items;
    const onPost = items.find((r) => r.targetType === 'post') as AdminReport;
    const onUser = items.find((r) => r.targetType === 'user') as AdminReport;

    expect((await act(admin, onPost.id, 'dismiss')).json<AdminReport>()).toMatchObject({ status: 'dismissed', resolution: 'dismissed' });
    expect((await call(t, 'GET', `/v1/posts/${post.id}`)).statusCode).toBe(200);
    expect((await act(admin, onUser.id, 'hide')).statusCode).toBe(400); // a person cannot be hidden
    expect((await act(admin, onUser.id, 'restore')).statusCode).toBe(400); // only posts can be restored
    expect((await act(admin, onUser.id, 'explode')).statusCode).toBe(400);
    expect((await act(admin, randomUUID(), 'dismiss')).statusCode).toBe(404);
  });

  it('still shows a report whose target has been deleted', async () => {
    const { ama, kemi, admin } = await setup();
    const post = await makePost(t, ama);
    await report_(kemi, 'post', post.id, 'spam');
    await call(t, 'DELETE', `/v1/posts/${post.id}`, ama);
    expect((await queue(admin)).items[0]).toMatchObject({ target: null, reportCount: 1 });
  });
});

describe('deleting an account', () => {
  it('removes the person\'s stories and views', async () => {
    const [ama, kemi] = [await register(t), await register(t)] as [Who, Who];
    const story = await postStory(ama);
    await call(t, 'POST', `/v1/stories/${story.id}/view`, kemi);
    expect((await call(t, 'DELETE', '/v1/me', ama, { password: 'correct horse battery' })).statusCode).toBe(204);
    expect(await t.db.story.count()).toBe(0);
    expect(await t.db.storyView.count()).toBe(0);
  });
});
