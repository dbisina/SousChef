import { Platform } from 'react-native';
import Purchases, {
  PurchasesPackage,
  CustomerInfo,
  PurchasesOffering,
  PurchasesError,
  LOG_LEVEL,
  PURCHASES_ERROR_CODE,
} from 'react-native-purchases';
import RevenueCatUI, {
  PAYWALL_RESULT,
  type CustomerCenterCallbacks as RCCustomerCenterCallbacks,
} from 'react-native-purchases-ui';
import {
  ENTITLEMENTS,
  SubscriptionTier,
  PurchaseResult,
  RestoreResult,
  PaywallResult,
} from '@/types/subscription';

// API Keys from environment
const IOS_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY || '';
const ANDROID_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY || '';

// Get the appropriate API key for the current platform
const getApiKey = (): string => {
  return Platform.OS === 'ios' ? IOS_API_KEY : ANDROID_API_KEY;
};

let isConfigured = false;

// Initialize RevenueCat
export const initializeRevenueCat = async (userId?: string): Promise<void> => {
  const apiKey = getApiKey();

  if (!apiKey) {
    console.warn(
      `[RevenueCat] API key not configured for ${Platform.OS}. ` +
      `Ensure EXPO_PUBLIC_REVENUECAT_${Platform.OS === 'ios' ? 'IOS' : 'ANDROID'}_API_KEY ` +
      `is set as an EAS secret with the EXPO_PUBLIC_ prefix.`
    );
    return;
  }

  if (isConfigured) {
    // Already configured, maybe just identify user if changed? 
    // For now, avoid re-configuring to stop warnings
    return;
  }

  // Set log level based on environment
  const isDev = __DEV__;
  Purchases.setLogLevel(isDev ? LOG_LEVEL.DEBUG : LOG_LEVEL.ERROR);

  // Configure Purchases
  if (userId) {
    await Purchases.configure({ apiKey, appUserID: userId });
  } else {
    await Purchases.configure({ apiKey });
  }

  isConfigured = true;
};

// Login user to RevenueCat (sync with your auth system)
export const loginToRevenueCat = async (userId: string): Promise<CustomerInfo> => {
  const { customerInfo } = await Purchases.logIn(userId);
  return customerInfo;
};

// Logout user from RevenueCat
export const logoutFromRevenueCat = async (): Promise<CustomerInfo> => {
  return await Purchases.logOut();
};

// Get current customer info
export const getCustomerInfo = async (): Promise<CustomerInfo> => {
  return await Purchases.getCustomerInfo();
};

// Get available offerings (subscription packages)
export const getOfferings = async (): Promise<PurchasesOffering | null> => {
  const offerings = await Purchases.getOfferings();
  return offerings.current;
};

// Get all offerings
export const getAllOfferings = async (): Promise<Record<string, PurchasesOffering>> => {
  const offerings = await Purchases.getOfferings();
  return offerings.all;
};

// Purchase a package
export const purchasePackage = async (
  packageToPurchase: PurchasesPackage
): Promise<PurchaseResult> => {
  try {
    const { customerInfo } = await Purchases.purchasePackage(packageToPurchase);
    return {
      success: true,
      customerInfo,
    };
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'userCancelled' in error) {
      const purchaseError = error as { userCancelled: boolean; code: number; message: string };
      if (purchaseError.userCancelled) {
        return {
          success: false,
          userCancelled: true,
        };
      }
    }

    const errorMessage = error instanceof Error ? error.message : 'Purchase failed';
    return {
      success: false,
      error: errorMessage,
    };
  }
};

