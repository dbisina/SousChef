import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SubscriptionTier } from '@/types/subscription';
import { getTierDisplayName, getTierColor } from '@/services/subscriptionService';

interface PremiumBadgeProps {
  tier: SubscriptionTier;
  size?: 'small' | 'medium' | 'large';
  showIcon?: boolean;
}

export const PremiumBadge: React.FC<PremiumBadgeProps> = ({
  tier,
  size = 'medium',
  showIcon = true,
}) => {
  if (tier === 'free') {
    return null;
  }

  const tierName = getTierDisplayName(tier);
  const tierColor = getTierColor(tier);

  const sizeClasses = {
    small: 'px-1.5 py-0.5',
    medium: 'px-2 py-1',
    large: 'px-3 py-1.5',
  };

  const textSizeClasses = {
    small: 'text-xs',
    medium: 'text-sm',
    large: 'text-base',
  };

  const iconSizes = {
    small: 10,
    medium: 12,
    large: 16,
  };

  const bgColor = tier === 'pro' ? 'bg-purple-100' : 'bg-primary-100';
  const textColor = tier === 'pro' ? 'text-purple-700' : 'text-primary-700';

  return (
    <View
      className={`flex-row items-center rounded-full ${bgColor} ${sizeClasses[size]}`}
    >
      {showIcon && (
        <Ionicons
          name={tier === 'pro' ? 'diamond' : 'star'}
          size={iconSizes[size]}
          color={tierColor}
          style={{ marginRight: 4 }}
        />
      )}
      <Text className={`font-semibold ${textColor} ${textSizeClasses[size]}`}>
        {tierName}
      </Text>
    </View>
  );
};
