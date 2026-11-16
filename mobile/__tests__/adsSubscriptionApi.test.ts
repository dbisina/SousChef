// Ads and the plan, against a pretend server.
const mockFirebaseTouched = jest.fn();
jest.mock('firebase/firestore', () => ({ Timestamp: { now: () => ({ toMillis: () => 0 }), fromDate: (d: Date) => ({ toDate: () => d, toMillis: () => d.getTime() }) } }));
jest.mock('@/lib/firebase', () => {
  const touch = () => mockFirebaseTouched();
  return {
    db: {}, collection: touch, doc: touch, getDocs: touch, getDoc: touch, addDoc: touch, updateDoc: touch, deleteDoc: touch, query: touch, where: touch, orderBy: touch, increment: touch,
    Timestamp: { now: () => ({ toMillis: () => 0, toDate: () => new Date(0) }), fromDate: (d: Date) => ({ toDate: () => d, toMillis: () => d.getTime() }) },
  };
});
jest.mock('expo-secure-store', () => ({ getItemAsync: async () => null, setItemAsync: async () => undefined, deleteItemAsync: async () => undefined }));
jest.mock('react-native-purchases', () => ({}), { virtual: true });
jest.mock('@/lib/revenuecat', () => ({
  getSubscriptionTier: (info: { tier: string }) => info.tier,
  initializeRevenueCat: jest.fn(),
  isRevenueCatDisabled: () => false,
  loginToRevenueCat: jest.fn(),
  logoutFromRevenueCat: jest.fn(),
  getCustomerInfo: jest.fn(),
  getOfferings: jest.fn(),
  getAllOfferings: jest.fn(),
  purchasePackage: jest.fn(),
  restorePurchases: jest.fn(),
  addCustomerInfoListener: jest.fn(),
  setUserAttributes: jest.fn(),
  isPurchasesConfigured: jest.fn(),
  presentPaywall: jest.fn(),
  presentPaywallIfNeeded: jest.fn(),
  presentCustomerCenter: jest.fn(),
}));

import { api, resetApiForTests } from '@/lib/api';
import * as ads from '@/services/adService';
import { toAppAdminAd, toAppPublicAd } from '@/services/adApi';
import { useSubscriptionStore } from '@/stores/subscriptionStore';
import type { AdminAd, PublicAd } from '@shared/index';

const publicAd = (over: Partial<PublicAd> = {}): PublicAd => ({
  id: 'ad1', advertiserName: 'FreshCart', advertiserLogoUrl: 'https://m.test/l.png', title: 'Farm fresh', subtitle: '20% off', imageUrl: 'https://m.test/a.jpg',
  ctaText: 'Order', ctaUrl: 'https://fresh.example', format: 'card', accentColor: '#f60', darkMode: true, isFallback: false, ...over,
});
const adminAd = (over: Partial<AdminAd> = {}): AdminAd => ({
  ...publicAd(), placements: ['home_feed'], status: 'active', expired: false, startsAt: '2026-11-01T00:00:00.000Z', endsAt: '2026-12-01T00:00:00.000Z', budgetCents: 5000, cpmCents: 500,
  metrics: { impressions: 100, clicks: 4, ctr: 4, spend: 0.5, remaining: 49.5 }, createdAt: '2026-10-30T00:00:00.000Z', updatedAt: '2026-10-31T00:00:00.000Z', ...over,
});
const reply = (status: number, body?: unknown) => ({ ok: status < 300, status, json: async () => body ?? null }) as Response;
const tokens = { accessToken: 'a1', accessTokenExpiresAt: new Date(Date.now() + 900_000).toISOString(), refreshToken: 'r1' };
let server: jest.Mock;
const sent = (i: number) => {
  const [url, init] = server.mock.calls[i] as [string, RequestInit];
  return { method: init.method, path: new URL(String(url)).pathname, search: new URL(String(url)).search, body: init.body ? JSON.parse(String(init.body)) : undefined };
};

beforeEach(async () => {
  mockFirebaseTouched.mockClear();
  process.env.EXPO_PUBLIC_API_URL = 'https://api.test';
  resetApiForTests();
  server = jest.fn();
  global.fetch = server as unknown as typeof fetch;
  await api().setTokens(tokens);
});
afterAll(() => {
  delete process.env.EXPO_PUBLIC_API_URL;
});

