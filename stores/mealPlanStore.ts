import { create } from 'zustand';
import {
  WeeklyMealPlan,
  MealPlanDay,
  PlannedMeal,
  ShoppingListItem,
  FoodWasteEntry,
  WasteStats,
  MealPlanPreferences,
  DEFAULT_MEAL_PLAN_PREFERENCES,
  MealType,
  WasteEntryFormData,
} from '@/types/mealplan';
import { Recipe, PantryItem, PantryCategory } from '@/types';
import { usePantryStore } from '@/stores/pantryStore';
import {
  getCurrentMealPlan,
  getMealPlanByWeek,
  saveMealPlan,
  updateMeal,
  deleteMealPlan,
  updateShoppingListItem,
  logWasteEntry,
  getWasteLog,
  deleteWasteEntry,
  getWasteStats,
  getWeekStartDate,
  createEmptyMealPlan,
  generateWeekDates,
} from '@/services/mealPlanService';
import {
  generateMealPlan,
  calculateShoppingList,
  calculateMealPlanStats,
} from '@/services/mealPlanAIService';

interface MealPlanStoreState {
  // Current plan
  currentPlan: WeeklyMealPlan | null;
  isLoading: boolean;
  isGenerating: boolean;
  error: string | null;

  // Waste tracking
  wasteLog: FoodWasteEntry[];
  wasteStats: WasteStats | null;
  isLoadingWaste: boolean;

  // Preferences
  preferences: MealPlanPreferences;

  // Selected week
  selectedWeekStart: string;

  // Actions - Plan
  setCurrentPlan: (plan: WeeklyMealPlan | null) => void;
  setLoading: (loading: boolean) => void;
  setGenerating: (generating: boolean) => void;
  setError: (error: string | null) => void;
  setSelectedWeek: (weekStart: string) => void;
  setPreferences: (preferences: Partial<MealPlanPreferences>) => void;

  // Plan operations
  fetchCurrentPlan: (userId: string) => Promise<void>;
  fetchPlanByWeek: (userId: string, weekStart: string) => Promise<void>;
  generatePlan: (
    userId: string,
    recipes: Recipe[],
    pantryItems: PantryItem[],
    expiringItems: PantryItem[]
  ) => Promise<void>;
  savePlan: (userId: string) => Promise<void>;
  clearPlan: (userId: string) => Promise<void>;
  addMealToPlan: (
    date: string,
    mealType: MealType,
    meal: PlannedMeal
  ) => void;
  removeMealFromPlan: (date: string, mealType: MealType) => void;
  toggleShoppingItem: (userId: string, itemId: string) => Promise<void>;
  clearCheckedItems: (userId: string) => Promise<void>;

  // Waste operations
  fetchWasteLog: (userId: string) => Promise<void>;
  fetchWasteStats: (userId: string) => Promise<void>;
  addWasteEntry: (userId: string, data: WasteEntryFormData) => Promise<void>;
  removeWasteEntry: (userId: string, entryId: string) => Promise<void>;

  // Computed
  getShoppingListByCategory: () => Map<string, ShoppingListItem[]>;
  getItemsToBuy: () => ShoppingListItem[];
  getMealForDay: (date: string, mealType: MealType) => PlannedMeal | undefined;
}

