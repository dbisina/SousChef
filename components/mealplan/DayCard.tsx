/**
 * @fileoverview DayCard - the planned meals of one day as photo cards (swap / remove), plus a compact row variant.
 *
 * @module components/mealplan/DayCard
 */

import React, { memo } from 'react';
import { Alert, Pressable, Text as RNText, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Icon, ListRow, PhotoCard, Tag, UIconButton, FONT } from '@/components/ui';
import { MealPlanDay, MealType } from '@/types/mealplan';
import { useRecipeStore } from '@/stores/recipeStore';
import { mealPhoto } from './foodPhoto';

interface DayCardProps {
  day: MealPlanDay;
  dayName: string;
  isToday: boolean;
  onMealPress: (mealType: MealType, recipeId?: string) => void;
  /** Add a meal to an empty slot, or swap the meal in a filled one. */
  onAddMeal: (mealType: MealType) => void;
  onRemoveMeal?: (mealType: MealType) => void;
}

const CORE_MEALS: MealType[] = ['breakfast', 'lunch', 'dinner'];

const MEAL_LABEL: Record<MealType, [string, string]> = {
  breakfast: ['plan.breakfast', 'Breakfast'],
  lunch: ['plan.lunch', 'Lunch'],
  dinner: ['plan.dinner', 'Dinner'],
  snack: ['plan.snack', 'Snack'],
};

/** Photo cards for each meal slot of a day (design: MealPlan.html .pc 132px with a swap button). */
export const DayCard: React.FC<DayCardProps> = memo(
  ({ day, dayName, onMealPress, onAddMeal, onRemoveMeal }) => {
    const { t } = useTranslation();
    const recipes = useRecipeStore((st) => st.recipes);
    // Breakfast, lunch and dinner always show a slot; snack only when one is planned.
    const types: MealType[] = day.snack ? [...CORE_MEALS, 'snack'] : CORE_MEALS;

    // Design shows the cook time; fall back to servings when the recipe is not in the store.
    const mealSubtitle = (recipeId: string, servings: number) => {
      const r = recipes.find((x) => x.id === recipeId);
      const mins = r ? (r.prepTime || 0) + (r.cookTime || 0) : 0;
      return mins > 0
        ? t('plan.minutes', '{{n}} min', { n: mins })
        : t('plan.servings', '{{n}} servings', { n: servings });
    };

    // One glass button like the design: swap, or remove when a remove handler exists.
    const onSwap = (type: MealType, name: string) => {
      if (!onRemoveMeal) {
        onAddMeal(type);
        return;
      }
      Alert.alert(name, undefined, [
        { text: t('plan.swapMealShort', 'Swap'), onPress: () => onAddMeal(type) },
        { text: t('plan.remove', 'Remove'), style: 'destructive', onPress: () => onRemoveMeal(type) },
        { text: t('common.cancel', 'Cancel'), style: 'cancel' },
      ]);
    };

    return (
      <View style={{ gap: 14 }}>
        {types.map((type) => {
          const meal = day[type];
          const label = t(MEAL_LABEL[type][0], MEAL_LABEL[type][1]);
          if (!meal) {
            return (
              <Pressable
                key={type}
                accessibilityRole="button"
                accessibilityLabel={t('plan.addMeal', 'Add {{meal}}', { meal: label.toLowerCase() })}
                onPress={() => onAddMeal(type)}
                className="bg-surface items-center justify-center"
                style={({ pressed }) => ({ height: 132, borderRadius: 26, gap: 8, opacity: pressed ? 0.85 : 1 })}
              >
                <Icon name="plus" color="muted" />
                <RNText className="text-muted" style={{ fontFamily: FONT.sansMedium, fontSize: 13 }}>
                  {t('plan.addMeal', 'Add {{meal}}', { meal: label.toLowerCase() })}
                </RNText>
              </Pressable>
            );
          }
          return (
            <PhotoCard
              key={type}
              source={mealPhoto(meal.imageURL, type)}
              height={132}
              radius={26}
              title={meal.recipeName}
              titleSize={17}
              captionInset={16}
              subtitle={mealSubtitle(meal.recipeId, meal.servings)}
              accessibilityLabel={`${label}, ${meal.recipeName}, ${dayName}`}
              onPress={() => onMealPress(type, meal.recipeId)}
              topLeft={<Tag tone="glassDark" label={label} />}
              topRight={
                <UIconButton
                  icon="refresh"
                  tone="glassDark"
                  size={38}
                  iconSize="sm"
                  label={t('plan.swapMeal', 'Swap {{meal}}', { meal: label.toLowerCase() })}
                  onPress={() => onSwap(type, meal.recipeName)}
                />
              }
            />
          );
        })}
      </View>
    );
  },
  (prev, next) =>
    prev.day.date === next.day.date &&
    prev.dayName === next.dayName &&
    prev.isToday === next.isToday &&
    prev.day.breakfast === next.day.breakfast &&
    prev.day.lunch === next.day.lunch &&
    prev.day.dinner === next.day.dinner &&
    prev.day.snack === next.day.snack &&
    prev.onMealPress === next.onMealPress &&
    prev.onAddMeal === next.onAddMeal &&
    prev.onRemoveMeal === next.onRemoveMeal
);

DayCard.displayName = 'DayCard';

interface CompactDayCardProps {
  day: MealPlanDay;
  dayName: string;
  isToday: boolean;
  onPress: () => void;
}

/** Single-line day summary row. */
export const CompactDayCard: React.FC<CompactDayCardProps> = ({ day, dayName, isToday, onPress }) => {
  const { t } = useTranslation();
  const count = [day.breakfast, day.lunch, day.dinner, day.snack].filter(Boolean).length;
  return (
    <ListRow
      title={dayName}
      subtitle={
        count > 0
          ? t('plan.mealsPlanned', '{{n}} meals planned', { n: count })
          : t('plan.noMealsPlanned', 'No meals planned')
      }
      leading={
        <View
          className={`items-center justify-center ${isToday ? 'bg-ink' : 'bg-surface-3'}`}
          style={{ width: 44, height: 44, borderRadius: 22 }}
        >
          <RNText
            className={isToday ? 'text-ink-inverse' : 'text-ink'}
            style={{ fontFamily: FONT.display, fontSize: 15 }}
          >
            {dayName.slice(0, 2)}
          </RNText>
        </View>
      }
      onPress={onPress}
    />
  );
};
