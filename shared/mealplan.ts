// Weekly meal plans and the food-waste log. Dates are ISO strings; a plan's week is identified by its Monday (YYYY-MM-DD).

export const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
export type MealType = (typeof MEAL_TYPES)[number];

export const SHOPPING_CATEGORIES = [
  'produce',
  'dairy',
  'meat',
  'seafood',
  'grains',
  'spices',
  'condiments',
  'canned',
  'frozen',
  'beverages',
  'bakery',
  'other',
] as const;
export type ShoppingCategory = (typeof SHOPPING_CATEGORIES)[number];

export interface PlannedMeal {
  recipeId: string;
  /** Kept with the plan so it still reads right if the recipe is later renamed or removed. */
  recipeName: string;
  servings: number;
  imageUrl?: string;
  /** Family plans: the names of the people this meal suits. */
  suitableFor?: string[];
}

export interface MealPlanDay {
  /** YYYY-MM-DD */
  date: string;
  breakfast?: PlannedMeal;
  lunch?: PlannedMeal;
  dinner?: PlannedMeal;
  snack?: PlannedMeal;
}

export interface PlanShoppingItem {
  id: string;
  name: string;
  amount: number;
  unit: string;
  category: ShoppingCategory;
  /** Recipe ids that need it. */
  recipes: string[];
  recipeNames: string[];
  inPantry: boolean;
  pantryAmount: number;
  /** Amount to buy after what is already in the pantry. */
  toBuy: number;
  checked: boolean;
}

export interface MealPlanStats {
  pantryItemsUsed: number;
  expiringItemsUsed: number;
  /** Share of ingredients reused across meals, 0 to 100. */
  ingredientOverlap: number;
  estimatedSavings: number;
  /** The two below are always worked out by the server from the days. */
  totalMeals: number;
  uniqueRecipes: number;
}

export interface MealPlan {
  /** Monday of the week, YYYY-MM-DD. */
  weekStart: string;
  /** Always seven days, Monday first. */
  days: MealPlanDay[];
  shoppingList: PlanShoppingItem[];
  stats: MealPlanStats;
  /** True when an AI wrote it rather than the person. */
  isGenerated: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SaveMealPlanRequest {
  days: MealPlanDay[];
  shoppingList?: PlanShoppingItem[];
  stats?: Partial<Omit<MealPlanStats, 'totalMeals' | 'uniqueRecipes'>>;
  isGenerated?: boolean;
}

export interface UpdateShoppingCheckRequest {
  checked: boolean;
}

/* ---------------------------------------------------------------- food waste */

export const WASTE_REASONS = ['expired', 'spoiled', 'leftover', 'overcooked', 'other'] as const;
export type WasteReason = (typeof WASTE_REASONS)[number];

export interface WasteEntry {
  id: string;
  itemName: string;
  amount: number;
  unit: string;
  reason: WasteReason;
  /** What it cost, in the person's own currency. */
  estimatedValue: number;
  notes: string;
  /** When it was thrown away. */
  wastedAt: string;
}

export interface LogWasteRequest {
  itemName: string;
  amount: number;
  unit: string;
  reason: WasteReason;
  estimatedValue: number;
  notes?: string;
  /** ISO date or date-time; defaults to now. */
  wastedAt?: string;
}

export interface WasteStats {
  totalWasted: number;
  /** Last 7 days. */
  wastedThisWeek: number;
  /** Last 30 days. */
  wastedThisMonth: number;
  itemsWastedThisMonth: number;
  /** Up to five, most often thrown away first. */
  topWastedItems: { name: string; count: number }[];
  /** Number of entries per reason. */
  wasteByReason: Record<WasteReason, number>;
  /** The last 30 days against the 30 before: more than 10% either way counts. */
  trendDirection: 'improving' | 'stable' | 'worsening';
  /** Added up from the saving estimates on the person's meal plans. */
  savedByPlanning: number;
}
