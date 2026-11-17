import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { AdDayStat, AdInquiry, AdminAd, Page, PublicAd } from '@shared';
import { DAY_MS, makeApp, register, type TestApp } from './helpers';
import { call, makeAdmin } from './recipeHelpers';

let t: TestApp;
beforeAll(async () => {
  // Long-lived access tokens: some tests move the server's clock by days and must stay signed in.
  t = await makeApp({ ACCESS_TOKEN_TTL_SECONDS: String(60 * 86400), RATE_LIMIT_MAX: '100000' });
});
afterAll(() => t.close());
beforeEach(() => t.reset());

type Who = Awaited<ReturnType<typeof register>>;
const inDays = (n: number) => new Date(Date.now() + n * DAY_MS).toISOString();

const adBody = (overrides: Record<string, unknown> = {}) => ({
  advertiserName: 'FreshCart',
  title: 'Farm Fresh',
  subtitle: '20% off',
  imageUrl: 'https://img.example.com/ad.jpg',
  ctaText: 'Order',
  ctaUrl: 'https://freshcart.example.com',
  placements: ['home_feed'],
  format: 'card',
  startsAt: inDays(-1),
  endsAt: inDays(30),
  ...overrides,
});
const createAd = async (admin: Who, overrides: Record<string, unknown> = {}) => {
  const res = await call(t, 'POST', '/v1/admin/ads', admin, adBody(overrides));
  if (res.statusCode !== 201) throw new Error(`create ad failed: ${res.statusCode} ${res.body}`);
  return res.json<AdminAd>();
};
const pick = async (placement = 'home_feed') => (await call(t, 'GET', `/v1/ads?placement=${placement}`)).json<{ ad: PublicAd }>().ad;

describe('choosing the ad to show', () => {
  it('shows SousChef\'s own ad when no campaign is running', async () => {
    const ad = await pick();
    expect(ad).toMatchObject({ id: 'fallback', isFallback: true, advertiserName: 'enplace' });
    expect((await call(t, 'GET', '/v1/ads?placement=nowhere')).statusCode).toBe(400);
    expect((await call(t, 'GET', '/v1/ads')).statusCode).toBe(400);
  });

  it('shows an active campaign for its placement only, without any money details', async () => {
    const admin = await makeAdmin(t);
    const created = await createAd(admin, { placements: ['home_feed', 'browse'] });
    const shown = await pick('home_feed');
    expect(shown).toMatchObject({ id: created.id, isFallback: false, advertiserName: 'FreshCart' });
    expect(Object.keys(shown)).not.toEqual(expect.arrayContaining(['budgetCents', 'cpmCents', 'metrics']));
    expect((await pick('browse')).id).toBe(created.id);
    expect((await pick('recipe_detail')).isFallback).toBe(true);
  });

  it('ignores paused, not-yet-started, ended and unreviewed campaigns', async () => {
    const admin = await makeAdmin(t);
    await createAd(admin, { status: 'paused' });
    await createAd(admin, { status: 'pending_review' });
    await createAd(admin, { startsAt: inDays(2), endsAt: inDays(9) });
    await createAd(admin, { startsAt: inDays(-9), endsAt: inDays(-2) });
    expect((await pick()).isFallback).toBe(true);
  });

  it('prefers the campaign that started most recently', async () => {
    const admin = await makeAdmin(t);
    await createAd(admin, { title: 'Older', startsAt: inDays(-10) });
    const newer = await createAd(admin, { title: 'Newer', startsAt: inDays(-1) });
    expect((await pick()).id).toBe(newer.id);
  });

  it('stops showing a campaign once its budget is spent', async () => {
    const admin = await makeAdmin(t);
    // 1000 cents per thousand views = 1 cent a view, so a 1 cent budget is used up by the first view.
    const ad = await createAd(admin, { budgetCents: 1, cpmCents: 1000 });
    expect((await pick()).id).toBe(ad.id);
    await call(t, 'POST', `/v1/ads/${ad.id}/impression`);
    expect((await pick()).isFallback).toBe(true);
  });

  it('follows the server clock for start and end dates', async () => {
    const admin = await makeAdmin(t);
    const ad = await createAd(admin, { startsAt: inDays(2), endsAt: inDays(9) });
    expect((await pick()).isFallback).toBe(true);
    t.advance(3 * DAY_MS);
    expect((await pick()).id).toBe(ad.id);
    t.advance(10 * DAY_MS);
    expect((await pick()).isFallback).toBe(true);
  });
});

