// AI helpers that run on the server: ingredient substitutions, a planned week of meals, and reading a recipe from photos
// of a cookbook page. The phone sends what it knows; the server asks the AI and checks the answer before returning it.
import type { ImportedRecipe } from './kitchen';
import type { MealPlanDay, MealPlanStats, MealType, PlanShoppingItem } from './mealplan';

/* ---------------------------------------------------------------- substitutions */

export interface SubstituteRequest {
  ingredient: string;
  recipeTitle?: string;
  /** Allergies and diets to respect, such as "peanuts" or "vegan". */
  restrictions?: string[];
  /** Names of what the person has at home, so suggestions they can make right now come first. */
  pantry?: string[];
}

export interface SubstitutionSuggestion {
  original: string;
  substitute: string;
  /** How much to use, such as "1 for 1" or "3/4 cup per cup". */
  ratio: string;
  notes: string;
  impact: 'minimal' | 'moderate' | 'significant';
  /** The person already has it. */
  inPantry: boolean;
}

export interface SubstituteResponse {
  suggestions: SubstitutionSuggestion[];
}

/* ---------------------------------------------------------------- planning a week */

export interface GenerateMealPlanRequest {
  /** The first day, YYYY-MM-DD. */
  startDate: string;
  /** 1 to 14. */
  days: number;
  mealTypes: MealType[];
  servings: number;
  /** Allergies and diets. An allergy is never broken: recipes with it are not offered to the AI at all. */
  restrictions?: string[];
  cuisines?: string[];
  maxPrepTime?: number;
  maxCookTime?: number;
  /** Daily calories to aim for. */
  calorieTarget?: number;
  prioritizeExpiring: boolean;
  maximizeOverlap: boolean;
}

export interface GeneratedMealPlan {
  days: MealPlanDay[];
  /** Worked out from the chosen recipes and the pantry by the server, not written by the AI. */
  shoppingList: PlanShoppingItem[];
  stats: MealPlanStats;
  /** What the AI says about its choices. */
  notes: string[];
}

/* ---------------------------------------------------------------- reading a cookbook page */

export interface ScanRecipeRequest {
  /** Finished `import_frame` uploads: one to eight photos of the same recipe. They are deleted after reading. */
  uploadIds: string[];
  bookName?: string;
}

export interface ScanRecipeResponse {
  recipe: ImportedRecipe;
}
