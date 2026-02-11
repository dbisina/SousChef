import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Modal,
  Dimensions,
  StyleSheet,
  StatusBar,
  Image,
  Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { PurchasesPackage } from 'react-native-purchases';
import { useSubscription, useSubscriptionPackages } from '@/hooks/useSubscription';
import { SubscriptionTier, TIER_FEATURES } from '@/types/subscription';
import { Button } from '@/components/ui';
import {
  formatPrice,
  getPricePerMonth,
  calculateAnnualSavings,
} from '@/lib/revenuecat';
import { FeatureComparison } from './FeatureComparison';
import { useThemeColors } from '@/stores/themeStore';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface PaywallProps {
  visible: boolean;
  onClose: () => void;
  feature?: string;
  requiredTier?: SubscriptionTier;
}

// Feature display configuration - allows dynamic features without hardcoding
const FEATURE_CONFIG: Record<string, { icon: keyof typeof Ionicons.glyphMap; label: string }> = {
  unlimitedRecipes: { icon: 'book', label: 'Unlimited recipes' },
  unlimitedPantry: { icon: 'cube', label: 'Unlimited pantry items' },
  aiSubstitutions: { icon: 'sparkles', label: 'AI substitutions' },
  portionAnalysis: { icon: 'camera', label: 'Portion analysis' },
  voiceCommands: { icon: 'mic', label: 'Voice hands-free' },
  mealPlanning: { icon: 'calendar', label: 'Meal planning' },
  mealGeneration: { icon: 'bulb', label: 'AI meal generation' },
  wasteTracking: { icon: 'leaf', label: 'Waste tracking' },
  nutrition: { icon: 'nutrition', label: 'Advanced nutrition' },
  offlineAccess: { icon: 'cloud-offline', label: 'Offline access' },
  adFree: { icon: 'ban', label: 'Ad-free experience' },
  prioritySupport: { icon: 'headset', label: 'Priority support' },
  exclusiveRecipes: { icon: 'star', label: 'Exclusive chef recipes' },
};

// Map tier to features for display
const getTierFeaturesList = (tier: SubscriptionTier): string[] => {
  const features = TIER_FEATURES[tier];
  const list: string[] = [];

  if (features.maxRecipes === 'unlimited') list.push('unlimitedRecipes');
  if (features.maxPantryItems === 'unlimited') list.push('unlimitedPantry');
  if (features.aiSubstitutions) {
    const limit = features.aiSubstitutionsPerDay;
    list.push(limit === 'unlimited' ? 'Unlimited AI substitutions' : `${limit} AI substitutions/day`);
  }
  if (features.portionAnalysis) {
    const limit = features.portionAnalysisPerDay;
    list.push(limit === 'unlimited' ? 'Unlimited portion analysis' : `${limit} portion analyses/day`);
  }
  if (features.voiceHandsFree) {
    const limit = features.voiceUsagePerDay;
    list.push(limit === 'unlimited' ? 'Unlimited voice commands' : `${limit} voice commands/day`);
  }
  if (features.mealPlanning) list.push('mealPlanning');
  if (features.mealPlanGeneration) list.push('mealGeneration');
  if (features.wasteTracking) list.push('wasteTracking');
  if (features.advancedNutrition) list.push('nutrition');
  if (features.offlineAccess) list.push('offlineAccess');
  if (features.adFree) list.push('adFree');
  if (features.prioritySupport) list.push('prioritySupport');
  if (features.exclusiveRecipes) list.push('exclusiveRecipes');

  return list;
};

