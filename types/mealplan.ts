import { Timestamp } from 'firebase/firestore';

// Meal types
export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

// Planned meal in a day
export interface PlannedMeal {
  recipeId: string;
  recipeName: string;
  servings: number;
  imageURL?: string;
}

// Single day's meal plan
export interface MealPlanDay {
  date: string; // ISO date string (YYYY-MM-DD)
  breakfast?: PlannedMeal;
  lunch?: PlannedMeal;
  dinner?: PlannedMeal;
  snack?: PlannedMeal;
}

// Shopping list item
export interface ShoppingListItem {
  id: string;
  name: string;
  amount: number;
  unit: string;
  category: ShoppingCategory;
  recipes: string[]; // Recipe IDs that need this ingredient
  recipeNames: string[]; // Recipe names for display
  inPantry: boolean;
  pantryAmount: number;
  toBuy: number; // Amount needed after pantry deduction
  checked: boolean;
}

// Shopping list categories (for grouping in store)
export type ShoppingCategory =
  | 'produce'
  | 'dairy'
  | 'meat'
  | 'seafood'
  | 'grains'
  | 'spices'
  | 'condiments'
  | 'canned'
  | 'frozen'
  | 'beverages'
  | 'bakery'
  | 'other';

// Meal plan statistics
export interface MealPlanStats {
  pantryItemsUsed: number;
  expiringItemsUsed: number;
  ingredientOverlap: number; // Percentage of ingredients reused across meals
  estimatedSavings: number; // Estimated $ saved from waste reduction
  totalMeals: number;
  uniqueRecipes: number;
}

// Weekly meal plan (stored in Firestore)
export interface WeeklyMealPlan {
  id: string;
  userId: string;
  weekStartDate: string; // ISO date string (Monday of the week)
  days: MealPlanDay[];
  shoppingList: ShoppingListItem[];
  stats: MealPlanStats;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  isGenerated: boolean; // Was this AI-generated or manually created
}

// Food waste tracking
export type WasteReason = 'expired' | 'spoiled' | 'leftover' | 'overcooked' | 'other';

export interface FoodWasteEntry {
  id: string;
  userId: string;
  itemName: string;
  amount: number;
  unit: string;
  reason: WasteReason;
  date: Timestamp;
  estimatedValue: number; // Estimated $ value of wasted food
  notes?: string;
}

// Aggregated waste statistics
export interface WasteStats {
  totalWasted: number; // Total $ wasted all-time
  wastedThisWeek: number;
  wastedThisMonth: number;
  itemsWastedThisMonth: number;
  topWastedItems: Array<{ name: string; count: number }>;
  wasteByReason: Record<WasteReason, number>;
  trendDirection: 'improving' | 'stable' | 'worsening';
  savedByPlanning: number; // Estimated $ saved by using meal planning
}

// Meal plan generation preferences
export interface MealPlanPreferences {
  servingsPerMeal: number;
  mealsToInclude: MealType[];
  daysToGenerate: number;
  dietaryRestrictions: string[];
  cuisinePreferences: string[];
  maxPrepTime?: number; // Max prep time in minutes
  maxCookTime?: number; // Max cook time in minutes
  prioritizeExpiring: boolean;
  maximizeOverlap: boolean; // Maximize ingredient reuse
  budgetFriendly: boolean;
}

// Default meal plan preferences
export const DEFAULT_MEAL_PLAN_PREFERENCES: MealPlanPreferences = {
  servingsPerMeal: 2,
  mealsToInclude: ['breakfast', 'lunch', 'dinner'],
  daysToGenerate: 7,
  dietaryRestrictions: [],
  cuisinePreferences: [],
  prioritizeExpiring: true,
  maximizeOverlap: true,
  budgetFriendly: false,
};

// Meal plan generation request
export interface MealPlanGenerationRequest {
  preferences: MealPlanPreferences;
  availableRecipeIds?: string[]; // Optional: specific recipes to choose from
  excludeRecipeIds?: string[]; // Optional: recipes to exclude
}

// AI-generated meal plan response
export interface MealPlanAIResponse {
  plan: MealPlanDay[];
  shoppingList: Omit<ShoppingListItem, 'id' | 'checked'>[];
  stats: MealPlanStats;
  notes: string[]; // AI suggestions/notes about the plan
  optimizationInsights: string[]; // e.g., "Using chicken in 3 meals this week"
}

// Form data for logging waste
export interface WasteEntryFormData {
  itemName: string;
  amount: number;
  unit: string;
  reason: WasteReason;
  estimatedValue: number;
  notes?: string;
}

// Meal plan store state
export interface MealPlanStoreState {
  currentPlan: WeeklyMealPlan | null;
  isLoading: boolean;
  isGenerating: boolean;
  error: string | null;
  wasteLog: FoodWasteEntry[];
  wasteStats: WasteStats | null;
}

// Ingredient overlap info for display
export interface IngredientOverlapInfo {
  ingredientName: string;
  usedInRecipes: string[];
  totalAmount: number;
  unit: string;
}

// Day summary for quick display
export interface DaySummary {
  date: string;
  dayName: string;
  mealsPlanned: number;
  totalCalories: number;
  expiringIngredientsUsed: string[];
}

// Waste reason display names
export const WASTE_REASON_LABELS: Record<WasteReason, string> = {
  expired: 'Expired',
  spoiled: 'Spoiled',
  leftover: 'Leftover',
  overcooked: 'Overcooked/Burned',
  other: 'Other',
};

// Shopping category labels
export const SHOPPING_CATEGORY_LABELS: Record<ShoppingCategory, string> = {
  produce: 'Produce',
  dairy: 'Dairy & Eggs',
  meat: 'Meat & Poultry',
  seafood: 'Seafood',
  grains: 'Grains & Bread',
  spices: 'Spices & Seasonings',
  condiments: 'Condiments & Sauces',
  canned: 'Canned & Packaged',
  frozen: 'Frozen Foods',
  beverages: 'Beverages',
  bakery: 'Bakery',
  other: 'Other',
};

// Shopping category order for display
export const SHOPPING_CATEGORY_ORDER: ShoppingCategory[] = [
  'produce',
  'dairy',
  'meat',
  'seafood',
  'bakery',
  'grains',
  'canned',
  'frozen',
  'condiments',
  'spices',
  'beverages',
  'other',
];
