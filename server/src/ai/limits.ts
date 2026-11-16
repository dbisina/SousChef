import type { SubscriptionTier } from '@shared';

/** The AI helpers that have their own daily allowance. */
export type AiFeature =
  | 'pantry_scan'
  | 'tonight'
  | 'leftovers'
  | 'plate_check'
  | 'caption'
  | 'search'
  | 'waste_coach'
  | 'health_summary'
  | 'rewrite'
  | 'cook_chat'
  | 'chat_assist'
  | 'scale';

/**
 * Requests per person per day. Photos and long answers cost the most, so they get the smallest free allowance. These are
 * the knobs that keep the monthly AI budget safe; the router's hard monthly stop is the last line of defence.
 */
export const AI_LIMITS: Record<AiFeature, Record<SubscriptionTier, number>> = {
  pantry_scan: { free: 2, premium: 10, pro: 30 },
  tonight: { free: 3, premium: 15, pro: 40 },
  leftovers: { free: 3, premium: 10, pro: 30 },
  plate_check: { free: 2, premium: 8, pro: 30 },
  caption: { free: 5, premium: 20, pro: 60 },
  search: { free: 20, premium: 60, pro: 200 },
  waste_coach: { free: 1, premium: 3, pro: 10 },
  health_summary: { free: 1, premium: 3, pro: 10 },
  rewrite: { free: 1, premium: 5, pro: 20 },
  cook_chat: { free: 10, premium: 40, pro: 150 },
  chat_assist: { free: 5, premium: 20, pro: 80 },
  scale: { free: 5, premium: 20, pro: 60 },
};

export const aiLimit = (feature: AiFeature, tier: SubscriptionTier): number => AI_LIMITS[feature][tier];
