// When it is polite to mention a plan or ask for a rating: rarely, never early, and never twice in a row.
const mockStore = new Map<string, string>();
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: async (k: string) => mockStore.get(k) ?? null,
    setItem: async (k: string, v: string) => void mockStore.set(k, v),
    removeItem: async (k: string) => void mockStore.delete(k),
  },
}));

import { RULES, canOfferUpsell, loadEngagement, markUpsellDismissed, markUpsellShown, recordCookFinished, reviewAllowed, upsellAllowed, type Engagement } from '@/lib/engagement';

const DAY = 86_400_000;
const at = (start: Date, days: number) => new Date(start.getTime() + days * DAY);
const base = (over: Partial<Engagement> = {}): Engagement => ({ installedAt: new Date(0).toISOString(), cooksFinished: 5, upsellShownAt: null, upsellDismissedAt: null, reviewAskedAt: null, ...over });
const T0 = new Date('2026-11-19T10:00:00Z');

beforeEach(() => mockStore.clear());

describe('the plan upsell sheet', () => {
  it('stays closed in the first days and before they have cooked', () => {
    const e = base({ installedAt: T0.toISOString(), cooksFinished: 5 });
    expect(upsellAllowed(e, at(T0, 1))).toBe(false); // too new
    expect(upsellAllowed(e, at(T0, RULES.upsellMinDays))).toBe(true);
    expect(upsellAllowed(base({ installedAt: T0.toISOString(), cooksFinished: 2 }), at(T0, 30))).toBe(false); // has not cooked enough
  });

  it('opens at most once in 3 days, and not for a week after they closed it', () => {
    const e = base({ installedAt: T0.toISOString() });
    expect(upsellAllowed({ ...e, upsellShownAt: at(T0, 10).toISOString() }, at(T0, 11))).toBe(false);
    expect(upsellAllowed({ ...e, upsellShownAt: at(T0, 10).toISOString() }, at(T0, 13.1))).toBe(true);
    expect(upsellAllowed({ ...e, upsellDismissedAt: at(T0, 10).toISOString() }, at(T0, 16))).toBe(false);
    expect(upsellAllowed({ ...e, upsellDismissedAt: at(T0, 10).toISOString() }, at(T0, 17.1))).toBe(true);
  });

  it('is remembered between launches', async () => {
    const first = await loadEngagement(T0);
    expect(first.installedAt).toBe(T0.toISOString());
    expect(await canOfferUpsell(at(T0, 1))).toBe(false);
    await markUpsellShown(at(T0, 20));
    await markUpsellDismissed(at(T0, 20));
    const later = await loadEngagement(at(T0, 21));
    expect(later.installedAt).toBe(T0.toISOString()); // not reset
    expect(later.upsellDismissedAt).toBe(at(T0, 20).toISOString());
  });
});

describe('asking for a store rating after cooking', () => {
  it('waits for the 3rd finished cook and 3 days, and asks once', async () => {
    await loadEngagement(T0);
    expect((await recordCookFinished(at(T0, 1))).askForReview).toBe(false); // cook 1
    expect((await recordCookFinished(at(T0, 2))).askForReview).toBe(false); // cook 2
    expect((await recordCookFinished(at(T0, 2.5))).askForReview).toBe(false); // cook 3, but only 2.5 days in
    expect((await recordCookFinished(at(T0, 4))).askForReview).toBe(true); // cook 4, day 4
    expect((await recordCookFinished(at(T0, 5))).askForReview).toBe(false); // already asked
  });

  it('asks again only after 120 days', () => {
    const e = base({ installedAt: T0.toISOString(), reviewAskedAt: at(T0, 10).toISOString() });
    expect(reviewAllowed(e, at(T0, 100))).toBe(false);
    expect(reviewAllowed(e, at(T0, 131))).toBe(true);
  });
});
