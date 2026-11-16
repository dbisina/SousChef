// A person's kitchen: pantry, recipes they want to cook, and the shopping list. Dates are ISO strings.
import type { Cuisine, Difficulty, RecipeCategory, RecipeSummary } from './recipe';

export const PANTRY_CATEGORIES = [
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
  'other',
] as const;
export type PantryCategory = (typeof PANTRY_CATEGORIES)[number];

export interface PantryItem {
  id: string;
  name: string;
  amount: number;
  unit: string;
  category: PantryCategory;
  expiresAt: string | null;
  createdAt: string;
}

export interface PantryItemInput {
  name: string;
  amount: number;
  unit: string;
  category: PantryCategory;
  /** ISO date or date-time. */
  expiresAt?: string;
}

export type UpdatePantryItemRequest = Partial<Omit<PantryItemInput, 'expiresAt'>> & { expiresAt?: string | null };

export interface BulkAddPantryRequest {
  items: PantryItemInput[];
}

export interface UsePantryItemRequest {
  /** How much was used. The item is removed when nothing is left. */
  amount: number;
}

/** `expiring` = expires within 3 days, `expired` = already past. */
export type PantryFilter = 'expiring' | 'expired';

export type PantrySummary = Record<PantryCategory, number>;

/* ---------------------------------------------------------------- want to cook */

export type WantToCookStatus = 'saved' | 'planned' | 'shopping' | 'cooked';

export interface ImportedIngredient {
  name: string;
  amount: number;
  unit: string;
  optional?: boolean;
}

/** A recipe the person brought in from a link, video or photo. Lives inside their want-to-cook item. */
export interface ImportedRecipe {
  title: string;
  description: string;
  imageUrl?: string;
  videoUrl?: string;
  sourceUrl: string;
  /** 'tiktok', 'instagram', 'youtube', 'website', ... */
  sourcePlatform?: string;
  ingredients: ImportedIngredient[];
  instructions: string[];
  servings: number;
  prepTime?: number;
  cookTime?: number;
  difficulty?: Difficulty;
  cuisine?: Cuisine;
  category?: RecipeCategory;
  tags: string[];
  /** 0 to 1: how sure the import was. */
  extractionConfidence: number;
}

/** How much of a recipe the pantry covers. Names only: amounts and units rarely line up between a pantry and a recipe. */
export interface PantryMatch {
  /** 0 to 100, of the required ingredients. */
  matchPercent: number;
  matching: string[];
  missing: string[];
  canMake: boolean;
}

export interface WantToCookItem {
  id: string;
  status: WantToCookStatus;
  savedAt: string;
  plannedFor: string | null;
  cookedAt: string | null;
  notes: string;
  /** One of these two is set. */
  recipe: RecipeSummary | null;
  imported: ImportedRecipe | null;
  pantryMatch: PantryMatch;
}

export type AddWantToCookRequest = { recipeId: string } | { imported: ImportedRecipe };

export interface UpdateWantToCookRequest {
  status?: WantToCookStatus;
  plannedFor?: string | null;
  notes?: string;
}

/* ---------------------------------------------------------------- shopping list */

export interface ShoppingItem {
  id: string;
  name: string;
  amount: number;
  unit: string;
  category: string | null;
  checked: boolean;
  recipeId: string | null;
  recipeTitle: string | null;
  createdAt: string;
}

export interface ShoppingItemInput {
  name: string;
  amount: number;
  unit: string;
  category?: string;
  recipeId?: string;
  recipeTitle?: string;
}

export interface AddShoppingItemsRequest {
  items: ShoppingItemInput[];
}

export interface UpdateShoppingItemRequest {
  name?: string;
  amount?: number;
  unit?: string;
  checked?: boolean;
}
