import { useEffect, useCallback, useState } from 'react';
import { useMealPlanStore } from '@/stores/mealPlanStore';
import { useAuthStore } from '@/stores/authStore';
import { usePantryStore } from '@/stores/pantryStore';
import { useRecipeStore } from '@/stores/recipeStore';
import { useSubscriptionStore } from '@/stores/subscriptionStore';
import {
  MealPlanPreferences,
  MealType,
  PlannedMeal,
  ShoppingListItem,
  WasteEntryFormData,
  SHOPPING_CATEGORY_ORDER,
} from '@/types/mealplan';
import {
  canUseMealPlanGeneration,
  canViewMealPlans,
  canUseWasteTracking,
} from '@/services/subscriptionService';
import { FeatureCheckResult } from '@/types/subscription';

// Main meal plan hook
export const useMealPlan = () => {
  const { user } = useAuthStore();
  const { subscriptionTier } = useSubscriptionStore();
  const { items: pantryItems, getExpiringItems, getExpiredItems } = usePantryStore();
  const { recipes } = useRecipeStore();

  const {
    currentPlan,
    isLoading,
    isGenerating,
    error,
    preferences,
    selectedWeekStart,
    fetchCurrentPlan,
    fetchPlanByWeek,
    generatePlan,
    savePlan,
    clearPlan,
    addMealToPlan,
    removeMealFromPlan,
    setPreferences,
    setSelectedWeek,
    setError,
  } = useMealPlanStore();

  const [canView, setCanView] = useState(false);
  const [canGenerate, setCanGenerate] = useState<FeatureCheckResult>({
    allowed: false,
  });

  // Check access on mount and tier change
  useEffect(() => {
    const checkAccess = async () => {
      setCanView(canViewMealPlans(subscriptionTier));
      const genResult = await canUseMealPlanGeneration(subscriptionTier);
      setCanGenerate(genResult);
    };
    checkAccess();
  }, [subscriptionTier]);

  // Fetch current plan on mount
  useEffect(() => {
    if (user && canView) {
      fetchCurrentPlan(user.id);
    }
  }, [user?.id, canView]);

  // Generate meal plan
  const generate = useCallback(async () => {
    if (!user) {
      setError('Please log in to generate a meal plan');
      return;
    }

    if (!canGenerate.allowed) {
      setError('Upgrade to Pro to generate meal plans');
      return;
    }

    const expiringItems = [...getExpiringItems(), ...getExpiredItems()];
    await generatePlan(user.id, recipes, pantryItems, expiringItems);
  }, [user, canGenerate, recipes, pantryItems, getExpiringItems, getExpiredItems]);

  // Save current plan
  const save = useCallback(async () => {
    if (!user) return;
    await savePlan(user.id);
  }, [user]);

  // Clear current plan
  const clear = useCallback(async () => {
    if (!user) return;
    await clearPlan(user.id);
  }, [user]);

  // Navigate to a different week
  const goToWeek = useCallback(
    async (weekStart: string) => {
      if (!user) return;
      await fetchPlanByWeek(user.id, weekStart);
    },
    [user]
  );

  // Add a meal
  const addMeal = useCallback(
    (date: string, mealType: MealType, meal: PlannedMeal) => {
      addMealToPlan(date, mealType, meal);
    },
    []
  );

  // Remove a meal
  const removeMeal = useCallback(
    (date: string, mealType: MealType) => {
      removeMealFromPlan(date, mealType);
    },
    []
  );

  // Update preferences
  const updatePreferences = useCallback(
    (newPrefs: Partial<MealPlanPreferences>) => {
      setPreferences(newPrefs);
    },
    []
  );

  return {
    // State
    currentPlan,
    isLoading,
    isGenerating,
    error,
    preferences,
    selectedWeekStart,
    canView,
    canGenerate,

    // Actions
    generate,
    save,
    clear,
    goToWeek,
    addMeal,
    removeMeal,
    updatePreferences,
    setSelectedWeek,
  };
};

