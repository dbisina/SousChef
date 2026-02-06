import { useEffect, useCallback, useState } from 'react';
import { Alert, Linking, Platform } from 'react-native';
import { PurchasesPackage, PurchasesOffering } from 'react-native-purchases';
import { useSubscriptionStore } from '@/stores/subscriptionStore';
import { useAuthStore } from '@/stores/authStore';
import {
  SubscriptionTier,
  TIER_FEATURES,
  SUBSCRIPTION_PLANS,
  ENTITLEMENTS,
  FeatureCheckResult,
  PaywallResult,
} from '@/types/subscription';
import type { CustomerCenterCallbacks } from '@/lib/revenuecat';
import {
  getTierFeatures,
  getTierDisplayName,
  getTierColor,
  getRemainingAIUses,
  getRemainingPortionUses,
  getRemainingVoiceUses,
  canUseVoice,
  canUseMealPlanGeneration,
  canViewMealPlans,
  canUseWasteTracking,
} from '@/services/subscriptionService';
import {
  getManagementURL,
  presentPaywall as rcPresentPaywall,
  presentPaywallIfNeeded as rcPresentPaywallIfNeeded,
  presentCustomerCenter as rcPresentCustomerCenter,
} from '@/lib/revenuecat';

// Main subscription hook
export const useSubscription = () => {
  const {
    isInitialized,
    isLoading,
    error,
    customerInfo,
    currentOffering,
    packages,
    subscriptionTier,
    isSubscribed,
    isPremium,
    isPro,
    aiUsageToday,
    portionUsageToday,
    initialize,
    login,
    logout,
    refreshCustomerInfo,
    fetchOfferings,
    purchase,
    restore,
    checkAIAccess,
    checkPortionAccess,
    recordAIUsage,
    recordPortionUsage,
    refreshUsage,
  } = useSubscriptionStore();

  const { user } = useAuthStore();

  // Initialize RevenueCat when user changes
  useEffect(() => {
    if (!isInitialized) {
      initialize(user?.id);
    } else if (user) {
      login(user.id, user.email, user.displayName);
    }
  }, [user?.id, isInitialized]);

  // Get tier features
  const features = getTierFeatures(subscriptionTier);
  const tierName = getTierDisplayName(subscriptionTier);
  const tierColor = getTierColor(subscriptionTier);

  // Purchase a package
  const purchasePackage = useCallback(
    async (pkg: PurchasesPackage) => {
      const result = await purchase(pkg);

      if (result.success) {
        Alert.alert('Success!', 'Thank you for subscribing to SousChef!');
      } else if (result.userCancelled) {
        // User cancelled, no alert needed
      } else {
        Alert.alert('Purchase Failed', result.error || 'Please try again.');
      }

      return result;
    },
    [purchase]
  );

  // Restore purchases
  const restorePurchases = useCallback(async () => {
    const result = await restore();

    if (result.success) {
      if (result.hasActiveSubscription) {
        Alert.alert('Restored!', 'Your subscription has been restored.');
      } else {
        Alert.alert('No Subscription Found', 'No active subscription was found to restore.');
      }
    } else {
      Alert.alert('Restore Failed', result.error || 'Please try again.');
    }

    return result;
  }, [restore]);

  // Open subscription management
  const openManagement = useCallback(async () => {
    if (customerInfo) {
      const url = getManagementURL(customerInfo);
      if (url) {
        await Linking.openURL(url);
      } else {
        // Fallback to platform-specific subscription settings
        if (Platform.OS === 'ios') {
          await Linking.openURL('https://apps.apple.com/account/subscriptions');
        } else {
          await Linking.openURL(
            'https://play.google.com/store/account/subscriptions'
          );
        }
      }
    }
  }, [customerInfo]);

  return {
    // State
    isInitialized,
    isLoading,
    error,
    customerInfo,
    packages,
    currentOffering,

    // Subscription status
    subscriptionTier,
    isSubscribed,
    isPremium,
    isPro,
    features,
    tierName,
    tierColor,

    // Usage
    aiUsageToday,
    portionUsageToday,

    // Actions
    purchasePackage,
    restorePurchases,
    openManagement,
    refreshCustomerInfo,
    fetchOfferings,
    refreshUsage,

    // Feature checks
    checkAIAccess,
    checkPortionAccess,
    recordAIUsage,
    recordPortionUsage,
  };
};

// Hook for checking specific feature access
export const useFeatureAccess = (feature: 'ai' | 'portion') => {
  const { subscriptionTier, checkAIAccess, checkPortionAccess } = useSubscription();
  const [accessResult, setAccessResult] = useState<FeatureCheckResult>({ allowed: true });
  const [isChecking, setIsChecking] = useState(false);

  const checkAccess = useCallback(async () => {
    setIsChecking(true);
    const result = feature === 'ai' ? await checkAIAccess() : await checkPortionAccess();
    setAccessResult(result);
    setIsChecking(false);
    return result;
  }, [feature, checkAIAccess, checkPortionAccess]);

  // Check on mount and when tier changes
  useEffect(() => {
    checkAccess();
  }, [subscriptionTier]);

  return {
    ...accessResult,
    isChecking,
    checkAccess,
  };
};

