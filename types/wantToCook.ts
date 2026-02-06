import { Timestamp } from 'firebase/firestore';
import { Ingredient, NutritionInfo, RecipeCategory, Cuisine, Difficulty } from './index';

// Source types for imported recipes
export type RecipeSource = 'url' | 'video' | 'cookbook_scan' | 'manual' | 'app';

// Status for "Want to Cook" recipes
export type WantToCookStatus = 'saved' | 'planned' | 'shopping' | 'cooked';

// Imported recipe from URL/video
export interface ImportedRecipe {
  id: string;
  title: string;
  description: string;
  imageURL?: string;
  sourceURL: string;
  sourcePlatform?: string; // 'tiktok', 'instagram', 'youtube', 'website', etc.
  ingredients: Ingredient[];
  instructions: string[];
  servings: number;
  prepTime?: number;
  cookTime?: number;
  difficulty?: Difficulty;
  cuisine?: Cuisine;
  category?: RecipeCategory;
  nutrition?: NutritionInfo;
  tags: string[];
  // Extraction metadata
  extractedAt: Timestamp;
  extractionConfidence: number; // 0-1 confidence score
  rawContent?: string; // Original extracted text for debugging
}

// "Want to Cook" item - a recipe the user wants to make
export interface WantToCookItem {
  id: string;
  oderId: string; // User who saved it
  // Can reference an app recipe OR an imported recipe
  recipeId?: string; // Reference to Recipe in recipes collection
  importedRecipe?: ImportedRecipe; // Inline imported recipe data
  // Status tracking
  status: WantToCookStatus;
  savedAt: Timestamp;
  plannedFor?: Timestamp; // When user plans to cook it
  cookedAt?: Timestamp;
  // Pantry matching
  pantryMatchPercent?: number; // 0-100
  matchingIngredients?: string[];
  missingIngredients?: string[];
  // User notes
  notes?: string;
  // Shopping
  addedToShoppingList: boolean;
  shoppingListId?: string;
}

// Quick shopping list item (simplified for Want to Cook feature)
export interface QuickShoppingItem {
  id: string;
  name: string;
  amount: number;
  unit: string;
  category?: string;
  checked: boolean;
  recipeId?: string; // Which recipe this is for
  recipeName?: string;
  addedAt: Timestamp;
}

// Quick shopping list (simplified for Want to Cook feature)
export interface QuickShoppingList {
  id: string;
  userId: string;
  name: string;
  items: QuickShoppingItem[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
  // Linked recipes
  recipeIds: string[];
}

// URL extraction request
export interface URLExtractionRequest {
  url: string;
  includeNutrition?: boolean;
}

// URL extraction response
export interface URLExtractionResponse {
  success: boolean;
  recipe?: ImportedRecipe;
  error?: string;
  confidence: number;
}

// Cookbook scan request
export interface CookbookScanRequest {
  imageUri: string;
  cookbookName?: string;
}

// Cookbook scan response
export interface CookbookScanResponse {
  success: boolean;
  recipe?: ImportedRecipe;
  error?: string;
  confidence: number;
}

// Pantry match result
export interface PantryMatchResult {
  recipeId: string;
  matchPercent: number;
  matchingIngredients: Array<{
    ingredient: string;
    pantryItem: string;
    amountAvailable: number;
    amountNeeded: number;
    unit: string;
  }>;
  missingIngredients: Array<{
    ingredient: string;
    amount: number;
    unit: string;
  }>;
  canMake: boolean;
}

// Cooking reminder
export interface CookingReminder {
  id: string;
  userId: string
  wantToCookItemId: string;
  recipeTitle: string;
  savedDaysAgo: number;
  reminderType: 'nudge' | 'planned' | 'expiring_ingredients';
  message: string;
  dismissed: boolean;
  createdAt: Timestamp;
}
