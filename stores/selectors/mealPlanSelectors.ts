/**
 * @fileoverview Meal Plan Selectors - Memoized selectors for meal plan store optimization
 *
 * This module provides performance-optimized selector functions for the meal plan store.
 * Selectors use caching to prevent unnecessary recalculations and re-renders.
 *
 * Performance Impact:
 * - Reduces unnecessary re-renders by subscribing only to needed state slices
 * - Prevents expensive calculations (like grouping by category) on every render
 * - Uses reference equality checks to determine if recalculation is needed
 *
 * @module stores/selectors/mealPlanSelectors
 */

import { MealPlanStoreState } from '../mealPlanStore';
import { ShoppingListItem, ShoppingCategory } from '@/types/mealplan';

/**
 * Select the current meal plan
 *
 * @param {MealPlanStoreState} state - Meal plan store state
 * @returns {MealPlan | null} Current meal plan or null if none exists
 */
export const selectCurrentPlan = (state: MealPlanStoreState) => state.currentPlan;

/**
 * Select loading state
 *
 * @param {MealPlanStoreState} state - Meal plan store state
 * @returns {boolean} True if meal plan is being fetched
 */
export const selectIsLoading = (state: MealPlanStoreState) => state.isLoading;

/**
 * Select generating state
 *
 * @param {MealPlanStoreState} state - Meal plan store state
 * @returns {boolean} True if AI is generating a meal plan
 */
export const selectIsGenerating = (state: MealPlanStoreState) => state.isGenerating;

/**
 * Select error message
 *
 * @param {MealPlanStoreState} state - Meal plan store state
 * @returns {string | null} Error message or null if no error
 */
export const selectError = (state: MealPlanStoreState) => state.error;

/**
 * Select shopping list
 *
 * @param {MealPlanStoreState} state - Meal plan store state
 * @returns {ShoppingListItem[]} Array of shopping list items
 */
export const selectShoppingList = (state: MealPlanStoreState) =>
  state.currentPlan?.shoppingList || [];

/**
 * Select unchecked shopping items
 *
 * @param {MealPlanStoreState} state - Meal plan store state
 * @returns {ShoppingListItem[]} Array of items not yet checked off
 */
export const selectUncheckedItems = (state: MealPlanStoreState) =>
  state.currentPlan?.shoppingList.filter((item) => !item.checked) || [];

/**
 * Select items to buy
 *
 * Filters to items that are both unchecked and have a positive toBuy quantity.
 * These are items not in the pantry that need to be purchased.
 *
 * @param {MealPlanStoreState} state - Meal plan store state
 * @returns {ShoppingListItem[]} Array of items needing purchase
 */
export const selectItemsToBuy = (state: MealPlanStoreState) =>
  state.currentPlan?.shoppingList.filter((item) => item.toBuy > 0 && !item.checked) || [];

/**
 * Select meal plan statistics
 *
 * @param {MealPlanStoreState} state - Meal plan store state
 * @returns {MealPlanStats | undefined} Statistics about the meal plan
 */
export const selectPlanStats = (state: MealPlanStoreState) =>
  state.currentPlan?.stats;

/**
 * Select selected week start date
 *
 * @param {MealPlanStoreState} state - Meal plan store state
 * @returns {string} ISO date string of the selected week's Monday
 */
export const selectSelectedWeek = (state: MealPlanStoreState) => state.selectedWeekStart;

/**
 * Select meal plan generation preferences
 *
 * @param {MealPlanStoreState} state - Meal plan store state
 * @returns {MealPlanPreferences} User preferences for meal plan generation
 */
export const selectPreferences = (state: MealPlanStoreState) => state.preferences;

/**
 * Select waste log entries
 *
 * @param {MealPlanStoreState} state - Meal plan store state
 * @returns {WasteEntry[]} Array of waste tracking entries
 */
export const selectWasteLog = (state: MealPlanStoreState) => state.wasteLog;

/**
 * Select waste statistics
 *
 * @param {MealPlanStoreState} state - Meal plan store state
 * @returns {WasteStats | null} Waste tracking statistics
 */
export const selectWasteStats = (state: MealPlanStoreState) => state.wasteStats;

// Memoized selector for shopping list by category
let cachedGroupedList: Map<string, ShoppingListItem[]> | null = null;
let lastShoppingListRef: ShoppingListItem[] | null = null;

/**
 * Select shopping list grouped by category
 *
 * Groups shopping list items by their category (Produce, Dairy, etc.) for organized display.
 * Uses caching to avoid regrouping on every render - only recalculates when shopping list reference changes.
 *
 * Performance: Prevents expensive Map creation and grouping on every component render
 *
 * @param {MealPlanStoreState} state - Meal plan store state
 * @returns {Map<string, ShoppingListItem[]>} Map of category names to items
 *
 * @example
 * ```typescript
 * const byCategory = useMealPlanStore(selectShoppingListByCategory);
 * // Returns: Map { "Produce" => [...items], "Dairy" => [...items] }
 * ```
 */
export const selectShoppingListByCategory = (
  state: MealPlanStoreState
): Map<string, ShoppingListItem[]> => {
  const shoppingList = state.currentPlan?.shoppingList;

  if (!shoppingList) return new Map();

  // Return cached result if list hasn't changed
  if (lastShoppingListRef === shoppingList && cachedGroupedList) {
    return cachedGroupedList;
  }

  const grouped = new Map<string, ShoppingListItem[]>();

  shoppingList.forEach((item) => {
    const existing = grouped.get(item.category) || [];
    existing.push(item);
    grouped.set(item.category, existing);
  });

  // Update cache
  cachedGroupedList = grouped;
  lastShoppingListRef = shoppingList;

  return grouped;
};
