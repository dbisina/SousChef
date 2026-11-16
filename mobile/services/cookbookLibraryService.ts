/**
 * Cookbook Library Service
 * 
 * Uses Gemini AI to suggest recipes a user could make from their
 * physical cookbook collection based on what's in their pantry.
 * 
 * This is the feature Eitan specifically asked for:
 * "If I can tell some app all the cookbooks I have in my collection,
 * and then let's say in the fridge, I have chicken, broccoli, a few
 * ingredients — are there any recipes in my cookbooks that have that in it?"
 */

import { CookbookSuggestion, CookbookRecipe, CookbookRecipeContent } from '@/types/cookbookLibrary';
import { PantryItem } from '@/types';
import { textModel } from '@/lib/gemini';
import { matchPantry } from '@shared/pantryMatch';

interface CookbookInfo {
    title: string;
    author?: string;
    recipes?: { name: string; keyIngredients?: string[] }[];
}

/**
 * Fetch the cover image URL for a cookbook using the Google Books API (free, no key needed).
 * Returns the highest-resolution thumbnail available, or null if not found.
 */
export async function fetchBookCoverImage(
    title: string,
    author?: string
): Promise<string | null> {
    try {
        const query = encodeURIComponent(
            `intitle:${title}${author ? `+inauthor:${author}` : ''}`
        );
        const url = `https://www.googleapis.com/books/v1/volumes?q=${query}&maxResults=3&printType=books`;
        const res = await fetch(url);
        if (!res.ok) return null;

        const data = await res.json();
        if (!data.items || data.items.length === 0) return null;

        // Find the best match — preferring ones with images
        for (const item of data.items) {
            const imageLinks = item.volumeInfo?.imageLinks;
            if (imageLinks) {
                // Try to get the highest quality: extraLarge > large > medium > small > thumbnail
                const imgUrl =
                    imageLinks.extraLarge ||
                    imageLinks.large ||
                    imageLinks.medium ||
                    imageLinks.small ||
                    imageLinks.thumbnail ||
                    imageLinks.smallThumbnail;

                if (imgUrl) {
                    // Google Books returns http — upgrade to https and
                    // bump zoom level for better quality
                    return imgUrl
                        .replace('http://', 'https://')
                        .replace('zoom=1', 'zoom=2')
                        .replace('&edge=curl', '');
                }
            }
        }
        return null;
    } catch (error) {
        console.error('[CookbookLibraryService] Cover image fetch error:', error);
        return null;
    }
}

/**
 * Search for a food/recipe image using TheMealDB (free, no key required).
 * Falls back to a Google Books embedded preview if available.
 */
export async function searchRecipeImage(
    recipeName: string
): Promise<string | null> {
    try {
        // 1. Try TheMealDB first — it has great food photos
        const mealQuery = encodeURIComponent(recipeName.split(' ').slice(0, 3).join(' '));
        const mealRes = await fetch(
            `https://www.themealdb.com/api/json/v1/1/search.php?s=${mealQuery}`
        );
        if (mealRes.ok) {
            const mealData = await mealRes.json();
            if (mealData.meals && mealData.meals.length > 0) {
                const thumb = mealData.meals[0].strMealThumb;
                if (thumb) return thumb;
            }
        }

        // 2. Try a broader search with just the first keyword
        const keyword = recipeName.split(' ')[0];
        const fallbackRes = await fetch(
            `https://www.themealdb.com/api/json/v1/1/search.php?s=${encodeURIComponent(keyword)}`
        );
        if (fallbackRes.ok) {
            const fallbackData = await fallbackRes.json();
            if (fallbackData.meals && fallbackData.meals.length > 0) {
                return fallbackData.meals[0].strMealThumb;
            }
        }

        return null;
    } catch (error) {
        console.error('[CookbookLibraryService] Recipe image search error:', error);
        return null;
    }
}

/**
 * Which recipes in the cookbooks the person owns could they cook from the pantry?
 *
 * Worked out here, not by an AI: each recipe on file is compared with the pantry by its key ingredients (the same
 * matching the rest of the app uses). That means no AI key on the phone, no cost, no waiting, and it can only ever
 * name recipes that are really on file for that cookbook. Recipes with no key ingredients on file cannot be judged
 * and are left out.
 */
