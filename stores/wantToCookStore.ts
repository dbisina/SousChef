import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Timestamp } from 'firebase/firestore';
import {
  db,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  addDoc,
} from '@/lib/firebase';
import {
  WantToCookItem,
  WantToCookStatus,
  ImportedRecipe,
  QuickShoppingList,
  QuickShoppingItem,
  PantryMatchResult,
} from '@/types/wantToCook';
import { Recipe, PantryItem } from '@/types';
import {
  extractRecipeFromURL,
  extractRecipeFromPhoto,
  calculatePantryMatch,
  generateShoppingList,
} from '@/services/recipeImportService';
import { generateId } from '@/lib/firebase';

interface WantToCookState {
  // Want to Cook items
  items: WantToCookItem[];
  isLoading: boolean;
  error: string | null;

  // Shopping list
  shoppingList: QuickShoppingItem[];

  // Import state
  isImporting: boolean;
  importProgress: string;

  // Actions - Import
  importFromURL: (url: string, userId: string) => Promise<WantToCookItem | null>;
  importFromPhoto: (imageUri: string, userId: string, cookbookName?: string) => Promise<WantToCookItem | null>;

  // Actions - Want to Cook
  addToWantToCook: (userId: string, recipe: Recipe | ImportedRecipe, isImported: boolean) => Promise<WantToCookItem>;
  removeFromWantToCook: (itemId: string) => Promise<void>;
  updateStatus: (itemId: string, status: WantToCookStatus) => Promise<void>;
  markAsCooked: (itemId: string) => Promise<void>;

  // Actions - Fetch
  fetchWantToCookItems: (userId: string) => Promise<void>;

  // Actions - Pantry Match
  updatePantryMatches: (pantryItems: PantryItem[]) => void;

  // Actions - Shopping List
  addToShoppingList: (items: Array<{ name: string; amount: number; unit: string; recipeId?: string; recipeName?: string }>) => void;
  removeFromShoppingList: (itemId: string) => void;
  toggleShoppingItem: (itemId: string) => void;
  clearShoppingList: () => void;
  clearCheckedItems: () => void;

  // Getters
  getItemsByStatus: (status: WantToCookStatus) => WantToCookItem[];
  getOldSavedRecipes: (daysOld: number) => WantToCookItem[];
  getReadyToCook: (pantryItems: PantryItem[]) => WantToCookItem[];

  // State setters
  setError: (error: string | null) => void;
  setLoading: (loading: boolean) => void;
}

