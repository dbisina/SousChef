import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ENTITLEMENTS, TIER_FEATURES, type ApiErrorBody, type Entitlements, type PublicAd, type Recipe, type RecipeSummary, type Page } from '@shared';
import { DAY_MS, makeApp, register, type TestApp } from './helpers';
import { call, createRecipe, makeAdmin } from './recipeHelpers';

const SECRET = 'a-webhook-secret-of-24-chars';
let t: TestApp;
beforeAll(async () => {
  // Long-lived access tokens: some tests move the server's clock by days and must stay signed in.
  t = await makeApp({ REVENUECAT_WEBHOOK_SECRET: SECRET, ACCESS_TOKEN_TTL_SECONDS: String(120 * 86400) });
});
afterAll(() => t.close());
beforeEach(() => t.reset());

type Who = Awaited<ReturnType<typeof register>>;
let eventCounter = 0;

/** A RevenueCat event for this person, with sensible defaults. */
function rcEvent(who: Who, overrides: Record<string, unknown> = {}) {
  eventCounter++;
  return {
    api_version: '1.0',
    event: {
      id: `evt-${Date.now()}-${eventCounter}`,
      type: 'INITIAL_PURCHASE',
      app_user_id: who.user.id,
      original_app_user_id: who.user.id,
      aliases: [who.user.id],
      product_id: 'pro_monthly',
      entitlement_ids: [ENTITLEMENTS.PRO],
      expiration_at_ms: Date.now() + 30 * DAY_MS,
      event_timestamp_ms: Date.now(),
      store: 'APP_STORE',
      ...overrides,
    },
  };
}
const send = (body: unknown, secret: string | null = SECRET) =>
  t.app.inject({
    method: 'POST',
    url: '/v1/webhooks/revenuecat',
    ...(secret === null ? {} : { headers: { authorization: `Bearer ${secret}` } }),
    payload: body as object,
  });
const plan = async (who: Who) => (await call(t, 'GET', '/v1/me/entitlements', who)).json<Entitlements>();
const outcome = async (res: ReturnType<typeof send>) => (await res).json<{ status: string }>().status;

describe('entitlements', () => {
  it('is free until someone pays', async () => {
    const ama = await register(t);
    expect((await call(t, 'GET', '/v1/me/entitlements')).statusCode).toBe(401);
    const free = await plan(ama);
    expect(free).toEqual({ tier: 'free', features: TIER_FEATURES.free, status: 'none', expiresAt: null, willRenew: false, source: 'none' });
  });
});

