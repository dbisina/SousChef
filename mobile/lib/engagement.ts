// How long this person has been here and how they have used the app, kept only on the phone. It decides when it is polite to
// mention a paid plan or ask for a store rating: rarely, and never in the first days or before they have cooked.
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'enplace.engagement.v1';
const DAY_MS = 86_400_000;

/** The rules, in one place so the screens and the tests agree. */
export const RULES = {
  /** No plan upsell until they have been here this long and have finished this many cooks. */
  upsellMinDays: 3,
  upsellMinCooks: 3,
  /** At most one upsell sheet in this many days, and none for this many days after they closed one. */
  upsellEveryDays: 3,
  upsellAfterDismissDays: 7,
  /** Ask for a store rating after this many finished cooks and days, then at most once in this many days. */
  reviewMinCooks: 3,
  reviewMinDays: 3,
  reviewEveryDays: 120,
} as const;

export interface Engagement {
  installedAt: string;
  cooksFinished: number;
  upsellShownAt: string | null;
  upsellDismissedAt: string | null;
  reviewAskedAt: string | null;
}

const fresh = (now: Date): Engagement => ({ installedAt: now.toISOString(), cooksFinished: 0, upsellShownAt: null, upsellDismissedAt: null, reviewAskedAt: null });

export async function loadEngagement(now: Date = new Date()): Promise<Engagement> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) return { ...fresh(now), ...(JSON.parse(raw) as Partial<Engagement>) };
  } catch {
    // unreadable: start again
  }
  const first = fresh(now);
  await save(first);
  return first;
}

async function save(e: Engagement): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(e));
  } catch {
    // a convenience only
  }
}

const daysSince = (iso: string | null, now: Date): number => (iso ? (now.getTime() - new Date(iso).getTime()) / DAY_MS : Infinity);

/** Pure rule: may a plan upsell sheet open by itself right now? (A person tapping "See plans" is always allowed.) */
export function upsellAllowed(e: Engagement, now: Date): boolean {
  return (
    daysSince(e.installedAt, now) >= RULES.upsellMinDays &&
    e.cooksFinished >= RULES.upsellMinCooks &&
    daysSince(e.upsellShownAt, now) >= RULES.upsellEveryDays &&
    daysSince(e.upsellDismissedAt, now) >= RULES.upsellAfterDismissDays
  );
}

/** Pure rule: ask for a store rating now? Only right after a finished cook, never twice in a short time. */
export function reviewAllowed(e: Engagement, now: Date): boolean {
  return e.cooksFinished >= RULES.reviewMinCooks && daysSince(e.installedAt, now) >= RULES.reviewMinDays && daysSince(e.reviewAskedAt, now) >= RULES.reviewEveryDays;
}

export async function canOfferUpsell(now: Date = new Date()): Promise<boolean> {
  return upsellAllowed(await loadEngagement(now), now);
}

export async function markUpsellShown(now: Date = new Date()): Promise<void> {
  await save({ ...(await loadEngagement(now)), upsellShownAt: now.toISOString() });
}

export async function markUpsellDismissed(now: Date = new Date()): Promise<void> {
  await save({ ...(await loadEngagement(now)), upsellDismissedAt: now.toISOString() });
}

/** Counts a finished cook and says whether this is a good moment to ask for a rating. */
export async function recordCookFinished(now: Date = new Date()): Promise<{ askForReview: boolean }> {
  const e = await loadEngagement(now);
  const next = { ...e, cooksFinished: e.cooksFinished + 1 };
  const askForReview = reviewAllowed(next, now);
  await save(askForReview ? { ...next, reviewAskedAt: now.toISOString() } : next);
  return { askForReview };
}
