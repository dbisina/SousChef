import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { PurchasesPackage } from 'react-native-purchases';
import { useSubscription, useSubscriptionPackages } from '@/hooks/useSubscription';
import { SubscriptionTier, TIER_FEATURES } from '@/types/subscription';
import {
  CtaBar,
  Dim,
  FONT,
  H1,
  Icon,
  Muted,
  Screen,
  Segmented,
  Tag,
  Tile,
  UButton,
  UIconButton,
} from '@/components/ui';
import { formatPrice, getPricePerMonth, calculateAnnualSavings } from '@/lib/revenuecat';
import { TOKEN_HEX } from '@/stores/themeStore';
import { SAMPLE } from '@/assets/sample';
import { FeatureComparison } from './FeatureComparison';

interface PaywallProps {
  visible: boolean;
  onClose: () => void;
  feature?: string;
  requiredTier?: SubscriptionTier;
}

// Feature keys map to display labels; other entries are already display strings ("20 AI substitutions/day").
const FEATURE_LABELS: Record<string, string> = {
  unlimitedRecipes: 'Unlimited recipes',
  unlimitedPantry: 'Unlimited pantry items',
  aiSubstitutions: 'AI substitutions',
  portionAnalysis: 'Portion analysis',
  voiceCommands: 'Voice hands-free',
  mealPlanning: 'Meal planning',
  mealGeneration: 'AI meal generation',
  wasteTracking: 'Waste tracking',
  nutrition: 'Advanced nutrition',
  offlineAccess: 'Offline access',
  adFree: 'Ad-free experience',
  prioritySupport: 'Priority support',
  exclusiveRecipes: 'Exclusive chef recipes',
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

const GROUND = TOKEN_HEX.dark.ground;

export const Paywall: React.FC<PaywallProps> = ({
  visible,
  onClose,
  feature,
  requiredTier = 'premium',
}) => {
  const { t } = useTranslation();
  const router = useRouter();
  const { purchasePackage, restorePurchases, isLoading, isInitialized, error } = useSubscription();
  const { packages, fetchOfferings } = useSubscriptionPackages();
  const [selectedPeriod, setSelectedPeriod] = useState<'monthly' | 'annual'>('annual');
  const [selectedTier, setSelectedTier] = useState<SubscriptionTier>(requiredTier);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [showComparison, setShowComparison] = useState(false);

  // Fetch offerings when paywall becomes visible (only after initialization completes)
  useEffect(() => {
    if (visible && isInitialized && packages.length === 0 && !isLoading) {
      fetchOfferings();
    }
  }, [visible, isInitialized, packages.length, isLoading, fetchOfferings]);

  // Group packages by tier and period using product ID (not package identifier)
  // Package identifiers like $rc_monthly/$rc_annual are the same across offerings,
  // so we must use the underlying product ID to distinguish premium vs pro
  const groupedPackages = useMemo(() => {
    const groups: Record<string, Record<string, PurchasesPackage>> = {
      premium: {},
      pro: {},
    };

    packages.forEach((pkg) => {
      const productId = pkg.product?.identifier?.toLowerCase() || pkg.identifier.toLowerCase();
      const tier = productId.includes('pro') ? 'pro' : 'premium';
      const period = productId.includes('year') || productId.includes('annual') || pkg.packageType === 'ANNUAL'
        ? 'annual'
        : 'monthly';

      groups[tier][period] = pkg;
    });

    return groups;
  }, [packages]);

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

  const goTo = (path: '/settings/terms' | '/settings/privacy') => {
    onClose();
    setTimeout(() => router.push(path), 300);
  };

  const getFeatureLabel = (featureKey: string): string => FEATURE_LABELS[featureKey] ?? featureKey;

  const currentFeatures = useMemo(() => getTierFeaturesList(selectedTier), [selectedTier]);
  const tierLabel = selectedTier === 'pro' ? 'Pro' : 'Premium';
  const periodWord = selectedPeriod === 'annual' ? t('account.paywall.perYear', 'per year') : t('account.paywall.perMonth', 'per month');

  const tierTile = (tier: SubscriptionTier) => {
    const pkg = groupedPackages[tier]?.[selectedPeriod];
    const on = selectedTier === tier;
    const name = tier === 'pro' ? 'Pro' : 'Premium';
    return (
      <Pressable
        key={tier}
        accessibilityRole="button"
        accessibilityLabel={name}
        accessibilityState={{ selected: on }}
        onPress={() => setSelectedTier(tier)}
        style={{ flex: 1, opacity: on ? 1 : 0.6 }}
      >
        <Tile tone={tier === 'pro' ? 'accent' : 'default'} style={{ padding: 16, gap: 4 }}>
          <View className="flex-row items-center justify-between" style={{ gap: 6 }}>
            <Text className="text-muted" style={{ fontFamily: FONT.sans, fontSize: 12 }}>
              {name}
            </Text>
            {tier === 'pro' ? <Tag tone="k" label={t('account.paywall.bestValue', 'Best value')} /> : null}
          </View>
          <Text className="text-ink" style={{ fontFamily: FONT.display, fontSize: 22, letterSpacing: -0.44 }}>
            {pkg ? formatPrice(pkg) : '-'}
          </Text>
          <Text className="text-muted" style={{ fontFamily: FONT.sans, fontSize: 12 }}>
            {periodWord}
          </Text>
        </Tile>
      </Pressable>
    );
  };

  const tilesToShow: SubscriptionTier[] = availableTiers.length > 0 ? availableTiers : ['premium', 'pro'];

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <Screen tone="dark" bare>
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 340 }}>
          <Image source={SAMPLE.beef} style={StyleSheet.absoluteFill} contentFit="cover" accessible={false} />
          <LinearGradient
            pointerEvents="none"
            colors={[`${GROUND}00`, GROUND]}
            locations={[0.35, 0.95]}
            style={StyleSheet.absoluteFill}
          />
        </View>

        <View style={{ position: 'absolute', top: 58, right: 20, zIndex: 4 }}>
          <UIconButton icon="close" tone="glassDark" label={t('account.close', 'Close')} onPress={onClose} />
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingTop: 250, paddingHorizontal: 20, paddingBottom: 170, gap: 16 }}
        >
          <View style={{ gap: 6 }}>
            <H1 style={{ fontSize: 36, lineHeight: 39 }}>
              <Dim>{t('account.paywall.line1', 'Cook without')}</Dim>
              {'\n'}
              {t('account.paywall.line2', 'limits')}
            </H1>
            {feature ? (
              <Muted>{t('account.paywall.unlock', 'Unlock {{feature}} and get the most out of SousChef', { feature })}</Muted>
            ) : null}
          </View>

          <Segmented
            value={selectedPeriod}
            onChange={setSelectedPeriod}
            options={[
              { value: 'monthly', label: t('account.paywall.monthly', 'Monthly') },
              {
                value: 'annual',
                label:
                  savings && savings.percentage > 0
                    ? t('account.paywall.annualSave', 'Annual -{{pct}}%', { pct: savings.percentage })
                    : t('account.paywall.annual', 'Annual'),
              },
            ]}
          />

          {packages.length > 0 || isLoading ? (
            <View className="flex-row" style={{ gap: 12 }}>
              {tilesToShow.map(tierTile)}
            </View>
          ) : null}

          {selectedPackage && selectedPeriod === 'annual' ? (
            <Muted small>
              {t('account.paywall.perMonthBilled', '{{price}}/month billed annually', { price: getPricePerMonth(selectedPackage) })}
            </Muted>
          ) : null}

          {/* Loading / empty states for offerings */}
          {isLoading && packages.length === 0 ? (
            <Muted center>{t('account.paywall.loading', 'Loading plans...')}</Muted>
          ) : null}
          {!isLoading && packages.length === 0 ? (
            <View style={{ gap: 12 }}>
              <Muted center>{error || t('account.paywall.unavailable', 'Subscriptions are not available at this time.')}</Muted>
              <Muted small center>
                {t('account.paywall.checkConnection', 'Please check your internet connection and try again.')}
              </Muted>
              <UButton variant="ghost" size="sm" label={t('account.paywall.retry', 'Retry')} onPress={fetchOfferings} style={{ alignSelf: 'center' }} />
            </View>
          ) : null}

          <View style={{ gap: 10 }}>
            {currentFeatures.map((featureKey) => (
              <View key={featureKey} className="flex-row items-center" style={{ gap: 10 }}>
                <Icon name="check" size="sm" color="accent" />
                <Text className="text-ink flex-1" style={{ fontFamily: FONT.sans, fontSize: 14 }}>
                  {getFeatureLabel(featureKey)}
                </Text>
              </View>
            ))}
          </View>

          {selectedTier === 'pro' ? (
            <Muted small>{t('account.paywall.includesPremium', 'Includes everything in Premium')}</Muted>
          ) : null}

          {packages.length > 0 ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => setShowComparison(true)}
              style={{ minHeight: 44, justifyContent: 'center' }}
            >
              <Text className="text-accent-text" style={{ fontFamily: FONT.sansMedium, fontSize: 13 }}>
                {t('account.paywall.compare', 'Compare all features')}
              </Text>
            </Pressable>
          ) : null}
        </ScrollView>

        <CtaBar vertical>
          {selectedPackage ? (
            <UButton
              variant="accent"
              label={
                isPurchasing
                  ? t('account.paywall.processing', 'Processing...')
                  : t('account.paywall.continueWith', 'Continue with {{tier}}', { tier: tierLabel })
              }
              loading={isPurchasing}
              onPress={handlePurchase}
            />
          ) : (
            <UButton variant="accent" label={t('account.paywall.selectPlan', 'Select a plan')} disabled />
          )}
          <View className="flex-row flex-wrap items-center justify-center" style={{ gap: 4 }}>
            <Text className="text-muted" style={{ fontFamily: FONT.sans, fontSize: 12 }}>
              {t('account.paywall.cancelAnytime', 'Cancel anytime')} {'·'}
            </Text>
            <Pressable accessibilityRole="link" onPress={() => goTo('/settings/terms')} style={{ minHeight: 32, justifyContent: 'center' }}>
              <Text className="text-muted" style={{ fontFamily: FONT.sans, fontSize: 12, textDecorationLine: 'underline' }}>
                {t('account.paywall.terms', 'Terms')}
              </Text>
            </Pressable>
            <Text className="text-muted" style={{ fontSize: 12 }}>{'·'}</Text>
            <Pressable accessibilityRole="link" onPress={() => goTo('/settings/privacy')} style={{ minHeight: 32, justifyContent: 'center' }}>
              <Text className="text-muted" style={{ fontFamily: FONT.sans, fontSize: 12, textDecorationLine: 'underline' }}>
                {t('account.paywall.privacy', 'Privacy')}
              </Text>
            </Pressable>
            <Text className="text-muted" style={{ fontSize: 12 }}>{'·'}</Text>
            <Pressable
              accessibilityRole="button"
              disabled={isRestoring}
              onPress={handleRestore}
              style={{ minHeight: 32, justifyContent: 'center' }}
            >
              <Text className="text-muted" style={{ fontFamily: FONT.sans, fontSize: 12, textDecorationLine: 'underline' }}>
                {isRestoring ? t('account.paywall.restoring', 'Restoring...') : t('account.paywall.restore', 'Restore')}
              </Text>
            </Pressable>
          </View>
        </CtaBar>

        <FeatureComparison
          visible={showComparison}
          onClose={() => setShowComparison(false)}
          onSelectTier={(tier) => {
            setSelectedTier(tier);
            setShowComparison(false);
          }}
        />
      </Screen>
    </Modal>
  );
};

export default Paywall;
