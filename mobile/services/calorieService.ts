import {
  CALORIE_DATABASE,
  CalorieEntry,
  UNIT_CONVERSIONS,
  UNIT_ALIASES,
} from '@/constants/calories';
import { Ingredient, NutritionInfo, Recipe } from '@/types';

// Normalize unit to standard form
export const normalizeUnit = (unit: string): string => {
  const lower = unit.toLowerCase().trim();
  return UNIT_ALIASES[lower] || lower;
};

// Find calorie entry for an ingredient
export const findCalorieEntry = (ingredientName: string): CalorieEntry | null => {
  const normalized = ingredientName.toLowerCase().trim();

  // Direct match
  if (CALORIE_DATABASE[normalized]) {
    return CALORIE_DATABASE[normalized];
  }

  // Partial match - try to find a substring match
  for (const [key, entry] of Object.entries(CALORIE_DATABASE)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return entry;
    }
  }

  // Try removing common modifiers
  const modifiers = [
    'fresh',
    'frozen',
    'canned',
    'dried',
    'raw',
    'cooked',
    'organic',
    'chopped',
    'diced',
    'sliced',
    'minced',
  ];
  let cleanedName = normalized;
  modifiers.forEach((mod) => {
    cleanedName = cleanedName.replace(mod, '').trim();
  });

  if (CALORIE_DATABASE[cleanedName]) {
    return CALORIE_DATABASE[cleanedName];
  }

  for (const [key, entry] of Object.entries(CALORIE_DATABASE)) {
    if (cleanedName.includes(key) || key.includes(cleanedName)) {
      return entry;
    }
  }

  return null;
};

// Calculate calories for a single ingredient
export const calculateIngredientCalories = (
  name: string,
  amount: number,
  unit: string
): number => {
  const entry = findCalorieEntry(name);
  if (!entry) {
    console.warn(`No calorie data found for: ${name}`);
    return 0;
  }

  const normalizedUnit = normalizeUnit(unit);

  // Convert to grams based on unit type
  let grams: number;

  // Weight units
  const weightUnits: Record<string, number> = {
    g: 1,
    kg: 1000,
    oz: 28.35,
    lb: 453.592,
  };

  // Volume units (approximate conversion to grams assuming water-like density)
  const volumeUnits: Record<string, number> = {
    tsp: 5,
    tbsp: 15,
    cup: 240,
    ml: 1,
    l: 1000,
    'fl oz': 30,
  };

  if (weightUnits[normalizedUnit]) {
    grams = amount * weightUnits[normalizedUnit];
  } else if (volumeUnits[normalizedUnit]) {
    // For volume, use approximate conversion based on typical ingredient density
    grams = amount * volumeUnits[normalizedUnit];
  } else if (normalizedUnit === entry.defaultUnit) {
    // If using the ingredient's default unit, use its conversion factor
    grams = amount * entry.gramsPerUnit;
  } else {
    // Fallback: assume it's a count-based unit (piece, slice, etc.)
    grams = amount * entry.gramsPerUnit;
  }

  // Calculate calories based on grams
  const calories = (grams / 100) * entry.caloriesPer100g;
  return Math.round(calories);
};

// Calculate full nutrition info for an ingredient
export const calculateIngredientNutrition = (
  name: string,
  amount: number,
  unit: string
): {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
} => {
  const entry = findCalorieEntry(name);
  if (!entry) {
    return { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };
  }

  const normalizedUnit = normalizeUnit(unit);

  // Calculate grams (same logic as above)
  let grams: number;
  const weightUnits: Record<string, number> = {
    g: 1,
    kg: 1000,
    oz: 28.35,
    lb: 453.592,
  };
  const volumeUnits: Record<string, number> = {
    tsp: 5,
    tbsp: 15,
    cup: 240,
    ml: 1,
    l: 1000,
  };

  if (weightUnits[normalizedUnit]) {
    grams = amount * weightUnits[normalizedUnit];
  } else if (volumeUnits[normalizedUnit]) {
    grams = amount * volumeUnits[normalizedUnit];
  } else {
    grams = amount * entry.gramsPerUnit;
  }

  const factor = grams / 100;

  return {
    calories: Math.round(factor * entry.caloriesPer100g),
    protein: Math.round(factor * entry.protein * 10) / 10,
    carbs: Math.round(factor * entry.carbs * 10) / 10,
    fat: Math.round(factor * entry.fat * 10) / 10,
    fiber: Math.round(factor * entry.fiber * 10) / 10,
  };
};

