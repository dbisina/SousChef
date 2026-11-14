// Calories and nutrition from an ingredient list. Pure functions: the app and the server must agree on the numbers.
import { CALORIE_DATABASE, UNIT_ALIASES, type CalorieEntry } from './calories';
import type { NutritionInfo, RecipeIngredient } from './recipe';

export const normalizeUnit = (unit: string): string => {
  const lower = unit.toLowerCase().trim();
  return UNIT_ALIASES[lower] || lower;
};

export const findCalorieEntry = (ingredientName: string): CalorieEntry | null => {
  const normalized = ingredientName.toLowerCase().trim();
  const direct = CALORIE_DATABASE[normalized];
  if (direct) return direct;
  for (const [key, entry] of Object.entries(CALORIE_DATABASE)) {
    if (normalized.includes(key) || key.includes(normalized)) return entry;
  }
  return null;
};

const WEIGHT_UNITS: Record<string, number> = { g: 1, kg: 1000, oz: 28.35, lb: 453.592 };
// Volume is approximated as 1 g per ml, which is rough but close enough for a calorie estimate.
const VOLUME_UNITS: Record<string, number> = { tsp: 5, tbsp: 15, cup: 240, ml: 1, l: 1000 };

export const calculateIngredientCalories = (name: string, amount: number, unit: string): number => {
  const entry = findCalorieEntry(name);
  if (!entry) return 0;
  const normalizedUnit = normalizeUnit(unit);
  const grams = (): number => {
    if (normalizedUnit === entry.defaultUnit) return amount * entry.gramsPerUnit;
    const weight = WEIGHT_UNITS[normalizedUnit];
    if (weight) return amount * weight;
    const volume = VOLUME_UNITS[normalizedUnit];
    if (volume) return amount * volume;
    return amount * entry.gramsPerUnit;
  };
  return Math.round((grams() / 100) * entry.caloriesPer100g);
};

export const calculateNutrition = (
  ingredients: Pick<RecipeIngredient, 'name' | 'amount' | 'calories'>[],
  servings: number,
): NutritionInfo => {
  let calories = 0;
  let protein = 0;
  let carbs = 0;
  let fat = 0;
  let fiber = 0;
  for (const ingredient of ingredients) {
    const entry = findCalorieEntry(ingredient.name);
    if (entry) {
      const factor = (ingredient.amount * entry.gramsPerUnit) / 100;
      calories += factor * entry.caloriesPer100g;
      protein += factor * entry.protein;
      carbs += factor * entry.carbs;
      fat += factor * entry.fat;
      fiber += factor * entry.fiber;
    } else {
      calories += ingredient.calories || 0;
    }
  }
  return {
    totalCalories: Math.round(calories),
    caloriesPerServing: Math.round(calories / Math.max(servings, 1)),
    protein: Math.round(protein),
    carbs: Math.round(carbs),
    fat: Math.round(fat),
    fiber: Math.round(fiber),
  };
};