export const Paywall: React.FC<PaywallProps> = ({
  visible,
  onClose,
  feature,
  requiredTier = 'premium',
}) => {
  const { purchasePackage, restorePurchases, isLoading } = useSubscription();
  const colors = useThemeColors();
  const { packages, fetchOfferings } = useSubscriptionPackages();
  const [selectedPeriod, setSelectedPeriod] = useState<'monthly' | 'annual'>('annual');
  const [selectedTier, setSelectedTier] = useState<SubscriptionTier>(requiredTier);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [showComparison, setShowComparison] = useState(false);

  // Fetch offerings when paywall becomes visible
  useEffect(() => {
    if (visible && packages.length === 0) {
      fetchOfferings();
    }
  }, [visible, packages.length, fetchOfferings]);

  // Group packages by tier and period using product ID (not package identifier)
  // Package identifiers like $rc_monthly/$rc_annual are the same across offerings,
  // so we must use the underlying product ID to distinguish premium vs pro
  const groupedPackages = useMemo(() => {
    const groups: Record<string, Record<string, PurchasesPackage>> = {
      premium: {},
      pro: {},
    };

    packages.forEach((pkg) => {
      // Use the product identifier (e.g. "premium_monthly", "pro_yearly")
      // to determine tier, since package identifiers ($rc_monthly) repeat across offerings
      const productId = pkg.product?.identifier?.toLowerCase() || pkg.identifier.toLowerCase();
      const tier = productId.includes('pro') ? 'pro' : 'premium';
      const period = productId.includes('year') || productId.includes('annual') || pkg.packageType === 'ANNUAL'
        ? 'annual'
        : 'monthly';

      groups[tier][period] = pkg;
    });

    return groups;
  }, [packages]);

  // Get the currently selected package
  const selectedPackage = useMemo(() => {
    return groupedPackages[selectedTier]?.[selectedPeriod];
  }, [groupedPackages, selectedTier, selectedPeriod]);

  // Calculate savings dynamically
  const savings = useMemo(() => {
    const monthly = groupedPackages[selectedTier]?.monthly;
    const annual = groupedPackages[selectedTier]?.annual;

    if (monthly && annual) {
      return calculateAnnualSavings(monthly, annual);
    }
    return null;
  }, [groupedPackages, selectedTier]);

  // Get available tiers from packages
  const availableTiers = useMemo(() => {
    const tiers: SubscriptionTier[] = [];
    if (Object.keys(groupedPackages.premium).length > 0) tiers.push('premium');
    if (Object.keys(groupedPackages.pro).length > 0) tiers.push('pro');
    return tiers;
  }, [groupedPackages]);

  const handlePurchase = async () => {
    if (!selectedPackage) return;

    setIsPurchasing(true);
    const result = await purchasePackage(selectedPackage);
    setIsPurchasing(false);

    if (result.success) {
      onClose();
    }
  };

  const handleRestore = async () => {
    setIsRestoring(true);
    const result = await restorePurchases();
    setIsRestoring(false);

    if (result.hasActiveSubscription) {
      onClose();
    }
  };

  const getFeatureLabel = (featureKey: string): string => {
    // Check if it's a predefined feature key
    if (FEATURE_CONFIG[featureKey]) {
      return FEATURE_CONFIG[featureKey].label;
    }
    // Otherwise return as-is (for dynamic strings like "20 AI substitutions/day")
    return featureKey;
  };

  const getFeatureIcon = (featureKey: string): keyof typeof Ionicons.glyphMap => {
    if (FEATURE_CONFIG[featureKey]) {
      return FEATURE_CONFIG[featureKey].icon;
    }
    // Default icons based on content
    if (featureKey.toLowerCase().includes('ai')) return 'sparkles';
    if (featureKey.toLowerCase().includes('portion')) return 'camera';
    if (featureKey.toLowerCase().includes('voice')) return 'mic';
    return 'checkmark-circle';
  };

  // Accent colors per tier
  const tierAccent = selectedTier === 'pro' ? '#8B5CF6' : colors.accent;
  const tierLightBg = selectedTier === 'pro' ? '#EDE9FE' : '#FFF7ED';
  const tierGradient: [string, string, string] = selectedTier === 'pro'
    ? ['#F5F3FF', '#EDE9FE', '#E0E7FF']
    : ['#FFF7ED', '#FEF3C7', '#ECFCCB'];

  // Current tier features
  const currentFeatures = useMemo(() => getTierFeaturesList(selectedTier), [selectedTier]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <StatusBar barStyle="dark-content" />
      <View className="flex-1 bg-background-start">
        {/* Gradient Background - changes per tier */}
        <LinearGradient
          colors={tierGradient}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />

        {/* Header */}
        <View className="flex-row items-center justify-between px-4 pt-14 pb-4">
          <TouchableOpacity
            onPress={onClose}
            className="w-10 h-10 items-center justify-center rounded-full bg-white/60"
            style={styles.iconButton}
          >
            <Ionicons name="close" size={24} color="#44403C" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleRestore}
            disabled={isRestoring}
            className="px-4 py-2 rounded-full bg-white/60"
            style={styles.restoreButton}
          >
            <Text className="text-neutral-700 dark:text-neutral-300 font-medium text-sm">
              {isRestoring ? 'Restoring...' : 'Restore'}
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 120 }}
        >
          {/* Hero Section */}
          <View className="items-center px-6 pb-4">
            <View className="mb-3" style={styles.heroLogoContainer}>
              <Image
                source={require('../../assets/icon.png')}
                style={styles.heroLogo}
                resizeMode="contain"
              />
            </View>
            <Text className="text-3xl font-bold text-neutral-900 text-center mb-1">
              Upgrade Your Kitchen
            </Text>
            <Text className="text-neutral-500 text-center text-base px-4">
              {feature
                ? `Unlock ${feature} and get the most out of SousChef`
                : 'Unlock all premium features and cook like a pro'}
            </Text>
          </View>

          {/* ===== TIER TAB (Premium | Pro) ===== */}
          {availableTiers.length > 1 && (
            <View className="mx-6 mb-4">
              <View className="flex-row p-1.5 rounded-2xl bg-white/70" style={styles.toggleContainer}>
                {availableTiers.map((tier) => {
                  const isActive = selectedTier === tier;
                  const isPro = tier === 'pro';
                  const tabColor = isPro ? '#8B5CF6' : colors.accent;
                  return (
                    <TouchableOpacity
                      key={tier}
                      onPress={() => setSelectedTier(tier)}
                      className={`flex-1 py-3 rounded-xl ${isActive ? 'bg-white' : ''}`}
                      style={isActive ? [styles.toggleActive, { borderColor: tabColor, borderWidth: 1.5 }] : undefined}
                    >
                      <View className="flex-row items-center justify-center">
                        <Ionicons
                          name={isPro ? 'diamond' : 'star'}
                          size={16}
                          color={isActive ? tabColor : '#A8A29E'}
                          style={{ marginRight: 6 }}
                        />
                        <Text
                          className={`font-bold ${isActive ? 'text-neutral-900' : 'text-neutral-500'}`}
                          style={isActive ? { color: tabColor } : undefined}
                        >
                          {isPro ? 'Pro' : 'Premium'}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* ===== PERIOD TAB (Monthly | Annual) ===== */}
          <View className="mx-6 mb-5">
            <View className="flex-row p-1.5 rounded-2xl bg-white/70" style={styles.toggleContainer}>
              <TouchableOpacity
                onPress={() => setSelectedPeriod('monthly')}
                className={`flex-1 py-3 rounded-xl ${selectedPeriod === 'monthly' ? 'bg-white' : ''}`}
                style={selectedPeriod === 'monthly' ? styles.toggleActive : undefined}
              >
                <Text
                  className={`text-center font-semibold ${
                    selectedPeriod === 'monthly' ? 'text-neutral-900' : 'text-neutral-500'
                  }`}
                >
                  Monthly
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setSelectedPeriod('annual')}
                className={`flex-1 py-3 rounded-xl ${selectedPeriod === 'annual' ? 'bg-white' : ''}`}
                style={selectedPeriod === 'annual' ? styles.toggleActive : undefined}
              >
                <View className="flex-row items-center justify-center">
                  <Text
                    className={`font-semibold ${
                      selectedPeriod === 'annual' ? 'text-neutral-900' : 'text-neutral-500'
                    }`}
                  >
                    Annual
                  </Text>
                  {savings && savings.percentage > 0 && (
                    <View className="ml-2 px-2 py-0.5 rounded-full" style={{ backgroundColor: tierLightBg }}>
                      <Text className="text-xs font-bold" style={{ color: tierAccent }}>
                        -{savings.percentage}%
                      </Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            </View>
          </View>

          {/* ===== SELECTED PLAN CARD ===== */}
          {selectedPackage && (
            <View className="mx-6 mb-4">
              {/* Price highlight card */}
              <View className="rounded-3xl overflow-hidden" style={styles.planCard}>
                <BlurView intensity={70} tint="light" style={StyleSheet.absoluteFill} />
                <View className="p-6 bg-white/60">
                  {/* Tier badge */}
                  <View className="flex-row items-center mb-4">
                    <View className="px-3 py-1.5 rounded-full flex-row items-center" style={{ backgroundColor: tierLightBg }}>
                      <Ionicons
                        name={selectedTier === 'pro' ? 'diamond' : 'star'}
                        size={14}
                        color={tierAccent}
                      />
                      <Text className="ml-1.5 font-bold text-sm" style={{ color: tierAccent }}>
                        {selectedTier === 'pro' ? 'Pro' : 'Premium'}
                      </Text>
                    </View>
                    <Text className="ml-3 text-neutral-500 text-sm">
                      {selectedTier === 'pro' ? 'For serious food enthusiasts' : 'Perfect for home cooks'}
                    </Text>
                  </View>

                  {/* Price */}
                  <View className="flex-row items-baseline mb-1">
                    <Text className="text-4xl font-bold text-neutral-900">
                      {formatPrice(selectedPackage)}
                    </Text>
                    <Text className="text-neutral-500 text-base ml-1">
                      /{selectedPeriod === 'annual' ? 'year' : 'month'}
                    </Text>
                  </View>
                  {selectedPeriod === 'annual' && (
                    <Text className="text-sm mb-4" style={{ color: tierAccent }}>
                      {getPricePerMonth(selectedPackage)}/month billed annually
                    </Text>
                  )}
                  {selectedPeriod === 'monthly' && (
                    <Text className="text-sm text-neutral-400 mb-4">
                      Billed monthly, cancel anytime
                    </Text>
                  )}

                  {/* Divider */}
                  <View className="h-px bg-neutral-200/60 mb-4" />

                  {/* Features list */}
                  <View className="gap-3">
                    {currentFeatures.map((featureKey, index) => (
                      <View key={index} className="flex-row items-center">
                        <View
                          className="w-6 h-6 rounded-full items-center justify-center mr-3"
                          style={{ backgroundColor: tierLightBg }}
                        >
                          <Ionicons
                            name={getFeatureIcon(featureKey)}
                            size={14}
                            color={tierAccent}
                          />
                        </View>
                        <Text className="text-sm text-neutral-700 flex-1">
                          {getFeatureLabel(featureKey)}
                        </Text>
                      </View>
                    ))}
                  </View>

                  {/* Pro includes Premium note */}
                  {selectedTier === 'pro' && (
                    <View
                      className="mt-5 py-2.5 px-4 rounded-xl flex-row items-center justify-center"
                      style={{ backgroundColor: tierLightBg }}
                    >
                      <Ionicons name="arrow-up-circle" size={16} color={tierAccent} />
                      <Text className="text-sm font-medium ml-2" style={{ color: tierAccent }}>
                        Includes everything in Premium
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            </View>
          )}

          {/* Loading state if no packages yet */}
          {isLoading && packages.length === 0 && (
            <View className="py-12 items-center">
              <View className="w-8 h-8 rounded-full border-2 border-primary-500 border-t-transparent animate-spin" />
              <Text className="text-neutral-500 mt-4">Loading plans...</Text>
            </View>
          )}

          {/* Empty state if no offerings configured */}
          {!isLoading && packages.length === 0 && (
            <View className="py-12 items-center px-6">
              <Ionicons name="alert-circle-outline" size={48} color="#A8A29E" />
              <Text className="text-neutral-500 mt-4 text-center">
                Subscriptions are not available at this time.
              </Text>
              <Text className="text-neutral-400 text-sm mt-2 text-center">
                Please check your internet connection and try again.
              </Text>
              <TouchableOpacity
                onPress={fetchOfferings}
                className="mt-6 px-6 py-3 bg-primary-500 rounded-lg"
              >
                <Text className="text-white font-semibold">Retry</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Feature Comparison Link */}
          {packages.length > 0 && (
            <TouchableOpacity
              className="mx-6 mt-2 py-3 items-center"
              onPress={() => setShowComparison(true)}
            >
              <Text className="font-medium" style={{ color: tierAccent }}>
                Compare all features
              </Text>
            </TouchableOpacity>
          )}

          {/* Terms */}
          <View className="px-6 py-6 pb-20">
            <Text className="text-xs text-neutral-400 text-center leading-5 mb-6">
              Payment will be charged to your {'\n'}
              App Store account at confirmation.{'\n'}
              Subscription auto-renews unless cancelled{'\n'}
              at least 24 hours before the end of the period.
            </Text>
            <View className="flex-row justify-center gap-6">
              <TouchableOpacity 
                onPress={() => { onClose(); setTimeout(() => { const router = require('expo-router').router; router.push('/settings/terms'); }, 300); }}
                className="py-2 px-4 bg-neutral-100 rounded-lg"
              >
                <Text className="text-xs font-semibold text-neutral-600">Terms of Use</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={() => { onClose(); setTimeout(() => { const router = require('expo-router').router; router.push('/settings/privacy'); }, 300); }}
                className="py-2 px-4 bg-neutral-100 rounded-lg"
              >
                <Text className="text-xs font-semibold text-neutral-600">Privacy Policy</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>

        {/* Purchase Button - Fixed at bottom */}
        <View className="absolute bottom-0 left-0 right-0" style={styles.purchaseContainer}>
          <BlurView intensity={80} tint="light" style={StyleSheet.absoluteFill} />
          <View className="px-6 pt-4 pb-8 bg-white/40">
            {selectedPackage ? (
              <Button
                title={
                  isPurchasing
                    ? 'Processing...'
                    : `Subscribe to ${selectedTier === 'pro' ? 'Pro' : 'Premium'} \u2022 ${formatPrice(selectedPackage)}/${selectedPeriod === 'annual' ? 'yr' : 'mo'}`
                }
                onPress={handlePurchase}
                isLoading={isPurchasing}
                fullWidth
                size="lg"
                style={{ backgroundColor: tierAccent }}
              />
            ) : (
              <Button
                title="Select a plan"
                disabled
                fullWidth
                size="lg"
              />
            )}
          </View>
        </View>

        {/* Feature Comparison Modal */}
        <FeatureComparison
          visible={showComparison}
          onClose={() => setShowComparison(false)}
          onSelectTier={(tier) => {
            setSelectedTier(tier);
            setShowComparison(false);
          }}
        />
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  iconButton: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  restoreButton: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  heroLogoContainer: {
    shadowColor: '#F97316',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  heroLogo: {
    width: 100,
    height: 100,
  },
  toggleContainer: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  toggleActive: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  planCard: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.5)',
    borderRadius: 24,
  },
  purchaseContainer: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 12,
  },
});

export default Paywall;
