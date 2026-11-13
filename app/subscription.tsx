import React, { useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { Stack, router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import {
  useSubscription,
  useRemainingUsage,
  useRevenueCatPaywall,
  useCustomerCenter,
} from '@/hooks/useSubscription';
import { TIER_FEATURES } from '@/types/subscription';
import { Paywall, PremiumBadge, UsageIndicator } from '@/components/subscription';
import { useThemeColors } from '@/stores/themeStore';
import {
  CtaBar,
  Display,
  H2,
  Icon,
  Loading,
  Muted,
  Screen,
  SectionLabel,
  Tag,
  TopBar,
  UButton,
  UCard,
  Rows,
  FONT,
} from '@/components/ui';
import { getSubscriptionExpiryDate, willSubscriptionRenew } from '@/lib/revenuecat';
import { showSuccessToast, showErrorToast } from '@/stores/toastStore';

export default function SubscriptionScreen() {
  const { t } = useTranslation();
  const {
    subscriptionTier,
    isSubscribed,
    isPremium,
    isPro,
    customerInfo,
    tierName,
    isLoading,
    openManagement,
    refreshCustomerInfo,
    refreshUsage,
  } = useSubscription();

  const { remainingAI, remainingPortion } = useRemainingUsage();

  const colors = useThemeColors();

  // RevenueCat UI hooks
  const { presentPaywall, presentPaywallForPro, isPresenting: isPaywallPresenting } =
    useRevenueCatPaywall();
  const { presentCustomerCenter, isPresenting: isCustomerCenterPresenting } =
    useCustomerCenter();

  const [showPaywall, setShowPaywall] = useState(false);
  const [useRevenueCatUI] = useState(true); // Toggle between custom and RC paywall
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
        showSuccessToast(
          t('account.sub.welcomeAboard', "Welcome aboard! Thank you for subscribing to SousChef. We're so excited to have you!"),
          t('account.sub.successTitle', 'Success!')
        );
      }
    } else {
      setShowPaywall(true);
    }
  };

  // Compare plans / upgrade to Pro
  const handleSeePlans = async () => {
    if (useRevenueCatUI) {
      if (isPremium) {
        await presentPaywallForPro();
      } else {
        await presentPaywall();
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
          showSuccessToast(
            t('account.sub.restored', 'Welcome back! Your purchases have been successfully restored.'),
            t('account.sub.restoredTitle', 'Restored')
          );
        },
        onRestoreFailed: () => {
          showErrorToast(
            t('account.sub.restoreFailed', "Hmm, we couldn't restore your purchases. Let's try once more?"),
            t('account.sub.restoreProblem', 'Restore Problem')
          );
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
      <Screen bare>
        <Stack.Screen options={{ headerShown: false }} />
        <View className="flex-1 items-center justify-center">
          <Loading />
        </View>
      </Screen>
    );
  }

  const planNote = isSubscribed
    ? expiryDate
      ? t('account.sub.renewLine', '{{renews}} {{date}} · Auto-renew {{state}}', {
          renews: willRenew ? t('account.sub.renewsOn', 'Renews on') : t('account.sub.expiresOn', 'Expires on'),
          date: expiryDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
          state: willRenew ? t('account.sub.on', 'On') : t('account.sub.off', 'Off'),
        })
      : t('account.sub.active', 'Active subscription')
    : t('account.sub.notSubscribed', 'Not subscribed · no renewal');

  const limitOf = (v: number | 'unlimited') => (v === 'unlimited' ? undefined : v);

  const valueRow = (label: string, value: string) => (
    <View className="flex-row items-center" style={{ minHeight: 64, gap: 14 }}>
      <Text className="flex-1 text-ink" style={{ fontFamily: FONT.sans, fontSize: 14 }}>
        {label}
      </Text>
      <Text className="text-ink" style={{ fontFamily: FONT.sansMedium, fontSize: 14 }}>
        {value}
      </Text>
    </View>
  );

  const flagRow = (label: string, enabled: boolean) => (
    <View className="flex-row items-center" style={{ minHeight: 64, gap: 14 }}>
      <Text className="flex-1 text-ink" style={{ fontFamily: FONT.sans, fontSize: 14 }}>
        {label}
      </Text>
      {enabled ? (
        <Tag tone="g" label={t('account.sub.included', 'Included')} />
      ) : (
        <Tag icon="lock" label={t('account.sub.pro', 'Pro')} />
      )}
    </View>
  );

  const unlimitedOr = (v: number | 'unlimited') => (v === 'unlimited' ? t('account.usage.unlimited', 'Unlimited') : `${v}`);

  return (
    <Screen
      bare
      footer={
        <CtaBar>
          {isSubscribed ? (
            <UButton
              variant="primary"
              label={isCustomerCenterPresenting ? t('account.sub.opening', 'Opening...') : t('account.sub.manageSub', 'Manage Subscription')}
              loading={isCustomerCenterPresenting}
              onPress={handleManageSubscription}
            />
          ) : (
            <UButton
              variant="accent"
              label={isPaywallPresenting ? t('account.sub.loading', 'Loading...') : t('account.sub.upgradePro', 'Upgrade to Pro')}
              loading={isPaywallPresenting}
              onPress={handleUpgrade}
            />
          )}
        </CtaBar>
      }
    >
      <Stack.Screen options={{ headerShown: false }} />
      <TopBar variant="compact" title={t('account.sub.title', 'Subscription')} onBack={() => router.back()} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.accent} />}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 140, gap: 16 }}
      >
        <UCard tone="black" style={{ gap: 8, borderRadius: 30, padding: 20 }}>
          <SectionLabel>{t('account.sub.currentPlan', 'Current plan')}</SectionLabel>
          <View className="flex-row items-center" style={{ gap: 10 }}>
            <Display size={32}>{tierName}</Display>
            {isSubscribed ? <PremiumBadge tier={subscriptionTier} size="small" showIcon={false} /> : null}
          </View>
          <Muted small>{planNote}</Muted>
        </UCard>

        <H2>{t('account.sub.todayUsage', "Today's usage")}</H2>
        <View style={{ gap: 14 }}>
          <UsageIndicator
            label={t('account.sub.aiSubs', 'AI Substitutions')}
            remaining={remainingAI}
            limit={limitOf(currentFeatures.aiSubstitutionsPerDay as number | 'unlimited')}
          />
          <UsageIndicator
            label={t('account.sub.portion', 'Portion Analysis')}
            remaining={remainingPortion}
            limit={limitOf(currentFeatures.portionAnalysisPerDay as number | 'unlimited')}
          />
        </View>

        <H2>{t('account.sub.yourFeatures', 'Your features')}</H2>
        <Rows>
          {valueRow(t('account.sub.maxRecipes', 'Max Recipes'), unlimitedOr(currentFeatures.maxRecipes))}
          {valueRow(t('account.sub.maxPantry', 'Max Pantry Items'), unlimitedOr(currentFeatures.maxPantryItems))}
          {flagRow(t('account.sub.aiSubs', 'AI Substitutions'), currentFeatures.aiSubstitutions)}
          {flagRow(t('account.sub.portion', 'Portion Analysis'), currentFeatures.portionAnalysis)}
          {flagRow(t('account.sub.mealPlanning', 'Meal Planning'), currentFeatures.mealPlanning)}
          {flagRow(t('account.sub.offline', 'Offline Access'), currentFeatures.offlineAccess)}
          {flagRow(t('account.sub.nutrition', 'Advanced Nutrition'), currentFeatures.advancedNutrition)}
        </Rows>

        {!isPro ? (
          <UCard
            onPress={handleSeePlans}
            accessibilityLabel={isPremium ? t('account.sub.upgradeProTitle', 'Upgrade to Pro') : t('account.sub.seeAllPlans', 'See All Plans')}
          >
            <View className="flex-row items-center" style={{ gap: 14, opacity: isPaywallPresenting ? 0.5 : 1 }}>
              <View className="flex-1" style={{ gap: 2 }}>
                <Text className="text-ink" style={{ fontFamily: FONT.display, fontSize: 15 }}>
                  {isPremium ? t('account.sub.upgradeProTitle', 'Upgrade to Pro') : t('account.sub.seeAllPlans', 'See All Plans')}
                </Text>
                <Muted small>
                  {isPremium
                    ? t('account.sub.proBody', 'Get unlimited AI features and meal planning')
                    : t('account.sub.compareBody', 'Compare Premium and Pro features')}
                </Muted>
              </View>
              <Icon name="chevronRight" color="subtle" />
            </View>
          </UCard>
        ) : null}
      </ScrollView>

      <Paywall
        visible={showPaywall}
        onClose={() => setShowPaywall(false)}
        requiredTier={isPremium ? 'pro' : 'premium'}
      />
    </Screen>
  );
}
