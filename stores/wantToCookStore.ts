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
  extractRecipeFromMultiplePhotos,
  calculatePantryMatch,
  generateShoppingList,
} from '@/services/recipeImportService';
import { ThinkingPhase } from '@/lib/gemini';
import { generateId } from '@/lib/firebase';
import { apiEnabled } from '@/lib/api';
import {
  apiAddShopping,
  apiAddWantToCook,
  apiCheckShopping,
  apiClearShopping,
  apiListWantToCook,
  apiRemoveShopping,
  apiRemoveWantToCook,
  apiShoppingList,
  apiUpdateWantToCook,
} from '@/services/wantToCookApi';

/** Server mode: put the shopping list back the way the server has it (after an action there failed). */
async function reloadShoppingList(set: (s: { shoppingList: QuickShoppingItem[] }) => void): Promise<void> {
  try {
    set({ shoppingList: await apiShoppingList() });
  } catch {
    // Offline: the list on the phone stays as it is.
  }
}

/** Recursively strip `undefined` values from an object (Firestore rejects them).
 *  Preserves Firestore Timestamps and other class instances. */
function removeUndefinedFields(obj: any): any {
  if (obj === null || obj === undefined) return null;
  if (obj instanceof Timestamp) return obj;
  if (obj instanceof Date) return obj;
  if (Array.isArray(obj)) return obj.map(removeUndefinedFields);
  if (typeof obj === 'object') {
    const clean: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        clean[key] = removeUndefinedFields(value);
      }
    }
    return clean;
  }
  return obj;
}

/** Safely get milliseconds from a savedAt field that may be a Timestamp,
 *  a plain {seconds, nanoseconds} object, or undefined. */
