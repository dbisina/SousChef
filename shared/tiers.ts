// What each subscription tier includes. One table for the app (to show it) and the server (to enforce it).

// RevenueCat entitlement identifiers.
export const ENTITLEMENTS = {
  PREMIUM: 'enplace Premium',
  PRO: 'enplace Pro',
} as const;
export type EntitlementId = (typeof ENTITLEMENTS)[keyof typeof ENTITLEMENTS];

// RevenueCat product identifiers.
export const PRODUCT_IDS = {
  // Premium tier - $6.99/month, $49.99/year
  PREMIUM_MONTHLY: 'premium_monthly',
  PREMIUM_ANNUAL: 'premium_yearly',
  // Pro tier - $11.99/month, $89.99/year
  PRO_MONTHLY: 'pro_monthly',
  PRO_ANNUAL: 'pro_yearly',
} as const;
export type ProductId = (typeof PRODUCT_IDS)[keyof typeof PRODUCT_IDS];

export type SubscriptionTier = 'free' | 'premium' | 'pro';

export interface TierFeatures {
  maxRecipes: number | 'unlimited';
  maxPantryItems: number | 'unlimited';
  /** Light AI (text only, cheap): small daily caps, free for everyone. */
  aiSubstitutions: boolean;
  aiSubstitutionsPerDay: number | 'unlimited';
  /** Plate calories and nutrition from a photo. Intensive AI: counted in the account's pool below. */
  portionAnalysis: boolean;
  portionAnalysisPerDay: number | 'unlimited';
  advancedNutrition: boolean;
  mealPlanning: boolean;
  /** AI meal-plan generation: a few per week, counted apart from the pool. */
  mealPlanGeneration: boolean;
  mealPlanPerWeek: number;
  wasteTracking: boolean;
  voiceHandsFree: boolean;
  voiceUsagePerDay: number | 'unlimited';
  offlineAccess: boolean;
  adFree: boolean;
  prioritySupport: boolean;
  exclusiveRecipes: boolean;
  /**
   * The account's whole allowance for the intensive AI (anything that reads photos or video, writes a long plan or report):
   * at most `max` uses per `windowDays` days across all of them, on top of each feature's own cap.
   */
  intensiveAi: { max: number; windowDays: number };
}

// The rule: only the intensive AI is limited by plan. Social, cooking, pantry, planning by hand, voice, offline and health
// logging are free for everyone. Light AI (text) is free with small daily caps. Premium and Pro raise the AI allowances
// and remove ads; they never lock a screen. (Not truly unlimited anywhere, to protect API costs.)
export const TIER_FEATURES: Record<SubscriptionTier, TierFeatures> = {
  free: {
    maxRecipes: 'unlimited',
    maxPantryItems: 'unlimited',
    aiSubstitutions: true,
    aiSubstitutionsPerDay: 5,
    portionAnalysis: true,
    portionAnalysisPerDay: 3,
    advancedNutrition: true,
    mealPlanning: true,
    mealPlanGeneration: true,
    mealPlanPerWeek: 1,
    wasteTracking: true,
    voiceHandsFree: true,
    voiceUsagePerDay: 'unlimited', // on the phone, costs nothing
    offlineAccess: true,
    adFree: false,
    prioritySupport: false,
    exclusiveRecipes: true,
    intensiveAi: { max: 3, windowDays: 7 },
  },
  premium: {
    maxRecipes: 'unlimited',
    maxPantryItems: 'unlimited',
    aiSubstitutions: true,
    aiSubstitutionsPerDay: 20,
    portionAnalysis: true,
    portionAnalysisPerDay: 5,
    advancedNutrition: true,
    mealPlanning: true,
    mealPlanGeneration: true,
    mealPlanPerWeek: 3,
    wasteTracking: true,
    voiceHandsFree: true,
    voiceUsagePerDay: 'unlimited',
    offlineAccess: true,
    adFree: true,
    prioritySupport: false,
    exclusiveRecipes: true,
    intensiveAi: { max: 10, windowDays: 1 },
  },
  pro: {
    maxRecipes: 'unlimited',
    maxPantryItems: 'unlimited',
    aiSubstitutions: true,
    aiSubstitutionsPerDay: 60,
    portionAnalysis: true,
    portionAnalysisPerDay: 15,
    advancedNutrition: true,
    mealPlanning: true,
    mealPlanGeneration: true,
    mealPlanPerWeek: 10,
    wasteTracking: true,
    voiceHandsFree: true,
    voiceUsagePerDay: 'unlimited',
    offlineAccess: true,
    adFree: true,
    prioritySupport: true,
    exclusiveRecipes: true,
    intensiveAi: { max: 30, windowDays: 1 },
  },
};

/** Where an allowance stands: what the screens show as "2 of 3 left this week". */
export interface AiAllowance {
  tier: SubscriptionTier;
  intensive: { used: number; max: number; windowDays: number; resetsAt: string | null };
  mealPlans: { used: number; max: number; windowDays: number; resetsAt: string | null };
}

/* ---------------------------------------------------------------- what the server reports */

export type SubscriptionStatus = 'none' | 'active' | 'cancelled' | 'billing_issue' | 'expired';

/** The signed-in person's plan, as the server sees it (the server is the authority, not the phone). */
export interface Entitlements {
  tier: SubscriptionTier;
  features: TierFeatures;
  status: SubscriptionStatus;
  /** When the paid period ends; null for free or a plan with no end date. */
  expiresAt: string | null;
  /** False once they have cancelled: access continues until `expiresAt`. */
  willRenew: boolean;
  /** Where the access comes from: a real subscription, free time earned (inviting friends), or nothing. */
  source: 'none' | 'paid' | 'promo';
}
