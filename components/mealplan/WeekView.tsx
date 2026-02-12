/**
 * @fileoverview WeekView Component - Weekly meal plan view with navigation
 *
 * This component displays a full week's meal plan with day-by-day meal cards.
 * It includes week navigation controls and highlights the current week/day.
 * Performance-optimized with memoized calculations to prevent unnecessary recalculations.
 *
 * @module components/mealplan/WeekView
 */

import React, { useMemo, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '@/stores/themeStore';
import { MealPlanDay } from '@/types/mealplan';
import { DayCard } from './DayCard';
import { getDayName } from '@/services/mealPlanService';

/**
 * Props for the WeekView component
 *
 * @interface WeekViewProps
 * @property {MealPlanDay[]} days - Array of 7 days representing the week's meal plan
 * @property {string} selectedWeekStart - ISO date string of the week's start date (Monday)
 * @property {Function} onPreviousWeek - Callback to navigate to the previous week
 * @property {Function} onNextWeek - Callback to navigate to the next week
 * @property {Function} onMealPress - Callback when a meal is pressed (date, mealType, recipeId)
 * @property {Function} onAddMeal - Callback when add meal button is pressed (date, mealType)
 * @property {Function} [onRemoveMeal] - Optional callback when remove meal button is pressed
 * @property {boolean} isCurrentWeek - Whether the displayed week is the current week
 */
interface WeekViewProps {
  days: MealPlanDay[];
  selectedWeekStart: string;
  onPreviousWeek: () => void;
  onNextWeek: () => void;
  onMealPress: (date: string, mealType: string, recipeId?: string) => void;
  onAddMeal: (date: string, mealType: string) => void;
  onRemoveMeal?: (date: string, mealType: string) => void;
  isCurrentWeek: boolean;
}

/**
 * WeekView Component
 *
 * A scrollable view displaying a full week's meal plan with navigation controls.
 * Shows 7 DayCard components (Monday through Sunday) with week navigation header.
 *
 * Features:
 * - Week navigation (previous/next week buttons)
 * - Week range display (e.g., "Jan 15 - 21")
 * - Current week indicator
 * - Scrollable day cards
 * - Highlights today's date
 * - Supports meal viewing, adding, and removing
 *
 * Performance Optimizations:
 * - Memoizes week range calculation to avoid recalculation on every render
 * - Only recalculates when selectedWeekStart changes
 * - Passes date-specific callbacks to child DayCards
 *
 * @component
 * @example
 * ```tsx
 * <WeekView
 *   days={currentWeekDays}
 *   selectedWeekStart="2026-02-10"
 *   onPreviousWeek={() => navigateToWeek(-1)}
 *   onNextWeek={() => navigateToWeek(1)}
 *   onMealPress={(date, type, id) => openRecipe(id)}
 *   onAddMeal={(date, type) => showRecipePicker(date, type)}
 *   onRemoveMeal={(date, type) => confirmRemove(date, type)}
 *   isCurrentWeek={true}
 * />
 * ```
 */
export const WeekView: React.FC<WeekViewProps> = ({
  days,
  selectedWeekStart,
  onPreviousWeek,
  onNextWeek,
  onMealPress,
  onAddMeal,
  onRemoveMeal,
  isCurrentWeek,
}) => {
  const colors = useThemeColors();

  // Format week range for display - memoized to avoid recalculation
  const weekRangeText = useMemo(() => {
    const start = new Date(selectedWeekStart);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);

    const startMonth = start.toLocaleDateString('en-US', { month: 'short' });
    const endMonth = end.toLocaleDateString('en-US', { month: 'short' });
    const startDay = start.getDate();
    const endDay = end.getDate();

    if (startMonth === endMonth) {
      return `${startMonth} ${startDay} - ${endDay}`;
    }
    return `${startMonth} ${startDay} - ${endMonth} ${endDay}`;
  }, [selectedWeekStart]);

  return (
    <View className="flex-1">
      {/* Week navigation header */}
      <View className="flex-row items-center justify-between px-4 py-3 bg-white dark:bg-neutral-800 border-b border-neutral-100 dark:border-neutral-700">
        <TouchableOpacity
          onPress={onPreviousWeek}
          className="p-2 rounded-full bg-neutral-100 dark:bg-neutral-700"
        >
          <Ionicons name="chevron-back" size={20} color={colors.icon} />
        </TouchableOpacity>

        <View className="items-center">
          <Text className="text-lg font-bold text-neutral-900 dark:text-neutral-50">
            {weekRangeText}
          </Text>
          {isCurrentWeek && (
            <Text className="text-xs font-medium" style={{ color: colors.accent }}>
              This Week
            </Text>
          )}
        </View>

        <TouchableOpacity
          onPress={onNextWeek}
          className="p-2 rounded-full bg-neutral-100 dark:bg-neutral-700"
        >
          <Ionicons name="chevron-forward" size={20} color={colors.icon} />
        </TouchableOpacity>
      </View>

      {/* Days scroll view */}
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 16 }}
      >
        {days.map((day, index) => {
          const isToday =
            day.date === new Date().toISOString().split('T')[0];

          return (
            <DayCard
              key={day.date}
              day={day}
              dayName={getDayName(day.date)}
              isToday={isToday}
              onMealPress={(mealType, recipeId) =>
                onMealPress(day.date, mealType, recipeId)
              }
              onAddMeal={(mealType) => onAddMeal(day.date, mealType)}
              onRemoveMeal={onRemoveMeal ? (mealType) => onRemoveMeal(day.date, mealType) : undefined}
            />
          );
        })}
      </ScrollView>
    </View>
  );
};
