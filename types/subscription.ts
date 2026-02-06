import { PurchasesPackage, CustomerInfo, PurchasesOffering } from 'react-native-purchases';

// Subscription tier identifiers (must match RevenueCat entitlements)
export const ENTITLEMENTS = {
  PREMIUM: 'Souschef Premium',
  PRO: 'Souschef Pro',
} as const;

export type EntitlementId = typeof ENTITLEMENTS[keyof typeof ENTITLEMENTS];

// Product identifiers (must match RevenueCat products)
export const PRODUCT_IDS = {
  // Premium tier - $9.99/month, $79.99/year
  PREMIUM_MONTHLY: 'premium_monthly',
  PREMIUM_ANNUAL: 'premium_yearly',
  // Pro tier - $19.99/month, $149.99/year
  PRO_MONTHLY: 'pro_monthly',
  PRO_ANNUAL: 'pro_yearly',
} as const;

export type ProductId = typeof PRODUCT_IDS[keyof typeof PRODUCT_IDS];

// Subscription plan types
export type SubscriptionPeriod = 'monthly' | 'annual';
export type SubscriptionTier = 'free' | 'premium' | 'pro';

// Subscription plan configuration
export interface SubscriptionPlan {
  id: ProductId;
  tier: SubscriptionTier;
  period: SubscriptionPeriod;
  name: string;
  description: string;
  features: string[];
  highlighted?: boolean;
}

// Feature flags for each tier
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

// Tier feature definitions
export const TIER_FEATURES: Record<SubscriptionTier, TierFeatures> = {
  free: {
    maxRecipes: 10,
    maxPantryItems: 20,
    aiSubstitutions: true,
    aiSubstitutionsPerDay: 3,
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
    aiSubstitutionsPerDay: 20,
    portionAnalysis: true,
    portionAnalysisPerDay: 10,
    advancedNutrition: true,
    mealPlanning: true,
    mealPlanGeneration: false,
    wasteTracking: true,
    voiceHandsFree: true,
    voiceUsagePerDay: 20,
    offlineAccess: true,
    adFree: true,
    prioritySupport: false,
    exclusiveRecipes: false,
  },
  pro: {
    maxRecipes: 'unlimited',
    maxPantryItems: 'unlimited',
    aiSubstitutions: true,
    aiSubstitutionsPerDay: 'unlimited',
    portionAnalysis: true,
    portionAnalysisPerDay: 'unlimited',
    advancedNutrition: true,
    mealPlanning: true,
    mealPlanGeneration: true,
    wasteTracking: true,
    voiceHandsFree: true,
    voiceUsagePerDay: 'unlimited',
    offlineAccess: true,
    adFree: true,
    prioritySupport: true,
    exclusiveRecipes: true,
  },
};

// Subscription plans configuration
export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: PRODUCT_IDS.PREMIUM_MONTHLY,
    tier: 'premium',
    period: 'monthly',
    name: 'Premium',
    description: '$9.99/month - Enhanced cooking',
    features: [
      'Unlimited recipes & pantry',
      '20 AI substitutions/day',
      '10 food scans/day',
      'Voice hands-free cooking',
      'Meal planning',
    ],
  },
  {
    id: PRODUCT_IDS.PREMIUM_ANNUAL,
    tier: 'premium',
    period: 'annual',
    name: 'Premium Annual',
    description: '$79.99/year - Save 33%',
    features: [
      'Unlimited recipes & pantry',
      '20 AI substitutions/day',
      '10 food scans/day',
      'Voice hands-free cooking',
      'Meal planning',
    ],
  },
  {
    id: PRODUCT_IDS.PRO_MONTHLY,
    tier: 'pro',
    period: 'monthly',
    name: 'Pro',
    description: '$19.99/month - Everything unlimited',
    features: [
      'Everything in Premium',
      'Unlimited AI features',
      'AI meal plan generation',
      'Zero-waste tracking',
      'Exclusive pro recipes',
    ],
    highlighted: true,
  },
  {
    id: PRODUCT_IDS.PRO_ANNUAL,
    tier: 'pro',
    period: 'annual',
    name: 'Pro Annual',
    description: '$149.99/year - Save 37%',
    features: [
      'Everything in Premium',
      'Unlimited AI features',
      'AI meal plan generation',
      'Zero-waste tracking',
      'Exclusive pro recipes',
    ],
  },
];

// Subscription state
export interface SubscriptionState {
  isInitialized: boolean;
  isLoading: boolean;
  error: string | null;
  customerInfo: CustomerInfo | null;
  currentOffering: PurchasesOffering | null;
  packages: PurchasesPackage[];

  // Computed subscription status
  subscriptionTier: SubscriptionTier;
  isSubscribed: boolean;
  isPremium: boolean;
  isPro: boolean;

  // Usage tracking
  aiUsageToday: number;
  portionUsageToday: number;
  voiceUsageToday: number;
  lastUsageReset: string; // ISO date string
}

// Purchase result
export interface PurchaseResult {
  success: boolean;
  customerInfo?: CustomerInfo;
  error?: string;
  userCancelled?: boolean;
}

// Restore result
export interface RestoreResult {
  success: boolean;
  customerInfo?: CustomerInfo;
  error?: string;
  hasActiveSubscription: boolean;
}

// Feature check result
export interface FeatureCheckResult {
  allowed: boolean;
  reason?: 'limit_reached' | 'feature_locked' | 'not_subscribed';
  currentUsage?: number;
  limit?: number | 'unlimited';
  upgradeRequired?: SubscriptionTier;
}

// Paywall result from RevenueCat UI
export type PaywallResultStatus =
  | 'purchased'
  | 'restored'
  | 'cancelled'
  | 'not_presented'
  | 'error';

export interface PaywallResult {
  status: PaywallResultStatus;
  error?: string;
}

// Customer Center callbacks - re-exported from lib/revenuecat.ts
// Use the SDK's CustomerCenterCallbacks type directly for type safety

// Paywall display options
export interface PaywallDisplayOptions {
  offering?: PurchasesOffering;
  requiredEntitlementId?: string;
}

// Export RevenueCat types for convenience
export type { PurchasesPackage, CustomerInfo, PurchasesOffering };