export async function suggestRecipesFromCookbooks(
    cookbooks: CookbookInfo[],
    pantryItems: PantryItem[]
): Promise<CookbookSuggestion[]> {
    const pantryNames = pantryItems.map((item) => item.name);
    const scored: CookbookSuggestion[] = [];
    for (const book of cookbooks) {
        for (const recipe of book.recipes || []) {
            const key = (recipe.keyIngredients || []).filter((i) => i.trim().length > 0);
            if (key.length === 0) continue;
            const match = matchPantry(key.map((name) => ({ name })), pantryNames);
            if (match.matching.length === 0) continue; // nothing in common is not a suggestion
            scored.push({
                cookbookTitle: book.title,
                recipeName: recipe.name,
                confidence: Math.round(match.matchPercent) / 100,
                reason: match.canMake
                    ? 'You have every key ingredient.'
                    : `You have ${match.matching.length} of ${match.matching.length + match.missing.length} key ingredients.`,
                matchingIngredients: match.matching,
                missingIngredients: match.missing,
            });
        }
    }
    // Best match first; fewer missing ingredients break ties, then the name keeps the order steady.
    const top = scored
        .sort((a, b) => b.confidence - a.confidence || a.missingIngredients.length - b.missingIngredients.length || a.recipeName.localeCompare(b.recipeName))
        .slice(0, 5);

    // Food photos are a nice-to-have; a failure to find one never hides a suggestion.
    return Promise.all(
        top.map(async (s) => {
            const imageURL = await searchRecipeImage(s.recipeName).catch(() => null);
            return { ...s, imageURL: imageURL || undefined };
        })
    );
}

/**
 * Search for cookbook metadata (title, author, cover) based on a title query.
 * Uses Gemini to provide known cookbook details.
 */
export async function lookupCookbook(
    query: string
): Promise<{ title: string; author: string; description: string; coverColor?: string } | null> {
    const model = textModel;

    const prompt = `The user is looking for a cookbook called "${query}". 
Provide the correct full title, author name, a one-sentence description, and pick a hex color that best represents this cookbook's cover/vibe (e.g. warm red for Italian, green for vegetarian, etc.).
If this is a well-known cookbook, provide accurate details.
If not, provide your best guess.

Return as JSON: { "title": "Full Title", "author": "Author Name", "description": "One sentence", "coverColor": "#hexcolor" }
Return ONLY the JSON, no markdown.`;

    try {
        const result = await model.generateContent(prompt);
        const text = result.response.text();
        const cleaned = text
            .replace(/```json\n?/g, '')
            .replace(/```\n?/g, '')
            .trim();
        return JSON.parse(cleaned);
    } catch (error) {
        console.error('[CookbookLibraryService] Lookup error:', error);
        return null;
    }
}

/**
 * Fetch all recipes from a cookbook by searching online.
 * Uses Gemini's knowledge of published cookbooks to return a table of contents.
 * Returns { recipes, isComplete } — isComplete=false means the AI couldn't
 * find the full list and the user should scan/upload instead.
 */
export async function fetchCookbookRecipes(
    title: string,
    author?: string
): Promise<{ recipes: CookbookRecipe[]; isComplete: boolean }> {
    const model = textModel;

    const bookRef = `"${title}"${author ? ` by ${author}` : ''}`;

    const prompt = `You are a culinary expert with encyclopedic knowledge of published cookbooks.

I need the COMPLETE table of contents / recipe list from the cookbook ${bookRef}.

Search your knowledge thoroughly. For each recipe in the book, provide:
- The recipe name (exact name as it appears in the book)
- The page number if you know it (or null)
- A brief one-sentence description of the dish
- 3-5 key ingredients

IMPORTANT: 
- Be as thorough as possible — list ALL recipes, not just the popular ones.
- If this is a well-known cookbook, you should know most or all recipes.
- If you're not confident you have the complete list, set "isComplete" to false.
- If you don't recognize this cookbook at all, return an empty list with "isComplete": false.

Return as JSON:
{
  "isComplete": true,
  "recipes": [
    {
      "name": "Recipe Name",
      "pageNumber": 42,
      "description": "A brief description",
      "keyIngredients": ["chicken", "lemon", "garlic"]
    }
  ]
}

Return ONLY the JSON, no markdown or other text.`;

    try {
        const result = await model.generateContent(prompt);
        const text = result.response.text();

        const cleaned = text
            .replace(/```json\n?/g, '')
            .replace(/```\n?/g, '')
            .trim();

        const parsed = JSON.parse(cleaned);

        const recipes: CookbookRecipe[] = (parsed.recipes || []).map(
            (r: any, index: number) => ({
                id: `fetched-${Date.now()}-${index}`,
                name: r.name || 'Untitled Recipe',
                pageNumber: r.pageNumber || undefined,
                source: 'fetched' as const,
                description: r.description || undefined,
                keyIngredients: r.keyIngredients || [],
            })
        );

        return {
            recipes,
            isComplete: parsed.isComplete === true && recipes.length > 0,
        };
    } catch (error) {
        console.error('[CookbookLibraryService] Recipe fetch error:', error);
        return { recipes: [], isComplete: false };
    }
}

