import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Modal,
  StyleSheet,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SubscriptionTier, TIER_FEATURES, TierFeatures } from '@/types/subscription';

interface FeatureComparisonProps {
  visible: boolean;
  onClose: () => void;
  onSelectTier?: (tier: SubscriptionTier) => void;
}

interface FeatureRowData {
  key: keyof TierFeatures;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  formatValue?: (value: TierFeatures[keyof TierFeatures]) => string;
}

const FEATURE_ROWS: FeatureRowData[] = [
  {
    key: 'maxRecipes',
    label: 'Recipes',
    icon: 'book',
    formatValue: (v) => (v === 'unlimited' ? 'Unlimited' : `${v}`),
  },
  {
    key: 'maxPantryItems',
    label: 'Pantry items',
    icon: 'cube',
    formatValue: (v) => (v === 'unlimited' ? 'Unlimited' : `${v}`),
  },
  {
    key: 'aiSubstitutionsPerDay',
    label: 'AI substitutions',
    icon: 'sparkles',
    formatValue: (v) => (v === 'unlimited' ? 'Unlimited' : `${v}/day`),
  },
  {
    key: 'portionAnalysis',
    label: 'Portion analysis',
    icon: 'camera',
  },
  {
    key: 'portionAnalysisPerDay',
    label: 'Analysis limit',
    icon: 'analytics',
    formatValue: (v) => (v === 'unlimited' ? 'Unlimited' : v === 0 ? '-' : `${v}/day`),
  },
  {
    key: 'voiceHandsFree',
    label: 'Voice commands',
    icon: 'mic',
  },
  {
    key: 'voiceUsagePerDay',
    label: 'Voice limit',
    icon: 'chatbubble',
    formatValue: (v) => (v === 'unlimited' ? 'Unlimited' : v === 0 ? '-' : `${v}/day`),
  },
  {
    key: 'mealPlanning',
    label: 'Meal planning',
    icon: 'calendar',
  },
  {
    key: 'mealPlanGeneration',
    label: 'AI meal generation',
    icon: 'bulb',
  },
  {
    key: 'wasteTracking',
    label: 'Waste tracking',
    icon: 'leaf',
  },
  {
    key: 'advancedNutrition',
    label: 'Advanced nutrition',
    icon: 'nutrition',
  },
  {
    key: 'offlineAccess',
    label: 'Offline access',
    icon: 'cloud-offline',
  },
  {
    key: 'adFree',
    label: 'Ad-free',
    icon: 'ban',
  },
  {
    key: 'prioritySupport',
    label: 'Priority support',
    icon: 'headset',
  },
  {
    key: 'exclusiveRecipes',
    label: 'Exclusive recipes',
    icon: 'star',
  },
];

const TIERS: SubscriptionTier[] = ['free', 'premium', 'pro'];

const TIER_LABELS: Record<SubscriptionTier, string> = {
  free: 'Free',
  premium: 'Premium',
  pro: 'Pro',
};

const TIER_COLORS: Record<SubscriptionTier, string> = {
  free: '#78716C',
  premium: '#F97316',
  pro: '#8B5CF6',
};

export const FeatureComparison: React.FC<FeatureComparisonProps> = ({
  visible,
  onClose,
  onSelectTier,
}) => {
  const renderValue = (tier: SubscriptionTier, row: FeatureRowData) => {
    const features = TIER_FEATURES[tier];
    const value = features[row.key];

    // Boolean values
    if (typeof value === 'boolean') {
      return value ? (
        <View className="w-6 h-6 rounded-full bg-secondary-100 items-center justify-center">
          <Ionicons name="checkmark" size={14} color="#16A34A" />
        </View>
      ) : (
        <View className="w-6 h-6 rounded-full bg-neutral-100 items-center justify-center">
          <Ionicons name="close" size={14} color="#A8A29E" />
        </View>
      );
    }

    // Number or string values
    const displayValue = row.formatValue
      ? row.formatValue(value)
      : String(value);

    const isUnlimited = displayValue === 'Unlimited';
    const isZero = displayValue === '-' || displayValue === '0';

    return (
      <Text
        className={`text-sm font-medium text-center ${
          isUnlimited
            ? 'text-secondary-600'
            : isZero
            ? 'text-neutral-400'
            : 'text-neutral-700'
        }`}
      >
        {displayValue}
      </Text>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-neutral-50">
        {/* Header */}
        <View className="flex-row items-center justify-between px-4 pt-4 pb-3 border-b border-neutral-200 bg-white">
          <Text className="text-lg font-bold text-neutral-900">Compare Plans</Text>
          <TouchableOpacity
            onPress={onClose}
            className="w-8 h-8 items-center justify-center rounded-full bg-neutral-100"
          >
            <Ionicons name="close" size={20} color="#44403C" />
          </TouchableOpacity>
        </View>

        <ScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 40 }}
        >
          {/* Tier Headers - Sticky */}
          <View className="flex-row bg-white border-b border-neutral-100 py-4 px-4">
            <View className="w-28" />
            {TIERS.map((tier) => (
              <View key={tier} className="flex-1 items-center">
                <View
                  className="px-3 py-1.5 rounded-full mb-1"
                  style={{ backgroundColor: `${TIER_COLORS[tier]}15` }}
                >
                  <Text
                    className="text-sm font-bold"
                    style={{ color: TIER_COLORS[tier] }}
                  >
                    {TIER_LABELS[tier]}
                  </Text>
                </View>
              </View>
            ))}
          </View>

          {/* Feature Rows */}
          <View className="bg-white">
            {FEATURE_ROWS.map((row, index) => (
              <View
                key={row.key}
                className={`flex-row items-center py-4 px-4 ${
                  index < FEATURE_ROWS.length - 1 ? 'border-b border-neutral-100' : ''
                }`}
              >
                {/* Feature Label */}
                <View className="w-28 flex-row items-center">
                  <View className="w-7 h-7 rounded-lg bg-neutral-100 items-center justify-center mr-2">
                    <Ionicons name={row.icon} size={14} color="#57534E" />
                  </View>
                  <Text className="text-xs text-neutral-700 flex-1" numberOfLines={2}>
                    {row.label}
                  </Text>
                </View>

                {/* Tier Values */}
                {TIERS.map((tier) => (
                  <View key={tier} className="flex-1 items-center justify-center">
                    {renderValue(tier, row)}
                  </View>
                ))}
              </View>
            ))}
          </View>

          {/* CTA Section */}
          {onSelectTier && (
            <View className="px-4 mt-6 gap-3">
              <TouchableOpacity
                onPress={() => onSelectTier('premium')}
                className="py-4 rounded-2xl items-center"
                style={[styles.ctaButton, { backgroundColor: '#FFF7ED' }]}
              >
                <Text className="font-bold text-primary-600">
                  Choose Premium
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => onSelectTier('pro')}
                className="py-4 rounded-2xl items-center overflow-hidden"
                style={styles.ctaButton}
              >
                <LinearGradient
                  colors={['#8B5CF6', '#7C3AED']}
                  style={StyleSheet.absoluteFill}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                />
                <Text className="font-bold text-white">
                  Choose Pro
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  ctaButton: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
});

export default FeatureComparison;