export function safeTimestampMillis(ts: any): number {
  if (!ts) return Date.now();
  if (typeof ts.toMillis === 'function') return ts.toMillis();
  if (typeof ts.seconds === 'number') return ts.seconds * 1000;
  if (ts instanceof Date) return ts.getTime();
  return Date.now();
}

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

  // AI thinking state (visible thinking for video imports)
  thinkingNotes: string[];
  thinkingPhase: ThinkingPhase;

  // Actions - Import
  importFromURL: (url: string, userId: string) => Promise<WantToCookItem | null>;
  importFromPhoto: (imageUri: string, userId: string, cookbookName?: string) => Promise<WantToCookItem | null>;
  importFromMultiplePhotos: (imageUris: string[], userId: string, cookbookName?: string) => Promise<WantToCookItem | null>;

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

  // Actions - Thinking
  addThinkingNote: (note: string) => void;
  setThinkingPhase: (phase: ThinkingPhase) => void;
  clearThinking: () => void;

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
      thinkingNotes: [],
      thinkingPhase: 'idle' as ThinkingPhase,

      // Import recipe from URL
      importFromURL: async (url, userId) => {
        set({
          isImporting: true,
          importProgress: 'Starting import...',
          error: null,
          thinkingNotes: [],
          thinkingPhase: 'idle' as ThinkingPhase,
        });

        try {
          const result = await extractRecipeFromURL(
            url,
            (progress) => {
              set({ importProgress: progress });
            },
            {
              onThinkingNote: (note) => {
                set((state) => ({
                  thinkingNotes: [...state.thinkingNotes, note],
                }));
              },
              onPhaseChange: (phase) => {
                set({ thinkingPhase: phase });
              },
            },
          );

          if (!result.success || !result.recipe) {
            set({ error: result.error || 'Failed to import recipe', isImporting: false, thinkingPhase: 'idle' as ThinkingPhase });
            return null;
          }

          set({ importProgress: 'Saving recipe...', thinkingPhase: 'done' as ThinkingPhase });
          const item = await get().addToWantToCook(userId, result.recipe, true);

          set({ isImporting: false, importProgress: '', thinkingPhase: 'idle' as ThinkingPhase, thinkingNotes: [] });
          return item;
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Import failed';
          set({ error: message, isImporting: false, importProgress: '', thinkingPhase: 'idle' as ThinkingPhase, thinkingNotes: [] });
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

      // Import recipe from multiple photos (multi-page cookbook scan)
      importFromMultiplePhotos: async (imageUris, userId, cookbookName) => {
        set({ isImporting: true, importProgress: `Scanning ${imageUris.length} pages...`, error: null });

        try {
          set({ importProgress: `Extracting recipe from ${imageUris.length} pages...` });
          const result = await extractRecipeFromMultiplePhotos(imageUris, cookbookName);

          if (!result.success || !result.recipe) {
            set({ error: result.error || 'Failed to scan recipe', isImporting: false });
            return null;
          }

          set({ importProgress: 'Saving recipe...' });
          const item = await get().addToWantToCook(userId, result.recipe, true);

          set({ isImporting: false, importProgress: '' });
          return item;
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Multi-page scan failed';
          set({ error: message, isImporting: false, importProgress: '' });
          return null;
        }
      },

      // Add recipe to Want to Cook
      addToWantToCook: async (userId, recipe, isImported) => {
        if (apiEnabled()) {
          const created = await apiAddWantToCook(recipe, isImported);
          set((state) => ({ items: [created, ...state.items.filter((i) => i.id !== created.id)] }));
          return created;
        }
        const item: WantToCookItem = {
          id: generateId(),
          ownerId: userId,
          status: 'saved',
          savedAt: Timestamp.now(),
          addedToShoppingList: false,
          ...(isImported
            ? { importedRecipe: recipe as ImportedRecipe }
            : { recipeId: (recipe as Recipe).id }),
        };

        // Save to Firestore (strip undefined values — Firestore rejects them)
        const cleanItem = removeUndefinedFields(item);
        try {
          await setDoc(doc(db, 'users', userId, 'wantToCook', item.id), cleanItem);
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
          if (apiEnabled()) await apiRemoveWantToCook(itemId);
          else await deleteDoc(doc(db, 'users', item.ownerId, 'wantToCook', itemId));
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
          if (apiEnabled()) {
            const saved = await apiUpdateWantToCook(itemId, status);
            // The server stamps "cooked at" itself and keeps the pantry numbers fresh.
            set((state) => ({ items: state.items.map((i) => (i.id === itemId ? saved : i)) }));
            return;
          }
          await updateDoc(doc(db, 'users', item.ownerId, 'wantToCook', itemId), updates);
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
          if (apiEnabled()) {
            const [items, shoppingList] = await Promise.all([apiListWantToCook(), apiShoppingList()]);
            set({ items, shoppingList, isLoading: false });
            return;
          }
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
        if (apiEnabled()) {
          // Show the lines at once, then swap in the server's copies (which have the server's ids).
          const placeholders: QuickShoppingItem[] = items.map((item) => ({
            id: `pending-${generateId()}`,
            name: item.name,
            amount: item.amount,
            unit: item.unit,
            checked: false,
            ...(item.recipeId ? { recipeId: item.recipeId } : {}),
            ...(item.recipeName ? { recipeName: item.recipeName } : {}),
            addedAt: Timestamp.now(),
          }));
          set((state) => ({ shoppingList: [...state.shoppingList, ...placeholders] }));
          const pending = new Set(placeholders.map((p) => p.id));
          apiAddShopping(items)
            .then((saved) => set((state) => ({ shoppingList: [...state.shoppingList.filter((i) => !pending.has(i.id)), ...saved] })))
            .catch(() => void reloadShoppingList(set));
          return;
        }
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
        if (apiEnabled() && !itemId.startsWith('pending-')) apiRemoveShopping(itemId).catch(() => void reloadShoppingList(set));
        set((state) => ({
          shoppingList: state.shoppingList.filter((i) => i.id !== itemId),
        }));
      },

      toggleShoppingItem: (itemId) => {
        if (apiEnabled() && !itemId.startsWith('pending-')) {
          const current = get().shoppingList.find((i) => i.id === itemId);
          if (current) apiCheckShopping(itemId, !current.checked).catch(() => void reloadShoppingList(set));
        }
        set((state) => ({
          shoppingList: state.shoppingList.map((i) =>
            i.id === itemId ? { ...i, checked: !i.checked } : i
          ),
        }));
      },

      clearShoppingList: () => {
        if (apiEnabled()) apiClearShopping(false).catch(() => void reloadShoppingList(set));
        set({ shoppingList: [] });
      },

      clearCheckedItems: () => {
        if (apiEnabled()) apiClearShopping(true).catch(() => void reloadShoppingList(set));
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
          const savedTime = safeTimestampMillis(item.savedAt);
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

      // Thinking actions
      addThinkingNote: (note) => {
        set((state) => ({
          thinkingNotes: [...state.thinkingNotes, note],
        }));
      },
      setThinkingPhase: (phase) => {
        set({ thinkingPhase: phase });
      },
      clearThinking: () => {
        set({ thinkingNotes: [], thinkingPhase: 'idle' as ThinkingPhase });
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
