import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { AdminReport, Entitlements, HouseAccount, InviteStatus, Page, Post, PublicAd, Recipe } from '@shared';
import { buildApp } from '../src/app';
import { MAX_REWARDS } from '../src/invites/service';
import { DAY_MS, makeApp, register, testConfig, type TestApp } from './helpers';
import { call, createRecipe, makeAdmin } from './recipeHelpers';
import { makePost } from './socialHelpers';

let t: TestApp;
beforeAll(async () => {
  // Long-lived access tokens: some tests move the server's clock by weeks and must stay signed in.
  t = await makeApp({ ACCESS_TOKEN_TTL_SECONDS: String(120 * 86400) });
});
afterAll(() => t.close());
beforeEach(() => t.reset());

type Who = Awaited<ReturnType<typeof register>>;
const status = async (who: Who) => (await call(t, 'GET', '/v1/me/invite', who)).json<InviteStatus>();
const plan = async (who: Who) => (await call(t, 'GET', '/v1/me/entitlements', who)).json<Entitlements>();
const redeem = (who: Who, code: string) => call(t, 'POST', '/v1/invites/redeem', who, { code });

/** A friend who joins with the inviter's code. `act` says whether they then do something real. */
async function friend(inviter: Who, recipeId: string | null, act = true): Promise<Who> {
  const f = await register(t);
  const res = await redeem(f, (await status(inviter)).code);
  if (res.statusCode !== 200) throw new Error(`redeem failed: ${res.statusCode} ${res.body}`);
  if (act && recipeId) await call(t, 'PUT', `/v1/recipes/${recipeId}/save`, f);
  return f;
}
/** A recipe for friends to save, made by someone other than the inviter. */
async function sharedRecipe(): Promise<Recipe> {
  return createRecipe(t, await register(t, { displayName: 'Chef' }));
}

describe('the invite code', () => {
  it('is made the first time it is asked for, stays the same, and starts at zero', async () => {
    const ama = await register(t);
    expect((await call(t, 'GET', '/v1/me/invite')).statusCode).toBe(401);
    const first = await status(ama);
    expect(first.code).toMatch(/^[A-HJ-NP-Z2-9]{8}$/); // no 0/O/1/I/L
    expect(first).toMatchObject({ qualified: 0, pending: 0, target: 10, untilNextReward: 10, rewardsEarned: 0, proUntil: null });
    expect((await status(ama)).code).toBe(first.code);
    expect((await status(await register(t))).code).not.toBe(first.code);
  });

  it('is made once even when asked for many times at once', async () => {
    const ama = await register(t);
    const codes = await Promise.all(Array.from({ length: 6 }, () => status(ama)));
    expect(new Set(codes.map((c) => c.code)).size).toBe(1);
    expect(await t.db.inviteCode.count()).toBe(1);
  });
});

describe('using a code', () => {
  it('links a new person to the inviter and says who it was', async () => {
    const ama = await register(t, { displayName: 'Ama' });
    const kemi = await register(t);
    const res = await redeem(kemi, (await status(ama)).code.toLowerCase()); // case does not matter
    expect(res.statusCode).toBe(200);
    expect(res.json<{ inviter: { displayName: string } }>().inviter.displayName).toBe('Ama');
    expect(await status(ama)).toMatchObject({ qualified: 0, pending: 1 });
  });

  it('refuses a made-up code, your own, a second code, an old account, and a signed-out request', async () => {
    const ama = await register(t);
    const code = (await status(ama)).code;
    const kemi = await register(t);
    expect((await redeem(kemi, 'ZZZZZZZZ')).statusCode).toBe(404);
    expect((await redeem(ama, code)).statusCode).toBe(400);
    expect((await redeem(kemi, code)).statusCode).toBe(200);
    expect((await redeem(kemi, (await status(await register(t))).code)).statusCode).toBe(400); // already used one
    const old = await register(t);
    await t.db.user.update({ where: { id: old.user.id }, data: { createdAt: new Date(Date.now() - 8 * DAY_MS) } });
    expect((await redeem(old, code)).statusCode).toBe(400);
    expect((await call(t, 'POST', '/v1/invites/redeem', undefined, { code })).statusCode).toBe(401);
    expect((await call(t, 'POST', '/v1/invites/redeem', kemi, { code: 'x' })).statusCode).toBe(400);
  });

  it('limits how fast codes can be guessed', async () => {
    const strict = await makeApp({ AUTH_RATE_LIMIT_MAX: '3', RATE_LIMIT_MAX: '100000', ACCESS_TOKEN_TTL_SECONDS: '999999' });
    try {
      const who = await register(strict);
      const codes: number[] = [];
      for (let i = 0; i < 5; i++) {
        codes.push((await strict.app.inject({ method: 'POST', url: '/v1/invites/redeem', headers: { authorization: `Bearer ${who.tokens.accessToken}` }, payload: { code: 'ZZZZZZZZ' } })).statusCode);
      }
      expect(codes).toEqual([404, 404, 404, 429, 429]);
    } finally {
      await strict.close();
    }
  });
});

