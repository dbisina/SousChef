/** Full recipe content fetched on-demand from Gemini */
export interface CookbookRecipeContent {
    description: string;
    /** URL to a representative image of the dish */
    imageURL?: string;
    prepTime: number;       // minutes
    cookTime: number;       // minutes
    servings: number;
    difficulty: 'easy' | 'medium' | 'hard';
    ingredients: { name: string; amount: string; unit: string }[];
    instructions: string[];
    tips?: string;
    nutrition?: {
        caloriesPerServing: number;
        protein: number;
        carbs: number;
        fat: number;
    };
}

/** A recipe found/fetched from a cookbook */
export interface CookbookRecipe {
    id: string;
    name: string;
    pageNumber?: number;
    /** 'fetched' = AI found it online, 'scanned' = user scanned/uploaded */
    source: 'fetched' | 'scanned';
    /** Brief description from AI */
    description?: string;
    /** Key ingredients the AI found for this recipe */
    keyIngredients?: string[];
    /** Full recipe content, fetched on-demand when user opens the recipe */
    fullContent?: CookbookRecipeContent;
}

export interface CookbookEntry {
    id: string;
    title: string;
    author?: string;
    coverImageURL?: string;
    /** Hex color representing the cookbook's cover/vibe */
    coverColor?: string;
    /** Short description from AI */
    description?: string;
    /** ISO string — stored in AsyncStorage, so we avoid Firebase Timestamp */
    addedAt: string;
    /** Number of recipes extracted/scanned from this cookbook */
    recipesScanned: number;
    /** Recipes that have been fetched by AI or scanned by user */
    recipes: CookbookRecipe[];
    /** Status of the AI recipe fetch */
    fetchStatus: 'idle' | 'fetching' | 'done' | 'partial' | 'failed';
}

export interface CookbookLibrary {
    userId: string;
    cookbooks: CookbookEntry[];
    updatedAt: string;
}

export interface CookbookSuggestion {
    cookbookTitle: string;
    recipeName: string;
    confidence: number;
    reason: string;
    matchingIngredients: string[];
    missingIngredients: string[];
    /** Food photo URL from TheMealDB */
    imageURL?: string;
}
