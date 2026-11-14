// Recipes as the API sends and receives them. Dates are ISO strings.

export const RECIPE_CATEGORIES = ['breakfast', 'lunch', 'dinner', 'dessert', 'snack', 'appetizer', 'beverage', 'side'] as const;
export type RecipeCategory = (typeof RECIPE_CATEGORIES)[number];

export const CUISINES = [
  'american',
  'italian',
  'mexican',
  'chinese',
  'japanese',
  'indian',
  'thai',
  'french',
  'mediterranean',
  'korean',
  'vietnamese',
  'nigerian',
  'west-african',
  'african',
  'other',
] as const;
export type Cuisine = (typeof CUISINES)[number];

export const DIFFICULTIES = ['easy', 'medium', 'hard'] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export type RecipeStatus = 'draft' | 'published' | 'flagged';

export interface RecipeIngredient {
  name: string;
  amount: number;
  unit: string;
  /** Worked out by the server from the amount and unit. */
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

export interface RecipeAuthor {
  id: string;
  handle: string;
  displayName: string;
  photoUrl: string | null;
  isChef: boolean;
  isVerifiedChef: boolean;
  kind: 'person' | 'house';
}

/** What a list shows: no ingredients or steps, so a page of them stays small. */
export interface RecipeSummary {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  author: RecipeAuthor;
  isOfficial: boolean;
  isExclusive: boolean;
  category: RecipeCategory;
  cuisine: Cuisine;
  difficulty: Difficulty;
  prepTime: number;
  cookTime: number;
  servings: number;
  caloriesPerServing: number;
  tags: string[];
  dietaryFlags: string[];
  allergens: string[];
  likeCount: number;
  saveCount: number;
  commentCount: number;
  /** Average of 1 to 5, or null when nobody has rated it. */
  rating: number | null;
  ratingCount: number;
  createdAt: string;
}

export interface Recipe extends RecipeSummary {
  status: RecipeStatus;
  youtubeUrl: string | null;
  ingredients: RecipeIngredient[];
  instructions: string[];
  nutrition: NutritionInfo;
  updatedAt: string;
  /** What the signed-in person has done with it; null when nobody is signed in. */
  viewer: { liked: boolean; saved: boolean; myRating: number | null } | null;
}

export interface RecipeIngredientInput {
  name: string;
  amount: number;
  unit: string;
  optional?: boolean;
}

export interface CreateRecipeRequest {
  title: string;
  description: string;
  imageUrl: string;
  youtubeUrl?: string;
  category: RecipeCategory;
  cuisine: Cuisine;
  difficulty: Difficulty;
  prepTime: number;
  cookTime: number;
  servings: number;
  ingredients: RecipeIngredientInput[];
  instructions: string[];
  tags?: string[];
  dietaryFlags?: string[];
  allergens?: string[];
  /** `draft` is only visible to the author. Default `published`. */
  status?: 'draft' | 'published';
  /** Admin only. */
  isOfficial?: boolean;
  /** Admin only. */
  isExclusive?: boolean;
}

export type UpdateRecipeRequest = Partial<Omit<CreateRecipeRequest, 'youtubeUrl'>> & { youtubeUrl?: string | null };

export type RecipeSort = 'new' | 'popular';

export interface Page<T> {
  items: T[];
  /** Pass back as `cursor` for the next page; null on the last page. */
  nextCursor: string | null;
}

export interface RecipeMatch {
  recipe: RecipeSummary;
  /** Share of the recipe's ingredients the person already has, 0 to 100. */
  matchPercent: number;
  missing: string[];
}

export interface MatchRecipesRequest {
  ingredients: string[];
  limit?: number;
}

export interface RecipeComment {
  id: string;
  recipeId: string;
  author: RecipeAuthor;
  text: string;
  createdAt: string;
}

export interface CreateCommentRequest {
  text: string;
}

export interface RateRecipeRequest {
  rating: number;
  review?: string;
}

export interface RateRecipeResponse {
  rating: number | null;
  ratingCount: number;
}

export interface MadePost {
  id: string;
  recipeId: string;
  author: RecipeAuthor;
  imageUrl: string;
  caption: string;
  createdAt: string;
}

export interface CreateMadePostRequest {
  imageUrl: string;
  caption?: string;
}

export interface FlagRecipeRequest {
  reason: string;
}

/** The new counts after a like, save, unlike or unsave. */
export interface ToggleResponse {
  active: boolean;
  count: number;
}