describe('when a friend counts', () => {
  it('only after they do something real', async () => {
    const ama = await register(t);
    const recipe = await sharedRecipe();
    const idle = await friend(ama, null, false);
    expect(await status(ama)).toMatchObject({ qualified: 0, pending: 1 });
    await call(t, 'PUT', `/v1/recipes/${recipe.id}/save`, idle);
    expect(await status(ama)).toMatchObject({ qualified: 1, pending: 0, untilNextReward: 9 });
  });

  it.each([
    ['saves a recipe', async (f: Who, recipeId: string) => call(t, 'PUT', `/v1/recipes/${recipeId}/save`, f)],
    ['puts a recipe on their want-to-cook list', async (f: Who, recipeId: string) => call(t, 'POST', '/v1/me/want-to-cook', f, { recipeId })],
    ['posts', async (f: Who) => makePost(t, f)],
    ['publishes a recipe', async (f: Who) => createRecipe(t, f)],
  ])('when they %s', async (_label, act) => {
    const ama = await register(t);
    const recipe = await sharedRecipe();
    const f = await friend(ama, null, false);
    await act(f, recipe.id);
    expect((await status(ama)).qualified).toBe(1);
  });

  it('not for a draft recipe, a pantry item, or a like', async () => {
    const ama = await register(t);
    const recipe = await sharedRecipe();
    const f = await friend(ama, null, false);
    await createRecipe(t, f, { status: 'draft' });
    await call(t, 'POST', '/v1/me/pantry', f, { name: 'Rice', amount: 1, unit: 'kg', category: 'grains' });
    await call(t, 'PUT', `/v1/recipes/${recipe.id}/like`, f);
    expect((await status(ama)).qualified).toBe(0);
  });

});

