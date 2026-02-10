import { create } from 'zustand';
import {
  CustomerInfo,
  PurchasesPackage,
  PurchasesOffering,
} from 'react-native-purchases';
import {
  SubscriptionTier,
  SubscriptionState,
  PurchaseResult,
  RestoreResult,
  FeatureCheckResult,
  PaywallResult,
} from '@/types/subscription';
import type { CustomerCenterCallbacks } from '@/lib/revenuecat';
import {
  initializeRevenueCat,
  loginToRevenueCat,
  logoutFromRevenueCat,
  getCustomerInfo,
  getOfferings,
  getAllOfferings,
  purchasePackage,
  restorePurchases,
  getSubscriptionTier,
  addCustomerInfoListener,
  setUserAttributes,
  isPurchasesConfigured,
  presentPaywall as rcPresentPaywall,
  presentPaywallIfNeeded as rcPresentPaywallIfNeeded,
  presentCustomerCenter as rcPresentCustomerCenter,
} from '@/lib/revenuecat';
import {
  getDailyUsage,
  canUseAISubstitution,
  canUsePortionAnalysis,
  recordAISubstitutionUsage,
  recordPortionAnalysisUsage,
  canUseVoice,
  recordVoiceUsage as recordVoiceUsageService,
} from '@/services/subscriptionService';

