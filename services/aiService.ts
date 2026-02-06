import {
  analyzeIngredientSubstitutions,
  analyzePortionFromImage,
  getCookingTips,
  generateRecipeFromImage,
} from '@/lib/gemini';
import { AISubstitutionResult, Ingredient, PortionAnalysis, Recipe } from '@/types';
import { getPantryItemNames } from './pantryService';

// Analyze what can be made with available ingredients
export const analyzeRecipeWithPantry = async (
  recipe: Recipe,
  userId: string
): Promise<AISubstitutionResult> => {
  // Get user's pantry items
  const pantryItems = await getPantryItemNames(userId);

  // Analyze with AI
  return analyzeIngredientSubstitutions(recipe.ingredients, pantryItems);
};

// Analyze recipe with manually provided ingredients
export const analyzeRecipeWithIngredients = async (
  recipe: Recipe,
  availableIngredients: string[]
): Promise<AISubstitutionResult> => {
  return analyzeIngredientSubstitutions(recipe.ingredients, availableIngredients);
};

// Analyze portion size from camera image
export const analyzePortionImage = async (
  imageUri: string,
  targetRecipe?: Recipe
): Promise<PortionAnalysis> => {
  return analyzePortionFromImage(imageUri, targetRecipe?.ingredients);
};

// Get AI cooking tips for a recipe
export const getRecipeTips = async (recipe: Recipe): Promise<string[]> => {
  return getCookingTips(recipe.title, recipe.difficulty, recipe.ingredients);
};

// Generate a recipe suggestion from a food image
export const generateRecipeFromFoodImage = async (
  imageUri: string
): Promise<{
  title: string;
  ingredients: string[];
  instructions: string[];
  cuisine: string;
  estimatedTime: number;
}> => {
  return generateRecipeFromImage(imageUri);
};

// Calculate match percentage between available ingredients and recipe
export const calculateIngredientMatch = (
  recipeIngredients: Ingredient[],
  availableIngredients: string[]
): {
  matchPercentage: number;
  matchedIngredients: string[];
  missingIngredients: string[];
} => {
  const normalizedAvailable = availableIngredients.map((i) => i.toLowerCase());
  const requiredIngredients = recipeIngredients.filter((i) => !i.optional);

  const matched: string[] = [];
  const missing: string[] = [];

  requiredIngredients.forEach((ingredient) => {
    const ingredientName = ingredient.name.toLowerCase();
    const isMatched = normalizedAvailable.some(
      (available) =>
        available.includes(ingredientName) || ingredientName.includes(available)
    );

    if (isMatched) {
      matched.push(ingredient.name);
    } else {
      missing.push(ingredient.name);
    }
  });

  const matchPercentage =
    requiredIngredients.length > 0
      ? (matched.length / requiredIngredients.length) * 100
      : 0;

  return {
    matchPercentage: Math.round(matchPercentage),
    matchedIngredients: matched,
    missingIngredients: missing,
  };
};

// Get substitution suggestions for a specific ingredient
export const getIngredientSubstitution = async (
  ingredientName: string,
  availableIngredients: string[]
): Promise<AISubstitutionResult> => {
  const mockIngredient: Ingredient = {
    name: ingredientName,
    amount: 1,
    unit: 'unit',
    calories: 0,
    optional: false,
  };

  return analyzeIngredientSubstitutions([mockIngredient], availableIngredients);
};

// Batch analyze multiple recipes against pantry
export const batchAnalyzeRecipes = async (
  recipes: Recipe[],
  userId: string
): Promise<Map<string, { canMake: boolean; matchPercentage: number }>> => {
  const pantryItems = await getPantryItemNames(userId);
  const results = new Map<string, { canMake: boolean; matchPercentage: number }>();

  for (const recipe of recipes) {
    const match = calculateIngredientMatch(recipe.ingredients, pantryItems);
    results.set(recipe.id, {
      canMake: match.matchPercentage >= 70, // Consider makeable if 70%+ ingredients available
      matchPercentage: match.matchPercentage,
    });
  }

  return results;
};

// Suggest recipes based on expiring ingredients
export const suggestRecipesForExpiringIngredients = async (
  expiringIngredients: string[],
  allRecipes: Recipe[]
): Promise<Recipe[]> => {
  const normalizedExpiring = expiringIngredients.map((i) => i.toLowerCase());

  // Score recipes based on how many expiring ingredients they use
  const scored = allRecipes.map((recipe) => {
    const recipeIngredients = recipe.ingredients.map((i) => i.name.toLowerCase());
    const expiringUsed = normalizedExpiring.filter((exp) =>
      recipeIngredients.some((ri) => ri.includes(exp) || exp.includes(ri))
    ).length;

    return { recipe, score: expiringUsed };
  });

  // Sort by score and return top matches
  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)
    .map((s) => s.recipe);
};
