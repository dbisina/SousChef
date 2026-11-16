import { useState, useCallback } from 'react';
import {
  analyzeRecipeWithPantry,
  analyzeRecipeWithIngredients,
  analyzePortionImage,
  getRecipeTips,
  generateRecipeFromFoodImage,
  calculateIngredientMatch,
} from '@/services/aiService';
import { AISubstitutionResult, PortionAnalysis, Recipe, Ingredient } from '@/types';
import { FeatureCheckResult } from '@/types/subscription';
import { useAuth } from './useAuth';
import { useSubscription } from './useSubscription';

// Hook for AI ingredient substitution
export const useIngredientSubstitution = () => {
  const { user } = useAuth();
  const { checkAIAccess, recordAIUsage } = useSubscription();
  const [result, setResult] = useState<AISubstitutionResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accessDenied, setAccessDenied] = useState<FeatureCheckResult | null>(null);

  // Check access before analyzing
  const checkAccess = useCallback(async (): Promise<boolean> => {
    const access = await checkAIAccess();
    if (!access.allowed) {
      setAccessDenied(access);
      return false;
    }
    setAccessDenied(null);
    return true;
  }, [checkAIAccess]);

  // Analyze with user's pantry
  const analyzeWithPantry = useCallback(
    async (recipe: Recipe) => {
      if (!user) {
        setError('Please log in to use this feature');
        return null;
      }

      // Check subscription access
      const hasAccess = await checkAccess();
      if (!hasAccess) {
        return null;
      }

      setIsAnalyzing(true);
      setError(null);

      try {
        const analysisResult = await analyzeRecipeWithPantry(recipe, user.id);
        setResult(analysisResult);
        // Record usage after successful analysis
        await recordAIUsage();
        return analysisResult;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to analyze recipe';
        setError(message);
        return null;
      } finally {
        setIsAnalyzing(false);
      }
    },
    [user, checkAccess, recordAIUsage]
  );

  // Analyze with custom ingredient list
  const analyzeWithIngredients = useCallback(
    async (recipe: Recipe, ingredients: string[]) => {
      // Check subscription access
      const hasAccess = await checkAccess();
      if (!hasAccess) {
        return null;
      }

      setIsAnalyzing(true);
      setError(null);

      try {
        const analysisResult = await analyzeRecipeWithIngredients(recipe, ingredients);
        setResult(analysisResult);
        // Record usage after successful analysis
        await recordAIUsage();
        return analysisResult;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to analyze recipe';
        setError(message);
        return null;
      } finally {
        setIsAnalyzing(false);
      }
    },
    [checkAccess, recordAIUsage]
  );

  // Clear results
  const clear = useCallback(() => {
    setResult(null);
    setError(null);
    setAccessDenied(null);
  }, []);

  return {
    result,
    isAnalyzing,
    error,
    accessDenied,
    analyzeWithPantry,
    analyzeWithIngredients,
    checkAccess,
    clear,
  };
};

// Hook for portion analysis from camera
export const usePortionAnalysis = () => {
  const { checkPortionAccess, recordPortionUsage } = useSubscription();
  const [result, setResult] = useState<PortionAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accessDenied, setAccessDenied] = useState<FeatureCheckResult | null>(null);

  // Check access before analyzing
  const checkAccess = useCallback(async (): Promise<boolean> => {
    const access = await checkPortionAccess();
    if (!access.allowed) {
      setAccessDenied(access);
      return false;
    }
    setAccessDenied(null);
    return true;
  }, [checkPortionAccess]);

  const analyzeImage = useCallback(async (imageUri: string, targetRecipe?: Recipe, ingredientHints?: string[]) => {
    // Check subscription access
    const hasAccess = await checkAccess();
    if (!hasAccess) {
      return null;
    }

    setIsAnalyzing(true);
    setError(null);

    try {
      const analysisResult = await analyzePortionImage(imageUri, targetRecipe, ingredientHints);
      setResult(analysisResult);
      // Record usage after successful analysis
      await recordPortionUsage();
      return analysisResult;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to analyze image';
      setError(message);
      return null;
    } finally {
      setIsAnalyzing(false);
    }
  }, [checkAccess, recordPortionUsage]);

  const clear = useCallback(() => {
    setResult(null);
    setError(null);
    setAccessDenied(null);
  }, []);

  return {
    result,
    isAnalyzing,
    error,
    accessDenied,
    analyzeImage,
    checkAccess,
    clear,
  };
};

// Hook for cooking tips
export const useCookingTips = () => {
  const [tips, setTips] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTips = useCallback(async (recipe: Recipe) => {
    setIsLoading(true);
    setError(null);

    try {
      const recipeTips = await getRecipeTips(recipe);
      setTips(recipeTips);
      return recipeTips;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to get tips';
      setError(message);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    tips,
    isLoading,
    error,
    fetchTips,
  };
};

// Hook for generating recipe from image
export const useRecipeFromImage = () => {
  const [generatedRecipe, setGeneratedRecipe] = useState<{
    title: string;
    ingredients: string[];
    instructions: string[];
    cuisine: string;
    estimatedTime: number;
  } | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateRecipe = useCallback(async (imageUri: string) => {
    setIsGenerating(true);
    setError(null);

    try {
      const recipe = await generateRecipeFromFoodImage(imageUri);
      setGeneratedRecipe(recipe);
      return recipe;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to generate recipe';
      setError(message);
      return null;
    } finally {
      setIsGenerating(false);
    }
  }, []);

  const clear = useCallback(() => {
    setGeneratedRecipe(null);
    setError(null);
  }, []);

  return {
    generatedRecipe,
    isGenerating,
    error,
    generateRecipe,
    clear,
  };
};

// Hook for quick ingredient match check (no AI, just local comparison)
export const useIngredientMatch = (recipeIngredients: Ingredient[]) => {
  const [availableIngredients, setAvailableIngredients] = useState<string[]>([]);

  const match = calculateIngredientMatch(recipeIngredients, availableIngredients);

  const addIngredient = useCallback((ingredient: string) => {
    setAvailableIngredients((prev) => [...prev, ingredient]);
  }, []);

  const removeIngredient = useCallback((ingredient: string) => {
    setAvailableIngredients((prev) => prev.filter((i) => i !== ingredient));
  }, []);

  const setIngredients = useCallback((ingredients: string[]) => {
    setAvailableIngredients(ingredients);
  }, []);

  const clear = useCallback(() => {
    setAvailableIngredients([]);
  }, []);

  return {
    availableIngredients,
    matchPercentage: match.matchPercentage,
    matchedIngredients: match.matchedIngredients,
    missingIngredients: match.missingIngredients,
    addIngredient,
    removeIngredient,
    setIngredients,
    clear,
  };
};
