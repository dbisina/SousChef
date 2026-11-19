import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Entitlements, PromoCodeAdmin, PromoGrantAdmin, RedeemPromoCodeResponse, SaleView } from '@shared';
import { DAY_MS, bearer, makeApp, register, type TestApp } from './helpers';
import { call, makeAdmin } from './recipeHelpers';

let t: TestApp;
beforeAll(async () => {
  t = await makeApp({ AUTH_RATE_LIMIT_MAX: '1000' });
});
afterAll(() => t.close());
beforeEach(() => t.reset());

type Who = Awaited<ReturnType<typeof register>>;
const plan = async (who: Who) => (await call(t, 'GET', '/v1/me/entitlements', who)).json<Entitlements>();
const makeCode = async (admin: Who, body: Record<string, unknown> = {}) =>
  (await call(t, 'POST', '/v1/admin/promo-codes', admin, { tier: 'pro', days: 30, maxUses: 2, ...body })).json<PromoCodeAdmin>();
const redeem = (who: Who, code: string, platform?: string) =>
  t.app.inject({ method: 'POST', url: '/v1/me/redeem', headers: { ...bearer(who), ...(platform ? { 'x-platform': platform } : {}) }, payload: { code } });

describe('giving a plan to one person', () => {
  it('finds them by email, ignoring case, and gives the plan for the days asked', async () => {
    const admin = await makeAdmin(t);
    const ama = await register(t, { email: 'ama.okafor@example.com' });
    const res = await call(t, 'POST', '/v1/admin/promos/grant', admin, { email: 'AMA.Okafor@Example.com', tier: 'premium', days: 90, note: 'beta tester' });
    expect(res.statusCode).toBe(201);
    expect(res.json<PromoGrantAdmin>()).toMatchObject({ tier: 'premium', note: 'beta tester', email: 'ama.okafor@example.com' });
    const p = await plan(ama);
    expect(p).toMatchObject({ tier: 'premium', source: 'promo' });
    const days = (new Date(p.expiresAt as string).getTime() - Date.now()) / DAY_MS;
    expect(days).toBeGreaterThan(89);
    expect(days).toBeLessThan(91);
  });

  it('stacks a second grant after the first, and can be taken back', async () => {
    const admin = await makeAdmin(t);
    const ama = await register(t, { email: 'ama2@example.com' });
    const give = () => call(t, 'POST', '/v1/admin/promos/grant', admin, { email: 'ama2@example.com', tier: 'pro', days: 30 });
    await give();
    const first = (await call(t, 'GET', '/v1/admin/promo-grants', admin)).json<{ items: PromoGrantAdmin[] }>().items[0] as PromoGrantAdmin;
    const second = (await give()).json<PromoGrantAdmin>();
    // The second starts the moment the first ends, so no days are lost or doubled.
    expect(second.startsAt).toBe(first.endsAt);
    expect((new Date(second.endsAt).getTime() - new Date(second.startsAt).getTime()) / DAY_MS).toBe(30);
    expect((await plan(ama)).tier).toBe('pro');
    expect((await call(t, 'GET', '/v1/admin/promo-grants', admin)).json<{ items: PromoGrantAdmin[] }>().items).toHaveLength(2);
    expect((await call(t, 'DELETE', `/v1/admin/promo-grants/${second.id}`, admin)).statusCode).toBe(204);
    expect((await plan(ama)).expiresAt).not.toBeNull();
    expect((await call(t, 'DELETE', `/v1/admin/promo-grants/${second.id}`, admin)).statusCode).toBe(404);
  });

  it('says so when nobody has that email, and only staff can do it', async () => {
    const admin = await makeAdmin(t);
    expect((await call(t, 'POST', '/v1/admin/promos/grant', admin, { email: 'nobody@example.com', tier: 'pro', days: 30 })).statusCode).toBe(404);
    const ama = await register(t);
    expect((await call(t, 'POST', '/v1/admin/promos/grant', ama, { email: 'x@example.com', tier: 'pro', days: 30 })).statusCode).toBe(403);
    expect((await call(t, 'POST', '/v1/admin/promos/grant', undefined, { email: 'x@example.com', tier: 'pro', days: 30 })).statusCode).toBe(401);
    expect((await call(t, 'POST', '/v1/admin/promos/grant', admin, { email: 'x@example.com', tier: 'gold', days: 30 })).statusCode).toBe(400);
  });
});

