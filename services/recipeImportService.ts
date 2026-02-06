import { Timestamp } from 'firebase/firestore';
import {
  ImportedRecipe,
  URLExtractionResponse,
  CookbookScanResponse,
  PantryMatchResult,
} from '@/types/wantToCook';
import { Ingredient, PantryItem } from '@/types';
import { generateId } from '@/lib/firebase';

const OPENAI_API_KEY = process.env.EXPO_PUBLIC_OPENAI_API_KEY;

// Detect platform from URL
export const detectPlatform = (url: string): string => {
  const lowercaseUrl = url.toLowerCase();
  if (lowercaseUrl.includes('tiktok.com')) return 'tiktok';
  if (lowercaseUrl.includes('instagram.com')) return 'instagram';
  if (lowercaseUrl.includes('youtube.com') || lowercaseUrl.includes('youtu.be')) return 'youtube';
  if (lowercaseUrl.includes('pinterest.com')) return 'pinterest';
  if (lowercaseUrl.includes('facebook.com')) return 'facebook';
  if (lowercaseUrl.includes('allrecipes.com')) return 'allrecipes';
  if (lowercaseUrl.includes('foodnetwork.com')) return 'foodnetwork';
  if (lowercaseUrl.includes('bonappetit.com')) return 'bonappetit';
  if (lowercaseUrl.includes('seriouseats.com')) return 'seriouseats';
  if (lowercaseUrl.includes('tasty.co')) return 'tasty';
  if (lowercaseUrl.includes('delish.com')) return 'delish';
  if (lowercaseUrl.includes('epicurious.com')) return 'epicurious';
  if (lowercaseUrl.includes('nytimes.com/cooking')) return 'nyt_cooking';
  return 'website';
};

// Extract recipe from URL using AI
export const extractRecipeFromURL = async (
  url: string
): Promise<URLExtractionResponse> => {
  try {
    // First, fetch the webpage content
    const pageContent = await fetchPageContent(url);

    if (!pageContent) {
      return {
        success: false,
        error: 'Could not fetch page content. Please check the URL.',
        confidence: 0,
      };
    }

    // Use AI to extract recipe from content
    const recipe = await parseRecipeWithAI(pageContent, url);

    if (!recipe) {
      return {
        success: false,
        error: 'Could not extract recipe from this page. Try a different URL.',
        confidence: 0,
      };
    }

    return {
      success: true,
      recipe,
      confidence: recipe.extractionConfidence,
    };
  } catch (error) {
    console.error('Recipe extraction error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to extract recipe',
      confidence: 0,
    };
  }
};

// Fetch page content (simplified - in production, use a proxy or serverless function)
const fetchPageContent = async (url: string): Promise<string | null> => {
  try {
    // For video platforms, we'll use a different approach
    const platform = detectPlatform(url);

    if (['tiktok', 'instagram', 'youtube'].includes(platform)) {
      // For video platforms, we'll send just the URL to AI and let it work with metadata
      return `VIDEO_URL: ${url}\nPLATFORM: ${platform}\nPlease extract any recipe information from this video URL.`;
    }

    // For regular websites, try to fetch content
    // Note: This may not work for all sites due to CORS. In production, use a backend proxy.
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SousChef/1.0; Recipe Extractor)',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.status}`);
    }

    const html = await response.text();

    // Extract text content (strip HTML tags for simpler processing)
    const textContent = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 15000); // Limit content size

    return textContent;
  } catch (error) {
    console.error('Fetch error:', error);
    // Return URL only as fallback - AI can sometimes work with just the URL
    return `URL: ${url}\nCould not fetch full content. Please extract recipe based on URL patterns and common recipe structures.`;
  }
};