describe('counting views and clicks', () => {
  it('counts them for anyone, in the total and in today\'s row', async () => {
    const admin = await makeAdmin(t);
    const ad = await createAd(admin, { cpmCents: 500, budgetCents: 100_000 });
    for (let i = 0; i < 4; i++) expect((await call(t, 'POST', `/v1/ads/${ad.id}/impression`)).statusCode).toBe(204);
    expect((await call(t, 'POST', `/v1/ads/${ad.id}/click`)).statusCode).toBe(204);

    const listed = (await call(t, 'GET', '/v1/admin/ads', admin)).json<{ items: AdminAd[] }>().items[0];
    expect(listed?.metrics).toEqual({ impressions: 4, clicks: 1, ctr: 25, spend: 0.02, remaining: 999.98 });

    const days = (await call(t, 'GET', `/v1/admin/ads/${ad.id}/stats?days=3`, admin)).json<{ days: AdDayStat[] }>().days;
    expect(days).toHaveLength(3);
    expect(days.at(-1)).toMatchObject({ impressions: 4, clicks: 1 });
    expect(days[0]).toMatchObject({ impressions: 0, clicks: 0 });
  });

  it('stays exact when many arrive together', async () => {
    const admin = await makeAdmin(t);
    const ad = await createAd(admin);
    await Promise.all(Array.from({ length: 25 }, () => call(t, 'POST', `/v1/ads/${ad.id}/impression`)));
    const stats = (await call(t, 'GET', `/v1/admin/ads/${ad.id}/stats?days=1`, admin)).json<{ days: AdDayStat[] }>().days;
    expect(stats[0]?.impressions).toBe(25);
    expect((await call(t, 'GET', '/v1/admin/ads', admin)).json<{ items: AdminAd[] }>().items[0]?.metrics.impressions).toBe(25);
  });

  it('ignores the fallback ad, and says no to an ad that does not exist', async () => {
    expect((await call(t, 'POST', '/v1/ads/fallback/impression')).statusCode).toBe(204);
    expect((await call(t, 'POST', '/v1/ads/00000000-0000-7000-8000-000000000000/click')).statusCode).toBe(404);
    expect((await call(t, 'POST', '/v1/ads/not-an-id/click')).statusCode).toBe(400);
  });
});

describe('staff', () => {
  it('only an admin may manage ads', async () => {
    const ama = await register(t);
    expect((await call(t, 'GET', '/v1/admin/ads')).statusCode).toBe(401);
    expect((await call(t, 'GET', '/v1/admin/ads', ama)).statusCode).toBe(403);
    expect((await call(t, 'POST', '/v1/admin/ads', ama, adBody())).statusCode).toBe(403);
    expect((await call(t, 'GET', '/v1/admin/ad-inquiries', ama)).statusCode).toBe(403);
  });

  it.each([
    ['an end before the start', { startsAt: inDays(5), endsAt: inDays(1) }],
    ['no placement', { placements: [] }],
    ['an unknown placement', { placements: ['lobby'] }],
    ['a link that is not a web address', { ctaUrl: 'javascript:alert(1)' }],
    ['a negative budget', { budgetCents: -5 }],
    ['a colour that is not a colour', { accentColor: 'green' }],
  ])('refuses %s', async (_label, overrides) => {
    const admin = await makeAdmin(t);
    expect((await call(t, 'POST', '/v1/admin/ads', admin, adBody(overrides))).statusCode).toBe(400);
  });

  it('edits, pauses and deletes', async () => {
    const admin = await makeAdmin(t);
    const ad = await createAd(admin);
    const paused = (await call(t, 'PATCH', `/v1/admin/ads/${ad.id}`, admin, { status: 'paused', title: 'New title', accentColor: '#112233' })).json<AdminAd>();
    expect(paused).toMatchObject({ status: 'paused', title: 'New title', accentColor: '#112233' });
    expect((await pick()).isFallback).toBe(true);
    expect((await call(t, 'PATCH', `/v1/admin/ads/${ad.id}`, admin, { endsAt: inDays(-5) })).statusCode).toBe(400); // before its start
    expect((await call(t, 'PATCH', `/v1/admin/ads/${ad.id}`, admin, {})).statusCode).toBe(400);
    expect((await call(t, 'DELETE', `/v1/admin/ads/${ad.id}`, admin)).statusCode).toBe(204);
    expect((await call(t, 'DELETE', `/v1/admin/ads/${ad.id}`, admin)).statusCode).toBe(404);
    expect((await call(t, 'PATCH', `/v1/admin/ads/${ad.id}`, admin, { title: 'x' })).statusCode).toBe(404);
  });

  it('lists active campaigns first and marks ended ones as expired', async () => {
    const admin = await makeAdmin(t);
    const paused = await createAd(admin, { status: 'paused', title: 'Paused' });
    const ended = await createAd(admin, { title: 'Ended', startsAt: inDays(-9), endsAt: inDays(-2) });
    const live = await createAd(admin, { title: 'Live' });
    const items = (await call(t, 'GET', '/v1/admin/ads', admin)).json<{ items: AdminAd[] }>().items;
    expect(items.map((a) => a.title)[0]).toBe('Live');
    expect(items.find((a) => a.id === ended.id)?.expired).toBe(true);
    expect(items.find((a) => a.id === live.id)?.expired).toBe(false);
    expect(items.find((a) => a.id === paused.id)?.status).toBe('paused');
  });
});

