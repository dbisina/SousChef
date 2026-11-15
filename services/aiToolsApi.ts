// The server's AI helpers: ingredient substitutions, a planned week of meals, and reading a recipe from cookbook photos.
// Used by aiService, mealPlanAIService and recipeImportService when EXPO_PUBLIC_API_URL is set (so no AI key lives on the phone).
import type {
  GeneratedMealPlan,
  GenerateMealPlanRequest,
  ScanRecipeResponse,
  SubstituteResponse,
} from '../shared/index';
import { api } from '@/lib/api';
import { uploadFile } from '@/lib/upload';
import { importedFromApi } from '@/services/wantToCookApi';
import type { AISubstitutionResult, Ingredient, SubstitutionSuggestion } from '@/types';
import type { MealPlanAIResponse, MealPlanDay, MealPlanPreferences } from '@/types/mealplan';
import type { CookbookScanResponse } from '@/types/wantToCook';

/* ---------------------------------------------------------------- substitutions */

export async function apiSubstitutions(ingredient: string, opts: { recipeTitle?: string; restrictions?: string[]; pantry?: string[] } = {}): Promise<SubstitutionSuggestion[]> {
  const res = await api().post<SubstituteResponse>('/v1/ai/substitute', { ingredient, ...opts }, { timeoutMs: 45_000 });
  return res.suggestions.map((s) => ({ originalIngredient: s.original, substitute: s.substitute, ratio: s.ratio, notes: s.notes, impactOnTaste: s.impact }));
}

/**
 * "Can I make this?" for a recipe: what is missing is worked out here from the pantry, and the server suggests a
 * replacement for each missing ingredient (at most four, to keep the cost down).
 */
export async function apiAnalyzeRecipe(ingredients: Ingredient[], available: string[], recipeTitle?: string): Promise<AISubstitutionResult> {
  const have = available.map((a) => a.toLowerCase());
  const required = ingredients.filter((i) => !i.optional);
  const matches = (name: string) => have.some((a) => a.includes(name.toLowerCase()) || name.toLowerCase().includes(a));
  const availableIngredients = required.filter((i) => matches(i.name)).map((i) => i.name);
  const missingIngredients = required.filter((i) => !matches(i.name)).map((i) => i.name);

  const substitutions: SubstitutionSuggestion[] = [];
  for (const missing of missingIngredients.slice(0, 4)) {
    try {
      const options = await apiSubstitutions(missing, { ...(recipeTitle ? { recipeTitle } : {}), pantry: available.slice(0, 100) });
      if (options[0]) substitutions.push(options[0]);
    } catch {
      // A missing suggestion is not a failure: the ingredient simply has no replacement listed.
    }
  }
  const replaced = new Set(substitutions.map((s) => s.originalIngredient.toLowerCase()));
  const stillMissing = missingIngredients.filter((m) => !replaced.has(m.toLowerCase()));
  return {
    canMake: stillMissing.length === 0,
    confidenceScore: required.length === 0 ? 0 : Math.round((1 - stillMissing.length / required.length) * 100) / 100,
    missingIngredients,
    availableIngredients,
    substitutions,
    tips: [],
  };
}

/* ---------------------------------------------------------------- meal plan */

export async function apiGenerateMealPlan(preferences: MealPlanPreferences, startDate: string): Promise<MealPlanAIResponse> {
  const body: GenerateMealPlanRequest = {
    startDate,
    days: preferences.daysToGenerate,
    mealTypes: preferences.mealsToInclude,
    servings: preferences.servingsPerMeal,
    restrictions: preferences.dietaryRestrictions,
    cuisines: preferences.cuisinePreferences,
    ...(preferences.maxPrepTime ? { maxPrepTime: preferences.maxPrepTime } : {}),
    ...(preferences.maxCookTime ? { maxCookTime: preferences.maxCookTime } : {}),
    ...(preferences.calorieTarget ? { calorieTarget: preferences.calorieTarget } : {}),
    prioritizeExpiring: preferences.prioritizeExpiring,
    maximizeOverlap: preferences.maximizeOverlap,
  };
  const res = await api().post<GeneratedMealPlan>('/v1/ai/meal-plan', body, { timeoutMs: 90_000 });
  const plan: MealPlanDay[] = res.days.map((d) => {
    const out: MealPlanDay = { date: d.date };
    for (const type of ['breakfast', 'lunch', 'dinner', 'snack'] as const) {
      const meal = d[type];
      if (meal) out[type] = { recipeId: meal.recipeId, recipeName: meal.recipeName, servings: meal.servings, ...(meal.imageUrl ? { imageURL: meal.imageUrl } : {}) };
    }
    return out;
  });
  return { plan, shoppingList: res.shoppingList, stats: res.stats, notes: res.notes, optimizationInsights: [] };
}

/* ---------------------------------------------------------------- cookbook photos */

/** Uploads the photos, then has the server read the recipe from them (it deletes the photos afterwards). */
export async function apiScanRecipe(imageUris: string[], bookName?: string): Promise<CookbookScanResponse> {
  try {
    const uploaded = await Promise.all(imageUris.slice(0, 8).map((uri) => uploadFile(uri, 'import_frame')));
    const res = await api().post<ScanRecipeResponse>('/v1/imports/scan', { uploadIds: uploaded.map((u) => u.id), ...(bookName ? { bookName } : {}) }, { timeoutMs: 90_000 });
    return { success: true, recipe: importedFromApi(res.recipe, `scan-${Date.now().toString(36)}`), confidence: res.recipe.extractionConfidence };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not read that recipe';
    return { success: false, error: message, confidence: 0 };
  }
}
