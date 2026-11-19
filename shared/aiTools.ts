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
  /** Plan within a weekly spend (the cost is an AI estimate). */
  budget?: PlanBudget;
  /** Plan for several people with their own restrictions: each meal says who it suits. */
  people?: PlanPerson[];
}

export interface GeneratedMealPlan {
  days: MealPlanDay[];
  /** Only when a budget was given. */
  estimate?: PlanCostEstimate;
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

/** Plain text the person typed, pasted or dictated: a recipe from a note, a message, a notebook. */
export interface ReadRecipeTextRequest {
  text: string;
}

/* ---------------------------------------------------------------- what is in my kitchen */

export interface PantryScanRequest {
  /** Finished `import_frame` uploads: one to four photos. They are deleted after reading. */
  uploadIds: string[];
  /** A fridge or shelf, or a shopping receipt. */
  kind: 'fridge' | 'receipt';
}

/** Nothing is saved: the app shows these to the person to tick, then adds the ones they keep. */
export interface PantryScanResponse {
  items: {
    name: string;
    amount: number;
    unit: string;
    category: import('./kitchen').PantryCategory;
    /** When it will likely go off, if the AI could tell. */
    expiresAt?: string;
  }[];
}

export interface TonightRequest {
  maxMinutes?: number;
  /** A few words: "something light", "comfort food". */
  mood?: string;
  restrictions?: string[];
}

export interface TonightResponse {
  recipe: {
    id: string;
    title: string;
    imageUrl: string;
    prepTime: number;
    cookTime: number;
    /** How much of it the person already has, 0 to 100. */
    matchPercent: number;
    missing: string[];
    /** One friendly line on why this one. */
    why: string;
  };
  /** False when the AI was unavailable and the best match was picked by the pantry alone. */
  aiUsed: boolean;
}

export interface LeftoversRequest {
  /** What is left, in the person's words. */
  text: string;
  restrictions?: string[];
}

export interface LeftoverIdea {
  title: string;
  minutes: number;
  /** Things from the person's pantry or leftovers it uses. */
  uses: string[];
  /** Anything else it needs. */
  alsoNeeds: string[];
  steps: string[];
}

export interface LeftoversResponse {
  ideas: LeftoverIdea[];
}

export interface PlateCheckRequest {
  /** A finished `made_post` upload of the plate. */
  uploadId: string;
  recipeId?: string;
}

export interface PlateCheckResponse {
  doneness: 'underdone' | 'good' | 'overdone' | 'unclear';
  praise: string;
  tip: string;
  /** Always shown: this is a look at a photo, not a food-safety check. */
  note: string;
}

/* ---------------------------------------------------------------- calories and nutrition from a plate photo */

export interface PlateNutritionRequest {
  /** A finished `made_post` upload of the plate. It is deleted after reading. */
  uploadId: string;
  /** What the person says is on the plate, when the first reading got it wrong. */
  hints?: string[];
}

/** Estimated amounts. Grams, except sodium in milligrams. */
export interface NutritionFacts {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
  sugarG: number;
  sodiumMg: number;
}

export interface PlateNutritionItem extends NutritionFacts {
  name: string;
  estimatedAmount: number;
  unit: string;
  /** 0 to 1. */
  confidence: number;
}

export interface PlateNutritionResponse {
  items: PlateNutritionItem[];
  /** The sum of the items, worked out by the server. */
  total: NutritionFacts;
  suggestedServings: number;
  recommendations: string[];
  /** Always shown: a photo cannot give exact numbers. */
  note: string;
}

export interface CaptionRequest {
  /** A finished `made_post` upload. */
  uploadId: string;
}

export interface CaptionResponse {
  title: string;
  caption: string;
  tags: string[];
}

export interface SearchIntentRequest {
  q: string;
}

/** A sentence turned into the filters `GET /v1/recipes` already understands (plus ingredients for `POST /v1/recipes/match`). */
export interface SearchIntentResponse {
  filters: {
    q?: string;
    category?: string;
    cuisine?: string;
    difficulty?: string;
    maxPrepTime?: number;
    dietaryFlags?: string[];
    excludeAllergens?: string[];
  };
  ingredients: string[];
}

/* ---------------------------------------------------------------- advice from your own numbers */

export interface WasteCoachResponse {
  /** Worked out by the server from the waste log; the AI only words them. */
  facts: {
    days: number;
    entries: number;
    totalValue: number;
    previousValue: number;
    trend: 'improving' | 'stable' | 'worsening';
    topItems: { name: string; count: number; value: number }[];
    byReason: Record<string, number>;
  };
  insights: string[];
  tip: string;
  /** False when the AI was unavailable and the plain-numbers version is shown. */
  aiUsed: boolean;
}

export interface HealthSummaryResponse {
  facts: {
    days: number;
    glucoseReadings: number;
    avgGlucose: number;
    timeInRangePct: number;
    mealsLogged: number;
    /** Meals that raised glucose the most, from the readings around each meal. */
    biggestRises: { title: string; group: string; rise: number }[];
    /** Meals that kept it steadiest. */
    steadiest: { title: string; group: string; rise: number }[];
  };
  /** Numbers only: no advice, no diagnosis, no medicine. */
  summary: string;
  aiUsed: boolean;
}

/* ---------------------------------------------------------------- rewriting a recipe */

export const REWRITE_GOALS = ['vegan', 'vegetarian', 'gluten-free', 'low-sodium', 'under-500-kcal', 'high-protein'] as const;
export type RewriteGoal = (typeof REWRITE_GOALS)[number];

export interface RewriteRecipeRequest {
  recipeId: string;
  goal: RewriteGoal;
}

export interface RewriteRecipeResponse {
  /** A draft to look over and save as a new recipe; nothing is saved here. */
  draft: {
    title: string;
    ingredients: { name: string; amount: number; unit: string; optional: boolean }[];
    instructions: string[];
    dietaryFlags: string[];
    caloriesPerServing: number;
    protein: number;
  };
  /** Checked by the server where it can be (ingredients for diets, numbers for calories and protein). null: cannot be checked. */
  meetsGoal: boolean | null;
  notes: string[];
}

/* ---------------------------------------------------------------- cooking help */

export interface CookChatRequest {
  recipeId: string;
  /** The step the person is on (0 is the first). */
  stepIndex?: number;
  question: string;
  history?: { role: 'user' | 'assistant'; text: string }[];
}

export interface CookChatResponse {
  answer: string;
}

export interface ChatAssistRequest {
  conversationId: string;
  mode: 'replies' | 'summary';
}

export interface ChatAssistResponse {
  replies?: string[];
  summary?: string;
}

/* ---------------------------------------------------------------- budget and family plans */

export interface PlanBudget {
  amount: number;
  /** "USD", "NGN", "GBP"... */
  currency: string;
}

export interface PlanPerson {
  name: string;
  restrictions: string[];
}

export interface PlanCostEstimate {
  currency: string;
  /** What the shopping list is guessed to cost: an AI estimate, not shop prices. */
  total: number;
  overBudget: boolean;
  priciest: { name: string; cost: number }[];
  note: string;
}

/* ---------------------------------------------------------------- cooking for more or fewer people */

export interface ScaleRecipeRequest {
  /** How many people to cook for. */
  servings: number;
  units?: 'original' | 'metric' | 'us';
  temp?: 'original' | 'c' | 'f';
}

/**
 * Where the numbers came from: cooks who made it at that size, an AI estimate, the typical ratios cooks use for each
 * kind of ingredient (used when the AI is unavailable), or plain multiplication.
 */
export type ScaleSource = 'creator' | 'ai' | 'community' | 'math';

export interface ScaleRecipeResponse {
  recipeId: string;
  /** What the recipe was written for. */
  fromServings: number;
  servings: number;
  /** Plain multiplication factor. The amounts below may differ (salt and spice do not scale in a straight line). */
  factor: number;
  source: ScaleSource;
  ingredients: { name: string; amount: number; unit: string; optional?: boolean }[];
  instructions: string[];
  /** Short practical tips: pan size, batches, seasoning, cooking time. */
  tips: string[];
  /** For example "Add 10 to 15 minutes". Empty when nothing is known. */
  timeNote: string;
  /** How many chefs' notes the answer drew on (0 for plain maths). */
  basedOn: number;
  note: string;
}

export interface ScaleNoteRequest {
  /** The number of people this note is for. */
  servings: number;
  /** What was really used, by ingredient name (names not in the recipe are ignored). */
  amounts: { name: string; amount: number; unit: string }[];
  tip?: string;
  /** Total minutes of cooking at this size, when it changed. */
  cookTimeMin?: number;
  /** The pan, pot or tray size used. */
  panNote?: string;
}

export interface ScaleNote extends ScaleNoteRequest {
  id: string;
  recipeId: string;
  authorId: string;
  createdAt: string;
}
