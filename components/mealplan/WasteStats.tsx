import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  WasteStats as WasteStatsType,
  FoodWasteEntry,
  WasteReason,
  WASTE_REASON_LABELS,
} from '@/types/mealplan';
import { Card } from '@/components/ui';

interface WasteStatsProps {
  stats: WasteStatsType | null;
  onViewDetails?: () => void;
}

export const WasteStatsCard: React.FC<WasteStatsProps> = ({
  stats,
  onViewDetails,
}) => {
  if (!stats) {
    return (
      <Card className="bg-neutral-50">
        <View className="items-center py-4">
          <Ionicons name="leaf-outline" size={32} color="#D4D4D4" />
          <Text className="text-neutral-400 mt-2">
            No waste data yet
          </Text>
          <Text className="text-neutral-400 text-sm text-center mt-1">
            Start tracking your food waste to see insights
          </Text>
        </View>
      </Card>
    );
  }

  const getTrendIcon = () => {
    switch (stats.trendDirection) {
      case 'improving':
        return { name: 'trending-down', color: '#22C55E' };
      case 'worsening':
        return { name: 'trending-up', color: '#EF4444' };
      default:
        return { name: 'remove', color: '#737373' };
    }
  };

  const trend = getTrendIcon();

  return (
    <Card>
      <View className="flex-row items-center justify-between mb-4">
        <Text className="text-lg font-bold text-neutral-900">
          Waste Overview
        </Text>
        {onViewDetails && (
          <TouchableOpacity onPress={onViewDetails}>
            <Text className="text-primary-500 font-medium">View All</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Main stats */}
      <View className="flex-row mb-4">
        {/* This Week */}
        <View className="flex-1 items-center p-3 bg-red-50 rounded-xl mr-2">
          <Text className="text-2xl font-bold text-red-600">
            ${stats.wastedThisWeek.toFixed(0)}
          </Text>
          <Text className="text-xs text-red-500">This Week</Text>
        </View>

        {/* Saved */}
        <View className="flex-1 items-center p-3 bg-green-50 rounded-xl ml-2">
          <Text className="text-2xl font-bold text-green-600">
            ${stats.savedByPlanning.toFixed(0)}
          </Text>
          <Text className="text-xs text-green-500">Saved</Text>
        </View>
      </View>

      {/* Trend indicator */}
      <View className="flex-row items-center justify-center py-2 bg-neutral-50 rounded-lg">
        <Ionicons name={trend.name as any} size={20} color={trend.color} />
        <Text className="ml-2 text-neutral-600">
          Trend:{' '}
          <Text style={{ color: trend.color }} className="font-medium">
            {stats.trendDirection.charAt(0).toUpperCase() +
              stats.trendDirection.slice(1)}
          </Text>
        </Text>
      </View>

      {/* Top wasted items */}
      {stats.topWastedItems.length > 0 && (
        <View className="mt-4">
          <Text className="text-sm font-medium text-neutral-500 mb-2">
            Most Wasted Items
          </Text>
          <View className="flex-row flex-wrap">
            {stats.topWastedItems.slice(0, 3).map((item, index) => (
              <View
                key={index}
                className="bg-neutral-100 px-3 py-1 rounded-full mr-2 mb-2"
              >
                <Text className="text-sm text-neutral-600">
                  {item.name} ({item.count}x)
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </Card>
  );
};

// Compact savings display
interface SavingsDisplayProps {
  savedByPlanning: number;
  expiringItemsUsed: number;
}

export const SavingsDisplay: React.FC<SavingsDisplayProps> = ({
  savedByPlanning,
  expiringItemsUsed,
}) => {
  return (
    <View className="bg-green-50 border border-green-200 rounded-xl p-4">
      <View className="flex-row items-center mb-2">
        <View className="w-10 h-10 rounded-full bg-green-100 items-center justify-center">
          <Ionicons name="leaf" size={20} color="#22C55E" />
        </View>
        <View className="ml-3">
          <Text className="text-green-800 font-bold text-lg">
            ${savedByPlanning.toFixed(2)} Saved
          </Text>
          <Text className="text-green-600 text-sm">
            This week's smart planning
          </Text>
        </View>
      </View>

      {expiringItemsUsed > 0 && (
        <View className="flex-row items-center mt-2 pt-2 border-t border-green-200">
          <Ionicons name="checkmark-circle" size={16} color="#22C55E" />
          <Text className="text-green-600 text-sm ml-2">
            {expiringItemsUsed} expiring item{expiringItemsUsed !== 1 ? 's' : ''}{' '}
            used before spoiling
          </Text>
        </View>
      )}
    </View>
  );
};

// Waste entry row for list display
interface WasteEntryRowProps {
  entry: FoodWasteEntry;
  onDelete?: () => void;
}

export const WasteEntryRow: React.FC<WasteEntryRowProps> = ({
  entry,
  onDelete,
}) => {
  const formatDate = (timestamp: any) => {
    const date = timestamp.toDate();
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  const getReasonIcon = (reason: WasteReason) => {
    const icons: Record<WasteReason, string> = {
      expired: 'calendar-outline',
      spoiled: 'alert-circle-outline',
      leftover: 'restaurant-outline',
      overcooked: 'flame-outline',
      other: 'help-circle-outline',
    };
    return icons[reason];
  };

  return (
    <View className="flex-row items-center bg-white p-4 border-b border-neutral-100">
      <View className="w-10 h-10 rounded-full bg-red-100 items-center justify-center">
        <Ionicons
          name={getReasonIcon(entry.reason) as any}
          size={20}
          color="#EF4444"
        />
      </View>

      <View className="flex-1 ml-3">
        <Text className="text-base font-medium text-neutral-900">
          {entry.itemName}
        </Text>
        <View className="flex-row items-center">
          <Text className="text-sm text-neutral-500">
            {entry.amount} {entry.unit}
          </Text>
          <View className="w-1 h-1 rounded-full bg-neutral-300 mx-2" />
          <Text className="text-sm text-neutral-500">
            {WASTE_REASON_LABELS[entry.reason]}
          </Text>
        </View>
      </View>

      <View className="items-end">
        <Text className="text-base font-medium text-red-500">
          -${entry.estimatedValue.toFixed(2)}
        </Text>
        <Text className="text-xs text-neutral-400">
          {formatDate(entry.date)}
        </Text>
      </View>

      {onDelete && (
        <TouchableOpacity onPress={onDelete} className="ml-2 p-2">
          <Ionicons name="trash-outline" size={18} color="#A3A3A3" />
        </TouchableOpacity>
      )}
    </View>
  );
};

// Waste reason breakdown chart
interface WasteBreakdownProps {
  wasteByReason: Record<WasteReason, number>;
}

export const WasteBreakdown: React.FC<WasteBreakdownProps> = ({
  wasteByReason,
}) => {
  const total = Object.values(wasteByReason).reduce((a, b) => a + b, 0);
  if (total === 0) return null;

  const reasons = Object.entries(wasteByReason)
    .filter(([_, count]) => count > 0)
    .sort((a, b) => b[1] - a[1]);

  const colors: Record<WasteReason, string> = {
    expired: '#EF4444',
    spoiled: '#F59E0B',
    leftover: '#3B82F6',
    overcooked: '#8B5CF6',
    other: '#6B7280',
  };

  return (
    <View>
      <Text className="text-sm font-medium text-neutral-500 mb-3">
        Waste by Reason
      </Text>

      {reasons.map(([reason, count]) => {
        const percentage = Math.round((count / total) * 100);
        return (
          <View key={reason} className="mb-3">
            <View className="flex-row justify-between mb-1">
              <Text className="text-sm text-neutral-700">
                {WASTE_REASON_LABELS[reason as WasteReason]}
              </Text>
              <Text className="text-sm text-neutral-500">
                {count} ({percentage}%)
              </Text>
            </View>
            <View className="h-2 bg-neutral-100 rounded-full overflow-hidden">
              <View
                style={{
                  width: `${percentage}%`,
                  backgroundColor: colors[reason as WasteReason],
                }}
                className="h-full rounded-full"
              />
            </View>
          </View>
        );
      })}
    </View>
  );
};