export const useMealPlanStore = create<MealPlanStoreState>((set, get) => ({
  currentPlan: null,
  isLoading: false,
  isGenerating: false,
  error: null,
  wasteLog: [],
  wasteStats: null,
  isLoadingWaste: false,
  preferences: DEFAULT_MEAL_PLAN_PREFERENCES,
  selectedWeekStart: getWeekStartDate(),

  // Setters
  setCurrentPlan: (currentPlan) => set({ currentPlan }),
  setLoading: (isLoading) => set({ isLoading }),
  setGenerating: (isGenerating) => set({ isGenerating }),
  setError: (error) => set({ error }),
  setSelectedWeek: (selectedWeekStart) => set({ selectedWeekStart }),
  setPreferences: (prefs) =>
    set((state) => ({
      preferences: { ...state.preferences, ...prefs },
    })),

  // Fetch current week's plan
  fetchCurrentPlan: async (userId) => {
    set({ isLoading: true, error: null });
    try {
      const plan = await getCurrentMealPlan(userId);
      set({ currentPlan: plan, isLoading: false });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to fetch meal plan';
      set({ error: message, isLoading: false });
    }
  },

  // Fetch plan for a specific week
  fetchPlanByWeek: async (userId, weekStart) => {
    set({ isLoading: true, error: null, selectedWeekStart: weekStart });
    try {
      const plan = await getMealPlanByWeek(userId, weekStart);
      set({ currentPlan: plan, isLoading: false });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to fetch meal plan';
      set({ error: message, isLoading: false });
    }
  },

  // Generate an AI-optimized meal plan
  generatePlan: async (userId, recipes, pantryItems, expiringItems) => {
    const { preferences, selectedWeekStart } = get();
    set({ isGenerating: true, error: null });

    try {
      const weekDates = generateWeekDates(selectedWeekStart);

      const result = await generateMealPlan(
        preferences,
        recipes,
        pantryItems,
        expiringItems,
        weekDates
      );

      // Create the plan structure - add id and checked to shopping list items
      const planData = {
        weekStartDate: selectedWeekStart,
        days: result.plan,
        shoppingList: result.shoppingList.map((item, index) => ({
          ...item,
          id: `item-${Date.now()}-${index}`,
          checked: false,
        })),
        stats: result.stats,
        isGenerated: true,
      };

      // Save to Firestore
      const savedPlan = await saveMealPlan(userId, planData);

      set({
        currentPlan: savedPlan,
        isGenerating: false,
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to generate meal plan';
      set({ error: message, isGenerating: false });
    }
  },

  // Save current plan
  savePlan: async (userId) => {
    const { currentPlan } = get();
    if (!currentPlan) return;

    set({ isLoading: true, error: null });
    try {
      const savedPlan = await saveMealPlan(userId, {
        weekStartDate: currentPlan.weekStartDate,
        days: currentPlan.days,
        shoppingList: currentPlan.shoppingList,
        stats: currentPlan.stats,
        isGenerated: currentPlan.isGenerated,
      });
      set({ currentPlan: savedPlan, isLoading: false });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to save meal plan';
      set({ error: message, isLoading: false });
    }
  },

  // Clear/delete current plan
  clearPlan: async (userId) => {
    const { currentPlan } = get();
    if (!currentPlan) return;

    set({ isLoading: true, error: null });
    try {
      await deleteMealPlan(userId, currentPlan.id);
      set({ currentPlan: null, isLoading: false });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to clear meal plan';
      set({ error: message, isLoading: false });
    }
  },

  // Add a meal to the plan (local update)
  addMealToPlan: (date, mealType, meal) => {
    set((state) => {
      if (!state.currentPlan) {
        // Create a new empty plan
        const emptyPlan = createEmptyMealPlan(state.selectedWeekStart);
        const dayIndex = emptyPlan.days.findIndex((d) => d.date === date);
        if (dayIndex >= 0) {
          emptyPlan.days[dayIndex] = {
            ...emptyPlan.days[dayIndex],
            [mealType]: meal,
          };
        }
        return {
          currentPlan: {
            id: '',
            userId: '',
            createdAt: null as any,
            updatedAt: null as any,
            ...emptyPlan,
          },
        };
      }

      const updatedDays = state.currentPlan.days.map((day) =>
        day.date === date ? { ...day, [mealType]: meal } : day
      );

      return {
        currentPlan: {
          ...state.currentPlan,
          days: updatedDays,
        },
      };
    });
  },

  // Remove a meal from the plan (local update)
  removeMealFromPlan: (date, mealType) => {
    set((state) => {
      if (!state.currentPlan) return state;

      const updatedDays = state.currentPlan.days.map((day) => {
        if (day.date !== date) return day;
        const { [mealType]: removed, ...rest } = day;
        return rest as MealPlanDay;
      });

      return {
        currentPlan: {
          ...state.currentPlan,
          days: updatedDays,
        },
      };
    });
  },

  // Toggle shopping list item checked state
  toggleShoppingItem: async (userId, itemId) => {
    const { currentPlan } = get();
    if (!currentPlan) return;

    const item = currentPlan.shoppingList.find((i) => i.id === itemId);
    if (!item) return;

    const newCheckedState = !item.checked;

    // Optimistic update
    set((state) => {
      if (!state.currentPlan) return state;

      const updatedList = state.currentPlan.shoppingList.map((i) =>
        i.id === itemId ? { ...i, checked: newCheckedState } : i
      );

      return {
        currentPlan: {
          ...state.currentPlan,
          shoppingList: updatedList,
        },
      };
    });

    try {
      await updateShoppingListItem(userId, currentPlan.id, itemId, newCheckedState);

      // Auto-add to pantry when item is checked off
      if (newCheckedState) {
        const pantryCategory = (
          ['produce', 'dairy', 'meat', 'seafood', 'grains', 'spices', 'condiments', 'canned', 'frozen', 'beverages', 'other']
            .includes(item.category) ? item.category : 'other'
        ) as PantryCategory;

        try {
          await usePantryStore.getState().addPantryItem(userId, {
            name: item.name,
            amount: item.toBuy || item.amount,
            unit: item.unit,
            category: pantryCategory,
          });
        } catch (pantryError) {
          // Don't revert shopping list toggle if pantry add fails
          console.error('Failed to auto-add to pantry:', pantryError);
        }
      }
    } catch (error) {
      // Revert on failure
      set((state) => {
        if (!state.currentPlan) return state;

        const revertedList = state.currentPlan.shoppingList.map((i) =>
          i.id === itemId ? { ...i, checked: item.checked } : i
        );

        return {
          currentPlan: {
            ...state.currentPlan,
            shoppingList: revertedList,
          },
        };
      });
    }
  },

  // Clear all checked items from shopping list
  clearCheckedItems: async (userId) => {
    const { currentPlan } = get();
    if (!currentPlan) return;

    const checkedIds = currentPlan.shoppingList
      .filter((item) => item.checked)
      .map((item) => item.id);

    if (checkedIds.length === 0) return;

    // Optimistic update - remove checked items
    set((state) => {
      if (!state.currentPlan) return state;

      const updatedList = state.currentPlan.shoppingList.filter(
        (item) => !item.checked
      );

      return {
        currentPlan: {
          ...state.currentPlan,
          shoppingList: updatedList,
        },
      };
    });

    // Save to backend
    try {
      const { currentPlan: updatedPlan } = get();
      if (updatedPlan) {
        await saveMealPlan(userId, {
          weekStartDate: updatedPlan.weekStartDate,
          days: updatedPlan.days,
          shoppingList: updatedPlan.shoppingList,
          stats: updatedPlan.stats,
          isGenerated: updatedPlan.isGenerated,
        });
      }
    } catch (error) {
      // Revert on failure
      set({ currentPlan });
      console.error('Failed to clear checked items:', error);
    }
  },

  // Waste tracking operations
  fetchWasteLog: async (userId) => {
    set({ isLoadingWaste: true });
    try {
      const log = await getWasteLog(userId);
      set({ wasteLog: log, isLoadingWaste: false });
    } catch (error) {
      console.error('Error fetching waste log:', error);
      set({ isLoadingWaste: false });
    }
  },

  fetchWasteStats: async (userId) => {
    try {
      const stats = await getWasteStats(userId);
      set({ wasteStats: stats });
    } catch (error) {
      console.error('Error fetching waste stats:', error);
    }
  },

  addWasteEntry: async (userId, data) => {
    try {
      const entry = await logWasteEntry(userId, data);
      set((state) => ({
        wasteLog: [entry, ...state.wasteLog],
      }));
      // Refresh stats
      const stats = await getWasteStats(userId);
      set({ wasteStats: stats });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to log waste';
      set({ error: message });
    }
  },

  removeWasteEntry: async (userId, entryId) => {
    try {
      await deleteWasteEntry(userId, entryId);
      set((state) => ({
        wasteLog: state.wasteLog.filter((e) => e.id !== entryId),
      }));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to delete waste entry';
      set({ error: message });
    }
  },

  // Computed: Get shopping list grouped by category
  getShoppingListByCategory: () => {
    const { currentPlan } = get();
    if (!currentPlan) return new Map();

    const grouped = new Map<string, ShoppingListItem[]>();

    currentPlan.shoppingList.forEach((item) => {
      const existing = grouped.get(item.category) || [];
      existing.push(item);
      grouped.set(item.category, existing);
    });

    return grouped;
  },

  // Computed: Get items that need to be purchased
  getItemsToBuy: () => {
    const { currentPlan } = get();
    if (!currentPlan) return [];

    return currentPlan.shoppingList.filter((item) => item.toBuy > 0 && !item.checked);
  },

  // Computed: Get meal for a specific day and type
  getMealForDay: (date, mealType) => {
    const { currentPlan } = get();
    if (!currentPlan) return undefined;

    const day = currentPlan.days.find((d) => d.date === date);
    if (!day) return undefined;

    return day[mealType];
  },
}));

// Selectors
export const selectCurrentPlan = (state: MealPlanStoreState) => state.currentPlan;
export const selectIsLoading = (state: MealPlanStoreState) => state.isLoading;
export const selectIsGenerating = (state: MealPlanStoreState) => state.isGenerating;
export const selectShoppingList = (state: MealPlanStoreState) =>
  state.currentPlan?.shoppingList || [];
export const selectWasteLog = (state: MealPlanStoreState) => state.wasteLog;
export const selectWasteStats = (state: MealPlanStoreState) => state.wasteStats;
