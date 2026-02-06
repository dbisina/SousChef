import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSubscription, useRemainingUsage } from '@/hooks/useSubscription';
import { PremiumBadge } from './PremiumBadge';
import { UsageIndicator } from './UsageIndicator';

interface SubscriptionCardProps {
  onUpgradePress?: () => void;
  onManagePress?: () => void;
  showUsage?: boolean;
}

export const SubscriptionCard: React.FC<SubscriptionCardProps> = ({
  onUpgradePress,
  onManagePress,
  showUsage = true,
}) => {
  const { subscriptionTier, isSubscribed, tierName, tierColor, openManagement } =
    useSubscription();
  const { remainingAI, remainingPortion } = useRemainingUsage();

  const handleManagePress = () => {
    if (onManagePress) {
      onManagePress();
    } else {
      openManagement();
    }
  };

  return (
    <View className="bg-white rounded-2xl p-4 shadow-sm border border-neutral-100">
      {/* Header */}
      <View className="flex-row items-center justify-between mb-4">
        <View className="flex-row items-center">
          <View
            className={`w-12 h-12 rounded-full items-center justify-center ${
              subscriptionTier === 'pro'
                ? 'bg-purple-100'
                : subscriptionTier === 'premium'
                ? 'bg-primary-100'
                : 'bg-neutral-100'
            }`}
          >
            <Ionicons
              name={
                subscriptionTier === 'pro'
                  ? 'diamond'
                  : subscriptionTier === 'premium'
                  ? 'star'
                  : 'person'
              }
              size={24}
              color={tierColor}
            />
          </View>
          <View className="ml-3">
            <View className="flex-row items-center">
              <Text className="text-lg font-bold text-neutral-900">{tierName}</Text>
              {isSubscribed && (
                <PremiumBadge tier={subscriptionTier} size="small" showIcon={false} />
              )}
            </View>
            <Text className="text-sm text-neutral-500">
              {isSubscribed ? 'Active subscription' : 'Free plan'}
            </Text>
          </View>
        </View>

        {isSubscribed ? (
          <TouchableOpacity
            onPress={handleManagePress}
            className="px-3 py-2 rounded-lg bg-neutral-100"
          >
            <Text className="text-sm font-medium text-neutral-700">Manage</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={onUpgradePress}
            className="px-3 py-2 rounded-lg bg-primary-500"
          >
            <Text className="text-sm font-medium text-white">Upgrade</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Usage Section */}
      {showUsage && (
        <View className="pt-4 border-t border-neutral-100">
          <Text className="text-sm font-medium text-neutral-500 mb-3">
            Daily Usage
          </Text>
          <View className="space-y-3">
            <UsageIndicator
              label="AI Substitutions"
              remaining={remainingAI}
              icon="sparkles"
            />
            <UsageIndicator
              label="Portion Analysis"
              remaining={remainingPortion}
              icon="camera"
            />
          </View>
        </View>
      )}

      {/* Upgrade prompt for free users */}
      {!isSubscribed && (
        <TouchableOpacity
          onPress={onUpgradePress}
          className="mt-4 p-3 bg-gradient-to-r from-primary-50 to-purple-50 rounded-xl flex-row items-center"
        >
          <Ionicons name="rocket" size={20} color="#FF6B35" />
          <View className="flex-1 ml-3">
            <Text className="text-sm font-medium text-neutral-900">
              Unlock all features
            </Text>
            <Text className="text-xs text-neutral-500">
              Get unlimited AI substitutions and more
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#737373" />
        </TouchableOpacity>
      )}
    </View>
  );
};
