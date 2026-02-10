import { Timestamp } from 'firebase/firestore';

// User types
export type UserRole = 'user' | 'chef' | 'admin';

export interface User {
  id: string;
  email: string;
  displayName: string;
  photoURL?: string;
  role: UserRole;
  subscriptionTier?: 'free' | 'premium' | 'pro';
  createdAt: Timestamp;
  savedRecipes?: string[];
  savedCookbooks?: string[];
  dietaryPreferences?: string[];
  allergies?: string[];
}

// Recipe types
export type Difficulty = 'easy' | 'medium' | 'hard';

export type RecipeCategory =
  | 'breakfast'
  | 'lunch'
  | 'dinner'
  | 'dessert'
  | 'snack'
  | 'appetizer'
  | 'beverage'
  | 'side';

export type Cuisine =
  | 'american'
  | 'italian'
  | 'mexican'
  | 'chinese'
  | 'japanese'
  | 'indian'
  | 'thai'
  | 'french'
  | 'mediterranean'
  | 'korean'
  | 'vietnamese'
  | 'other';

export interface Ingredient {
  name: string;
  amount: number;
  unit: string;
  calories: number;
  optional: boolean;
}

export interface NutritionInfo {
  caloriesPerServing: number;
  totalCalories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
}

export interface Recipe {
  id: string;
  title: string;
  description: string;
  imageURL: string;
  youtubeURL?: string;
  authorId: string;
  authorName: string;
  isOfficial: boolean;
  isExclusive?: boolean; // Pro-only exclusive recipes
  category: RecipeCategory;
  cuisine: Cuisine;
  difficulty: Difficulty;
  prepTime: number;
  cookTime: number;
  servings: number;
  ingredients: Ingredient[];
  instructions: string[];
  nutrition: NutritionInfo;
  tags: string[];
  likes: number;
  views?: number; // View count for analytics
  saveCount?: number; // Save count for analytics
  rating?: number; // Average rating
  createdAt: Timestamp;
}

// Pantry types
export type PantryCategory =
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
  | 'other';

export interface PantryItem {
  id: string;
  name: string;
  amount: number;
  unit: string;
  category: PantryCategory;
  expiryDate?: Timestamp;
  addedAt: Timestamp;
}

// AI types
export interface SubstitutionSuggestion {
  originalIngredient: string;
  substitute: string;
  ratio: string;
  notes: string;
  impactOnTaste: 'minimal' | 'moderate' | 'significant';
}

export interface AISubstitutionResult {
  canMake: boolean;
  confidenceScore: number;
  missingIngredients: string[];
  availableIngredients: string[];
  substitutions: SubstitutionSuggestion[];
  modifiedInstructions?: string[];
  tips: string[];
}

export interface PortionAnalysis {
  detectedItems: DetectedItem[];
  suggestedServings: number;
  totalEstimatedCalories: number;
  recommendations: string[];
}

export interface DetectedItem {
  name: string;
  estimatedAmount: number;
  unit: string;
  confidence: number;
  estimatedCalories: number;
}

// Form types
export interface RecipeFormData {
  title: string;
  description: string;
  youtubeURL?: string;
  category: RecipeCategory;
  cuisine: Cuisine;
  difficulty: Difficulty;
  prepTime: number;
  cookTime: number;
  servings: number;
  ingredients: Omit<Ingredient, 'calories'>[];
  instructions: string[];
  tags: string[];
}

export interface LoginFormData {
  email: string;
  password: string;
}

export interface RegisterFormData {
  email: string;
  password: string;
  confirmPassword: string;
  displayName: string;
}

export interface PantryItemFormData {
  name: string;
  amount: number;
  unit: string;
  category: PantryCategory;
  expiryDate?: Date;
}

// Filter types
export interface RecipeFilters {
  category?: RecipeCategory;
  cuisine?: Cuisine;
  difficulty?: Difficulty;
  maxCalories?: number;
  maxPrepTime?: number;
  isOfficial?: boolean;
  searchQuery?: string;
}

// Navigation types
export type TabParamList = {
  index: undefined;
  browse: undefined;
  upload: undefined;
  pantry: undefined;
  mealplan: undefined;
  profile: undefined;
};

// Cookbook types
export interface Cookbook {
  id: string;
  title: string;
  description: string;
  coverImageURL: string;
  recipeIds: string[];
  category?: string;
  likes: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Re-export subscription types
export * from './subscription';

// Re-export voice types
export * from './voice';

// Re-export meal plan types
export * from './mealplan';

// Re-export want to cook types
export * from './wantToCook';

// Re-export ad types
export * from './ads';