// Calculate nutrition for a list of ingredients
export const calculateRecipeNutrition = (
  ingredients: Ingredient[],
  servings: number
): NutritionInfo => {
  let totalCalories = 0;
  let totalProtein = 0;
  let totalCarbs = 0;
  let totalFat = 0;
  let totalFiber = 0;

  ingredients.forEach((ingredient) => {
    const nutrition = calculateIngredientNutrition(
      ingredient.name,
      ingredient.amount,
      ingredient.unit
    );
    totalCalories += nutrition.calories;
    totalProtein += nutrition.protein;
    totalCarbs += nutrition.carbs;
    totalFat += nutrition.fat;
    totalFiber += nutrition.fiber;
  });

  return {
    totalCalories: Math.round(totalCalories),
    caloriesPerServing: Math.round(totalCalories / servings),
    protein: Math.round(totalProtein),
    carbs: Math.round(totalCarbs),
    fat: Math.round(totalFat),
    fiber: Math.round(totalFiber),
  };
};

// Calculate calories for adjusted servings
export const calculateCaloriesForServings = (
  recipe: Recipe,
  desiredServings: number
): NutritionInfo => {
  const ratio = desiredServings / recipe.servings;
  return {
    totalCalories: Math.round(recipe.nutrition.totalCalories * ratio),
    caloriesPerServing: recipe.nutrition.caloriesPerServing, // Per serving stays the same
    protein: Math.round(recipe.nutrition.protein * ratio),
    carbs: Math.round(recipe.nutrition.carbs * ratio),
    fat: Math.round(recipe.nutrition.fat * ratio),
    fiber: Math.round(recipe.nutrition.fiber * ratio),
  };
};

// Calculate daily value percentages (based on 2000 calorie diet)
export const calculateDailyValues = (nutrition: NutritionInfo): {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
} => {
  return {
    calories: Math.round((nutrition.caloriesPerServing / 2000) * 100),
    protein: Math.round((nutrition.protein / 50) * 100), // 50g daily recommended
    carbs: Math.round((nutrition.carbs / 300) * 100), // 300g daily recommended
    fat: Math.round((nutrition.fat / 65) * 100), // 65g daily recommended
    fiber: Math.round((nutrition.fiber / 25) * 100), // 25g daily recommended
  };
};

// Calculate meal total (multiple recipes/items)
export const calculateMealTotal = (
  items: Array<{ nutrition: NutritionInfo; servings: number }>
): NutritionInfo => {
  const total = items.reduce(
    (acc, item) => ({
      totalCalories: acc.totalCalories + item.nutrition.caloriesPerServing * item.servings,
      protein: acc.protein + (item.nutrition.protein / item.servings) * item.servings,
      carbs: acc.carbs + (item.nutrition.carbs / item.servings) * item.servings,
      fat: acc.fat + (item.nutrition.fat / item.servings) * item.servings,
      fiber: acc.fiber + (item.nutrition.fiber / item.servings) * item.servings,
    }),
    { totalCalories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }
  );

  return {
    totalCalories: Math.round(total.totalCalories),
    caloriesPerServing: Math.round(total.totalCalories), // For a meal, total = per serving
    protein: Math.round(total.protein),
    carbs: Math.round(total.carbs),
    fat: Math.round(total.fat),
    fiber: Math.round(total.fiber),
  };
};

// Get calorie category label
export const getCalorieCategory = (caloriesPerServing: number): string => {
  if (caloriesPerServing < 200) return 'Low Calorie';
  if (caloriesPerServing < 400) return 'Light';
  if (caloriesPerServing < 600) return 'Moderate';
  if (caloriesPerServing < 800) return 'Hearty';
  return 'High Calorie';
};

// Format nutrition for display
export const formatNutrition = (nutrition: NutritionInfo): string => {
  return `${nutrition.caloriesPerServing} cal | P: ${nutrition.protein}g | C: ${nutrition.carbs}g | F: ${nutrition.fat}g`;
};

// Search calorie database
export const searchCalorieDatabase = (query: string): CalorieEntry[] => {
  const normalizedQuery = query.toLowerCase();
  return Object.values(CALORIE_DATABASE).filter(
    (entry) =>
      entry.name.toLowerCase().includes(normalizedQuery)
  );
};
