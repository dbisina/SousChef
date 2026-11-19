import { TIER_FEATURES, type SubscriptionTier } from '@shared';
import type { Pool } from './router';

/** The AI helpers that have their own allowance. */
export type AiFeature =
  | 'pantry_scan'
  | 'tonight'
  | 'leftovers'
  | 'plate_check'
  | 'plate_nutrition'
  | 'caption'
  | 'search'
  | 'waste_coach'
  | 'health_summary'
  | 'rewrite'
  | 'cook_chat'
  | 'chat_assist'
  | 'scale';

/**
 * Requests per person per day. Light AI (text only) is cheap, so everyone gets a small allowance. The intensive AI (photos,
 * video frames, long reports) has a lower cap per feature AND shares one pool per account (see `INTENSIVE` and the tier table in
 * `shared/tiers.ts`). These are the knobs that keep the monthly AI bill safe; the router's hard monthly stop is the last line
 * of defence.
 */
export const AI_LIMITS: Record<AiFeature, Record<SubscriptionTier, number>> = {
  // light
  tonight: { free: 2, premium: 8, pro: 20 },
  leftovers: { free: 2, premium: 8, pro: 20 },
  search: { free: 20, premium: 60, pro: 200 },
  rewrite: { free: 1, premium: 4, pro: 12 },
  cook_chat: { free: 8, premium: 30, pro: 100 },
  chat_assist: { free: 5, premium: 15, pro: 40 },
  scale: { free: 5, premium: 15, pro: 40 },
  // intensive: also counted in the account's pool
  pantry_scan: { free: 3, premium: 5, pro: 15 },
  plate_check: { free: 3, premium: 5, pro: 15 },
  plate_nutrition: { free: 3, premium: 5, pro: 15 },
  caption: { free: 3, premium: 5, pro: 15 },
  waste_coach: { free: 1, premium: 3, pro: 10 },
  health_summary: { free: 1, premium: 3, pro: 10 },
};

/** Everything counted in the pool: the features above that read photos or write long reports, and reading video frames or photos for imports. */
export const INTENSIVE_KEYS = ['pantry_scan', 'plate_check', 'plate_nutrition', 'caption', 'waste_coach', 'health_summary', 'extract_recipe_from_frames'] as const;

/** Importing from photos or video frames is intensive; importing from a link or written text is light. */
export const IMPORT_FRAMES_KEY = 'extract_recipe_from_frames';

/** AI imports per person per day (light). */
export const IMPORT_DAILY: Record<SubscriptionTier, number> = { free: 5, premium: 15, pro: 30 };

export const aiLimit = (feature: AiFeature, tier: SubscriptionTier): number => AI_LIMITS[feature][tier];

/** The account's shared allowance for the intensive AI. */
export const intensivePool = (tier: SubscriptionTier): Pool => ({ keys: INTENSIVE_KEYS, max: TIER_FEATURES[tier].intensiveAi.max, windowDays: TIER_FEATURES[tier].intensiveAi.windowDays });

const isIntensive = (feature: string): boolean => (INTENSIVE_KEYS as readonly string[]).includes(feature);

/** What to hand the router for a feature: its own cap, plus the pool when it is intensive. */
export const limitFor = (feature: AiFeature, tier: SubscriptionTier): { perDay: number; key: string; pool?: Pool } => ({
  perDay: aiLimit(feature, tier),
  key: feature,
  ...(isIntensive(feature) ? { pool: intensivePool(tier) } : {}),
});