// Shopping list hook
export const useShoppingList = () => {
  const { user } = useAuthStore();
  const {
    currentPlan,
    toggleShoppingItem,
    clearCheckedItems,
    getShoppingListByCategory,
    getItemsToBuy,
  } = useMealPlanStore();

  const shoppingList = currentPlan?.shoppingList || [];
  const byCategory = getShoppingListByCategory();
  const itemsToBuy = getItemsToBuy();

  // Toggle item checked state
  const toggleItem = useCallback(
    async (itemId: string) => {
      if (!user) return;
      await toggleShoppingItem(user.id, itemId);
    },
    [user]
  );

  // Clear all checked items
  const clearChecked = useCallback(async () => {
    if (!user) return;
    await clearCheckedItems(user.id);
  }, [user]);

  // Get items grouped by category in display order
  const getCategorizedItems = useCallback(() => {
    const result: { category: string; items: ShoppingListItem[] }[] = [];

    SHOPPING_CATEGORY_ORDER.forEach((category) => {
      const items = byCategory.get(category);
      if (items && items.length > 0) {
        result.push({ category, items });
      }
    });

    return result;
  }, [byCategory]);

  // Calculate totals
  const totalItems = shoppingList.length;
  const checkedItems = shoppingList.filter((i) => i.checked).length;
  const itemsInPantry = shoppingList.filter((i) => i.inPantry).length;
  const totalToBuy = itemsToBuy.length;

  return {
    shoppingList,
    byCategory,
    itemsToBuy,
    totalItems,
    checkedItems,
    itemsInPantry,
    totalToBuy,
    toggleItem,
    clearChecked,
    getCategorizedItems,
  };
};

// Waste tracking hook
export const useWasteTracking = () => {
  const { user } = useAuthStore();
  const { subscriptionTier } = useSubscriptionStore();
  const {
    wasteLog,
    wasteStats,
    isLoadingWaste,
    fetchWasteLog,
    fetchWasteStats,
    addWasteEntry,
    removeWasteEntry,
  } = useMealPlanStore();

  const [canTrack, setCanTrack] = useState(false);

  // Check access
  useEffect(() => {
    setCanTrack(canUseWasteTracking(subscriptionTier));
  }, [subscriptionTier]);

  // Fetch data on mount
  useEffect(() => {
    if (user && canTrack) {
      fetchWasteLog(user.id);
      fetchWasteStats(user.id);
    }
  }, [user?.id, canTrack]);

  // Log a waste entry
  const logWaste = useCallback(
    async (data: WasteEntryFormData) => {
      if (!user || !canTrack) return;
      await addWasteEntry(user.id, data);
    },
    [user, canTrack]
  );

  // Delete a waste entry
  const deleteWaste = useCallback(
    async (entryId: string) => {
      if (!user) return;
      await removeWasteEntry(user.id, entryId);
    },
    [user]
  );

  // Calculate weekly waste
  const weeklyWaste = wasteStats?.wastedThisWeek || 0;
  const monthlyWaste = wasteStats?.wastedThisMonth || 0;
  const savedByPlanning = wasteStats?.savedByPlanning || 0;

  return {
    wasteLog,
    wasteStats,
    isLoading: isLoadingWaste,
    canTrack,
    weeklyWaste,
    monthlyWaste,
    savedByPlanning,
    logWaste,
    deleteWaste,
  };
};

// Hook for meal plan stats display
export const useMealPlanStats = () => {
  const { currentPlan } = useMealPlanStore();

  if (!currentPlan) {
    return {
      totalMeals: 0,
      uniqueRecipes: 0,
      pantryItemsUsed: 0,
      expiringItemsUsed: 0,
      ingredientOverlap: 0,
      estimatedSavings: 0,
    };
  }

  return currentPlan.stats;
};

// Hook for checking meal plan feature access
export const useMealPlanAccess = () => {
  const { subscriptionTier, isPremium, isPro } = useSubscriptionStore();
  const [canView, setCanView] = useState(false);
  const [canGenerate, setCanGenerate] = useState(false);
  const [canTrack, setCanTrack] = useState(false);

  useEffect(() => {
    const check = async () => {
      setCanView(canViewMealPlans(subscriptionTier));
      const genResult = await canUseMealPlanGeneration(subscriptionTier);
      setCanGenerate(genResult.allowed);
      setCanTrack(canUseWasteTracking(subscriptionTier));
    };
    check();
  }, [subscriptionTier]);

  return {
    canView,
    canGenerate,
    canTrack,
    isPremium,
    isPro,
  };
};