// Hook for premium feature gate
export const usePremiumFeature = () => {
  const { isSubscribed, isPremium, isPro, subscriptionTier } = useSubscription();
  const [showPaywall, setShowPaywall] = useState(false);

  const requirePremium = useCallback(
    (callback: () => void) => {
      if (isPremium || isPro) {
        callback();
      } else {
        setShowPaywall(true);
      }
    },
    [isPremium, isPro]
  );

  const requirePro = useCallback(
    (callback: () => void) => {
      if (isPro) {
        callback();
      } else {
        setShowPaywall(true);
      }
    },
    [isPro]
  );

  const closePaywall = useCallback(() => {
    setShowPaywall(false);
  }, []);

  return {
    isSubscribed,
    isPremium,
    isPro,
    subscriptionTier,
    showPaywall,
    requirePremium,
    requirePro,
    closePaywall,
  };
};

// Hook for remaining usage
export const useRemainingUsage = () => {
  const { subscriptionTier, aiUsageToday, portionUsageToday, refreshUsage } =
    useSubscription();
  const [remainingAI, setRemainingAI] = useState<number | 'unlimited'>(0);
  const [remainingPortion, setRemainingPortion] = useState<number | 'unlimited'>(0);

  useEffect(() => {
    const fetchRemaining = async () => {
      const [ai, portion] = await Promise.all([
        getRemainingAIUses(subscriptionTier),
        getRemainingPortionUses(subscriptionTier),
      ]);
      setRemainingAI(ai);
      setRemainingPortion(portion);
    };

    fetchRemaining();
  }, [subscriptionTier, aiUsageToday, portionUsageToday]);

  return {
    remainingAI,
    remainingPortion,
    aiUsageToday,
    portionUsageToday,
    refreshUsage,
  };
};

// Hook for subscription packages
export const useSubscriptionPackages = () => {
  const { packages, currentOffering, isLoading, fetchOfferings } = useSubscription();

  // Group packages by period
  const monthlyPackages = packages.filter(
    (pkg) => pkg.packageType === 'MONTHLY' || pkg.identifier.includes('monthly')
  );

  const annualPackages = packages.filter(
    (pkg) => pkg.packageType === 'ANNUAL' || pkg.identifier.includes('annual')
  );

  // Get plan details
  const getPackagePlan = (pkg: PurchasesPackage) => {
    return SUBSCRIPTION_PLANS.find(
      (plan) => plan.id === pkg.identifier || pkg.identifier.includes(plan.tier)
    );
  };

  return {
    packages,
    monthlyPackages,
    annualPackages,
    currentOffering,
    isLoading,
    fetchOfferings,
    getPackagePlan,
  };
};

// Hook to sync subscription with auth
export const useSyncSubscription = () => {
  const { user } = useAuthStore();
  const { login, logout: rcLogout, isInitialized } = useSubscriptionStore();

  useEffect(() => {
    if (!isInitialized) return;

    if (user) {
      login(user.id, user.email, user.displayName);
    } else {
      rcLogout();
    }
  }, [user, isInitialized]);
};

// Hook for checking voice feature access
export const useVoiceAccess = () => {
  const { subscriptionTier } = useSubscription();
  const [accessResult, setAccessResult] = useState<FeatureCheckResult>({ allowed: false });
  const [remainingUses, setRemainingUses] = useState<number | 'unlimited'>(0);
  const [isChecking, setIsChecking] = useState(false);

  const checkAccess = useCallback(async () => {
    setIsChecking(true);
    const result = await canUseVoice(subscriptionTier);
    setAccessResult(result);
    setIsChecking(false);
    return result;
  }, [subscriptionTier]);

  useEffect(() => {
    checkAccess();
    getRemainingVoiceUses(subscriptionTier).then(setRemainingUses);
  }, [subscriptionTier]);

  return {
    ...accessResult,
    remainingUses,
    isChecking,
    checkAccess,
  };
};

// Hook for checking meal plan feature access
export const useMealPlanFeatureAccess = () => {
  const { subscriptionTier, isPremium, isPro } = useSubscription();
  const [canView, setCanView] = useState(false);
  const [canGenerate, setCanGenerate] = useState<FeatureCheckResult>({ allowed: false });
  const [canTrack, setCanTrack] = useState(false);

  useEffect(() => {
    const checkAccess = async () => {
      setCanView(canViewMealPlans(subscriptionTier));
      setCanTrack(canUseWasteTracking(subscriptionTier));
      const genResult = await canUseMealPlanGeneration(subscriptionTier);
      setCanGenerate(genResult);
    };
    checkAccess();
  }, [subscriptionTier]);

  return {
    canView,
    canGenerate,
    canTrack,
    isPremium,
    isPro,
    subscriptionTier,
  };
};