describe('general codes', () => {
  it('are made readable, redeemed once per person, and give the plan', async () => {
    const admin = await makeAdmin(t);
    const code = await makeCode(admin, { tier: 'premium', days: 180, note: 'launch' });
    expect(code.code).toMatch(/^[A-HJ-NP-Z2-9]{10}$/);
    const ama = await register(t);
    const typed = `${code.code.slice(0, 5).toLowerCase()}-${code.code.slice(5)}`; // spaces, dashes and case do not matter
    const res = await redeem(ama, typed);
    expect(res.statusCode).toBe(200);
    expect(res.json<RedeemPromoCodeResponse>().tier).toBe('premium');
    expect(await plan(ama)).toMatchObject({ tier: 'premium', source: 'promo' });
    expect((await redeem(ama, code.code)).statusCode).toBe(409); // not twice
    const list = (await call(t, 'GET', '/v1/admin/promo-codes', admin)).json<{ items: PromoCodeAdmin[] }>().items;
    expect(list[0]).toMatchObject({ usedCount: 1, maxUses: 2 });
  });

  it('stop at the use limit, when paused, and after they expire', async () => {
    const admin = await makeAdmin(t);
    const code = await makeCode(admin, { maxUses: 1 });
    expect((await redeem(await register(t), code.code)).statusCode).toBe(200);
    expect((await redeem(await register(t), code.code)).statusCode).toBe(409);

    const paused = await makeCode(admin);
    await call(t, 'PATCH', `/v1/admin/promo-codes/${paused.id}`, admin, { active: false });
    expect((await redeem(await register(t), paused.code)).statusCode).toBe(404);
    await call(t, 'PATCH', `/v1/admin/promo-codes/${paused.id}`, admin, { active: true });
    expect((await redeem(await register(t), paused.code)).statusCode).toBe(200);

    const short = await makeCode(admin, { expiresAt: new Date(Date.now() + 60_000).toISOString() });
    await t.db.promoCode.update({ where: { id: short.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    expect((await redeem(await register(t), short.code)).statusCode).toBe(404);
  });

  it('two people racing for the last use: only one gets it', async () => {
    const admin = await makeAdmin(t);
    const code = await makeCode(admin, { maxUses: 1 });
    const [a, b] = await Promise.all([register(t), register(t)]);
    const results = await Promise.all([redeem(a, code.code), redeem(b, code.code)]);
    expect(results.map((r) => r.statusCode).sort()).toEqual([200, 409]);
    expect((await t.db.promoCode.findUniqueOrThrow({ where: { id: code.id } })).usedCount).toBe(1);
  });

  it('are refused on iPhone, where Apple has its own code sheet', async () => {
    const admin = await makeAdmin(t);
    const code = await makeCode(admin);
    const ama = await register(t);
    expect((await redeem(ama, code.code, 'ios')).statusCode).toBe(403);
    expect((await redeem(ama, code.code, 'android')).statusCode).toBe(200);
    expect((await call(t, 'POST', '/v1/me/redeem', undefined, { code: code.code })).statusCode).toBe(401);
    expect((await call(t, 'POST', '/v1/admin/promo-codes', ama, { tier: 'pro', days: 30, maxUses: 1 })).statusCode).toBe(403);
  });
});

describe('sales', () => {
  const sale = (over: Record<string, unknown> = {}) => ({
    percentOff: 30,
    label: 'Launch week',
    startsAt: new Date(Date.now() - DAY_MS).toISOString(),
    endsAt: new Date(Date.now() + DAY_MS).toISOString(),
    ...over,
  });

  it('show only while running, the biggest wins, and ending one hides it', async () => {
    const admin = await makeAdmin(t);
    expect((await call(t, 'GET', '/v1/sales/current')).json<{ sale: SaleView | null }>().sale).toBeNull();
    await call(t, 'POST', '/v1/admin/sales', admin, sale({ startsAt: new Date(Date.now() + DAY_MS).toISOString(), endsAt: new Date(Date.now() + 2 * DAY_MS).toISOString() }));
    expect((await call(t, 'GET', '/v1/sales/current')).json<{ sale: SaleView | null }>().sale).toBeNull(); // not started yet
    const small = (await call(t, 'POST', '/v1/admin/sales', admin, sale({ percentOff: 10 }))).json<SaleView>();
    const big = (await call(t, 'POST', '/v1/admin/sales', admin, sale({ percentOff: 40, tier: 'pro' }))).json<SaleView>();
    expect((await call(t, 'GET', '/v1/sales/current')).json<{ sale: SaleView }>().sale).toMatchObject({ id: big.id, percentOff: 40, tier: 'pro' });
    await call(t, 'POST', `/v1/admin/sales/${big.id}/end`, admin);
    expect((await call(t, 'GET', '/v1/sales/current')).json<{ sale: SaleView }>().sale.id).toBe(small.id);
  });

  it('are checked: sensible discount, end after start, staff only', async () => {
    const admin = await makeAdmin(t);
    expect((await call(t, 'POST', '/v1/admin/sales', admin, sale({ percentOff: 95 }))).statusCode).toBe(400);
    expect((await call(t, 'POST', '/v1/admin/sales', admin, sale({ endsAt: new Date(Date.now() - 2 * DAY_MS).toISOString() }))).statusCode).toBe(400);
    expect((await call(t, 'POST', '/v1/admin/sales', await register(t), sale())).statusCode).toBe(403);
  });
});
