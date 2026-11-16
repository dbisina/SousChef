import React from 'react';
import { Modal, ScrollView, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { SubscriptionTier, TIER_FEATURES, TierFeatures } from '@/types/subscription';
import { FONT, Icon, Screen, Tag, TopBar, UButton, UIconButton } from '@/components/ui';

interface FeatureComparisonProps {
  visible: boolean;
  onClose: () => void;
  onSelectTier?: (tier: SubscriptionTier) => void;
}

interface FeatureRowData {
  key: keyof TierFeatures;
  label: string;
  formatValue?: (value: TierFeatures[keyof TierFeatures]) => string;
}

const FEATURE_ROWS: FeatureRowData[] = [
  { key: 'maxRecipes', label: 'Recipes', formatValue: (v) => (v === 'unlimited' ? 'Unlimited' : `${v}`) },
  { key: 'maxPantryItems', label: 'Pantry items', formatValue: (v) => (v === 'unlimited' ? 'Unlimited' : `${v}`) },
  { key: 'aiSubstitutionsPerDay', label: 'AI substitutions', formatValue: (v) => (v === 'unlimited' ? 'Unlimited' : `${v}/day`) },
  { key: 'portionAnalysis', label: 'Portion analysis' },
  {
    key: 'portionAnalysisPerDay',
    label: 'Analysis limit',
    formatValue: (v) => (v === 'unlimited' ? 'Unlimited' : v === 0 ? '-' : `${v}/day`),
  },
  { key: 'voiceHandsFree', label: 'Voice commands' },
  {
    key: 'voiceUsagePerDay',
    label: 'Voice limit',
    formatValue: (v) => (v === 'unlimited' ? 'Unlimited' : v === 0 ? '-' : `${v}/day`),
  },
  { key: 'mealPlanning', label: 'Meal planning' },
  { key: 'mealPlanGeneration', label: 'AI meal generation' },
  { key: 'wasteTracking', label: 'Waste tracking' },
  { key: 'advancedNutrition', label: 'Advanced nutrition' },
  { key: 'offlineAccess', label: 'Offline access' },
  { key: 'adFree', label: 'Ad-free' },
  { key: 'prioritySupport', label: 'Priority support' },
  { key: 'exclusiveRecipes', label: 'Exclusive recipes' },
];

const TIERS: SubscriptionTier[] = ['free', 'premium', 'pro'];

const TIER_LABELS: Record<SubscriptionTier, string> = {
  free: 'Free',
  premium: 'Premium',
  pro: 'Pro',
};

export const FeatureComparison: React.FC<FeatureComparisonProps> = ({
  visible,
  onClose,
  onSelectTier,
}) => {
  const { t } = useTranslation();

  const renderValue = (tier: SubscriptionTier, row: FeatureRowData) => {
    const value = TIER_FEATURES[tier][row.key];

    if (typeof value === 'boolean') {
      return value ? (
        <Icon name="check" size="sm" color="tag-g-fg" accessibilityLabel={t('account.compare.included', 'Included')} />
      ) : (
        <Icon name="minus" size="sm" color="subtle" accessibilityLabel={t('account.compare.notIncluded', 'Not included')} />
      );
    }

    const displayValue = row.formatValue ? row.formatValue(value) : String(value);
    const isUnlimited = displayValue === 'Unlimited';
    const isZero = displayValue === '-' || displayValue === '0';

    return (
      <Text
        className={isUnlimited ? 'text-tag-g-fg' : isZero ? 'text-subtle' : 'text-ink'}
        style={{ fontFamily: FONT.sansMedium, fontSize: 12, textAlign: 'center' }}
      >
        {displayValue}
      </Text>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <Screen bare>
        <TopBar
          variant="compact"
          title={t('account.compare.title', 'Compare Plans')}
          right={<UIconButton icon="close" label={t('account.close', 'Close')} onPress={onClose} />}
        />
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40, gap: 16 }}>
          <View className="flex-row items-center" style={{ gap: 8 }}>
            <View style={{ width: 104 }} />
            {TIERS.map((tier) => (
              <View key={tier} className="flex-1 items-center">
                <Tag label={TIER_LABELS[tier]} tone={tier === 'pro' ? 'k' : tier === 'premium' ? 'o' : 'default'} />
              </View>
            ))}
          </View>

          <View className="bg-surface" style={{ borderRadius: 26, paddingHorizontal: 16 }}>
            {FEATURE_ROWS.map((row, index) => (
              <View
                key={row.key}
                className={`flex-row items-center ${index > 0 ? 'border-t border-divider' : ''}`}
                style={{ minHeight: 52, gap: 8 }}
              >
                <Text className="text-ink" numberOfLines={2} style={{ width: 88, fontFamily: FONT.sans, fontSize: 12 }}>
                  {row.label}
                </Text>
                {TIERS.map((tier) => (
                  <View key={tier} className="flex-1 items-center justify-center">
                    {renderValue(tier, row)}
                  </View>
                ))}
              </View>
            ))}
          </View>

          {onSelectTier ? (
            <View style={{ gap: 10 }}>
              <UButton variant="ghost" label={t('account.compare.choosePremium', 'Choose Premium')} onPress={() => onSelectTier('premium')} />
              <UButton variant="accent" label={t('account.compare.choosePro', 'Choose Pro')} onPress={() => onSelectTier('pro')} />
            </View>
          ) : null}
        </ScrollView>
      </Screen>
    </Modal>
  );
};

export default FeatureComparison;