// ============================================
// RevenueCat UI Hooks
// ============================================

// Hook for presenting RevenueCat Paywalls
export const useRevenueCatPaywall = () => {
  const { currentOffering, refreshCustomerInfo } = useSubscription();
  const [isPresenting, setIsPresenting] = useState(false);

  // Present the default paywall
  const presentPaywall = useCallback(
    async (offering?: PurchasesOffering): Promise<PaywallResult> => {
      setIsPresenting(true);
      try {
        const result = await rcPresentPaywall(offering ?? currentOffering ?? undefined);

        if (result.status === 'purchased' || result.status === 'restored') {
          await refreshCustomerInfo();
        }

        return result;
      } finally {
        setIsPresenting(false);
      }
    },
    [currentOffering, refreshCustomerInfo]
  );

  // Present paywall only if user lacks premium entitlement
  const presentPaywallForPremium = useCallback(async (): Promise<PaywallResult> => {
    setIsPresenting(true);
    try {
      const result = await rcPresentPaywallIfNeeded(
        ENTITLEMENTS.PREMIUM,
        currentOffering ?? undefined
      );

      if (result.status === 'purchased' || result.status === 'restored') {
        await refreshCustomerInfo();
      }

      return result;
    } finally {
      setIsPresenting(false);
    }
  }, [currentOffering, refreshCustomerInfo]);

  // Present paywall only if user lacks pro entitlement
  const presentPaywallForPro = useCallback(async (): Promise<PaywallResult> => {
    setIsPresenting(true);
    try {
      const result = await rcPresentPaywallIfNeeded(
        ENTITLEMENTS.PRO,
        currentOffering ?? undefined
      );

      if (result.status === 'purchased' || result.status === 'restored') {
        await refreshCustomerInfo();
      }

      return result;
    } finally {
      setIsPresenting(false);
    }
  }, [currentOffering, refreshCustomerInfo]);

  // Present paywall for a specific entitlement
  const presentPaywallIfNeeded = useCallback(
    async (entitlementId: string): Promise<PaywallResult> => {
      setIsPresenting(true);
      try {
        const result = await rcPresentPaywallIfNeeded(
          entitlementId,
          currentOffering ?? undefined
        );

        if (result.status === 'purchased' || result.status === 'restored') {
          await refreshCustomerInfo();
        }

        return result;
      } finally {
        setIsPresenting(false);
      }
    },
    [currentOffering, refreshCustomerInfo]
  );

  return {
    isPresenting,
    presentPaywall,
    presentPaywallForPremium,
    presentPaywallForPro,
    presentPaywallIfNeeded,
  };
};

// Hook for presenting RevenueCat Customer Center
export const useCustomerCenter = () => {
  const { refreshCustomerInfo, isSubscribed } = useSubscription();
  const [isPresenting, setIsPresenting] = useState(false);

  const presentCustomerCenter = useCallback(
    async (callbacks?: CustomerCenterCallbacks): Promise<void> => {
      setIsPresenting(true);
      try {
        const enhancedCallbacks: CustomerCenterCallbacks = {
          ...callbacks,
          onRestoreCompleted: ({ customerInfo }) => {
            refreshCustomerInfo();
            callbacks?.onRestoreCompleted?.({ customerInfo });
          },
        };

        await rcPresentCustomerCenter(enhancedCallbacks);
      } catch (error) {
        console.error('Failed to present Customer Center:', error);
        Alert.alert(
          'Error',
          'Unable to open subscription management. Please try again later.'
        );
      } finally {
        setIsPresenting(false);
      }
    },
    [refreshCustomerInfo]
  );

  return {
    isPresenting,
    presentCustomerCenter,
    isSubscribed,
  };
};

// Convenience hook that combines paywall and customer center
export const useSubscriptionUI = () => {
  const {
    isPresenting: isPaywallPresenting,
    presentPaywall,
    presentPaywallForPremium,
    presentPaywallForPro,
    presentPaywallIfNeeded,
  } = useRevenueCatPaywall();

  const {
    isPresenting: isCustomerCenterPresenting,
    presentCustomerCenter,
    isSubscribed,
  } = useCustomerCenter();

  const { isPremium, isPro, subscriptionTier } = useSubscription();

  // Unified function to show upgrade UI or customer center based on subscription status
  const showSubscriptionUI = useCallback(async () => {
    if (isSubscribed) {
      await presentCustomerCenter();
    } else {
      await presentPaywall();
    }
  }, [isSubscribed, presentCustomerCenter, presentPaywall]);

  return {
    // State
    isPresenting: isPaywallPresenting || isCustomerCenterPresenting,
    isSubscribed,
    isPremium,
    isPro,
    subscriptionTier,

    // Paywall functions
    presentPaywall,
    presentPaywallForPremium,
    presentPaywallForPro,
    presentPaywallIfNeeded,

    // Customer Center
    presentCustomerCenter,

    // Unified
    showSubscriptionUI,
  };
};