// Parse recipe content using AI
const parseRecipeWithAI = async (
  content: string,
  sourceURL: string
): Promise<ImportedRecipe | null> => {
  if (!OPENAI_API_KEY) {
    console.error('OpenAI API key not configured');
    // Return mock data for development
    return createMockRecipe(sourceURL);
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a recipe extraction assistant. Extract recipe information from the provided content and return it as JSON.

Return ONLY valid JSON with this exact structure:
{
  "title": "Recipe Name",
  "description": "Brief description",
  "ingredients": [
    {"name": "ingredient name", "amount": 1, "unit": "cup", "optional": false}
  ],
  "instructions": ["Step 1", "Step 2"],
  "servings": 4,
  "prepTime": 15,
  "cookTime": 30,
  "difficulty": "easy|medium|hard",
  "cuisine": "italian|mexican|chinese|american|etc",
  "category": "dinner|lunch|breakfast|dessert|snack|appetizer",
  "tags": ["tag1", "tag2"],
  "confidence": 0.85
}

If you cannot extract a recipe, return: {"error": "reason", "confidence": 0}

Important:
- All amounts should be numbers (convert "1/2" to 0.5)
- Include ALL ingredients mentioned
- Keep instructions clear and numbered
- Estimate prep/cook times if not stated
- Set confidence between 0-1 based on extraction quality`,
          },
          {
            role: 'user',
            content: `Extract the recipe from this content:\n\n${content}`,
          },
        ],
        temperature: 0.3,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const aiResponse = data.choices[0]?.message?.content;

    if (!aiResponse) {
      throw new Error('No response from AI');
    }

    // Parse JSON response
    const parsed = JSON.parse(aiResponse);

    if (parsed.error) {
      console.error('AI extraction error:', parsed.error);
      return null;
    }

    // Convert to ImportedRecipe format
    const recipe: ImportedRecipe = {
      id: generateId(),
      title: parsed.title || 'Untitled Recipe',
      description: parsed.description || '',
      sourceURL,
      sourcePlatform: detectPlatform(sourceURL),
      ingredients: (parsed.ingredients || []).map((ing: any, index: number) => ({
        name: ing.name || `Ingredient ${index + 1}`,
        amount: typeof ing.amount === 'number' ? ing.amount : parseFloat(ing.amount) || 1,
        unit: ing.unit || 'piece',
        calories: 0, // Will be calculated later
        optional: ing.optional || false,
      })),
      instructions: parsed.instructions || [],
      servings: parsed.servings || 4,
      prepTime: parsed.prepTime,
      cookTime: parsed.cookTime,
      difficulty: parsed.difficulty,
      cuisine: parsed.cuisine,
      category: parsed.category,
      tags: parsed.tags || [],
      extractedAt: Timestamp.now(),
      extractionConfidence: parsed.confidence || 0.7,
      rawContent: content.slice(0, 1000), // Store first 1000 chars for reference
    };

    return recipe;
  } catch (error) {
    console.error('AI parsing error:', error);
    return null;
  }
};

// Create mock recipe for development/testing
const createMockRecipe = (sourceURL: string): ImportedRecipe => {
  return {
    id: generateId(),
    title: 'Imported Recipe (Demo)',
    description: 'This recipe was imported from ' + detectPlatform(sourceURL),
    sourceURL,
    sourcePlatform: detectPlatform(sourceURL),
    ingredients: [
      { name: 'Chicken breast', amount: 2, unit: 'pieces', calories: 165, optional: false },
      { name: 'Olive oil', amount: 2, unit: 'tbsp', calories: 240, optional: false },
      { name: 'Garlic', amount: 3, unit: 'cloves', calories: 15, optional: false },
      { name: 'Lemon', amount: 1, unit: 'whole', calories: 20, optional: false },
      { name: 'Fresh rosemary', amount: 2, unit: 'sprigs', calories: 5, optional: true },
      { name: 'Salt', amount: 1, unit: 'tsp', calories: 0, optional: false },
      { name: 'Black pepper', amount: 0.5, unit: 'tsp', calories: 0, optional: false },
    ],
    instructions: [
      'Preheat oven to 400°F (200°C).',
      'Season chicken breasts with salt and pepper.',
      'Heat olive oil in an oven-safe skillet over medium-high heat.',
      'Sear chicken for 3 minutes per side until golden.',
      'Add garlic and rosemary to the pan.',
      'Squeeze lemon juice over chicken.',
      'Transfer to oven and bake for 15-20 minutes until cooked through.',
      'Let rest for 5 minutes before serving.',
    ],
    servings: 2,
    prepTime: 10,
    cookTime: 25,
    difficulty: 'easy',
    cuisine: 'mediterranean',
    category: 'dinner',
    tags: ['chicken', 'healthy', 'quick', 'lemon'],
    extractedAt: Timestamp.now(),
    extractionConfidence: 0.95,
  };
};

// Extract recipe from cookbook photo using OCR + AI
export const extractRecipeFromPhoto = async (
  imageUri: string,
  cookbookName?: string
): Promise<CookbookScanResponse> => {
  if (!OPENAI_API_KEY) {
    return {
      success: false,
      error: 'AI service not configured',
      confidence: 0,
    };
  }

  try {
    // Convert image to base64
    const response = await fetch(imageUri);
    const blob = await response.blob();
    const base64 = await blobToBase64(blob);

    // Use GPT-4 Vision to extract recipe
    const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are a cookbook recipe extractor. Analyze the image of a cookbook page and extract the recipe.

Return ONLY valid JSON with this structure:
{
  "title": "Recipe Name",
  "description": "Brief description",
  "ingredients": [
    {"name": "ingredient", "amount": 1, "unit": "cup", "optional": false}
  ],
  "instructions": ["Step 1", "Step 2"],
  "servings": 4,
  "prepTime": 15,
  "cookTime": 30,
  "confidence": 0.85
}`,
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Extract the recipe from this cookbook page${cookbookName ? ` from "${cookbookName}"` : ''}.`,
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/jpeg;base64,${base64}`,
                },
              },
            ],
          },
        ],
        max_tokens: 2000,
      }),
    });

    if (!aiResponse.ok) {
      throw new Error(`Vision API error: ${aiResponse.status}`);
    }

    const data = await aiResponse.json();
    const parsed = JSON.parse(data.choices[0]?.message?.content || '{}');

    if (parsed.error) {
      return {
        success: false,
        error: parsed.error,
        confidence: 0,
      };
    }

    const recipe: ImportedRecipe = {
      id: generateId(),
      title: parsed.title || 'Scanned Recipe',
      description: parsed.description || '',
      sourceURL: `cookbook://${cookbookName || 'unknown'}`,
      sourcePlatform: 'cookbook_scan',
      ingredients: (parsed.ingredients || []).map((ing: any) => ({
        name: ing.name,
        amount: parseFloat(ing.amount) || 1,
        unit: ing.unit || 'piece',
        calories: 0,
        optional: ing.optional || false,
      })),
      instructions: parsed.instructions || [],
      servings: parsed.servings || 4,
      prepTime: parsed.prepTime,
      cookTime: parsed.cookTime,
      tags: [],
      extractedAt: Timestamp.now(),
      extractionConfidence: parsed.confidence || 0.7,
    };

    return {
      success: true,
      recipe,
      confidence: recipe.extractionConfidence,
    };
  } catch (error) {
    console.error('Photo extraction error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to scan recipe',
      confidence: 0,
    };
  }
};

