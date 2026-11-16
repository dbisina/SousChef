import { PurchasesPackage, CustomerInfo, PurchasesOffering } from 'react-native-purchases';

// The tier table (what each plan includes), the RevenueCat ids and the tier names live in shared/ so the server
// enforces exactly what the app shows.
import {
  ENTITLEMENTS,
  PRODUCT_IDS,
  TIER_FEATURES,
  type EntitlementId,
  type ProductId,
  type SubscriptionTier,
  type TierFeatures,
} from '@shared/tiers';

export { ENTITLEMENTS, PRODUCT_IDS, TIER_FEATURES };
export type { EntitlementId, ProductId, SubscriptionTier, TierFeatures };

// Subscription plan types
export type SubscriptionPeriod = 'monthly' | 'annual';

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

// Subscription plans configuration
export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: PRODUCT_IDS.PREMIUM_MONTHLY,
    tier: 'premium',
    period: 'monthly',
    name: 'Premium',
    description: '$6.99/month',
    features: [
      'Unlimited AI substitutions',
      'Portion scanning & nutrition',
      'Voice hands-free cooking',
      'Meal planning',
      'Ad-free experience',
    ],
  },
  {
    id: PRODUCT_IDS.PREMIUM_ANNUAL,
    tier: 'premium',
    period: 'annual',
    name: 'Premium Annual',
    description: '$49.99/year — Save 40%',
    features: [
      'Unlimited AI substitutions',
      'Portion scanning & nutrition',
      'Voice hands-free cooking',
      'Meal planning',
      'Ad-free experience',
    ],
  },
  {
    id: PRODUCT_IDS.PRO_MONTHLY,
    tier: 'pro',
    period: 'monthly',
    name: 'Pro',
    description: '$11.99/month',
    features: [
      'Everything in Premium',
      'AI meal plan generation',
      'Zero-waste tracking',
      'Priority support',
      'Exclusive pro recipes',
    ],
    highlighted: true,
  },
  {
    id: PRODUCT_IDS.PRO_ANNUAL,
    tier: 'pro',
    period: 'annual',
    name: 'Pro Annual',
    description: '$89.99/year — Save 37%',
    features: [
      'Everything in Premium',
      'AI meal plan generation',
      'Zero-waste tracking',
      'Priority support',
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
