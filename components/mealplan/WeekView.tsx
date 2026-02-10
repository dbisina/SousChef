import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '@/stores/themeStore';
import { MealPlanDay } from '@/types/mealplan';
import { DayCard } from './DayCard';
import { getDayName } from '@/services/mealPlanService';

interface WeekViewProps {
  days: MealPlanDay[];
  selectedWeekStart: string;
  onPreviousWeek: () => void;
  onNextWeek: () => void;
  onMealPress: (date: string, mealType: string, recipeId?: string) => void;
  onAddMeal: (date: string, mealType: string) => void;
  isCurrentWeek: boolean;
}

export const WeekView: React.FC<WeekViewProps> = ({
  days,
  selectedWeekStart,
  onPreviousWeek,
  onNextWeek,
  onMealPress,
  onAddMeal,
  isCurrentWeek,
}) => {
  const colors = useThemeColors();
  // Format week range for display
  const formatWeekRange = () => {
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
  };

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
            {formatWeekRange()}
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
            />
          );
        })}
      </ScrollView>
    </View>
  );
};
