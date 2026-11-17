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
  aiSubstitutions: boolean;
  aiSubstitutionsPerDay: number | 'unlimited';
  portionAnalysis: boolean;
  portionAnalysisPerDay: number | 'unlimited';
  advancedNutrition: boolean;
  mealPlanning: boolean;
  mealPlanGeneration: boolean;
  wasteTracking: boolean;
  voiceHandsFree: boolean;
  voiceUsagePerDay: number | 'unlimited';
  offlineAccess: boolean;
  adFree: boolean;
  prioritySupport: boolean;
  exclusiveRecipes: boolean;
}

// Free = generous enough to experience the core loop (import -> cook)
// Premium ($6.99) = power user with smart daily caps
// Pro ($11.99) = everything, high caps (not truly unlimited, to protect API costs)
export const TIER_FEATURES: Record<SubscriptionTier, TierFeatures> = {
  free: {
    maxRecipes: 'unlimited', // Never gate the core import loop
    maxPantryItems: 'unlimited', // Pantry is core to the brief
    aiSubstitutions: true,
    aiSubstitutionsPerDay: 3, // Taste the AI, then hit the wall
    portionAnalysis: false,
    portionAnalysisPerDay: 0,
    advancedNutrition: false,
    mealPlanning: false,
    mealPlanGeneration: false,
    wasteTracking: false,
    voiceHandsFree: false,
    voiceUsagePerDay: 0,
    offlineAccess: false,
    adFree: false,
    prioritySupport: false,
    exclusiveRecipes: false,
  },
  premium: {
    maxRecipes: 'unlimited',
    maxPantryItems: 'unlimited',
    aiSubstitutions: true,
    aiSubstitutionsPerDay: 15, // Generous but controlled
    portionAnalysis: true,
    portionAnalysisPerDay: 10,
    advancedNutrition: true,
    mealPlanning: true,
    mealPlanGeneration: false,
    wasteTracking: true,
    voiceHandsFree: true,
    voiceUsagePerDay: 15,
    offlineAccess: true,
    adFree: true,
    prioritySupport: false,
    exclusiveRecipes: false,
  },
  pro: {
    maxRecipes: 'unlimited',
    maxPantryItems: 'unlimited',
    aiSubstitutions: true,
    aiSubstitutionsPerDay: 200, // Effectively unlimited
    portionAnalysis: true,
    portionAnalysisPerDay: 50,
    advancedNutrition: true,
    mealPlanning: true,
    mealPlanGeneration: true,
    wasteTracking: true,
    voiceHandsFree: true,
    voiceUsagePerDay: 100,
    offlineAccess: true,
    adFree: true,
    prioritySupport: true,
    exclusiveRecipes: true,
  },
};

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
