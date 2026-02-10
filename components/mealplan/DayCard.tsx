import React from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '@/stores/themeStore';
import { MealPlanDay, MealType, PlannedMeal } from '@/types/mealplan';

interface DayCardProps {
  day: MealPlanDay;
  dayName: string;
  isToday: boolean;
  onMealPress: (mealType: MealType, recipeId?: string) => void;
  onAddMeal: (mealType: MealType) => void;
}

const MEAL_TYPES: { type: MealType; label: string; icon: string }[] = [
  { type: 'breakfast', label: 'Breakfast', icon: 'sunny-outline' },
  { type: 'lunch', label: 'Lunch', icon: 'restaurant-outline' },
  { type: 'dinner', label: 'Dinner', icon: 'moon-outline' },
  { type: 'snack', label: 'Snack', icon: 'cafe-outline' },
];

export const DayCard: React.FC<DayCardProps> = ({
  day,
  dayName,
  isToday,
  onMealPress,
  onAddMeal,
}) => {
  const colors = useThemeColors();
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const renderMealSlot = (
    type: MealType,
    label: string,
    icon: string,
    meal?: PlannedMeal
  ) => {
    if (meal) {
      return (
        <TouchableOpacity
          key={type}
          onPress={() => onMealPress(type, meal.recipeId)}
          className="flex-row items-center bg-neutral-50 dark:bg-neutral-800 rounded-lg p-2 mb-2"
        >
          {meal.imageURL ? (
            <Image
              source={{ uri: meal.imageURL }}
              className="w-12 h-12 rounded-lg"
            />
          ) : (
            <View className="w-12 h-12 rounded-lg bg-primary-100 items-center justify-center">
              <Ionicons name={icon as any} size={20} color={colors.accent} />
            </View>
          )}
          <View className="flex-1 ml-3">
            <Text className="text-xs text-neutral-500 dark:text-neutral-400 uppercase">
              {label}
            </Text>
            <Text className="text-sm font-medium text-neutral-900 dark:text-neutral-50" numberOfLines={1}>
              {meal.recipeName}
            </Text>
            <Text className="text-xs text-neutral-500 dark:text-neutral-400">
              {meal.servings} serving{meal.servings !== 1 ? 's' : ''}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color="#A3A3A3" />
        </TouchableOpacity>
      );
    }

    return (
      <TouchableOpacity
        key={type}
        onPress={() => onAddMeal(type)}
        className="flex-row items-center border border-dashed border-neutral-300 rounded-lg p-2 mb-2"
      >
        <View className="w-12 h-12 rounded-lg bg-neutral-100 dark:bg-neutral-700 items-center justify-center">
          <Ionicons name={icon as any} size={20} color="#A3A3A3" />
        </View>
        <View className="flex-1 ml-3">
          <Text className="text-xs text-neutral-400 dark:text-neutral-500 uppercase">{label}</Text>
          <Text className="text-sm text-neutral-400 dark:text-neutral-500">Add meal</Text>
        </View>
        <View className="w-6 h-6 rounded-full bg-primary-100 items-center justify-center">
          <Ionicons name="add" size={16} color={colors.accent} />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View
      className={`mb-4 rounded-xl overflow-hidden ${
        isToday ? 'border-2' : 'border border-neutral-200 dark:border-neutral-700'
      }`}
      style={isToday ? { borderWidth: 2, borderColor: colors.accent } : undefined}
    >
      {/* Day header */}
      <View
        className={`flex-row items-center justify-between px-4 py-2 ${
          isToday ? '' : 'bg-neutral-100 dark:bg-neutral-700'
        }`}
        style={isToday ? { backgroundColor: colors.accent } : undefined}
      >
        <View className="flex-row items-center">
          <Text
            className={`text-base font-bold ${
              isToday ? 'text-white' : 'text-neutral-900 dark:text-neutral-50'
            }`}
          >
            {dayName}
          </Text>
          {isToday && (
            <View className="ml-2 px-2 py-0.5 bg-white rounded-full">
              <Text className="text-xs font-medium" style={{ color: colors.accent }}>
                Today
              </Text>
            </View>
          )}
        </View>
        <Text
          className={`text-sm ${
            isToday ? 'text-primary-100' : 'text-neutral-500 dark:text-neutral-400'
          }`}
        >
          {formatDate(day.date)}
        </Text>
      </View>

      {/* Meal slots */}
      <View className="p-3 bg-white dark:bg-neutral-800">
        {MEAL_TYPES.map(({ type, label, icon }) =>
          renderMealSlot(type, label, icon, day[type])
        )}
      </View>
    </View>
  );
};

// Compact day card for list views
interface CompactDayCardProps {
  day: MealPlanDay;
  dayName: string;
  isToday: boolean;
  onPress: () => void;
}

export const CompactDayCard: React.FC<CompactDayCardProps> = ({
  day,
  dayName,
  isToday,
  onPress,
}) => {
  const colors = useThemeColors();
  const mealsCount = [day.breakfast, day.lunch, day.dinner, day.snack].filter(
    Boolean
  ).length;

  return (
    <TouchableOpacity
      onPress={onPress}
      className={`flex-row items-center p-4 rounded-xl mb-2 ${
        isToday ? 'bg-primary-50 border border-primary-200' : 'bg-neutral-50 dark:bg-neutral-800'
      }`}
    >
      <View
        className={`w-12 h-12 rounded-full items-center justify-center ${
          isToday ? '' : 'bg-neutral-200 dark:bg-neutral-700'
        }`}
        style={isToday ? { backgroundColor: colors.accent } : undefined}
      >
        <Text
          className={`text-lg font-bold ${
            isToday ? 'text-white' : 'text-neutral-600 dark:text-neutral-400'
          }`}
        >
          {dayName.slice(0, 2)}
        </Text>
      </View>

      <View className="flex-1 ml-3">
        <Text className="text-base font-medium text-neutral-900 dark:text-neutral-50">
          {dayName}
        </Text>
        <Text className="text-sm text-neutral-500 dark:text-neutral-400">
          {mealsCount > 0
            ? `${mealsCount} meal${mealsCount !== 1 ? 's' : ''} planned`
            : 'No meals planned'}
        </Text>
      </View>

      {mealsCount > 0 && (
        <View className="flex-row">
          {day.breakfast && (
            <View className="w-2 h-2 rounded-full bg-amber-400 mr-1" />
          )}
          {day.lunch && (
            <View className="w-2 h-2 rounded-full bg-green-400 mr-1" />
          )}
          {day.dinner && (
            <View className="w-2 h-2 rounded-full bg-blue-400 mr-1" />
          )}
          {day.snack && (
            <View className="w-2 h-2 rounded-full bg-purple-400" />
          )}
        </View>
      )}

      <Ionicons name="chevron-forward" size={20} color="#A3A3A3" />
    </TouchableOpacity>
  );
};