describe('the RevenueCat webhook', () => {
  it('is off without a secret, and refuses a wrong or missing one', async () => {
    const ama = await register(t);
    expect((await send(rcEvent(ama), null)).statusCode).toBe(401);
    expect((await send(rcEvent(ama), 'a-wrong-secret-of-24-chars!!')).statusCode).toBe(401);
    expect((await send(rcEvent(ama), SECRET.slice(0, -1))).statusCode).toBe(401);
    expect((await plan(ama)).tier).toBe('free');

    const off = await makeApp();
    try {
      const res = await off.app.inject({ method: 'POST', url: '/v1/webhooks/revenuecat', headers: { authorization: 'Bearer anything-at-all-here' }, payload: rcEvent(ama) });
      expect(res.statusCode).toBe(501);
      expect(res.json<ApiErrorBody>().error.code).toBe('provider_not_configured');
    } finally {
      await off.close();
    }
  });

  it('refuses a body that is not an event', async () => {
    expect((await send({ hello: 'world' })).statusCode).toBe(400);
    expect((await send({ event: { type: 'RENEWAL' } })).statusCode).toBe(400);
  });

  it('turns a purchase into the right plan', async () => {
    const ama = await register(t);
    const kemi = await register(t);
    const expires = Date.now() + 30 * DAY_MS;
    expect(await outcome(send(rcEvent(ama, { expiration_at_ms: expires })))).toBe('applied');
    expect(await outcome(send(rcEvent(kemi, { product_id: 'premium_yearly', entitlement_ids: [ENTITLEMENTS.PREMIUM] })))).toBe('applied');

    const pro = await plan(ama);
    expect(pro).toMatchObject({ tier: 'pro', status: 'active', willRenew: true, features: TIER_FEATURES.pro });
    expect(pro.expiresAt).toBe(new Date(expires).toISOString());
    expect(await plan(kemi)).toMatchObject({ tier: 'premium', features: TIER_FEATURES.premium });
  });

  it('works out the plan from the product name when no entitlement is named', async () => {
    const ama = await register(t);
    await send(rcEvent(ama, { entitlement_ids: null, product_id: 'premium_monthly' }));
    expect((await plan(ama)).tier).toBe('premium');
  });

  it('applies a repeated event once', async () => {
    const ama = await register(t);
    const event = rcEvent(ama);
    expect(await outcome(send(event))).toBe('applied');
    expect(await outcome(send(event))).toBe('duplicate');
    expect(await t.db.webhookEvent.count()).toBe(1);
  });

  it('ignores an older event that arrives after a newer one', async () => {
    const ama = await register(t);
    const now = Date.now();
    await send(rcEvent(ama, { type: 'EXPIRATION', event_timestamp_ms: now, expiration_at_ms: now - 1000 }));
    expect(await outcome(send(rcEvent(ama, { type: 'RENEWAL', event_timestamp_ms: now - 60_000 })))).toBe('ignored');
    expect((await plan(ama)).tier).toBe('free');
    // ...but a newer one still applies.
    expect(await outcome(send(rcEvent(ama, { type: 'RENEWAL', event_timestamp_ms: now + 60_000 })))).toBe('applied');
    expect((await plan(ama)).tier).toBe('pro');
  });

  it('keeps access after a cancellation until the period ends, then drops to free', async () => {
    const ama = await register(t);
    await send(rcEvent(ama, { expiration_at_ms: Date.now() + 10 * DAY_MS }));
    await send(rcEvent(ama, { type: 'CANCELLATION', expiration_at_ms: Date.now() + 10 * DAY_MS, event_timestamp_ms: Date.now() + 1 }));
    expect(await plan(ama)).toMatchObject({ tier: 'pro', status: 'cancelled', willRenew: false });

    t.advance(11 * DAY_MS); // the period has run out, and no EXPIRATION event has arrived yet
    expect(await plan(ama)).toMatchObject({ tier: 'free', status: 'expired' });
  });

  it('keeps access during a billing problem, and drops it on expiration', async () => {
    const ama = await register(t);
    const t0 = Date.now();
    await send(rcEvent(ama, { event_timestamp_ms: t0, expiration_at_ms: t0 + 5 * DAY_MS }));
    await send(rcEvent(ama, { type: 'BILLING_ISSUE', event_timestamp_ms: t0 + 1, expiration_at_ms: t0 + 5 * DAY_MS }));
    expect(await plan(ama)).toMatchObject({ tier: 'pro', status: 'billing_issue' });
    await send(rcEvent(ama, { type: 'EXPIRATION', event_timestamp_ms: t0 + 2, expiration_at_ms: t0 - 1 }));
    expect(await plan(ama)).toMatchObject({ tier: 'free', status: 'expired' });
  });

  it('moves between plans', async () => {
    const ama = await register(t);
    const t0 = Date.now();
    await send(rcEvent(ama, { event_timestamp_ms: t0, product_id: 'premium_monthly', entitlement_ids: [ENTITLEMENTS.PREMIUM] }));
    expect((await plan(ama)).tier).toBe('premium');
    await send(rcEvent(ama, { type: 'PRODUCT_CHANGE', event_timestamp_ms: t0 + 1 }));
    expect((await plan(ama)).tier).toBe('pro');
  });

  it('finds the person by an alias when the main id is an anonymous one', async () => {
    const ama = await register(t);
    const res = await send(rcEvent(ama, { app_user_id: '$RCAnonymousID:abc123', original_app_user_id: '$RCAnonymousID:abc123', aliases: ['$RCAnonymousID:abc123', ama.user.id] }));
    expect((await res.json<{ status: string }>()).status).toBe('applied');
    expect((await plan(ama)).tier).toBe('pro');
  });

  it('answers 200 and changes nothing for people and events it does not know', async () => {
    const ama = await register(t);
    const unknown = await send(rcEvent(ama, { app_user_id: '$RCAnonymousID:zzz', original_app_user_id: undefined, aliases: ['$RCAnonymousID:zzz'] }));
    expect(unknown.statusCode).toBe(200);
    expect((await unknown.json<{ status: string }>()).status).toBe('ignored');
    const noSuchUser = await send(rcEvent(ama, { app_user_id: '00000000-0000-7000-8000-000000000000', original_app_user_id: undefined, aliases: [] }));
    expect(noSuchUser.json<{ status: string }>().status).toBe('ignored');
    expect(await outcome(send(rcEvent(ama, { type: 'TEST' })))).toBe('ignored');
    expect(await outcome(send(rcEvent(ama, { product_id: 'mystery', entitlement_ids: [] })))).toBe('ignored');
    expect((await plan(ama)).tier).toBe('free');
  });

  it('removes the plan with the account', async () => {
    const ama = await register(t);
    await send(rcEvent(ama));
    expect(await t.db.subscription.count()).toBe(1);
    expect((await call(t, 'DELETE', '/v1/me', ama, { password: 'correct horse battery' })).statusCode).toBe(204);
    expect(await t.db.subscription.count()).toBe(0);
  });
});

describe('what a plan unlocks', () => {
  const grant = (who: Who, tier: 'premium' | 'pro') =>
    send(rcEvent(who, tier === 'pro' ? {} : { product_id: 'premium_monthly', entitlement_ids: [ENTITLEMENTS.PREMIUM] }));

  it('opens a chef special for everyone, signed in or not, and still labels it', async () => {
    const admin = await makeAdmin(t);
    const free = await register(t);
    const secret = await createRecipe(t, admin, { title: 'Chef Special', isExclusive: true });

    const open = (who?: Who) => call(t, 'GET', `/v1/recipes/${secret.id}`, who);
    expect((await open()).statusCode).toBe(200); // no wall, not even for a visitor
    expect((await open(free)).statusCode).toBe(200);
    expect((await open(free)).json<Recipe>().ingredients.length).toBeGreaterThan(0);

    const listed = (await call(t, 'GET', '/v1/recipes')).json<Page<RecipeSummary>>().items;
    expect(listed.map((r) => [r.title, r.isExclusive])).toEqual([['Chef Special', true]]);
  });

  it('shows no ads to paying people', async () => {
    const free = await register(t);
    const premium = await register(t);
    await grant(premium, 'premium');
    const ad = (who?: Who) => call(t, 'GET', '/v1/ads?placement=home_feed', who).then((r) => r.json<{ ad: PublicAd | null }>().ad);
    expect((await ad())?.id).toBe('fallback');
    expect((await ad(free))?.id).toBe('fallback');
    expect(await ad(premium)).toBeNull();
  });
});
