/**
 * @fileoverview WeekView - week strip (Mon..Sun) plus the selected day's meal photo cards.
 *
 * Design: MealPlan.html. 46x66 day buttons, the selected one filled with ink. Week navigation stays
 * reachable through the small range row above the strip.
 *
 * @module components/mealplan/WeekView
 */

import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text as RNText, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Muted, Title, UIconButton, FONT } from '@/components/ui';
import { MealPlanDay, MealType } from '@/types/mealplan';
import { DayCard } from './DayCard';

interface WeekViewProps {
  days: MealPlanDay[];
  onMealPress: (date: string, mealType: MealType, recipeId?: string) => void;
  onAddMeal: (date: string, mealType: MealType) => void;
  onRemoveMeal?: (date: string, mealType: MealType) => void;
}

const localKey = (d: Date) => {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
};

const parse = (key: string) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
};

export const WeekView: React.FC<WeekViewProps> = ({ days, onMealPress, onAddMeal, onRemoveMeal }) => {
  const { t } = useTranslation();
  const todayKey = localKey(new Date());
  const [picked, setPicked] = useState<string | null>(null);

  const selectedDate =
    (picked && days.some((d) => d.date === picked) && picked) ||
    (days.some((d) => d.date === todayKey) && todayKey) ||
    days[0]?.date;
  const selectedDay = days.find((d) => d.date === selectedDate);

  const strip = days.map((day) => {
    const date = parse(day.date);
    const on = day.date === selectedDate;
    const shortName = date.toLocaleDateString(undefined, { weekday: 'short' });
    return (
      <Pressable
        key={day.date}
        accessibilityRole="button"
        accessibilityLabel={date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
        accessibilityState={{ selected: on }}
        onPress={() => setPicked(day.date)}
        className={`items-center justify-center ${on ? 'bg-ink' : ''}`}
        style={{ width: 46, height: 66, borderRadius: 23 }}
      >
        <RNText
          className={on ? 'text-ink-inverse' : 'text-muted'}
          style={{ fontFamily: FONT.sans, fontSize: 12, opacity: on ? 0.75 : 1 }}
        >
          {shortName}
        </RNText>
        <RNText className={on ? 'text-ink-inverse' : 'text-ink'} style={{ fontFamily: FONT.display, fontSize: 15 }}>
          {date.getDate()}
        </RNText>
      </Pressable>
    );
  });

  return (
    <View style={{ gap: 14 }}>
      {days.length > 7 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {strip}
        </ScrollView>
      ) : (
        <View className="flex-row justify-between">{strip}</View>
      )}

      {selectedDay ? (
        <DayCard
          day={selectedDay}
          dayName={parse(selectedDay.date).toLocaleDateString(undefined, { weekday: 'long' })}
          isToday={selectedDay.date === todayKey}
          onMealPress={(mealType, recipeId) => onMealPress(selectedDay.date, mealType, recipeId)}
          onAddMeal={(mealType) => onAddMeal(selectedDay.date, mealType)}
          onRemoveMeal={onRemoveMeal ? (mealType) => onRemoveMeal(selectedDay.date, mealType) : undefined}
        />
      ) : null}
    </View>
  );
};

interface WeekNavProps {
  selectedWeekStart: string;
  isCurrentWeek: boolean;
  onPreviousWeek: () => void;
  onNextWeek: () => void;
}

/** Previous / next week control. The design shows only the current week, so this sits below the plan. */
export const WeekNav: React.FC<WeekNavProps> = ({ selectedWeekStart, isCurrentWeek, onPreviousWeek, onNextWeek }) => {
  const { t } = useTranslation();
  const weekRangeText = useMemo(() => {
    const start = parse(selectedWeekStart);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    const startMonth = start.toLocaleDateString(undefined, { month: 'short' });
    const endMonth = end.toLocaleDateString(undefined, { month: 'short' });
    return startMonth === endMonth
      ? `${startMonth} ${start.getDate()} - ${end.getDate()}`
      : `${startMonth} ${start.getDate()} - ${endMonth} ${end.getDate()}`;
  }, [selectedWeekStart]);

  return (
    <View className="flex-row items-center justify-between">
      <UIconButton icon="back" size={44} label={t('plan.prevWeek', 'Previous week')} onPress={onPreviousWeek} />
      <View className="items-center">
        <Title>{weekRangeText}</Title>
        {isCurrentWeek ? <Muted small>{t('plan.thisWeek', 'This week')}</Muted> : null}
      </View>
      <UIconButton icon="chevronRight" size={44} label={t('plan.nextWeek', 'Next week')} onPress={onNextWeek} />
    </View>
  );
};