describe('the reward', () => {
  async function inviteMany(inviter: Who, count: number): Promise<Who[]> {
    const recipe = await sharedRecipe();
    const friends: Who[] = [];
    for (let i = 0; i < count; i++) friends.push(await friend(inviter, recipe.id));
    return friends;
  }

  it('gives nothing for nine friends, and a month of Pro to the inviter and all ten at ten', async () => {
    const ama = await register(t);
    const friends = await inviteMany(ama, 9);
    expect(await status(ama)).toMatchObject({ qualified: 9, untilNextReward: 1, rewardsEarned: 0 });
    expect((await plan(ama)).tier).toBe('free');

    const tenth = (await inviteMany(ama, 1))[0] as Who;
    const earned = await status(ama);
    expect(earned).toMatchObject({ qualified: 10, rewardsEarned: 1, untilNextReward: 10 });
    expect(Date.parse(earned.proUntil as string) - Date.now()).toBeGreaterThan(29 * DAY_MS);

    for (const who of [ama, tenth, ...friends]) {
      const e = await plan(who);
      expect(e).toMatchObject({ tier: 'pro', status: 'active', source: 'promo', willRenew: false });
      expect(e.features.exclusiveRecipes).toBe(true);
    }
    expect((await plan(await register(t))).tier).toBe('free'); // someone who was not part of it
  });

  it('is granted once however many times it is checked, and lapses after a month', async () => {
    const ama = await register(t);
    const first = (await inviteMany(ama, 10))[0] as Who;
    await status(ama);
    await status(ama);
    expect(await t.db.promoGrant.count({ where: { userId: ama.user.id } })).toBe(1);
    expect(await t.db.promoGrant.count()).toBe(11); // the inviter and the ten
    expect((await plan(first)).tier).toBe('pro');
    t.advance(31 * DAY_MS);
    expect(await plan(ama)).toMatchObject({ tier: 'free', source: 'none', status: 'none' });
    expect((await plan(first)).tier).toBe('free');
  });

  /** Friends who already count, made straight in the database to keep the test quick. */
  async function seedQualified(inviter: Who, count: number): Promise<void> {
    const base = Date.now();
    const users = await Promise.all(
      Array.from({ length: count }, (_, i) => t.db.user.create({ data: { displayName: `Seed ${i}`, handle: `seed${base}${i}` } })),
    );
    await t.db.invite.createMany({
      data: users.map((u, i) => ({ inviterId: inviter.user.id, inviteeId: u.id, code: 'SEEDSEED', qualifiedAt: new Date(base + i) })),
    });
  }

  it('queues a second reward after the first', async () => {
    const ama = await register(t);
    await seedQualified(ama, 20);
    const two = await status(ama);
    expect(two.rewardsEarned).toBe(2);
    expect(Date.parse(two.proUntil as string) - Date.now()).toBeGreaterThan(59 * DAY_MS);
    const grants = await t.db.promoGrant.findMany({ where: { userId: ama.user.id }, orderBy: { startsAt: 'asc' } });
    expect(grants[1]?.startsAt.getTime()).toBe(grants[0]?.endsAt.getTime()); // back to back
  });

  it('stops after three rewards however many friends join', async () => {
    const ama = await register(t);
    await seedQualified(ama, 50);
    const status_ = await status(ama);
    expect(status_).toMatchObject({ qualified: 50, rewardsEarned: MAX_REWARDS });
    expect(await t.db.promoGrant.count({ where: { userId: ama.user.id } })).toBe(MAX_REWARDS);
    expect(Date.parse(status_.proUntil as string) - Date.now()).toBeGreaterThan(89 * DAY_MS);
    expect(Date.parse(status_.proUntil as string) - Date.now()).toBeLessThan(91 * DAY_MS);
  });

  it('turns into an unlock of the Pro features while it lasts', async () => {
    const ama = await register(t);
    const tier = async () => (await call(t, 'GET', '/v1/ai/allowance', ama)).json<{ tier: string; intensive: { max: number } }>();
    expect(await tier()).toMatchObject({ tier: 'free', intensive: { max: 3 } });
    await inviteMany(ama, 10);
    await status(ama); // opening the invite screen settles it; otherwise the background job does within minutes
    expect(await tier()).toMatchObject({ tier: 'pro', intensive: { max: 30 } });
    expect((await call(t, 'GET', '/v1/ads?placement=home_feed', ama)).json<{ ad: PublicAd | null }>().ad).toBeNull();
  }, 120_000);

  it('is settled by the background job even if the inviter never opens the app', async () => {
    const ama = await register(t);
    const recipe = await sharedRecipe();
    await status(ama); // makes the code
    for (let i = 0; i < 10; i++) await friend(ama, recipe.id);
    expect(await t.db.promoGrant.count()).toBe(0);
    const job = await buildApp({ config: testConfig(), db: t.db, storage: t.storage, pushSender: null });
    await job.app.ready();
    try {
      expect(await job.invites.settleAll()).toBe(1);
      expect(await t.db.promoGrant.count()).toBe(11);
      expect(await job.invites.settleAll()).toBe(0); // nothing left waiting
    } finally {
      await job.app.close();
    }
  }, 120_000);
});

