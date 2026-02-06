import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  SubscriptionTier,
  TIER_FEATURES,
  TierFeatures,
  FeatureCheckResult,
} from '@/types/subscription';

// Storage keys
const USAGE_KEY = 'souschef_daily_usage';
const LAST_RESET_KEY = 'souschef_last_usage_reset';

interface DailyUsage {
  aiSubstitutions: number;
  portionAnalysis: number;
  voiceCommands: number;
  date: string;
}

// Get today's date string
const getTodayString = (): string => {
  return new Date().toISOString().split('T')[0];
};

// Get or initialize daily usage
export const getDailyUsage = async (): Promise<DailyUsage> => {
  try {
    const stored = await AsyncStorage.getItem(USAGE_KEY);
    const lastReset = await AsyncStorage.getItem(LAST_RESET_KEY);
    const today = getTodayString();

    if (stored && lastReset === today) {
      return JSON.parse(stored);
    }

    // Reset for new day
    const newUsage: DailyUsage = {
      aiSubstitutions: 0,
      portionAnalysis: 0,
      voiceCommands: 0,
      date: today,
    };

    await AsyncStorage.setItem(USAGE_KEY, JSON.stringify(newUsage));
    await AsyncStorage.setItem(LAST_RESET_KEY, today);

    return newUsage;
  } catch (error) {
    console.error('Error getting daily usage:', error);
    return {
      aiSubstitutions: 0,
      portionAnalysis: 0,
      voiceCommands: 0,
      date: getTodayString(),
    };
  }
};

// Increment usage counter
export const incrementUsage = async (
  feature: 'aiSubstitutions' | 'portionAnalysis' | 'voiceCommands'
): Promise<DailyUsage> => {
  const usage = await getDailyUsage();
  usage[feature]++;
  await AsyncStorage.setItem(USAGE_KEY, JSON.stringify(usage));
  return usage;
};

// Get features for a tier
export const getTierFeatures = (tier: SubscriptionTier): TierFeatures => {
  return TIER_FEATURES[tier];
};

// Check if a feature is available for the user's tier
export const checkFeatureAccess = async (
  tier: SubscriptionTier,
  feature: keyof TierFeatures
): Promise<FeatureCheckResult> => {
  const features = TIER_FEATURES[tier];
  const featureValue = features[feature];

  // Boolean features
  if (typeof featureValue === 'boolean') {
    if (featureValue) {
      return { allowed: true };
    }
    return {
      allowed: false,
      reason: 'feature_locked',
      upgradeRequired: getUpgradeTierForFeature(feature),
    };
  }

  // Unlimited features
  if (featureValue === 'unlimited') {
    return { allowed: true };
  }

  // Number-limited features (check daily usage)
  const usage = await getDailyUsage();

  if (feature === 'aiSubstitutionsPerDay') {
    const limit = featureValue as number;
    const currentUsage = usage.aiSubstitutions;

    if (currentUsage >= limit) {
      return {
        allowed: false,
        reason: 'limit_reached',
        currentUsage,
        limit,
        upgradeRequired: getUpgradeTierForFeature(feature),
      };
    }

    return {
      allowed: true,
      currentUsage,
      limit,
    };
  }

  if (feature === 'portionAnalysisPerDay') {
    const limit = featureValue as number;
    const currentUsage = usage.portionAnalysis;

    if (currentUsage >= limit) {
      return {
        allowed: false,
        reason: 'limit_reached',
        currentUsage,
        limit,
        upgradeRequired: getUpgradeTierForFeature(feature),
      };
    }

    return {
      allowed: true,
      currentUsage,
      limit,
    };
  }

  // For maxRecipes and maxPantryItems, we'd need to check against actual counts
  // This would be handled separately in the respective services

  return { allowed: true };
};

// Get the tier that unlocks a specific feature
const getUpgradeTierForFeature = (feature: keyof TierFeatures): SubscriptionTier => {
  // Check Premium tier
  const premiumFeatures = TIER_FEATURES.premium;
  const premiumValue = premiumFeatures[feature];

  if (
    premiumValue === true ||
    premiumValue === 'unlimited' ||
    (typeof premiumValue === 'number' && premiumValue > 0)
  ) {
    return 'premium';
  }

  // Otherwise Pro tier
  return 'pro';
};

// Check if user can use AI substitution
export const canUseAISubstitution = async (
  tier: SubscriptionTier
): Promise<FeatureCheckResult> => {
  const features = TIER_FEATURES[tier];

  if (!features.aiSubstitutions) {
    return {
      allowed: false,
      reason: 'feature_locked',
      upgradeRequired: 'premium',
    };
  }

  if (features.aiSubstitutionsPerDay === 'unlimited') {
    return { allowed: true };
  }

  const usage = await getDailyUsage();
  const limit = features.aiSubstitutionsPerDay as number;

  if (usage.aiSubstitutions >= limit) {
    return {
      allowed: false,
      reason: 'limit_reached',
      currentUsage: usage.aiSubstitutions,
      limit,
      upgradeRequired: tier === 'free' ? 'premium' : 'pro',
    };
  }

  return {
    allowed: true,
    currentUsage: usage.aiSubstitutions,
    limit,
  };
};