// Restore purchases
export const restorePurchases = async (): Promise<RestoreResult> => {
  try {
    const customerInfo = await Purchases.restorePurchases();
    const hasActiveSubscription = checkHasActiveSubscription(customerInfo);

    return {
      success: true,
      customerInfo,
      hasActiveSubscription,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Restore failed';
    return {
      success: false,
      error: errorMessage,
      hasActiveSubscription: false,
    };
  }
};

// Check if user has an active subscription
export const checkHasActiveSubscription = (customerInfo: CustomerInfo): boolean => {
  const { entitlements } = customerInfo;
  return (
    entitlements.active[ENTITLEMENTS.PREMIUM]?.isActive ||
    entitlements.active[ENTITLEMENTS.PRO]?.isActive ||
    false
  );
};

// Get the user's current subscription tier
export const getSubscriptionTier = (customerInfo: CustomerInfo): SubscriptionTier => {
  const { entitlements } = customerInfo;

  if (entitlements.active[ENTITLEMENTS.PRO]?.isActive) {
    return 'pro';
  }

  if (entitlements.active[ENTITLEMENTS.PREMIUM]?.isActive) {
    return 'premium';
  }

  return 'free';
};

// Check if user has a specific entitlement
export const hasEntitlement = (
  customerInfo: CustomerInfo,
  entitlementId: string
): boolean => {
  return customerInfo.entitlements.active[entitlementId]?.isActive || false;
};

// Get subscription expiry date
export const getSubscriptionExpiryDate = (customerInfo: CustomerInfo): Date | null => {
  const { entitlements } = customerInfo;

  // Check Pro first, then Premium
  const proEntitlement = entitlements.active[ENTITLEMENTS.PRO];
  const premiumEntitlement = entitlements.active[ENTITLEMENTS.PREMIUM];

  const activeEntitlement = proEntitlement || premiumEntitlement;

  if (activeEntitlement?.expirationDate) {
    return new Date(activeEntitlement.expirationDate);
  }

  return null;
};

// Check if subscription will renew
export const willSubscriptionRenew = (customerInfo: CustomerInfo): boolean => {
  const { entitlements } = customerInfo;

  const proEntitlement = entitlements.active[ENTITLEMENTS.PRO];
  const premiumEntitlement = entitlements.active[ENTITLEMENTS.PREMIUM];

  const activeEntitlement = proEntitlement || premiumEntitlement;

  return activeEntitlement?.willRenew || false;
};

// Get management URL for subscription
export const getManagementURL = (customerInfo: CustomerInfo): string | null => {
  return customerInfo.managementURL;
};

// Set user attributes for analytics
export const setUserAttributes = async (attributes: {
  email?: string;
  displayName?: string;
  [key: string]: string | undefined;
}): Promise<void> => {
  if (attributes.email) {
    await Purchases.setEmail(attributes.email);
  }
  if (attributes.displayName) {
    await Purchases.setDisplayName(attributes.displayName);
  }

  // Set custom attributes
  for (const [key, value] of Object.entries(attributes)) {
    if (key !== 'email' && key !== 'displayName' && value) {
      await Purchases.setAttributes({ [key]: value });
    }
  }
};

// Add listener for customer info updates
export const addCustomerInfoListener = (
  listener: (customerInfo: CustomerInfo) => void
): (() => void) => {
  Purchases.addCustomerInfoUpdateListener(listener);

  // Return unsubscribe function
  return () => {
    Purchases.removeCustomerInfoUpdateListener(listener);
  };
};

// Check if purchases are configured
export const isPurchasesConfigured = async (): Promise<boolean> => {
  return isConfigured;
};

// Format price for display
export const formatPrice = (packageInfo: PurchasesPackage): string => {
  return packageInfo.product.priceString;
};

// Get price per month for annual subscriptions
export const getPricePerMonth = (packageInfo: PurchasesPackage): string | null => {
  const { product } = packageInfo;

  if (product.subscriptionPeriod === 'P1Y') {
    const annualPrice = product.price;
    const monthlyPrice = annualPrice / 12;

    // Format based on currency
    const formatter = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: product.currencyCode,
    });

    return formatter.format(monthlyPrice);
  }

  return null;
};

// Calculate savings for annual vs monthly
export const calculateAnnualSavings = (
  monthlyPackage: PurchasesPackage,
  annualPackage: PurchasesPackage
): { amount: number; percentage: number } | null => {
  const monthlyPrice = monthlyPackage.product.price;
  const annualPrice = annualPackage.product.price;

  const yearlyMonthlyTotal = monthlyPrice * 12;
  const savings = yearlyMonthlyTotal - annualPrice;
  const percentage = Math.round((savings / yearlyMonthlyTotal) * 100);

  return {
    amount: savings,
    percentage,
  };
};

// ============================================
// RevenueCat UI - Paywalls
// ============================================

// Present the default paywall
export const presentPaywall = async (
  offering?: PurchasesOffering
): Promise<PaywallResult> => {
  try {
    const options = offering ? { offering } : undefined;
    const result = await RevenueCatUI.presentPaywall(options);

    return mapPaywallResult(result);
  } catch (error) {
    console.error('Error presenting paywall:', error);
    return {
      status: 'error',
      error: error instanceof Error ? error.message : 'Failed to present paywall',
    };
  }
};

// Present paywall only if user doesn't have the required entitlement
export const presentPaywallIfNeeded = async (
  requiredEntitlementId: string,
  offering?: PurchasesOffering
): Promise<PaywallResult> => {
  try {
    const options: { requiredEntitlementIdentifier: string; offering?: PurchasesOffering } = {
      requiredEntitlementIdentifier: requiredEntitlementId,
    };

    if (offering) {
      options.offering = offering;
    }

    const result = await RevenueCatUI.presentPaywallIfNeeded(options);

    return mapPaywallResult(result);
  } catch (error) {
    console.error('Error presenting paywall:', error);
    return {
      status: 'error',
      error: error instanceof Error ? error.message : 'Failed to present paywall',
    };
  }
};

// Helper to map PAYWALL_RESULT to our PaywallResult type
const mapPaywallResult = (result: PAYWALL_RESULT): PaywallResult => {
  switch (result) {
    case PAYWALL_RESULT.PURCHASED:
      return { status: 'purchased' };
    case PAYWALL_RESULT.RESTORED:
      return { status: 'restored' };
    case PAYWALL_RESULT.CANCELLED:
      return { status: 'cancelled' };
    case PAYWALL_RESULT.NOT_PRESENTED:
      return { status: 'not_presented' };
    case PAYWALL_RESULT.ERROR:
      return { status: 'error', error: 'Paywall error occurred' };
    default:
      return { status: 'cancelled' };
  }
};

// ============================================
// RevenueCat UI - Customer Center
// ============================================

// Present the Customer Center for subscription management
// Uses SDK's CustomerCenterCallbacks type directly for type safety
export const presentCustomerCenter = async (
  callbacks?: RCCustomerCenterCallbacks
): Promise<void> => {
  try {
    await RevenueCatUI.presentCustomerCenter(
      callbacks ? { callbacks } : undefined
    );
  } catch (error) {
    console.error('Error presenting Customer Center:', error);
    throw error;
  }
};

// Re-export CustomerCenterCallbacks type from SDK for external use
export type { RCCustomerCenterCallbacks as CustomerCenterCallbacks };

// Export RevenueCatUI for component usage
export { RevenueCatUI, PAYWALL_RESULT };