describe('earned time and a subscription together', () => {
  it('uses the better plan, and the paid one when they are equal and it lasts longer', async () => {
    const withWebhook = await makeApp({ REVENUECAT_WEBHOOK_SECRET: 'test-revenuecat-secret-123', ACCESS_TOKEN_TTL_SECONDS: '9999999' });
    try {
      const plan2 = async (who: Who) => (await call(withWebhook, 'GET', '/v1/me/entitlements', who)).json<Entitlements>();
      const hook = (who: Who, product: string, ent: string, days: number) =>
        withWebhook.app.inject({
          method: 'POST',
          url: '/v1/webhooks/revenuecat',
          headers: { authorization: 'Bearer test-revenuecat-secret-123' },
          payload: { event: { id: `e-${Math.random()}`, type: 'INITIAL_PURCHASE', app_user_id: who.user.id, product_id: product, entitlement_ids: [ent], expiration_at_ms: Date.now() + days * DAY_MS, event_timestamp_ms: Date.now() } },
        });
      const ama = await register(withWebhook);
      const grant = (userId: string, days: number) =>
        withWebhook.db.promoGrant.create({ data: { userId, tier: 'pro', key: `test:${Math.random()}`, startsAt: new Date(Date.now() - 1000), endsAt: new Date(Date.now() + days * DAY_MS) } });

      await hook(ama, 'premium_monthly', 'enplace Premium', 20);
      expect((await plan2(ama)).tier).toBe('premium');
      await grant(ama.user.id, 30);
      expect(await plan2(ama)).toMatchObject({ tier: 'pro', source: 'promo' }); // earned Pro beats paid Premium

      const bee = await register(withWebhook);
      await hook(bee, 'pro_monthly', 'enplace Pro', 60);
      await grant(bee.user.id, 30);
      expect(await plan2(bee)).toMatchObject({ tier: 'pro', source: 'paid' }); // paid Pro lasts longer

      const cee = await register(withWebhook);
      await hook(cee, 'pro_monthly', 'enplace Pro', 10);
      await grant(cee.user.id, 30);
      expect(await plan2(cee)).toMatchObject({ tier: 'pro', source: 'promo' }); // earned time lasts longer
    } finally {
      await withWebhook.close();
    }
  });
});

