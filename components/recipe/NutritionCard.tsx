import React from 'react';
import { View, Text } from 'react-native';
import { NutritionInfo } from '@/types';
import { calculateDailyValues, formatNutrition } from '@/services/calorieService';

interface NutritionCardProps {
  nutrition: NutritionInfo;
  servings?: number;
  showDailyValues?: boolean;
  compact?: boolean;
}

export const NutritionCard: React.FC<NutritionCardProps> = ({
  nutrition,
  servings = 1,
  showDailyValues = true,
  compact = false,
}) => {
  const dailyValues = calculateDailyValues(nutrition);

  if (compact) {
    return (
      <View className="flex-row items-center justify-between bg-neutral-50 rounded-xl p-3">
        <NutritionBadge
          label="Cal"
          value={nutrition.caloriesPerServing}
          unit=""
        />
        <NutritionBadge
          label="Protein"
          value={nutrition.protein}
          unit="g"
        />
        <NutritionBadge
          label="Carbs"
          value={nutrition.carbs}
          unit="g"
        />
        <NutritionBadge
          label="Fat"
          value={nutrition.fat}
          unit="g"
        />
      </View>
    );
  }

  return (
    <View className="bg-white rounded-2xl p-4 shadow-sm">
      <Text className="text-lg font-bold text-neutral-900 mb-4">
        Nutrition Facts
      </Text>

      {servings > 1 && (
        <Text className="text-sm text-neutral-500 mb-4">
          Per serving ({servings} servings total)
        </Text>
      )}

      {/* Calories */}
      <View className="border-b-2 border-neutral-900 pb-2 mb-2">
        <View className="flex-row items-baseline justify-between">
          <Text className="text-xl font-bold text-neutral-900">Calories</Text>
          <Text className="text-3xl font-bold text-neutral-900">
            {nutrition.caloriesPerServing}
          </Text>
        </View>
      </View>

      {/* Macros */}
      <View className="space-y-2">
        <NutritionRow
          label="Total Fat"
          value={nutrition.fat}
          unit="g"
          dailyValue={showDailyValues ? dailyValues.fat : undefined}
          isBold
        />
        <NutritionRow
          label="Total Carbohydrates"
          value={nutrition.carbs}
          unit="g"
          dailyValue={showDailyValues ? dailyValues.carbs : undefined}
          isBold
        />
        <NutritionRow
          label="Dietary Fiber"
          value={nutrition.fiber}
          unit="g"
          dailyValue={showDailyValues ? dailyValues.fiber : undefined}
          isIndented
        />
        <NutritionRow
          label="Protein"
          value={nutrition.protein}
          unit="g"
          dailyValue={showDailyValues ? dailyValues.protein : undefined}
          isBold
        />
      </View>

      {showDailyValues && (
        <Text className="text-xs text-neutral-400 mt-4">
          * Percent Daily Values are based on a 2,000 calorie diet.
        </Text>
      )}
    </View>
  );
};

interface NutritionRowProps {
  label: string;
  value: number;
  unit: string;
  dailyValue?: number;
  isBold?: boolean;
  isIndented?: boolean;
}

const NutritionRow: React.FC<NutritionRowProps> = ({
  label,
  value,
  unit,
  dailyValue,
  isBold = false,
  isIndented = false,
}) => {
  return (
    <View
      className={`
        flex-row items-center justify-between py-1 border-b border-neutral-100
        ${isIndented ? 'ml-4' : ''}
      `}
    >
      <Text
        className={`${isBold ? 'font-semibold' : ''} text-neutral-700`}
      >
        {label}
      </Text>
      <View className="flex-row items-center">
        <Text className={`${isBold ? 'font-semibold' : ''} text-neutral-700`}>
          {value}{unit}
        </Text>
        {dailyValue !== undefined && (
          <Text className="text-neutral-500 ml-2 w-12 text-right">
            {dailyValue}%
          </Text>
        )}
      </View>
    </View>
  );
};

interface NutritionBadgeProps {
  label: string;
  value: number;
  unit: string;
}

const NutritionBadge: React.FC<NutritionBadgeProps> = ({ label, value, unit }) => {
  return (
    <View className="items-center">
      <Text className="text-lg font-bold text-neutral-900">
        {value}{unit}
      </Text>
      <Text className="text-xs text-neutral-500">{label}</Text>
    </View>
  );
};

// Mini nutrition display for cards
interface MiniNutritionProps {
  nutrition: NutritionInfo;
}

export const MiniNutrition: React.FC<MiniNutritionProps> = ({ nutrition }) => {
  return (
    <Text className="text-sm text-neutral-500">
      {formatNutrition(nutrition)}
    </Text>
  );
};

// Calorie summary for meal planning
interface CalorieSummaryProps {
  items: Array<{
    name: string;
    calories: number;
    servings: number;
  }>;
}

export const CalorieSummary: React.FC<CalorieSummaryProps> = ({ items }) => {
  const total = items.reduce((sum, item) => sum + item.calories * item.servings, 0);

  return (
    <View className="bg-white rounded-2xl p-4">
      <Text className="text-lg font-bold text-neutral-900 mb-3">
        Calorie Summary
      </Text>

      {items.map((item, index) => (
        <View
          key={index}
          className="flex-row items-center justify-between py-2 border-b border-neutral-100"
        >
          <Text className="text-neutral-700">{item.name}</Text>
          <Text className="text-neutral-500">
            {item.servings > 1 ? `${item.servings} x ` : ''}
            {item.calories} cal
          </Text>
        </View>
      ))}

      <View className="flex-row items-center justify-between pt-3 mt-1">
        <Text className="text-lg font-bold text-neutral-900">Total</Text>
        <Text className="text-xl font-bold text-primary-500">{total} cal</Text>
      </View>
    </View>
  );
};