describe('advertiser inquiries', () => {
  const inquiry = (overrides: Record<string, unknown> = {}) => ({
    name: 'Ngozi',
    email: 'Ngozi@Brand.example',
    company: 'Brand Ltd',
    website: 'https://brand.example',
    budget: '500_2000',
    placements: ['home_feed', 'browse'],
    startDate: '2026-12-01',
    message: 'We would like to advertise our rice.',
    ...overrides,
  });

  it('takes an inquiry from anyone and lets staff work through them', async () => {
    const admin = await makeAdmin(t);
    expect((await call(t, 'POST', '/v1/ad-inquiries', undefined, inquiry())).statusCode).toBe(202);
    await call(t, 'POST', '/v1/ad-inquiries', undefined, inquiry({ company: 'Second Co', website: undefined, startDate: undefined }));

    const all = (await call(t, 'GET', '/v1/admin/ad-inquiries', admin)).json<Page<AdInquiry>>();
    expect(all.items.map((i) => i.company)).toEqual(['Second Co', 'Brand Ltd']);
    expect(all.items[1]).toMatchObject({ email: 'ngozi@brand.example', status: 'new', startDate: '2026-12-01', website: 'https://brand.example' });
    expect(all.items[0]).toMatchObject({ website: null, startDate: null });

    const updated = (await call(t, 'PATCH', `/v1/admin/ad-inquiries/${all.items[1]?.id}`, admin, { status: 'contacted' })).json<AdInquiry>();
    expect(updated.status).toBe('contacted');
    expect((await call(t, 'GET', '/v1/admin/ad-inquiries?status=new', admin)).json<Page<AdInquiry>>().items.map((i) => i.company)).toEqual(['Second Co']);
    expect((await call(t, 'PATCH', '/v1/admin/ad-inquiries/00000000-0000-7000-8000-000000000000', admin, { status: 'active' })).statusCode).toBe(404);
  });

  it.each([
    ['a bad email', { email: 'nope' }],
    ['no company', { company: ' ' }],
    ['an empty message', { message: '' }],
    ['an unknown budget', { budget: 'lots' }],
    ['a date that is not a date', { startDate: '2026-02-30' }],
  ])('refuses %s', async (_label, overrides) => {
    expect((await call(t, 'POST', '/v1/ad-inquiries', undefined, inquiry(overrides))).statusCode).toBe(400);
  });

  it('limits how fast one address can send them', async () => {
    const limited = await makeApp({ AUTH_RATE_LIMIT_MAX: '3', RATE_LIMIT_MAX: '100000' });
    try {
      const statuses: number[] = [];
      for (let i = 0; i < 5; i++) statuses.push((await limited.app.inject({ method: 'POST', url: '/v1/ad-inquiries', payload: inquiry() })).statusCode);
      expect(statuses).toEqual([202, 202, 202, 429, 429]);
    } finally {
      await limited.close();
    }
  });
});