describe('ads people see', () => {
  it('shows what the server picked, in the shape the ad card reads', async () => {
    server.mockResolvedValueOnce(reply(200, { ad: publicAd() }));
    const ad = await ads.getAdForPlacement('home_feed');
    expect(ad).toMatchObject({ id: 'ad1', title: 'Farm fresh', imageURL: 'https://m.test/a.jpg', ctaURL: 'https://fresh.example', advertiserLogo: 'https://m.test/l.png', accentColor: '#f60', darkMode: true });
    expect(sent(0).search).toBe('?placement=home_feed');
    expect(mockFirebaseTouched).not.toHaveBeenCalled();
  });

  it('shows no ad at all to someone on an ad-free plan', async () => {
    server.mockResolvedValue(reply(200, { ad: null }));
    expect(await ads.getAdForPlacement('home_feed')).toBeNull();
    expect(await ads.getActiveAdsForPlacement('home_feed')).toEqual([]);
  });

  it('counts views and taps on the server, but never for the fallback ad', async () => {
    server.mockResolvedValue(reply(204));
    await ads.recordImpression('ad1');
    await ads.recordClick('ad1');
    await ads.recordImpression('fallback');
    await ads.recordClick('fallback');
    expect(server).toHaveBeenCalledTimes(2);
    expect([sent(0).path, sent(1).path]).toEqual(['/v1/ads/ad1/impression', '/v1/ads/ad1/click']);
  });

  it('never makes the screen fail when counting fails', async () => {
    server.mockRejectedValue(new TypeError('offline'));
    await expect(ads.recordImpression('ad1')).resolves.toBeUndefined();
  });

  it('sends an advertiser inquiry', async () => {
    server.mockResolvedValueOnce(reply(202));
    await ads.submitAdInquiry({ name: 'Bo', email: 'bo@x.test', company: 'Fresh', budget: '500_2000', placements: ['home_feed'], message: 'Hi' });
    expect(sent(0)).toMatchObject({ method: 'POST', path: '/v1/ad-inquiries', body: { company: 'Fresh', budget: '500_2000' } });
    server.mockRejectedValueOnce(new TypeError('offline'));
    await expect(ads.submitAdInquiry({ name: 'Bo', email: 'bo@x.test', company: 'Fresh', budget: '500_2000', placements: [], message: 'Hi' })).rejects.toThrow('Failed to submit inquiry');
  });
});

describe('ad management (staff)', () => {
  it('lists with spend and counts, and marks an ad past its end date as expired', () => {
    const live = toAppAdminAd(adminAd());
    expect(live).toMatchObject({ status: 'active', impressions: 100, clicks: 4, spentCents: 50, budgetCents: 5000, placements: ['home_feed'] });
    expect(toAppAdminAd(adminAd({ expired: true })).status).toBe('expired');
    expect(toAppPublicAd(publicAd({ isFallback: true }), 'browse').advertiserId).toBe('souschef');
  });

  it('creates, pauses, edits and deletes', async () => {
    server.mockResolvedValueOnce(reply(201, adminAd({ id: 'new1' })));
    const start = { toDate: () => new Date('2026-11-01T00:00:00Z') };
    const end = { toDate: () => new Date('2026-12-01T00:00:00Z') };
    const id = await ads.createSponsoredAd({ advertiserName: 'FreshCart', title: 'T', subtitle: 'S', imageURL: 'https://m.test/a.jpg', ctaText: 'Go', ctaURL: 'https://x.test', placements: ['home_feed'], format: 'card', status: 'active', startDate: start, endDate: end, budgetCents: 100, cpmCents: 500 } as never);
    expect(id).toBe('new1');
    expect(sent(0).body).toMatchObject({ imageUrl: 'https://m.test/a.jpg', ctaUrl: 'https://x.test', startsAt: '2026-11-01T00:00:00.000Z', endsAt: '2026-12-01T00:00:00.000Z' });

    server.mockResolvedValue(reply(200, adminAd()));
    await ads.toggleAdStatus('new1', 'active');
    expect(sent(1)).toMatchObject({ method: 'PATCH', path: '/v1/admin/ads/new1', body: { status: 'paused' } });
    await ads.updateSponsoredAd('new1', { status: 'expired' });
    expect(sent(2).body).toEqual({ status: 'paused' }); // "expired" is worked out from the end date
    server.mockResolvedValueOnce(reply(204));
    await ads.deleteSponsoredAd('new1');
    expect(sent(3)).toMatchObject({ method: 'DELETE', path: '/v1/admin/ads/new1' });
  });
});

describe('the plan', () => {
  const entitlements = (tier: string) => reply(200, { tier, features: {}, status: 'active', expiresAt: null, willRenew: false, source: 'promo' });
  const store = () => useSubscriptionStore.getState();
  const info = (tier: string) => ({ tier }) as never;

  // (A store plan of "free" goes through the admin check, which loads the auth store with a dynamic import that jest
  // cannot run; the merge itself is the same line, so these tests start from "premium".)
  it('takes the server\'s plan when it is better than the store\'s (for example Pro time earned from invites)', async () => {
    server.mockResolvedValueOnce(entitlements('pro'));
    await store().setCustomerInfo(info('premium'));
    expect(store()).toMatchObject({ subscriptionTier: 'pro', isPro: true, isPremium: true, isSubscribed: true });
    expect(sent(0).path).toBe('/v1/me/entitlements');
  });

  it('keeps the store\'s plan when it is better (a purchase the server has not heard about yet)', async () => {
    server.mockResolvedValueOnce(entitlements('free'));
    await store().setCustomerInfo(info('premium'));
    expect(store()).toMatchObject({ subscriptionTier: 'premium', isPro: false, isPremium: true });
  });

  it('keeps the store\'s plan when the server cannot be reached', async () => {
    server.mockRejectedValueOnce(new TypeError('offline'));
    await store().setCustomerInfo(info('premium'));
    expect(store().subscriptionTier).toBe('premium');
  });
});
