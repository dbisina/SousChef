import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CookbookEntry, CookbookSuggestion, CookbookRecipe } from '@/types/cookbookLibrary';
import { PantryItem } from '@/types';
import { generateId } from '@/lib/firebase';
import { suggestRecipesFromCookbooks, fetchCookbookRecipes, fetchFullRecipeContent } from '@/services/cookbookLibraryService';

interface CookbookLibraryState {
    cookbooks: CookbookEntry[];
    isLoading: boolean;
    suggestions: CookbookSuggestion[];
    isSuggesting: boolean;

    // Actions
    addCookbook: (title: string, author?: string, opts?: { description?: string; coverColor?: string; coverImageURL?: string }) => string;
    removeCookbook: (id: string) => void;
    updateCookbook: (id: string, updates: Partial<CookbookEntry>) => void;
    incrementRecipesScanned: (id: string) => void;
    getSuggestions: (pantryItems: PantryItem[]) => Promise<void>;
    clearSuggestions: () => void;
    fetchRecipesForCookbook: (id: string) => Promise<{ isComplete: boolean }>;
    addScannedRecipe: (cookbookId: string, recipe: CookbookRecipe) => void;
    fetchFullRecipe: (cookbookId: string, recipeId: string) => Promise<boolean>;
}

export const useCookbookLibraryStore = create<CookbookLibraryState>()(
    persist(
        (set, get) => ({
            cookbooks: [],
            isLoading: false,
            suggestions: [],
            isSuggesting: false,

            addCookbook: (title, author, opts) => {
                const newEntry: CookbookEntry = {
                    id: generateId(),
                    title: title.trim(),
                    author: author?.trim(),
                    description: opts?.description,
                    coverColor: opts?.coverColor,
                    coverImageURL: opts?.coverImageURL,
                    addedAt: new Date().toISOString(),
                    recipesScanned: 0,
                    recipes: [],
                    fetchStatus: 'idle',
                };
                set((state) => ({
                    cookbooks: [...state.cookbooks, newEntry],
                }));
                return newEntry.id;
            },

            removeCookbook: (id) => {
                set((state) => ({
                    cookbooks: state.cookbooks.filter((c) => c.id !== id),
                }));
            },

            updateCookbook: (id, updates) => {
                set((state) => ({
                    cookbooks: state.cookbooks.map((c) =>
                        c.id === id ? { ...c, ...updates } : c
                    ),
                }));
            },

            incrementRecipesScanned: (id) => {
                set((state) => ({
                    cookbooks: state.cookbooks.map((c) =>
                        c.id === id ? { ...c, recipesScanned: c.recipesScanned + 1 } : c
                    ),
                }));
            },

            getSuggestions: async (pantryItems) => {
                const { cookbooks } = get();
                if (cookbooks.length === 0 || pantryItems.length === 0) {
                    set({ suggestions: [] });
                    return;
                }

                set({ isSuggesting: true });
                try {
                    const suggestions = await suggestRecipesFromCookbooks(
                        cookbooks.map((c) => ({
                            title: c.title,
                            author: c.author,
                            recipes: (c.recipes || []).map((r) => ({
                                name: r.name,
                                keyIngredients: r.keyIngredients,
                            })),
                        })),
                        pantryItems
                    );
                    set({ suggestions, isSuggesting: false });
                } catch (error) {
                    console.error('Error getting cookbook suggestions:', error);
                    set({ isSuggesting: false });
                }
            },

            clearSuggestions: () => set({ suggestions: [] }),

            fetchRecipesForCookbook: async (id) => {
                const cookbook = get().cookbooks.find((c) => c.id === id);
                if (!cookbook) return { isComplete: false };

                // Mark as fetching
                set((state) => ({
                    cookbooks: state.cookbooks.map((c) =>
                        c.id === id ? { ...c, fetchStatus: 'fetching' as const } : c
                    ),
                }));

                try {
                    const { recipes, isComplete } = await fetchCookbookRecipes(
                        cookbook.title,
                        cookbook.author
                    );

                    set((state) => ({
                        cookbooks: state.cookbooks.map((c) => {
                            if (c.id !== id) return c;
                            // Keep user-scanned recipes, replace AI-fetched ones to avoid duplicates on retry
                            const scannedRecipes = c.recipes.filter((r) => r.source !== 'fetched');
                            const allRecipes = [...scannedRecipes, ...recipes];
                            return {
                                ...c,
                                recipes: allRecipes,
                                recipesScanned: allRecipes.length,
                                fetchStatus: isComplete ? 'done' : (recipes.length > 0 ? 'partial' : 'failed'),
                            };
                        }),
                    }));

                    return { isComplete };
                } catch (error) {
                    console.error('Error fetching cookbook recipes:', error);
                    set((state) => ({
                        cookbooks: state.cookbooks.map((c) =>
                            c.id === id ? { ...c, fetchStatus: 'failed' as const } : c
                        ),
                    }));
                    return { isComplete: false };
                }
            },

            addScannedRecipe: (cookbookId, recipe) => {
                set((state) => ({
                    cookbooks: state.cookbooks.map((c) =>
                        c.id === cookbookId
                            ? {
                                ...c,
                                recipes: [...c.recipes, recipe],
                                recipesScanned: c.recipesScanned + 1,
                            }
                            : c
                    ),
                }));
            },

            fetchFullRecipe: async (cookbookId, recipeId) => {
                const cookbook = get().cookbooks.find((c) => c.id === cookbookId);
                if (!cookbook) return false;

                const recipe = cookbook.recipes.find((r) => r.id === recipeId);
                if (!recipe) return false;

                // Already fetched
                if (recipe.fullContent) return true;

                try {
                    const content = await fetchFullRecipeContent(
                        recipe.name,
                        cookbook.title,
                        cookbook.author
                    );

                    if (!content) return false;

                    set((state) => ({
                        cookbooks: state.cookbooks.map((c) =>
                            c.id === cookbookId
                                ? {
                                    ...c,
                                    recipes: c.recipes.map((r) =>
                                        r.id === recipeId
                                            ? { ...r, fullContent: content }
                                            : r
                                    ),
                                }
                                : c
                        ),
                    }));

                    return true;
                } catch (error) {
                    console.error('Error fetching full recipe:', error);
                    return false;
                }
            },
        }),
        {
            name: 'souschef-cookbook-library',
            storage: createJSONStorage(() => AsyncStorage),
            partialize: (state) => ({
                cookbooks: state.cookbooks,
                suggestions: state.suggestions,
            }),
        }
    )
);
