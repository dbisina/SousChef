import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '@/stores/themeStore';

interface UsageIndicatorProps {
  label: string;
  remaining: number | 'unlimited';
  limit?: number;
  icon?: keyof typeof Ionicons.glyphMap;
  showProgress?: boolean;
  compact?: boolean;
}

export const UsageIndicator: React.FC<UsageIndicatorProps> = ({
  label,
  remaining,
  limit,
  icon,
  showProgress = true,
  compact = false,
}) => {
  const colors = useThemeColors();
  const isUnlimited = remaining === 'unlimited';
  const remainingNum = isUnlimited ? 0 : remaining;
  const usedCount = limit ? limit - remainingNum : 0;
  const progress = limit ? (usedCount / limit) * 100 : 0;

  const getProgressColor = () => {
    if (isUnlimited) return 'bg-green-500';
    if (progress >= 100) return 'bg-red-500';
    if (progress >= 75) return 'bg-yellow-500';
    return '';
  };

  const getTextColor = () => {
    if (isUnlimited) return 'text-green-600';
    if (remainingNum === 0) return 'text-red-600';
    if (limit && remainingNum <= 2) return 'text-yellow-600';
    return 'text-neutral-700 dark:text-neutral-300';
  };

  if (compact) {
    return (
      <View className="flex-row items-center">
        {icon && (
          <Ionicons
            name={icon}
            size={14}
            color={isUnlimited ? '#22C55E' : remainingNum === 0 ? '#EF4444' : colors.textMuted}
            style={{ marginRight: 4 }}
          />
        )}
        <Text className={`text-sm font-medium ${getTextColor()}`}>
          {isUnlimited ? (
            <Ionicons name="infinite" size={14} />
          ) : (
            `${remaining}${limit ? `/${limit}` : ''}`
          )}
        </Text>
      </View>
    );
  }

  return (
    <View className="space-y-1">
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center">
          {icon && (
            <Ionicons
              name={icon}
              size={16}
              color={colors.textMuted}
              style={{ marginRight: 6 }}
            />
          )}
          <Text className="text-sm text-neutral-600 dark:text-neutral-400">{label}</Text>
        </View>
        <Text className={`text-sm font-semibold ${getTextColor()}`}>
          {isUnlimited ? (
            <View className="flex-row items-center">
              <Ionicons name="infinite" size={16} color="#22C55E" />
              <Text className="text-green-600 ml-1">Unlimited</Text>
            </View>
          ) : (
            `${remaining}${limit ? ` / ${limit}` : ''} left`
          )}
        </Text>
      </View>

      {showProgress && !isUnlimited && limit && (
        <View className="h-2 bg-neutral-100 dark:bg-neutral-700 rounded-full overflow-hidden">
          <View
            className={`h-full ${getProgressColor()} rounded-full`}
            style={[{ width: `${Math.min(progress, 100)}%` }, !getProgressColor() && { backgroundColor: colors.accent }]}
          />
        </View>
      )}
    </View>
  );
};

// Inline usage badge for showing remaining uses
interface UsageBadgeProps {
  remaining: number | 'unlimited';
  size?: 'small' | 'medium';
}

export const UsageBadge: React.FC<UsageBadgeProps> = ({
  remaining,
  size = 'medium',
}) => {
  const colors = useThemeColors();
  const isUnlimited = remaining === 'unlimited';
  const remainingNum = isUnlimited ? 0 : remaining;

  const getBgColor = () => {
    if (isUnlimited) return 'bg-green-100';
    if (remainingNum === 0) return 'bg-red-100';
    if (remainingNum <= 2) return 'bg-yellow-100';
    return 'bg-neutral-100 dark:bg-neutral-700';
  };

  const getTextColor = () => {
    if (isUnlimited) return 'text-green-700';
    if (remainingNum === 0) return 'text-red-700';
    if (remainingNum <= 2) return 'text-yellow-700';
    return 'text-neutral-700 dark:text-neutral-300';
  };

  const sizeClasses = size === 'small' ? 'px-1.5 py-0.5' : 'px-2 py-1';
  const textSize = size === 'small' ? 'text-xs' : 'text-sm';

  return (
    <View className={`rounded-full ${getBgColor()} ${sizeClasses}`}>
      {isUnlimited ? (
        <Ionicons name="infinite" size={size === 'small' ? 12 : 14} color="#22C55E" />
      ) : (
        <Text className={`font-medium ${getTextColor()} ${textSize}`}>
          {remaining}
        </Text>
      )}
    </View>
  );
};