// Check if user can use portion analysis
export const canUsePortionAnalysis = async (
  tier: SubscriptionTier
): Promise<FeatureCheckResult> => {
  const features = TIER_FEATURES[tier];

  if (!features.portionAnalysis) {
    return {
      allowed: false,
      reason: 'feature_locked',
      upgradeRequired: 'premium',
    };
  }

  if (features.portionAnalysisPerDay === 'unlimited') {
    return { allowed: true };
  }

  const usage = await getDailyUsage();
  const limit = features.portionAnalysisPerDay as number;

  if (usage.portionAnalysis >= limit) {
    return {
      allowed: false,
      reason: 'limit_reached',
      currentUsage: usage.portionAnalysis,
      limit,
      upgradeRequired: tier === 'premium' ? 'pro' : 'premium',
    };
  }

  return {
    allowed: true,
    currentUsage: usage.portionAnalysis,
    limit,
  };
};

// Record AI substitution usage
export const recordAISubstitutionUsage = async (): Promise<DailyUsage> => {
  return incrementUsage('aiSubstitutions');
};

// Record portion analysis usage
export const recordPortionAnalysisUsage = async (): Promise<DailyUsage> => {
  return incrementUsage('portionAnalysis');
};

// Get remaining AI uses for today
export const getRemainingAIUses = async (tier: SubscriptionTier): Promise<number | 'unlimited'> => {
  const features = TIER_FEATURES[tier];

  if (!features.aiSubstitutions) {
    return 0;
  }

  if (features.aiSubstitutionsPerDay === 'unlimited') {
    return 'unlimited';
  }

  const usage = await getDailyUsage();
  const limit = features.aiSubstitutionsPerDay as number;

  return Math.max(0, limit - usage.aiSubstitutions);
};

// Get remaining portion analysis uses for today
export const getRemainingPortionUses = async (
  tier: SubscriptionTier
): Promise<number | 'unlimited'> => {
  const features = TIER_FEATURES[tier];

  if (!features.portionAnalysis) {
    return 0;
  }

  if (features.portionAnalysisPerDay === 'unlimited') {
    return 'unlimited';
  }

  const usage = await getDailyUsage();
  const limit = features.portionAnalysisPerDay as number;

  return Math.max(0, limit - usage.portionAnalysis);
};

// Format feature limit for display
export const formatFeatureLimit = (limit: number | 'unlimited'): string => {
  if (limit === 'unlimited') {
    return 'Unlimited';
  }
  return limit.toString();
};

// Get tier display name
export const getTierDisplayName = (tier: SubscriptionTier): string => {
  const names: Record<SubscriptionTier, string> = {
    free: 'Free',
    premium: 'Premium',
    pro: 'Pro',
  };
  return names[tier];
};

// Get tier color
export const getTierColor = (tier: SubscriptionTier): string => {
  const colors: Record<SubscriptionTier, string> = {
    free: '#737373',
    premium: '#FF6B35',
    pro: '#8B5CF6',
  };
  return colors[tier];
};

// Check if user can use voice hands-free feature
export const canUseVoice = async (
  tier: SubscriptionTier
): Promise<FeatureCheckResult> => {
  const features = TIER_FEATURES[tier];

  if (!features.voiceHandsFree) {
    return {
      allowed: false,
      reason: 'feature_locked',
      upgradeRequired: 'premium',
    };
  }

  if (features.voiceUsagePerDay === 'unlimited') {
    return { allowed: true };
  }

  const usage = await getDailyUsage();
  const limit = features.voiceUsagePerDay as number;

  if (usage.voiceCommands >= limit) {
    return {
      allowed: false,
      reason: 'limit_reached',
      currentUsage: usage.voiceCommands,
      limit,
      upgradeRequired: tier === 'premium' ? 'pro' : 'premium',
    };
  }

  return {
    allowed: true,
    currentUsage: usage.voiceCommands,
    limit,
  };
};

// Record voice command usage
export const recordVoiceUsage = async (): Promise<DailyUsage> => {
  return incrementUsage('voiceCommands');
};

// Get remaining voice uses for today
export const getRemainingVoiceUses = async (
  tier: SubscriptionTier
): Promise<number | 'unlimited'> => {
  const features = TIER_FEATURES[tier];

  if (!features.voiceHandsFree) {
    return 0;
  }

  if (features.voiceUsagePerDay === 'unlimited') {
    return 'unlimited';
  }

  const usage = await getDailyUsage();
  const limit = features.voiceUsagePerDay as number;

  return Math.max(0, limit - usage.voiceCommands);
};

// Check if user can use meal plan generation
export const canUseMealPlanGeneration = async (
  tier: SubscriptionTier
): Promise<FeatureCheckResult> => {
  const features = TIER_FEATURES[tier];

  if (!features.mealPlanGeneration) {
    return {
      allowed: false,
      reason: 'feature_locked',
      upgradeRequired: 'pro',
    };
  }

  return { allowed: true };
};

// Check if user can view meal plans (without generation)
export const canViewMealPlans = (tier: SubscriptionTier): boolean => {
  const features = TIER_FEATURES[tier];
  return features.mealPlanning;
};

// Check if user can use waste tracking
export const canUseWasteTracking = (tier: SubscriptionTier): boolean => {
  const features = TIER_FEATURES[tier];
  return features.wasteTracking;
};