// Helper to convert blob to base64
const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = (reader.result as string).split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

// Calculate pantry match for a recipe
export const calculatePantryMatch = (
  ingredients: Ingredient[],
  pantryItems: PantryItem[]
): PantryMatchResult => {
  const matching: PantryMatchResult['matchingIngredients'] = [];
  const missing: PantryMatchResult['missingIngredients'] = [];

  // Normalize ingredient names for comparison
  const normalizeString = (s: string) => s.toLowerCase().trim().replace(/s$/, '');

  // Create a map of pantry items for quick lookup
  const pantryMap = new Map<string, PantryItem>();
  pantryItems.forEach((item) => {
    pantryMap.set(normalizeString(item.name), item);
    // Also add without common prefixes/suffixes
    const simplified = normalizeString(item.name)
      .replace(/^fresh\s+/, '')
      .replace(/^dried\s+/, '')
      .replace(/\s+powder$/, '');
    pantryMap.set(simplified, item);
  });

  ingredients.forEach((ingredient) => {
    const normalizedName = normalizeString(ingredient.name);
    const simplifiedName = normalizedName
      .replace(/^fresh\s+/, '')
      .replace(/^dried\s+/, '')
      .replace(/\s+powder$/, '');

    // Check for match
    const pantryItem = pantryMap.get(normalizedName) || pantryMap.get(simplifiedName);

    if (pantryItem) {
      matching.push({
        ingredient: ingredient.name,
        pantryItem: pantryItem.name,
        amountAvailable: pantryItem.amount,
        amountNeeded: ingredient.amount,
        unit: ingredient.unit,
      });
    } else if (!ingredient.optional) {
      // Only count non-optional ingredients as missing
      missing.push({
        ingredient: ingredient.name,
        amount: ingredient.amount,
        unit: ingredient.unit,
      });
    }
  });

  const totalRequired = ingredients.filter((i) => !i.optional).length;
  const matchPercent = totalRequired > 0
    ? Math.round((matching.length / totalRequired) * 100)
    : 0;

  return {
    recipeId: '',
    matchPercent,
    matchingIngredients: matching,
    missingIngredients: missing,
    canMake: missing.length === 0,
  };
};

// Generate shopping list from recipe ingredients
export const generateShoppingList = (
  ingredients: Ingredient[],
  pantryItems: PantryItem[],
  recipeName: string,
  recipeId: string
): Array<{
  name: string;
  amount: number;
  unit: string;
  recipeName: string;
  recipeId: string;
}> => {
  const match = calculatePantryMatch(ingredients, pantryItems);

  return match.missingIngredients.map((missing) => ({
    name: missing.ingredient,
    amount: missing.amount,
    unit: missing.unit,
    recipeName,
    recipeId,
  }));
};
