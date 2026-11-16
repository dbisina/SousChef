// The server's AI helpers: ingredient substitutions, a planned week of meals, and reading a recipe from cookbook photos.
// Used by aiService, mealPlanAIService and recipeImportService when EXPO_PUBLIC_API_URL is set (so no AI key lives on the phone).
import type {
  CaptionResponse,
  ChatAssistRequest,
  ChatAssistResponse,
  CookChatRequest,
  CookChatResponse,
  GeneratedMealPlan,
  GenerateMealPlanRequest,
  HealthSummaryResponse,
  LeftoversRequest,
  LeftoversResponse,
  PantryScanRequest,
  PantryScanResponse,
  PlateCheckResponse,
  RewriteRecipeRequest,
  RewriteRecipeResponse,
  ScaleNote,
  ScaleNoteRequest,
  ScaleRecipeRequest,
  ScaleRecipeResponse,
  ScanRecipeResponse,
  SearchIntentResponse,
  SubstituteResponse,
  TonightRequest,
  TonightResponse,
  WasteCoachResponse,
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

/* ---------------------------------------------------------------- cooking for more or fewer people */

/** The recipe for a different number of people. The answer says where its numbers came from (`source`). */
export const apiScaleRecipe = (recipeId: string, body: ScaleRecipeRequest): Promise<ScaleRecipeResponse> =>
  api().post<ScaleRecipeResponse>(`/v1/recipes/${recipeId}/scale`, body, { timeoutMs: 60_000 });

/** "Here is what I really used for N people." Allowed for the recipe's author and anyone who has made it. */
export const apiSaveScaleNote = (recipeId: string, body: ScaleNoteRequest): Promise<ScaleNote> =>
  api().put<ScaleNote>(`/v1/recipes/${recipeId}/scale-notes`, body);

export const apiScaleNotes = async (recipeId: string): Promise<ScaleNote[]> => (await api().get<{ items: ScaleNote[] }>(`/v1/recipes/${recipeId}/scale-notes`)).items;

/* ---------------------------------------------------------------- more AI helpers (thin wrappers; each call is limited per day by the server) */

export const apiTonight = (body: TonightRequest = {}): Promise<TonightResponse> => api().post<TonightResponse>('/v1/ai/tonight', body, { timeoutMs: 45_000 });
export const apiLeftovers = (body: LeftoversRequest): Promise<LeftoversResponse> => api().post<LeftoversResponse>('/v1/ai/leftovers', body, { timeoutMs: 45_000 });
export const apiWasteCoach = (): Promise<WasteCoachResponse> => api().get<WasteCoachResponse>('/v1/ai/waste-coach', { timeoutMs: 45_000 });
export const apiHealthSummary = (): Promise<HealthSummaryResponse> => api().get<HealthSummaryResponse>('/v1/ai/health-summary', { timeoutMs: 45_000 });
export const apiRewriteRecipe = (body: RewriteRecipeRequest): Promise<RewriteRecipeResponse> => api().post<RewriteRecipeResponse>('/v1/ai/rewrite-recipe', body, { timeoutMs: 60_000 });
export const apiCookChat = (body: CookChatRequest): Promise<CookChatResponse> => api().post<CookChatResponse>('/v1/ai/cook-chat', body, { timeoutMs: 45_000 });
export const apiChatAssist = (body: ChatAssistRequest): Promise<ChatAssistResponse> => api().post<ChatAssistResponse>('/v1/ai/chat-assist', body, { timeoutMs: 45_000 });
export const apiSearchIntent = (q: string): Promise<SearchIntentResponse> => api().post<SearchIntentResponse>('/v1/ai/search-intent', { q }, { timeoutMs: 30_000 });

/** Uploads the photos, then has the server list what it sees. Nothing is saved until the person ticks what to keep. */
export async function apiPantryScan(imageUris: string[], kind: PantryScanRequest['kind']): Promise<PantryScanResponse> {
  const uploaded = await Promise.all(imageUris.slice(0, 4).map((uri) => uploadFile(uri, 'import_frame')));
  return api().post<PantryScanResponse>('/v1/ai/pantry-scan', { uploadIds: uploaded.map((u) => u.id), kind }, { timeoutMs: 90_000 });
}

export async function apiPlateCheck(imageUri: string, recipeId?: string): Promise<PlateCheckResponse> {
  const up = await uploadFile(imageUri, 'made_post');
  return api().post<PlateCheckResponse>('/v1/ai/plate-check', { uploadId: up.id, ...(recipeId ? { recipeId } : {}) }, { timeoutMs: 60_000 });
}

export async function apiSuggestCaption(imageUri: string): Promise<CaptionResponse> {
  const up = await uploadFile(imageUri, 'made_post');
  return api().post<CaptionResponse>('/v1/ai/caption', { uploadId: up.id }, { timeoutMs: 60_000 });
}