export const useWantToCookStore = create<WantToCookState>()(
  persist(
    (set, get) => ({
      items: [],
      isLoading: false,
      error: null,
      shoppingList: [],
      isImporting: false,
      importProgress: '',

      // Import recipe from URL
      importFromURL: async (url, userId) => {
        set({ isImporting: true, importProgress: 'Fetching recipe...', error: null });

        try {
          set({ importProgress: 'Analyzing content...' });
          const result = await extractRecipeFromURL(url);

          if (!result.success || !result.recipe) {
            set({ error: result.error || 'Failed to import recipe', isImporting: false });
            return null;
          }

          set({ importProgress: 'Saving recipe...' });
          const item = await get().addToWantToCook(userId, result.recipe, true);

          set({ isImporting: false, importProgress: '' });
          return item;
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Import failed';
          set({ error: message, isImporting: false, importProgress: '' });
          return null;
        }
      },

      // Import recipe from photo
      importFromPhoto: async (imageUri, userId, cookbookName) => {
        set({ isImporting: true, importProgress: 'Scanning image...', error: null });

        try {
          set({ importProgress: 'Extracting recipe...' });
          const result = await extractRecipeFromPhoto(imageUri, cookbookName);

          if (!result.success || !result.recipe) {
            set({ error: result.error || 'Failed to scan recipe', isImporting: false });
            return null;
          }

          set({ importProgress: 'Saving recipe...' });
          const item = await get().addToWantToCook(userId, result.recipe, true);

          set({ isImporting: false, importProgress: '' });
          return item;
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Scan failed';
          set({ error: message, isImporting: false, importProgress: '' });
          return null;
        }
      },

      // Add recipe to Want to Cook
      addToWantToCook: async (userId, recipe, isImported) => {
        const item: WantToCookItem = {
          id: generateId(),
          oderId: userId,
          status: 'saved',
          savedAt: Timestamp.now(),
          addedToShoppingList: false,
          ...(isImported
            ? { importedRecipe: recipe as ImportedRecipe }
            : { recipeId: (recipe as Recipe).id }),
        };

        // Save to Firestore
        try {
          await setDoc(doc(db, 'users', userId, 'wantToCook', item.id), item);
        } catch (error) {
          console.error('Error saving to Firestore:', error);
        }

        set((state) => ({
          items: [item, ...state.items],
        }));

        return item;
      },

      // Remove from Want to Cook
      removeFromWantToCook: async (itemId) => {
        const item = get().items.find((i) => i.id === itemId);
        if (!item) return;

        try {
          await deleteDoc(doc(db, 'users', item.oderId, 'wantToCook', itemId));
        } catch (error) {
          console.error('Error deleting from Firestore:', error);
        }

        set((state) => ({
          items: state.items.filter((i) => i.id !== itemId),
        }));
      },

      // Update status
      updateStatus: async (itemId, status) => {
        const item = get().items.find((i) => i.id === itemId);
        if (!item) return;

        const updates: Partial<WantToCookItem> = { status };
        if (status === 'cooked') {
          updates.cookedAt = Timestamp.now();
        }

        try {
          await updateDoc(doc(db, 'users', item.oderId, 'wantToCook', itemId), updates);
        } catch (error) {
          console.error('Error updating Firestore:', error);
        }

        set((state) => ({
          items: state.items.map((i) =>
            i.id === itemId ? { ...i, ...updates } : i
          ),
        }));
      },

      // Mark as cooked
      markAsCooked: async (itemId) => {
        await get().updateStatus(itemId, 'cooked');
      },

      // Fetch Want to Cook items
      fetchWantToCookItems: async (userId) => {
        set({ isLoading: true, error: null });

        try {
          const q = query(
            collection(db, 'users', userId, 'wantToCook'),
            orderBy('savedAt', 'desc')
          );
          const snapshot = await getDocs(q);

          const items: WantToCookItem[] = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          })) as WantToCookItem[];

          set({ items, isLoading: false });
        } catch (error) {
          console.error('Error fetching Want to Cook items:', error);
          set({ error: 'Failed to load recipes', isLoading: false });
        }
      },

      // Update pantry matches for all items
      updatePantryMatches: (pantryItems) => {
        set((state) => ({
          items: state.items.map((item) => {
            const ingredients = item.importedRecipe?.ingredients || [];
            if (ingredients.length === 0) return item;

            const match = calculatePantryMatch(ingredients, pantryItems);
            return {
              ...item,
              pantryMatchPercent: match.matchPercent,
              matchingIngredients: match.matchingIngredients.map((m) => m.ingredient),
              missingIngredients: match.missingIngredients.map((m) => m.ingredient),
            };
          }),
        }));
      },

      // Shopping list actions
      addToShoppingList: (items) => {
        const newItems: QuickShoppingItem[] = items.map((item) => ({
          id: generateId(),
          name: item.name,
          amount: item.amount,
          unit: item.unit,
          checked: false,
          recipeId: item.recipeId,
          recipeName: item.recipeName,
          addedAt: Timestamp.now(),
        }));

        set((state) => ({
          shoppingList: [...state.shoppingList, ...newItems],
        }));
      },

      removeFromShoppingList: (itemId) => {
        set((state) => ({
          shoppingList: state.shoppingList.filter((i) => i.id !== itemId),
        }));
      },

      toggleShoppingItem: (itemId) => {
        set((state) => ({
          shoppingList: state.shoppingList.map((i) =>
            i.id === itemId ? { ...i, checked: !i.checked } : i
          ),
        }));
      },

      clearShoppingList: () => {
        set({ shoppingList: [] });
      },

      clearCheckedItems: () => {
        set((state) => ({
          shoppingList: state.shoppingList.filter((i) => !i.checked),
        }));
      },

      // Getters
      getItemsByStatus: (status) => {
        return get().items.filter((item) => item.status === status);
      },

      getOldSavedRecipes: (daysOld) => {
        const cutoff = Date.now() - daysOld * 24 * 60 * 60 * 1000;
        return get().items.filter((item) => {
          if (item.status !== 'saved') return false;
          const savedTime = item.savedAt.toMillis();
          return savedTime < cutoff;
        });
      },

      getReadyToCook: (pantryItems) => {
        return get().items.filter((item) => {
          if (item.status === 'cooked') return false;
          const ingredients = item.importedRecipe?.ingredients || [];
          if (ingredients.length === 0) return false;

          const match = calculatePantryMatch(ingredients, pantryItems);
          return match.canMake;
        });
      },

      setError: (error) => set({ error }),
      setLoading: (isLoading) => set({ isLoading }),
    }),
    {
      name: 'want-to-cook-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        shoppingList: state.shoppingList,
      }),
    }
  )
);