interface SubscriptionStore extends SubscriptionState {
  currentAppUserID: string | null;
  // Actions
  initialize: (userId?: string) => Promise<void>;
  login: (userId: string, email?: string, displayName?: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshCustomerInfo: () => Promise<void>;
  fetchOfferings: () => Promise<void>;
  purchase: (packageToPurchase: PurchasesPackage) => Promise<PurchaseResult>;
  restore: () => Promise<RestoreResult>;

  // RevenueCat UI - Paywalls
  presentPaywall: (offering?: PurchasesOffering) => Promise<PaywallResult>;
  presentPaywallIfNeeded: (
    entitlementId: string,
    offering?: PurchasesOffering
  ) => Promise<PaywallResult>;

  // RevenueCat UI - Customer Center
  presentCustomerCenter: (callbacks?: CustomerCenterCallbacks) => Promise<void>;

  // Feature checks
  checkAIAccess: () => Promise<FeatureCheckResult>;
  checkPortionAccess: () => Promise<FeatureCheckResult>;
  checkVoiceAccess: () => Promise<FeatureCheckResult>;
  recordAIUsage: () => Promise<void>;
  recordPortionUsage: () => Promise<void>;
  recordVoiceUsage: () => Promise<void>;
  refreshUsage: () => Promise<void>;

  // Internal
  setCustomerInfo: (customerInfo: CustomerInfo | null) => Promise<void>;
  setError: (error: string | null) => void;
  setLoading: (loading: boolean) => void;
}

export const useSubscriptionStore = create<SubscriptionStore>((set, get) => ({
  // Initial state
  isInitialized: false,
  isLoading: false,
  error: null,
  customerInfo: null,
  currentOffering: null,
  packages: [],
  subscriptionTier: 'free',
  isSubscribed: false,
  isPremium: false,
  isPro: false,
  aiUsageToday: 0,
  portionUsageToday: 0,
  voiceUsageToday: 0,
  lastUsageReset: new Date().toISOString().split('T')[0],
  currentAppUserID: null,

  // Initialize RevenueCat
  initialize: async (userId?: string) => {
    set({ isLoading: true, error: null });

    try {
      await initializeRevenueCat(userId);

      // Check if RevenueCat was actually configured (API key might be missing)
      const configured = await isPurchasesConfigured();
      if (!configured) {
        console.warn('[Subscriptions] RevenueCat not configured — skipping offerings fetch');
        set({ isInitialized: true, isLoading: false });
        return;
      }

      // Fetch customer info and offerings (from all offerings: premium + pro)
      const [customerInfo, allOfferings] = await Promise.all([
        getCustomerInfo(),
        getAllOfferings(),
      ]);

      // Combine packages from premium and pro offerings
      const premiumOffering = allOfferings['premium'];
      const proOffering = allOfferings['pro'];
      const defaultOffering = allOfferings['default'];
      const allPackages = [
        ...(premiumOffering?.availablePackages || []),
        ...(proOffering?.availablePackages || []),
      ];
      // Fallback to default offering if premium/pro not found
      const combinedPackages = allPackages.length > 0
        ? allPackages
        : (defaultOffering?.availablePackages || []);

      const tier = getSubscriptionTier(customerInfo);

      // Admin override - admins always get pro access without needing a RevenueCat purchase
      let finalTier = tier;
      if (tier === 'free') {
        const { useAuthStore } = await import('./authStore');
        const user = useAuthStore.getState().user;
        if (user?.role === 'admin') {
          finalTier = user?.subscriptionTier || 'pro';
        }
      }

      const usage = await getDailyUsage();

      set({
        isInitialized: true,
        customerInfo,
        currentOffering: premiumOffering || defaultOffering || null,
        packages: combinedPackages,
        subscriptionTier: finalTier,
        isSubscribed: finalTier !== 'free',
        isPremium: finalTier === 'premium' || finalTier === 'pro',
        isPro: finalTier === 'pro',
        aiUsageToday: usage.aiSubstitutions,
        portionUsageToday: usage.portionAnalysis,
        voiceUsageToday: usage.voiceCommands,
        lastUsageReset: usage.date,
        isLoading: false,
        currentAppUserID: userId || null,
      });

      // Set up listener for customer info updates
      addCustomerInfoListener((info) => {
        get().setCustomerInfo(info);
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to initialize';
      set({ error: message, isLoading: false, isInitialized: true });
    }
  },

  // Login to RevenueCat
  login: async (userId, email, displayName) => {
    // Check if already logged in with same user
    const alreadyLoggedIn = get().currentAppUserID === userId;

    // Even if already logged in, check for Firestore tier override (admin only)
    if (alreadyLoggedIn) {
      // Re-check Firestore tier in case user data was updated
      const currentTier = get().subscriptionTier;
      if (currentTier === 'free') {
        const { useAuthStore } = await import('./authStore');
        const user = useAuthStore.getState().user;
        // Admin users always get pro access
        if (user?.role === 'admin') {
          const adminTier = user?.subscriptionTier || 'pro';
          set({
            subscriptionTier: adminTier,
            isSubscribed: true,
            isPremium: true,
            isPro: adminTier === 'pro',
          });
        }
      }
      return;
    }

    set({ isLoading: true, error: null });

    try {
      const customerInfo = await loginToRevenueCat(userId);

      // Set user attributes
      if (email || displayName) {
        await setUserAttributes({ email, displayName });
      }

      let finalTier = getSubscriptionTier(customerInfo);

      // Admin users always get pro access
      if (finalTier === 'free') {
        const { useAuthStore } = await import('./authStore');
        const user = useAuthStore.getState().user;
        if (user?.role === 'admin') {
          finalTier = user?.subscriptionTier || 'pro';
        }
      }

      set({
        customerInfo,
        subscriptionTier: finalTier,
        isSubscribed: finalTier !== 'free',
        isPremium: finalTier === 'premium' || finalTier === 'pro',
        isPro: finalTier === 'pro',
        isLoading: false,
        currentAppUserID: userId,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to login';
      set({ error: message, isLoading: false });
    }
  },

  // Logout from RevenueCat
  logout: async () => {
    set({ isLoading: true, error: null });

    try {
      const customerInfo = await logoutFromRevenueCat();

      set({
        customerInfo,
        subscriptionTier: 'free',
        isSubscribed: false,
        isPremium: false,
        isPro: false,
        isLoading: false,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to logout';
      set({ error: message, isLoading: false });
    }
  },

  // Refresh customer info
  refreshCustomerInfo: async () => {
    try {
      const customerInfo = await getCustomerInfo();
      get().setCustomerInfo(customerInfo);
    } catch (error) {
      console.error('Failed to refresh customer info:', error);
    }
  },

  // Fetch available offerings (combine premium + pro)
  fetchOfferings: async () => {
    set({ isLoading: true });

    try {
      const allOfferings = await getAllOfferings();

      const premiumOffering = allOfferings['premium'];
      const proOffering = allOfferings['pro'];
      const defaultOffering = allOfferings['default'];
      const allPackages = [
        ...(premiumOffering?.availablePackages || []),
        ...(proOffering?.availablePackages || []),
      ];
      const combinedPackages = allPackages.length > 0
        ? allPackages
        : (defaultOffering?.availablePackages || []);

      set({
        currentOffering: premiumOffering || defaultOffering || null,
        packages: combinedPackages,
        isLoading: false,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch offerings';
      set({ error: message, isLoading: false });
    }
  },

  // Purchase a package
  purchase: async (packageToPurchase) => {
    set({ isLoading: true, error: null });

    try {
      const result = await purchasePackage(packageToPurchase);

      if (result.success && result.customerInfo) {
        get().setCustomerInfo(result.customerInfo);
      }

      set({ isLoading: false });
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Purchase failed';
      set({ error: message, isLoading: false });
      return { success: false, error: message };
    }
  },

  // Restore purchases
  restore: async () => {
    set({ isLoading: true, error: null });

    try {
      const result = await restorePurchases();

      if (result.success && result.customerInfo) {
        get().setCustomerInfo(result.customerInfo);
      }

      set({ isLoading: false });
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Restore failed';
      set({ error: message, isLoading: false });
      return { success: false, error: message, hasActiveSubscription: false };
    }
  },

  // Present RevenueCat Paywall
  presentPaywall: async (offering) => {
    set({ isLoading: true, error: null });

    try {
      const result = await rcPresentPaywall(offering);

      if (result.status === 'purchased' || result.status === 'restored') {
        await get().refreshCustomerInfo();
      }

      set({ isLoading: false });
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Paywall error';
      set({ error: message, isLoading: false });
      return { status: 'error', error: message };
    }
  },

  // Present Paywall only if user lacks entitlement
  presentPaywallIfNeeded: async (entitlementId, offering) => {
    set({ isLoading: true, error: null });

    try {
      const result = await rcPresentPaywallIfNeeded(entitlementId, offering);

      if (result.status === 'purchased' || result.status === 'restored') {
        await get().refreshCustomerInfo();
      }

      set({ isLoading: false });
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Paywall error';
      set({ error: message, isLoading: false });
      return { status: 'error', error: message };
    }
  },

  // Present Customer Center
  presentCustomerCenter: async (callbacks) => {
    set({ isLoading: true, error: null });

    try {
      const enhancedCallbacks: CustomerCenterCallbacks = {
        ...callbacks,
        onRestoreCompleted: ({ customerInfo }) => {
          get().setCustomerInfo(customerInfo);
          callbacks?.onRestoreCompleted?.({ customerInfo });
        },
      };

      await rcPresentCustomerCenter(enhancedCallbacks);
      set({ isLoading: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Customer Center error';
      set({ error: message, isLoading: false });
      throw error;
    }
  },

  // Check AI feature access
  checkAIAccess: async () => {
    const { subscriptionTier } = get();
    return canUseAISubstitution(subscriptionTier);
  },

  // Check portion analysis access
  checkPortionAccess: async () => {
    const { subscriptionTier } = get();
    return canUsePortionAnalysis(subscriptionTier);
  },

  // Check voice access
  checkVoiceAccess: async () => {
    const { subscriptionTier } = get();
    return canUseVoice(subscriptionTier);
  },

  // Record AI usage
  recordAIUsage: async () => {
    const usage = await recordAISubstitutionUsage();
    set({ aiUsageToday: usage.aiSubstitutions });
  },

  // Record portion analysis usage
  recordPortionUsage: async () => {
    const usage = await recordPortionAnalysisUsage();
    set({ portionUsageToday: usage.portionAnalysis });
  },

  // Record voice usage
  recordVoiceUsage: async () => {
    const usage = await recordVoiceUsageService();
    set({ voiceUsageToday: usage.voiceCommands });
  },

  // Refresh daily usage
  refreshUsage: async () => {
    const usage = await getDailyUsage();
    set({
      aiUsageToday: usage.aiSubstitutions,
      portionUsageToday: usage.portionAnalysis,
      voiceUsageToday: usage.voiceCommands,
      lastUsageReset: usage.date,
    });
  },

  // Set customer info (internal)
  setCustomerInfo: async (customerInfo) => {
    if (!customerInfo) {
      // Even if RevenueCat has no info, check for admin override
      const { useAuthStore } = await import('./authStore');
      const user = useAuthStore.getState().user;
      if (user?.role === 'admin') {
        const adminTier = user?.subscriptionTier || 'pro';
        set({
          customerInfo: null,
          subscriptionTier: adminTier,
          isSubscribed: true,
          isPremium: true,
          isPro: adminTier === 'pro',
        });
        return;
      }

      set({
        customerInfo: null,
        subscriptionTier: 'free',
        isSubscribed: false,
        isPremium: false,
        isPro: false,
      });
      return;
    }

    let tier = getSubscriptionTier(customerInfo);

    // Preserve admin override when RevenueCat reports 'free'
    if (tier === 'free') {
      const { useAuthStore } = await import('./authStore');
      const user = useAuthStore.getState().user;
      if (user?.role === 'admin') {
        tier = user?.subscriptionTier || 'pro';
      }
    }

    set({
      customerInfo,
      subscriptionTier: tier,
      isSubscribed: tier !== 'free',
      isPremium: tier === 'premium' || tier === 'pro',
      isPro: tier === 'pro',
    });
  },

  // Set error
  setError: (error) => set({ error }),

  // Set loading
  setLoading: (isLoading) => set({ isLoading }),
}));
