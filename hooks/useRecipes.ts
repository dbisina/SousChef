import { useEffect, useCallback, useState, useMemo } from 'react';
import { useRecipeStore } from '@/stores/recipeStore';
import { useSubscriptionStore } from '@/stores/subscriptionStore';
import { Recipe, RecipeFilters, RecipeFormData } from '@/types';
import { useAuth } from './useAuth';

// Main hook for recipes
export const useRecipes = () => {
  const {
    recipes: rawRecipes,
    currentRecipe,
    isLoading,
    error,
    hasMore,
    filters,
    setFilters,
    clearFilters,
    fetchRecipes,
    fetchRecipeById,
    fetchUserRecipes,
    createRecipe,
    updateRecipe,
    deleteRecipe,
    likeRecipe,
    unlikeRecipe,
    saveRecipe,
    unsaveRecipe,
    searchRecipes,
  } = useRecipeStore();

  const { user, isChef } = useAuth();
  const { isPro } = useSubscriptionStore();

  // Filter out exclusive recipes for non-Pro users
  const recipes = useMemo(() => {
    if (isPro) return rawRecipes;
    return rawRecipes.filter((recipe) => !recipe.isExclusive);
  }, [rawRecipes, isPro]);

  // Load recipes on mount
  useEffect(() => {
    fetchRecipes(true);
  }, []);

  // Apply filters
  const applyFilters = useCallback(
    (newFilters: RecipeFilters) => {
      setFilters(newFilters);
      fetchRecipes(true);
    },
    [setFilters, fetchRecipes]
  );

  // Load more recipes (pagination)
  const loadMore = useCallback(() => {
    if (!isLoading && hasMore) {
      fetchRecipes(false);
    }
  }, [isLoading, hasMore, fetchRecipes]);

  // Refresh recipes
  const refresh = useCallback(() => {
    fetchRecipes(true);
  }, [fetchRecipes]);

  // Check if recipe is saved by current user
  const isRecipeSaved = useCallback(
    (recipeId: string) => {
      return user?.savedRecipes?.includes(recipeId) || false;
    },
    [user]
  );

  // Toggle save/unsave
  const toggleSave = useCallback(
    async (recipeId: string) => {
      if (!user) return;
      if (isRecipeSaved(recipeId)) {
        await unsaveRecipe(recipeId, user.id);
      } else {
        await saveRecipe(recipeId, user.id);
      }
    },
    [user, isRecipeSaved, saveRecipe, unsaveRecipe]
  );

  // Toggle like/unlike
  const toggleLike = useCallback(
    async (recipeId: string) => {
      if (!user) return;
      // For simplicity, we'll just increment/decrement
      // In production, you'd track which users liked each recipe
      await likeRecipe(recipeId, user.id);
    },
    [user, likeRecipe]
  );

  return {
    recipes,
    currentRecipe,
    isLoading,
    error,
    hasMore,
    filters,
    applyFilters,
    clearFilters,
    loadMore,
    refresh,
    fetchRecipeById,
    createRecipe: async (data: RecipeFormData, imageURL: string) => {
      if (!user) throw new Error('Must be logged in');
      return createRecipe(data, imageURL, user.id, user.displayName, isChef);
    },
    updateRecipe,
    deleteRecipe,
    toggleSave,
    toggleLike,
    isRecipeSaved,
    searchRecipes,
  };
};

// Hook for a single recipe
export const useRecipe = (recipeId: string) => {
  const { currentRecipe, isLoading, error, fetchRecipeById } = useRecipeStore();

  useEffect(() => {
    if (recipeId) {
      fetchRecipeById(recipeId);
    }
  }, [recipeId]);

  return {
    recipe: currentRecipe,
    isLoading,
    error,
    refetch: () => fetchRecipeById(recipeId),
  };
};

// Hook for user's own recipes
export const useMyRecipes = () => {
  const { fetchUserRecipes } = useRecipeStore();
  const { user } = useAuth();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (user) {
      setIsLoading(true);
      fetchUserRecipes(user.id)
        .then(setRecipes)
        .finally(() => setIsLoading(false));
    }
  }, [user]);

  return { recipes, isLoading };
};

// Hook for official/chef recipes only
export const useOfficialRecipes = () => {
  const { recipes, isLoading, error, applyFilters } = useRecipes();

  useEffect(() => {
    applyFilters({ isOfficial: true });
  }, []);

  return {
    recipes: recipes.filter((r) => r.isOfficial),
    isLoading,
    error,
  };
};

// Hook for recipe search
export const useRecipeSearch = () => {
  const { searchRecipes } = useRecipeStore();
  const { isPro } = useSubscriptionStore();
  const [results, setResults] = useState<Recipe[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [query, setQuery] = useState('');

  const search = useCallback(async (searchQuery: string) => {
    setQuery(searchQuery);
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const searchResults = await searchRecipes(searchQuery);
      // Filter out exclusive recipes for non-Pro users
      const filteredResults = isPro
        ? searchResults
        : searchResults.filter((r) => !r.isExclusive);
      setResults(filteredResults);
    } finally {
      setIsSearching(false);
    }
  }, [searchRecipes, isPro]);

  const clear = useCallback(() => {
    setQuery('');
    setResults([]);
  }, []);

  return {
    results,
    isSearching,
    query,
    search,
    clear,
  };
};
