import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  useSubscription,
  useRemainingUsage,
  useRevenueCatPaywall,
  useCustomerCenter,
} from '@/hooks/useSubscription';
import { TIER_FEATURES } from '@/types/subscription';
import {
  Paywall,
  PremiumBadge,
  SubscriptionCard,
  UsageIndicator,
} from '@/components/subscription';
import { useThemeColors } from '@/stores/themeStore';
import { Loading } from '@/components/ui';
import { getSubscriptionExpiryDate, willSubscriptionRenew } from '@/lib/revenuecat';
import { showSuccessToast, showErrorToast } from '@/stores/toastStore';

export default function SubscriptionScreen() {
  const {
    subscriptionTier,
    isSubscribed,
    isPremium,
    isPro,
    customerInfo,
    features,
    tierName,
    tierColor,
    isLoading,
    openManagement,
    refreshCustomerInfo,
    refreshUsage,
  } = useSubscription();

  const { remainingAI, remainingPortion, aiUsageToday, portionUsageToday } =
    useRemainingUsage();

  const colors = useThemeColors();

  // RevenueCat UI hooks
  const { presentPaywall, presentPaywallForPro, isPresenting: isPaywallPresenting } =
    useRevenueCatPaywall();
  const { presentCustomerCenter, isPresenting: isCustomerCenterPresenting } =
    useCustomerCenter();

  const [showPaywall, setShowPaywall] = useState(false);
  const [useRevenueCatUI, setUseRevenueCatUI] = useState(true); // Toggle between custom and RC paywall
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refreshCustomerInfo(), refreshUsage()]);
    setRefreshing(false);
  };

  // Handle upgrade button press
  const handleUpgrade = async () => {
    if (useRevenueCatUI) {
      const result = await presentPaywall();
      if (result.status === 'purchased' || result.status === 'restored') {
        showSuccessToast('Welcome aboard! 🌟 Thank you for subscribing to SousChef. We\'re so excited to have you!', 'Success!');
      }
    } else {
      setShowPaywall(true);
    }
  };

  // Handle manage subscription
  const handleManageSubscription = async () => {
    try {
      await presentCustomerCenter({
        onFeedbackSurveyCompleted: ({ feedbackSurveyOptionId }) => {
          console.log('Feedback survey completed:', feedbackSurveyOptionId);
        },
        onRestoreCompleted: () => {
          showSuccessToast('Welcome back! ✨ Your purchases have been successfully restored.', 'Restored');
        },
        onRestoreFailed: () => {
          showErrorToast('Hmm, we couldn\'t restore your purchases. Let\'s try once more? 🔄', 'Restore Problem');
        },
      });
    } catch (error) {
      // Fallback to platform subscription management
      openManagement();
    }
  };

  // Get subscription details
  const expiryDate = customerInfo ? getSubscriptionExpiryDate(customerInfo) : null;
  const willRenew = customerInfo ? willSubscriptionRenew(customerInfo) : false;

  const currentFeatures = TIER_FEATURES[subscriptionTier];

  if (isLoading) {
    return (
      <View className="flex-1 bg-neutral-50 dark:bg-neutral-900 items-center justify-center">
        <Loading />
      </View>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Subscription',
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} className="mr-4">
              <Ionicons name="arrow-back" size={24} color={colors.icon} />
            </TouchableOpacity>
          ),
        }}
      />

      <ScrollView
        className="flex-1 bg-neutral-50 dark:bg-neutral-900"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.accent} />
        }
      >
        {/* Current Plan Section */}
        <View className="px-4 pt-6 pb-4">
          <View className="bg-white dark:bg-neutral-800 rounded-2xl p-6 shadow-sm border border-neutral-100 dark:border-neutral-700">
            <View className="items-center mb-6">
              <View
                className={`w-20 h-20 rounded-full items-center justify-center mb-4 ${
                  isPro
                    ? 'bg-purple-100'
                    : isPremium
                    ? 'bg-primary-100'
                    : 'bg-neutral-100'
                }`}
              >
                <Ionicons
                  name={isPro ? 'diamond' : isPremium ? 'star' : 'person'}
                  size={40}
                  color={tierColor}
                />
              </View>
              <View className="flex-row items-center">
                <Text className="text-2xl font-bold text-neutral-900 dark:text-neutral-50 mr-2">
                  {tierName}
                </Text>
                {isSubscribed && (
                  <PremiumBadge tier={subscriptionTier} size="medium" showIcon={false} />
                )}
              </View>
              <Text className="text-neutral-500 dark:text-neutral-400 mt-1">
                {isSubscribed ? 'Active subscription' : 'Free plan'}
              </Text>
            </View>

            {/* Subscription Details */}
            {isSubscribed && expiryDate && (
              <View className="border-t border-neutral-100 dark:border-neutral-700 pt-4 mb-4">
                <View className="flex-row justify-between items-center mb-2">
                  <Text className="text-sm text-neutral-500 dark:text-neutral-400">
                    {willRenew ? 'Renews on' : 'Expires on'}
                  </Text>
                  <Text className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                    {expiryDate.toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </Text>
                </View>
                <View className="flex-row justify-between items-center">
                  <Text className="text-sm text-neutral-500 dark:text-neutral-400">Auto-renew</Text>
                  <View className="flex-row items-center">
                    <View
                      className={`w-2 h-2 rounded-full mr-2 ${
                        willRenew ? 'bg-green-500' : 'bg-yellow-500'
                      }`}
                    />
                    <Text className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                      {willRenew ? 'On' : 'Off'}
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {/* Actions */}
            {isSubscribed ? (
              <TouchableOpacity
                onPress={handleManageSubscription}
                disabled={isCustomerCenterPresenting}
                className={`bg-neutral-100 dark:bg-neutral-700 py-3 rounded-xl ${
                  isCustomerCenterPresenting ? 'opacity-50' : ''
                }`}
              >
                <Text className="text-center font-semibold text-neutral-700 dark:text-neutral-300">
                  {isCustomerCenterPresenting ? 'Opening...' : 'Manage Subscription'}
                </Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                onPress={handleUpgrade}
                disabled={isPaywallPresenting}
                className={`py-3 rounded-xl ${
                  isPaywallPresenting ? 'opacity-50' : ''
                }`}
                style={{ backgroundColor: colors.accent }}
              >
                <Text className="text-center font-semibold text-white">
                  {isPaywallPresenting ? 'Loading...' : 'Upgrade to Premium'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Daily Usage Section */}
        <View className="px-4 pb-4">
          <Text className="text-lg font-bold text-neutral-900 dark:text-neutral-50 mb-3">
            Today's Usage
          </Text>
          <View className="bg-white dark:bg-neutral-800 rounded-2xl p-4 shadow-sm border border-neutral-100 dark:border-neutral-700 space-y-4">
            <UsageIndicator
              label="AI Substitutions"
              remaining={remainingAI}
              limit={
                currentFeatures.aiSubstitutionsPerDay === 'unlimited'
                  ? undefined
                  : (currentFeatures.aiSubstitutionsPerDay as number)
              }
              icon="sparkles"
            />
            <UsageIndicator
              label="Portion Analysis"
              remaining={remainingPortion}
              limit={
                currentFeatures.portionAnalysisPerDay === 'unlimited'
                  ? undefined
                  : (currentFeatures.portionAnalysisPerDay as number)
              }
              icon="camera"
            />
          </View>
        </View>

        {/* Features Section */}
        <View className="px-4 pb-4">
          <Text className="text-lg font-bold text-neutral-900 dark:text-neutral-50 mb-3">
            Your Features
          </Text>
          <View className="bg-white dark:bg-neutral-800 rounded-2xl p-4 shadow-sm border border-neutral-100 dark:border-neutral-700">
            <FeatureRow
              label="Max Recipes"
              value={
                currentFeatures.maxRecipes === 'unlimited'
                  ? 'Unlimited'
                  : `${currentFeatures.maxRecipes}`
              }
              enabled={true}
            />
            <FeatureRow
              label="Max Pantry Items"
              value={
                currentFeatures.maxPantryItems === 'unlimited'
                  ? 'Unlimited'
                  : `${currentFeatures.maxPantryItems}`
              }
              enabled={true}
            />
            <FeatureRow
              label="AI Substitutions"
              value={currentFeatures.aiSubstitutions ? 'Yes' : 'No'}
              enabled={currentFeatures.aiSubstitutions}
            />
            <FeatureRow
              label="Portion Analysis"
              value={currentFeatures.portionAnalysis ? 'Yes' : 'No'}
              enabled={currentFeatures.portionAnalysis}
            />
            <FeatureRow
              label="Offline Access"
              value={currentFeatures.offlineAccess ? 'Yes' : 'No'}
              enabled={currentFeatures.offlineAccess}
            />
            <FeatureRow
              label="Advanced Nutrition"
              value={currentFeatures.advancedNutrition ? 'Yes' : 'No'}
              enabled={currentFeatures.advancedNutrition}
            />
            <FeatureRow
              label="Meal Planning"
              value={currentFeatures.mealPlanning ? 'Yes' : 'No'}
              enabled={currentFeatures.mealPlanning}
              isLast
            />
          </View>
        </View>

        {/* Compare Plans */}
        {!isPro && (
          <View className="px-4 pb-8">
            <TouchableOpacity
              onPress={async () => {
                if (useRevenueCatUI) {
                  if (isPremium) {
                    await presentPaywallForPro();
                  } else {
                    await presentPaywall();
                  }
                } else {
                  setShowPaywall(true);
                }
              }}
              disabled={isPaywallPresenting}
              className={`border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 rounded-2xl p-4 flex-row items-center ${
                isPaywallPresenting ? 'opacity-50' : ''
              }`}
            >
              <View className="w-12 h-12 rounded-full bg-white dark:bg-neutral-700 items-center justify-center shadow-sm">
                <Ionicons name="rocket" size={24} color={colors.accent} />
              </View>
              <View className="flex-1 ml-4">
                <Text className="font-bold text-neutral-900 dark:text-neutral-50">
                  {isPremium ? 'Upgrade to Pro' : 'See All Plans'}
                </Text>
                <Text className="text-sm text-neutral-500 dark:text-neutral-400">
                  {isPremium
                    ? 'Get unlimited AI features and meal planning'
                    : 'Compare Premium and Pro features'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={24} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      <Paywall
        visible={showPaywall}
        onClose={() => setShowPaywall(false)}
        requiredTier={isPremium ? 'pro' : 'premium'}
      />
    </>
  );
}

interface FeatureRowProps {
  label: string;
  value: string;
  enabled: boolean;
  isLast?: boolean;
}

const FeatureRow: React.FC<FeatureRowProps> = ({
  label,
  value,
  enabled,
  isLast = false,
}) => (
  <View
    className={`flex-row justify-between items-center py-3 ${
      !isLast ? 'border-b border-neutral-100 dark:border-neutral-700' : ''
    }`}
  >
    <Text className="text-neutral-700 dark:text-neutral-300">{label}</Text>
    <View className="flex-row items-center">
      <Text
        className={`font-medium mr-2 ${
          enabled ? 'text-neutral-900 dark:text-neutral-100' : 'text-neutral-400 dark:text-neutral-500'
        }`}
      >
        {value}
      </Text>
      <Ionicons
        name={enabled ? 'checkmark-circle' : 'close-circle'}
        size={18}
        color={enabled ? '#22C55E' : '#D4D4D4'}
      />
    </View>
  </View>
);