/**
 * Fetch the full recipe content (ingredients, instructions, nutrition)
 * for a specific recipe from a cookbook. Uses Gemini's knowledge of the book.
 */
export async function fetchFullRecipeContent(
    recipeName: string,
    cookbookTitle: string,
    author?: string
): Promise<CookbookRecipeContent | null> {
    const model = textModel;

    const bookRef = `"${cookbookTitle}"${author ? ` by ${author}` : ''}`;

    const prompt = `You are a culinary expert with encyclopedic knowledge of published cookbooks.

Provide the FULL recipe for "${recipeName}" from the cookbook ${bookRef}.

I need the complete recipe including:
- A brief description of the dish (1-2 sentences)
- Prep time and cook time in minutes
- Number of servings
- Difficulty level (easy, medium, or hard)
- Complete ingredient list with amounts and units
- Step-by-step instructions (clear, numbered steps)
- Any helpful tips or notes
- Basic nutrition estimate per serving (calories, protein, carbs, fat)

IMPORTANT:
- Be as accurate as possible to the original recipe from the book.
- If you're not 100% sure of exact measurements, provide your best approximation based on your knowledge of the recipe.
- Instructions should be detailed and clear enough to follow.

Return as JSON:
{
  "description": "Brief description of the dish",
  "prepTime": 15,
  "cookTime": 30,
  "servings": 4,
  "difficulty": "medium",
  "ingredients": [
    { "name": "chicken breast", "amount": "2", "unit": "lbs" }
  ],
  "instructions": [
    "Preheat oven to 375°F.",
    "Season the chicken with salt and pepper.",
    "..."
  ],
  "tips": "Optional tips or notes about the recipe",
  "nutrition": {
    "caloriesPerServing": 350,
    "protein": 30,
    "carbs": 20,
    "fat": 15
  }
}

Return ONLY the JSON, no markdown or other text.`;

    try {
        // Fetch recipe content and image in parallel
        const [geminiResult, imageURL] = await Promise.all([
            model.generateContent(prompt),
            searchRecipeImage(recipeName),
        ]);

        const text = geminiResult.response.text();

        const cleaned = text
            .replace(/```json\n?/g, '')
            .replace(/```\n?/g, '')
            .trim();

        const parsed = JSON.parse(cleaned);

        return {
            description: parsed.description || '',
            imageURL: imageURL || undefined,
            prepTime: parsed.prepTime || 0,
            cookTime: parsed.cookTime || 0,
            servings: parsed.servings || 4,
            difficulty: parsed.difficulty || 'medium',
            ingredients: (parsed.ingredients || []).map((i: any) => ({
                name: i.name || '',
                amount: String(i.amount || ''),
                unit: i.unit || '',
            })),
            instructions: parsed.instructions || [],
            tips: parsed.tips || undefined,
            nutrition: parsed.nutrition
                ? {
                    caloriesPerServing: parsed.nutrition.caloriesPerServing || 0,
                    protein: parsed.nutrition.protein || 0,
                    carbs: parsed.nutrition.carbs || 0,
                    fat: parsed.nutrition.fat || 0,
                }
                : undefined,
        };
    } catch (error) {
        console.error('[CookbookLibraryService] Full recipe fetch error:', error);
        return null;
    }
}
