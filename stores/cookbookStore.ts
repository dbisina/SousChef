import { create } from 'zustand';
import {
  db,
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  orderBy,
  limit,
  Timestamp,
  increment,
  arrayUnion,
  arrayRemove,
  COLLECTIONS,
} from '@/lib/firebase';
import { Cookbook, Recipe } from '@/types';

interface CookbookState {
  cookbooks: Cookbook[];
  currentCookbook: Cookbook | null;
  currentCookbookRecipes: Recipe[];
  isLoading: boolean;
  error: string | null;

  // Actions
  setCookbooks: (cookbooks: Cookbook[]) => void;
  setCurrentCookbook: (cookbook: Cookbook | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;

  // Cookbook operations
  fetchCookbooks: () => Promise<void>;
  fetchCookbookById: (id: string) => Promise<Cookbook | null>;
  fetchCookbookRecipes: (recipeIds: string[]) => Promise<Recipe[]>;
  likeCookbook: (cookbookId: string) => Promise<void>;
  unlikeCookbook: (cookbookId: string) => Promise<void>;
  saveCookbook: (cookbookId: string, userId: string) => Promise<void>;
  unsaveCookbook: (cookbookId: string, userId: string) => Promise<void>;
}

export const useCookbookStore = create<CookbookState>((set, get) => ({
  cookbooks: [],
  currentCookbook: null,
  currentCookbookRecipes: [],
  isLoading: false,
  error: null,

  setCookbooks: (cookbooks) => set({ cookbooks }),
  setCurrentCookbook: (currentCookbook) => set({ currentCookbook }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),

  fetchCookbooks: async () => {
    set({ isLoading: true, error: null });
    try {
      const cookbooksRef = collection(db, COLLECTIONS.COOKBOOKS);
      const q = query(cookbooksRef, orderBy('createdAt', 'desc'), limit(20));
      const snapshot = await getDocs(q);

      const cookbooks = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Cookbook[];

      set({ cookbooks, isLoading: false });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to fetch cookbooks';
      set({ error: message, isLoading: false });
    }
  },

  fetchCookbookById: async (id) => {
    set({ isLoading: true, error: null });
    try {
      const cookbookDoc = await getDoc(doc(db, COLLECTIONS.COOKBOOKS, id));
      if (cookbookDoc.exists()) {
        const cookbook = { id: cookbookDoc.id, ...cookbookDoc.data() } as Cookbook;
        set({ currentCookbook: cookbook });

        // Also fetch the recipes for this cookbook
        if (cookbook.recipeIds && cookbook.recipeIds.length > 0) {
          const recipes = await get().fetchCookbookRecipes(cookbook.recipeIds);
          set({ currentCookbookRecipes: recipes, isLoading: false });
        } else {
          set({ currentCookbookRecipes: [], isLoading: false });
        }

        return cookbook;
      }
      set({ isLoading: false });
      return null;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to fetch cookbook';
      set({ error: message, isLoading: false });
      return null;
    }
  },

  fetchCookbookRecipes: async (recipeIds) => {
    try {
      const recipes: Recipe[] = [];
      // Fetch recipes in batches (Firestore 'in' query limit is 10)
      const batchSize = 10;
      for (let i = 0; i < recipeIds.length; i += batchSize) {
        const batch = recipeIds.slice(i, i + batchSize);
        const promises = batch.map((id) => getDoc(doc(db, COLLECTIONS.RECIPES, id)));
        const docs = await Promise.all(promises);
        docs.forEach((docSnap) => {
          if (docSnap.exists()) {
            recipes.push({ id: docSnap.id, ...docSnap.data() } as Recipe);
          }
        });
      }
      return recipes;
    } catch (error) {
      console.error('Error fetching cookbook recipes:', error);
      return [];
    }
  },

  likeCookbook: async (cookbookId) => {
    try {
      await updateDoc(doc(db, COLLECTIONS.COOKBOOKS, cookbookId), {
        likes: increment(1),
      });

      set((state) => ({
        cookbooks: state.cookbooks.map((c) =>
          c.id === cookbookId ? { ...c, likes: c.likes + 1 } : c
        ),
        currentCookbook:
          state.currentCookbook?.id === cookbookId
            ? { ...state.currentCookbook, likes: state.currentCookbook.likes + 1 }
            : state.currentCookbook,
      }));
    } catch (error) {
      console.error('Error liking cookbook:', error);
    }
  },

  unlikeCookbook: async (cookbookId) => {
    try {
      await updateDoc(doc(db, COLLECTIONS.COOKBOOKS, cookbookId), {
        likes: increment(-1),
      });

      set((state) => ({
        cookbooks: state.cookbooks.map((c) =>
          c.id === cookbookId ? { ...c, likes: Math.max(0, c.likes - 1) } : c
        ),
        currentCookbook:
          state.currentCookbook?.id === cookbookId
            ? { ...state.currentCookbook, likes: Math.max(0, state.currentCookbook.likes - 1) }
            : state.currentCookbook,
      }));
    } catch (error) {
      console.error('Error unliking cookbook:', error);
    }
  },

  saveCookbook: async (cookbookId, userId) => {
    try {
      await updateDoc(doc(db, COLLECTIONS.USERS, userId), {
        savedCookbooks: arrayUnion(cookbookId),
      });
    } catch (error) {
      console.error('Error saving cookbook:', error);
    }
  },

  unsaveCookbook: async (cookbookId, userId) => {
    try {
      await updateDoc(doc(db, COLLECTIONS.USERS, userId), {
        savedCookbooks: arrayRemove(cookbookId),
      });
    } catch (error) {
      console.error('Error unsaving cookbook:', error);
    }
  },
}));
