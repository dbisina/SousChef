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
} from 'react-native';
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

  // Group packages by tier and period dynamically
  const groupedPackages = useMemo(() => {
    const groups: Record<string, Record<string, PurchasesPackage>> = {
      premium: {},
      pro: {},
    };

    packages.forEach((pkg) => {
      const identifier = pkg.identifier.toLowerCase();
      const tier = identifier.includes('pro') ? 'pro' : 'premium';
      const period = identifier.includes('annual') || pkg.packageType === 'ANNUAL'
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

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <StatusBar barStyle="dark-content" />
      <View className="flex-1 bg-background-start">
        {/* Gradient Background */}
        <LinearGradient
          colors={['#FFF7ED', '#FEF3C7', '#ECFCCB']}
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
            <Text className="text-neutral-700 font-medium text-sm">
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
          <View className="items-center px-6 pb-6">
            <View className="mb-4" style={styles.heroLogoContainer}>
              <Image
                source={require('../../assets/icon.png')}
                style={styles.heroLogo}
                resizeMode="contain"
              />
            </View>
            <Text className="text-3xl font-bold text-neutral-900 text-center mb-2">
              Upgrade Your Kitchen
            </Text>
            <Text className="text-neutral-500 text-center text-base px-4">
              {feature
                ? `Unlock ${feature} and get the most out of SousChef`
                : 'Unlock all premium features and cook like a pro'}
            </Text>
          </View>

          {/* Period Toggle */}
          <View className="mx-6 mb-6">
            <View className="flex-row p-1.5 rounded-2xl bg-white/70" style={styles.toggleContainer}>
              <TouchableOpacity
                onPress={() => setSelectedPeriod('monthly')}
                className={`flex-1 py-3 rounded-xl ${
                  selectedPeriod === 'monthly' ? 'bg-white' : ''
                }`}
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
                className={`flex-1 py-3 rounded-xl ${
                  selectedPeriod === 'annual' ? 'bg-white' : ''
                }`}
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
                    <View className="ml-2 px-2 py-0.5 bg-secondary-100 rounded-full">
                      <Text className="text-xs font-bold text-secondary-700">
                        -{savings.percentage}%
                      </Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            </View>
          </View>

          {/* Plan Cards - Dynamically rendered based on available packages */}
          <View className="px-6 gap-4">
            {availableTiers.map((tier) => {
              const pkg = groupedPackages[tier]?.[selectedPeriod];
              if (!pkg) return null;

              const isSelected = selectedTier === tier;
              const isPro = tier === 'pro';
              const features = getTierFeaturesList(tier);
              const monthlyPrice = selectedPeriod === 'annual' ? getPricePerMonth(pkg) : null;

              return (
                <PlanCard
                  key={tier}
                  tier={tier}
                  name={isPro ? 'Pro' : 'Premium'}
                  description={isPro ? 'For serious food enthusiasts' : 'Perfect for home cooks'}
                  price={formatPrice(pkg)}
                  pricePerMonth={monthlyPrice}
                  period={selectedPeriod}
                  features={features.slice(0, 7)} // Show top 7 features
                  isSelected={isSelected}
                  onSelect={() => setSelectedTier(tier)}
                  highlighted={isPro}
                  getFeatureLabel={getFeatureLabel}
                  getFeatureIcon={getFeatureIcon}
                />
              );
            })}

            {/* Loading state if no packages yet */}
            {isLoading && packages.length === 0 && (
              <View className="py-12 items-center">
                <View className="w-8 h-8 rounded-full border-2 border-primary-500 border-t-transparent animate-spin" />
                <Text className="text-neutral-500 mt-4">Loading plans...</Text>
              </View>
            )}

            {/* Empty state if no offerings configured */}
            {!isLoading && packages.length === 0 && (
              <View className="py-12 items-center">
                <Ionicons name="alert-circle-outline" size={48} color="#A8A29E" />
                <Text className="text-neutral-500 mt-4 text-center">
                  Subscriptions are not available at this time.
                </Text>
              </View>
            )}
          </View>

          {/* Feature Comparison Link */}
          {packages.length > 0 && (
            <TouchableOpacity
              className="mx-6 mt-6 py-3 items-center"
              onPress={() => setShowComparison(true)}
            >
              <Text className="text-primary-600 font-medium">
                Compare all features
              </Text>
            </TouchableOpacity>
          )}

          {/* Terms */}
          <View className="px-6 py-6">
            <Text className="text-xs text-neutral-400 text-center leading-5">
              Payment will be charged to your {'\n'}
              App Store account at confirmation.{'\n'}
              Subscription auto-renews unless cancelled{'\n'}
              at least 24 hours before the end of the period.
            </Text>
            <View className="flex-row justify-center mt-4 gap-4">
              <TouchableOpacity>
                <Text className="text-xs text-neutral-500 underline">Terms of Use</Text>
              </TouchableOpacity>
              <TouchableOpacity>
                <Text className="text-xs text-neutral-500 underline">Privacy Policy</Text>
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
                    : `Continue with ${selectedTier === 'pro' ? 'Pro' : 'Premium'} \u2022 ${formatPrice(selectedPackage)}`
                }
                onPress={handlePurchase}
                isLoading={isPurchasing}
                fullWidth
                size="lg"
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

// Plan Card Component
interface PlanCardProps {
  tier: SubscriptionTier;
  name: string;
  description: string;
  price: string;
  pricePerMonth: string | null;
  period: 'monthly' | 'annual';
  features: string[];
  isSelected: boolean;
  onSelect: () => void;
  highlighted?: boolean;
  getFeatureLabel: (key: string) => string;
  getFeatureIcon: (key: string) => keyof typeof Ionicons.glyphMap;
}

const PlanCard: React.FC<PlanCardProps> = ({
  tier,
  name,
  description,
  price,
  pricePerMonth,
  period,
  features,
  isSelected,
  onSelect,
  highlighted = false,
  getFeatureLabel,
  getFeatureIcon,
}) => {
  const accentColor = highlighted ? '#8B5CF6' : '#F97316';
  const lightAccent = highlighted ? '#EDE9FE' : '#FFF7ED';
  const mediumAccent = highlighted ? '#C4B5FD' : '#FDBA74';

  return (
    <TouchableOpacity
      onPress={onSelect}
      activeOpacity={0.9}
      className={`rounded-3xl overflow-hidden ${isSelected ? '' : 'opacity-90'}`}
      style={[
        styles.planCard,
        isSelected && { borderColor: accentColor, borderWidth: 2 },
      ]}
    >
      {/* Highlight Badge */}
      {highlighted && (
        <View
          className="absolute top-0 right-0 px-3 py-1.5 rounded-bl-2xl"
          style={{ backgroundColor: accentColor }}
        >
          <Text className="text-white text-xs font-bold">BEST VALUE</Text>
        </View>
      )}

      <BlurView intensity={70} tint="light" style={StyleSheet.absoluteFill} />

      <View className="p-5 bg-white/60">
        {/* Header */}
        <View className="flex-row items-start justify-between mb-4">
          <View className="flex-row items-center flex-1">
            {/* Selection Indicator */}
            <View
              className="w-6 h-6 rounded-full border-2 items-center justify-center mr-3"
              style={{
                borderColor: isSelected ? accentColor : '#D6D3D1',
                backgroundColor: isSelected ? accentColor : 'transparent',
              }}
            >
              {isSelected && <Ionicons name="checkmark" size={14} color="white" />}
            </View>

            <View className="flex-1">
              <View className="flex-row items-center">
                <Text className="text-xl font-bold text-neutral-900">{name}</Text>
              </View>
              <Text className="text-sm text-neutral-500 mt-0.5">{description}</Text>
            </View>
          </View>

          {/* Price */}
          <View className="items-end">
            <Text className="text-2xl font-bold text-neutral-900">{price}</Text>
            {pricePerMonth && (
              <Text className="text-sm text-neutral-500">
                {pricePerMonth}/mo
              </Text>
            )}
            {!pricePerMonth && period === 'monthly' && (
              <Text className="text-sm text-neutral-500">per month</Text>
            )}
            {!pricePerMonth && period === 'annual' && (
              <Text className="text-sm text-neutral-500">per year</Text>
            )}
          </View>
        </View>

        {/* Divider */}
        <View className="h-px bg-neutral-200/60 mb-4" />

        {/* Features */}
        <View className="gap-3">
          {features.map((featureKey, index) => (
            <View key={index} className="flex-row items-center">
              <View
                className="w-6 h-6 rounded-full items-center justify-center mr-3"
                style={{ backgroundColor: lightAccent }}
              >
                <Ionicons
                  name={getFeatureIcon(featureKey)}
                  size={14}
                  color={accentColor}
                />
              </View>
              <Text className="text-sm text-neutral-700 flex-1">
                {getFeatureLabel(featureKey)}
              </Text>
            </View>
          ))}
        </View>

        {/* Pro includes Premium badge */}
        {highlighted && (
          <View
            className="mt-4 py-2.5 px-4 rounded-xl flex-row items-center justify-center"
            style={{ backgroundColor: lightAccent }}
          >
            <Ionicons name="arrow-up-circle" size={16} color={accentColor} />
            <Text className="text-sm font-medium ml-2" style={{ color: accentColor }}>
              Includes everything in Premium
            </Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
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