describe('house accounts', () => {
  async function setup() {
    const admin = await makeAdmin(t);
    const res = await call(t, 'POST', '/v1/admin/house-accounts', admin, { displayName: 'enplace Kitchen', bio: 'Official recipes from the enplace team' });
    return { admin, account: res.json<HouseAccount>() };
  }

  it('is for staff only', async () => {
    const ama = await register(t);
    expect((await call(t, 'POST', '/v1/admin/house-accounts', undefined, { displayName: 'x' })).statusCode).toBe(401);
    expect((await call(t, 'POST', '/v1/admin/house-accounts', ama, { displayName: 'Fake Chef' })).statusCode).toBe(403);
    expect((await call(t, 'GET', '/v1/admin/house-accounts', ama)).statusCode).toBe(403);
    expect((await call(t, 'POST', '/v1/admin/house/off', ama)).statusCode).toBe(403);
  });

  it('makes an account that is plainly official and cannot be signed in to', async () => {
    const { account } = await setup();
    expect(account.user).toMatchObject({ displayName: 'enplace Kitchen', handle: 'enplace_kitchen', kind: 'house' });
    const row = await t.db.user.findUniqueOrThrow({ where: { id: account.user.id } });
    expect(row).toMatchObject({ email: null, passwordHash: null, kind: 'HOUSE' });
    expect(await t.db.authIdentity.count({ where: { userId: row.id } })).toBe(0);
    expect(await t.db.session.count({ where: { userId: row.id } })).toBe(0);
    expect((await call(t, 'POST', '/v1/auth/login', undefined, { email: 'enplace_kitchen', password: 'whatever12345' })).statusCode).toBe(400);
    expect((await call(t, 'GET', `/v1/users/${account.user.id}`)).json<{ kind: string }>().kind).toBe('house');
  });

  it('refuses a taken or too-short handle', async () => {
    const { admin } = await setup();
    expect((await call(t, 'POST', '/v1/admin/house-accounts', admin, { displayName: 'enplace Kitchen' })).statusCode).toBe(409);
    expect((await call(t, 'POST', '/v1/admin/house-accounts', admin, { displayName: '!!' })).statusCode).toBe(400);
    expect((await call(t, 'POST', '/v1/admin/house-accounts', admin, { displayName: 'Valid name', handle: 'NO' })).statusCode).toBe(400);
  });

  it('posts as the account, labelled official, and a recipe post needs a real recipe', async () => {
    const { admin, account } = await setup();
    const recipe = await createRecipe(t, admin);
    const body = { kind: 'made-this', title: 'Jollof of the week', photoUrl: 'https://img.example.com/j.jpg' };
    expect((await call(t, 'POST', `/v1/admin/house-accounts/${account.user.id}/posts`, admin, { ...body, kind: 'recipe' })).statusCode).toBe(400);
    expect((await call(t, 'POST', `/v1/admin/house-accounts/${account.user.id}/posts`, admin, { ...body, kind: 'recipe', recipeId: recipe.id })).statusCode).toBe(201);
    expect((await call(t, 'POST', `/v1/admin/house-accounts/${account.user.id}/posts`, admin, body)).statusCode).toBe(201);
    expect((await call(t, 'POST', `/v1/admin/house-accounts/${admin.user.id}/posts`, admin, body)).statusCode).toBe(404); // not a house account

    const feed = (await call(t, 'GET', '/v1/feed/discover')).json<Page<Post>>().items;
    expect(feed).toHaveLength(2);
    expect(feed.every((p) => p.author.kind === 'house' && p.author.displayName === 'enplace Kitchen')).toBe(true);
    expect((await call(t, 'GET', '/v1/admin/house-accounts', admin)).json<{ items: HouseAccount[] }>().items[0]?.postCount).toBe(2);
  });

  it('has a kill switch that hides every house post at once and brings them back, leaving moderated ones hidden', async () => {
    const { admin, account } = await setup();
    const post = (title: string) => call(t, 'POST', `/v1/admin/house-accounts/${account.user.id}/posts`, admin, { kind: 'made-this', title, photoUrl: 'https://img.example.com/x.jpg' });
    const [a, b] = [(await post('One')).json<{ id: string }>(), (await post('Two')).json<{ id: string }>()] as [{ id: string }, { id: string }];
    await t.db.post.update({ where: { id: b.id }, data: { status: 'HIDDEN' } }); // taken down by moderation earlier
    const person = await register(t);
    await makePost(t, person, { title: 'A real person' });

    expect((await call(t, 'POST', '/v1/admin/house/off', admin)).json<{ posts: number }>()).toEqual({ posts: 1 });
    expect((await call(t, 'GET', '/v1/feed/discover')).json<Page<Post>>().items.map((p) => p.title)).toEqual(['A real person']);
    expect((await call(t, 'GET', `/v1/posts/${a.id}`)).statusCode).toBe(404);
    expect((await call(t, 'POST', '/v1/admin/house/off', admin)).json<{ posts: number }>()).toEqual({ posts: 0 }); // again: nothing left to hide

    expect((await call(t, 'POST', '/v1/admin/house/on', admin)).json<{ posts: number }>()).toEqual({ posts: 1 });
    expect((await call(t, 'GET', '/v1/feed/discover')).json<Page<Post>>().items.map((p) => p.title).sort()).toEqual(['A real person', 'One']);
    expect((await call(t, 'GET', `/v1/posts/${b.id}`)).statusCode).toBe(404); // still moderated
  });

  it('can be reported and removed like anything else, and deleting one takes its posts', async () => {
    const { admin, account } = await setup();
    await call(t, 'POST', `/v1/admin/house-accounts/${account.user.id}/posts`, admin, { kind: 'made-this', title: 'Gone soon', photoUrl: 'https://img.example.com/x.jpg' });
    const ama = await register(t);
    expect((await call(t, 'POST', '/v1/reports', ama, { targetType: 'user', targetId: account.user.id, reason: 'other' })).statusCode).toBe(202);
    expect((await call(t, 'GET', '/v1/admin/reports', admin)).json<Page<AdminReport>>().items).toHaveLength(1);
    expect((await call(t, 'DELETE', `/v1/admin/house-accounts/${account.user.id}`, admin)).statusCode).toBe(204);
    expect(await t.db.post.count()).toBe(0);
    expect((await call(t, 'DELETE', `/v1/admin/house-accounts/${account.user.id}`, admin)).statusCode).toBe(404);
    expect((await call(t, 'DELETE', `/v1/admin/house-accounts/${ama.user.id}`, admin)).statusCode).toBe(404); // a real person cannot be deleted this way
  });
});
