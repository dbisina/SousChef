import { create } from 'zustand';
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
  limit,
  startAfter,
  Timestamp,
  increment,
  arrayUnion,
  arrayRemove,
  DocumentSnapshot,
} from '@/lib/firebase';
import { Recipe, RecipeFilters, RecipeFormData, Ingredient } from '@/types';
import { calculateNutrition, calculateIngredientCalories } from '@/lib/utils';

interface RecipeState {
  recipes: Recipe[];
  currentRecipe: Recipe | null;
  isLoading: boolean;
  error: string | null;
  lastDoc: DocumentSnapshot | null;
  hasMore: boolean;
  filters: RecipeFilters;

  // Actions
  setRecipes: (recipes: Recipe[]) => void;
  setCurrentRecipe: (recipe: Recipe | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setFilters: (filters: RecipeFilters) => void;
  clearFilters: () => void;

  // Recipe operations
  fetchRecipes: (resetPagination?: boolean) => Promise<void>;
  fetchRecipeById: (id: string) => Promise<Recipe | null>;
  fetchUserRecipes: (userId: string) => Promise<Recipe[]>;
  createRecipe: (data: RecipeFormData, imageURL: string, authorId: string, authorName: string, isOfficial?: boolean) => Promise<string>;
  updateRecipe: (id: string, data: Partial<Recipe>) => Promise<void>;
  deleteRecipe: (id: string) => Promise<void>;
  likeRecipe: (recipeId: string, userId: string) => Promise<void>;
  unlikeRecipe: (recipeId: string, userId: string) => Promise<void>;
  saveRecipe: (recipeId: string, userId: string) => Promise<void>;
  unsaveRecipe: (recipeId: string, userId: string) => Promise<void>;
  searchRecipes: (searchQuery: string) => Promise<Recipe[]>;
}

const PAGE_SIZE = 10;

export const useRecipeStore = create<RecipeState>((set, get) => ({
  recipes: [],
  currentRecipe: null,
  isLoading: false,
  error: null,
  lastDoc: null,
  hasMore: true,
  filters: {},

  setRecipes: (recipes) => set({ recipes }),
  setCurrentRecipe: (currentRecipe) => set({ currentRecipe }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
  setFilters: (filters) => set({ filters }),
  clearFilters: () => set({ filters: {}, lastDoc: null, hasMore: true }),

  fetchRecipes: async (resetPagination = false) => {
    const { filters, lastDoc } = get();

    if (resetPagination) {
      set({ lastDoc: null, hasMore: true, recipes: [] });
    }

    set({ isLoading: true, error: null });

    try {
      const recipesRef = collection(db, 'recipes');
      const constraints: Parameters<typeof query>[1][] = [];

      // Apply filters
      if (filters.category) {
        constraints.push(where('category', '==', filters.category));
      }
      if (filters.cuisine) {
        constraints.push(where('cuisine', '==', filters.cuisine));
      }
      if (filters.difficulty) {
        constraints.push(where('difficulty', '==', filters.difficulty));
      }
      if (filters.isOfficial !== undefined) {
        constraints.push(where('isOfficial', '==', filters.isOfficial));
      }

      // Track if we have range filters (these conflict with orderBy on different fields in Firestore)
      const hasRangeFilters = !!(filters.maxCalories || filters.maxPrepTime);

      // Only add orderBy when there are no range filters to avoid Firestore index conflicts
      if (!hasRangeFilters) {
        constraints.push(orderBy('createdAt', 'desc'));
      }

      constraints.push(limit(hasRangeFilters ? 100 : PAGE_SIZE));

      // Pagination
      const currentLastDoc = resetPagination ? null : lastDoc;
      if (currentLastDoc) {
        constraints.push(startAfter(currentLastDoc));
      }

      const q = query(recipesRef, ...constraints);
      const snapshot = await getDocs(q);

      let newRecipes = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Recipe[];

      // Apply range filters and sorting client-side when needed
      if (hasRangeFilters) {
        if (filters.maxCalories) {
          newRecipes = newRecipes.filter(
            (r) => r.nutrition?.caloriesPerServing && r.nutrition.caloriesPerServing <= filters.maxCalories!
          );
        }
        if (filters.maxPrepTime) {
          newRecipes = newRecipes.filter((r) => r.prepTime <= filters.maxPrepTime!);
        }
        // Sort by createdAt descending (client-side)
        newRecipes.sort((a, b) => {
          const aTime = a.createdAt?.toMillis?.() || 0;
          const bTime = b.createdAt?.toMillis?.() || 0;
          return bTime - aTime;
        });
        // Apply pagination client-side
        newRecipes = newRecipes.slice(0, PAGE_SIZE);
      }

      const lastVisible = snapshot.docs[snapshot.docs.length - 1] || null;

      set((state) => ({
        recipes: resetPagination ? newRecipes : [...state.recipes, ...newRecipes],
        lastDoc: hasRangeFilters ? null : lastVisible,
        hasMore: hasRangeFilters ? false : snapshot.docs.length === PAGE_SIZE,
        isLoading: false,
      }));
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to fetch recipes';
      set({ error: message, isLoading: false });
    }
  },

  fetchRecipeById: async (id) => {
    set({ isLoading: true, error: null });
    try {
      const recipeDoc = await getDoc(doc(db, 'recipes', id));
      if (recipeDoc.exists()) {
        const recipe = { id: recipeDoc.id, ...recipeDoc.data() } as Recipe;
        set({ currentRecipe: recipe, isLoading: false });
        return recipe;
      }
      set({ isLoading: false });
      return null;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to fetch recipe';
      set({ error: message, isLoading: false });
      return null;
    }
  },

  fetchUserRecipes: async (userId) => {
    try {
      const q = query(
        collection(db, 'recipes'),
        where('authorId', '==', userId),
        orderBy('createdAt', 'desc')
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as Recipe[];
    } catch (error) {
      console.error('Error fetching user recipes:', error);
      return [];
    }
  },

  createRecipe: async (data, imageURL, authorId, authorName, isOfficial = false) => {
    set({ isLoading: true, error: null });
    try {
      // Calculate calories for each ingredient
      const ingredientsWithCalories: Ingredient[] = data.ingredients.map((ing) => ({
        ...ing,
        calories: calculateIngredientCalories(ing.name, ing.amount, ing.unit),
      }));

      // Calculate nutrition info
      const nutrition = calculateNutrition(ingredientsWithCalories, data.servings);

      const recipeData: Omit<Recipe, 'id'> = {
        ...data,
        imageURL,
        authorId,
        authorName,
        isOfficial,
        ingredients: ingredientsWithCalories,
        nutrition,
        likes: 0,
        createdAt: Timestamp.now(),
      };

      const recipeRef = doc(collection(db, 'recipes'));
      await setDoc(recipeRef, recipeData);

      set({ isLoading: false });
      return recipeRef.id;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to create recipe';
      set({ error: message, isLoading: false });
      throw error;
    }
  },

  updateRecipe: async (id, data) => {
    set({ isLoading: true, error: null });
    try {
      await updateDoc(doc(db, 'recipes', id), data);

      // Update local state
      set((state) => ({
        recipes: state.recipes.map((r) => (r.id === id ? { ...r, ...data } : r)),
        currentRecipe: state.currentRecipe?.id === id ? { ...state.currentRecipe, ...data } : state.currentRecipe,
        isLoading: false,
      }));
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to update recipe';
      set({ error: message, isLoading: false });
      throw error;
    }
  },

  deleteRecipe: async (id) => {
    set({ isLoading: true, error: null });
    try {
      await deleteDoc(doc(db, 'recipes', id));

      set((state) => ({
        recipes: state.recipes.filter((r) => r.id !== id),
        currentRecipe: state.currentRecipe?.id === id ? null : state.currentRecipe,
        isLoading: false,
      }));
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to delete recipe';
      set({ error: message, isLoading: false });
      throw error;
    }
  },

  likeRecipe: async (recipeId, userId) => {
    try {
      await updateDoc(doc(db, 'recipes', recipeId), {
        likes: increment(1),
      });

      set((state) => ({
        recipes: state.recipes.map((r) =>
          r.id === recipeId ? { ...r, likes: r.likes + 1 } : r
        ),
        currentRecipe:
          state.currentRecipe?.id === recipeId
            ? { ...state.currentRecipe, likes: state.currentRecipe.likes + 1 }
            : state.currentRecipe,
      }));
    } catch (error) {
      console.error('Error liking recipe:', error);
    }
  },

  unlikeRecipe: async (recipeId, userId) => {
    try {
      await updateDoc(doc(db, 'recipes', recipeId), {
        likes: increment(-1),
      });

      set((state) => ({
        recipes: state.recipes.map((r) =>
          r.id === recipeId ? { ...r, likes: Math.max(0, r.likes - 1) } : r
        ),
        currentRecipe:
          state.currentRecipe?.id === recipeId
            ? { ...state.currentRecipe, likes: Math.max(0, state.currentRecipe.likes - 1) }
            : state.currentRecipe,
      }));
    } catch (error) {
      console.error('Error unliking recipe:', error);
    }
  },

  saveRecipe: async (recipeId, userId) => {
    try {
      await updateDoc(doc(db, 'users', userId), {
        savedRecipes: arrayUnion(recipeId),
      });
    } catch (error) {
      console.error('Error saving recipe:', error);
    }
  },

  unsaveRecipe: async (recipeId, userId) => {
    try {
      await updateDoc(doc(db, 'users', userId), {
        savedRecipes: arrayRemove(recipeId),
      });
    } catch (error) {
      console.error('Error unsaving recipe:', error);
    }
  },

  searchRecipes: async (searchQuery) => {
    try {
      // For now, do client-side filtering
      // In production, you'd want to use Algolia or similar for full-text search
      const q = query(collection(db, 'recipes'), orderBy('title'), limit(50));
      const snapshot = await getDocs(q);
      const allRecipes = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Recipe[];

      const searchLower = searchQuery.toLowerCase();
      return allRecipes.filter(
        (recipe) =>
          recipe.title.toLowerCase().includes(searchLower) ||
          recipe.description.toLowerCase().includes(searchLower) ||
          recipe.tags.some((tag) => tag.toLowerCase().includes(searchLower)) ||
          recipe.ingredients.some((ing) => ing.name.toLowerCase().includes(searchLower))
      );
    } catch (error) {
      console.error('Error searching recipes:', error);
      return [];
    }
  },
}));
