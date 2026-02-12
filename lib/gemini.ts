import { GoogleGenerativeAI, Part } from '@google/generative-ai';
import { cacheDirectory, downloadAsync, deleteAsync, readAsStringAsync, getInfoAsync } from 'expo-file-system/legacy';
import {
  AISubstitutionResult,
  Ingredient,
  PortionAnalysis,
  SubstitutionSuggestion,
} from '@/types';

// ── Multi-key failover for Gemini AI ──────────────────────────────
// Collects all configured API keys and rotates automatically when
// one is exhausted (429 / quota) or returns 401 / 503.
const apiKeys = [
  process.env.EXPO_PUBLIC_GEMINI_API_KEY,
  process.env.EXPO_PUBLIC_GEMINI_API_KEY_2,
  process.env.EXPO_PUBLIC_GEMINI_API_KEY_3,
  process.env.EXPO_PUBLIC_GEMINI_API_KEY_4,
  process.env.EXPO_PUBLIC_GEMINI_API_KEY_5,
].filter(Boolean) as string[];

if (apiKeys.length === 0) {
  console.warn('[Gemini] No API keys configured — AI features will not work');
}

const clients = apiKeys.map((key) => new GoogleGenerativeAI(key));

/** Index of the key that should be tried first (updated on success). */
let activeKeyIndex = 0;

/** Returns true for errors that suggest a different key might succeed. */
const isRotatableError = (error: any): boolean => {
  const msg = String(error?.message ?? error ?? '');
  return (
    /\b(429|quota|rate.?limit|resource.?exhausted)\b/i.test(msg) ||
    /\b(401|403|unauthorized|forbidden|invalid.*key|API keys are not supported)\b/i.test(msg) ||
    /\b503\b/.test(msg)
  );
};

/**
 * Create a model-like object with automatic key rotation.
 * Exposes `.generateContent()` and `.generateContentStream()` compatible with the raw SDK model.
 */
const createFailoverModel = (modelName: string) => {
  // Pre-create one model instance per key
  const models = clients.map((c) => c.getGenerativeModel({ model: modelName }));

  return {
    generateContent: async (request: any) => {
      if (models.length === 0) {
        throw new Error('[Gemini] No API keys configured');
      }

      let firstError: any;

      for (let attempt = 0; attempt < models.length; attempt++) {
        const idx = (activeKeyIndex + attempt) % models.length;
        try {
          const result = await models[idx].generateContent(request);
          // Success — lock this key as the preferred one
          if (idx !== activeKeyIndex) {
            console.log(`[Gemini] Switched active key to ${idx + 1}/${models.length}`);
            activeKeyIndex = idx;
          }
          return result;
        } catch (error: any) {
          if (attempt === 0) firstError = error;
          console.warn(
            `[Gemini] Key ${idx + 1}/${models.length} failed:`,
            error?.message?.slice(0, 140),
          );

          if (isRotatableError(error) && attempt < models.length - 1) {
            console.log('[Gemini] Rotating to next API key...');
            continue;
          }

          // Non-rotatable error or last key — throw the first error
          // (it's usually more informative than the fallback error)
          throw firstError ?? error;
        }
      }

      throw firstError;
    },

    generateContentStream: async (request: any) => {
      if (models.length === 0) {
        throw new Error('[Gemini] No API keys configured');
      }

      let firstError: any;

      for (let attempt = 0; attempt < models.length; attempt++) {
        const idx = (activeKeyIndex + attempt) % models.length;
        try {
          const result = await models[idx].generateContentStream(request);
          if (idx !== activeKeyIndex) {
            console.log(`[Gemini] Stream switched active key to ${idx + 1}/${models.length}`);
            activeKeyIndex = idx;
          }
          return result;
        } catch (error: any) {
          if (attempt === 0) firstError = error;
          console.warn(
            `[Gemini] Stream key ${idx + 1}/${models.length} failed:`,
            error?.message?.slice(0, 140),
          );

          if (isRotatableError(error) && attempt < models.length - 1) {
            console.log('[Gemini] Rotating to next API key...');
            continue;
          }

          throw firstError ?? error;
        }
      }

      throw firstError;
    },
  };
};

const generateTempId = () => Date.now().toString(36) + Math.random().toString(36).substr(2);

// Model configurations (with automatic key failover)
const textModel = createFailoverModel('gemini-3-flash-preview');
const visionModel = createFailoverModel('gemini-3-flash-preview');

// Check if base64 data starts with valid image magic bytes
const isValidImageBase64 = (base64: string): boolean => {
  // JPEG: /9j/ (FFD8FF), PNG: iVBOR (89504E47), GIF: R0lG (47494638),
  // WebP: UklG (52494646), BMP: Qk (424D)
  return /^(\/9j\/|iVBOR|R0lG|UklG|Qk)/.test(base64);
};

// Detect MIME type from base64 magic bytes
const detectMimeFromBase64 = (base64: string): string => {
  if (base64.startsWith('/9j/')) return 'image/jpeg';
  if (base64.startsWith('iVBOR')) return 'image/png';
  if (base64.startsWith('R0lG')) return 'image/gif';
  if (base64.startsWith('UklG')) return 'image/webp';
  if (base64.startsWith('Qk')) return 'image/bmp';
  return 'image/jpeg'; // fallback
};

// Convert local image to base64 for Gemini Vision
export const imageToBase64 = async (uri: string): Promise<string> => {
  try {
    // Handle remote URLs
    if (uri.startsWith('http://') || uri.startsWith('https://')) {
      // Decode any HTML entities that may have leaked from og-tag extraction
      const cleanUrl = uri
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"');
      const filename = cleanUrl.split('/').pop()?.split('?')[0] || 'temp_image';
      const fileExtension = filename.split('.').pop() || 'jpg';
      const localUri = `${cacheDirectory}gemini_${generateTempId()}.${fileExtension}`;

      const { uri: downloadedUri } = await downloadAsync(cleanUrl, localUri);

      const base64 = await readAsStringAsync(downloadedUri, {
        encoding: 'base64',
      });

      // Clean up
      try {
        await deleteAsync(downloadedUri, { idempotent: true });
      } catch (e) {
        // Ignore cleanup errors
      }

      return base64;
    }

    // Handle local URIs
    const base64 = await readAsStringAsync(uri, {
      encoding: 'base64',
    });
    return base64;
  } catch (error) {
    console.error('Error converting image to base64:', error);
    throw error;
  }
};

// Create image part for Gemini Vision
export const createImagePart = async (uri: string): Promise<Part> => {
  const base64 = await imageToBase64(uri);

  // Validate that the downloaded data is actually an image
  if (!isValidImageBase64(base64)) {
    throw new Error('Downloaded data is not a valid image (possibly an HTML redirect or error page)');
  }

  // Detect MIME type from actual content, not just the URL extension
  const mimeType = detectMimeFromBase64(base64);

  return {
    inlineData: {
      data: base64,
      mimeType,
    },
  };
};

// Safe version of createImagePart that returns null instead of throwing
export const createImagePartSafe = async (uri: string): Promise<Part | null> => {
  try {
    return await createImagePart(uri);
  } catch (e) {
    console.warn('Could not create image part from:', uri, e);
    return null;
  }
};

// Create video part for Gemini Vision
export const createVideoPart = async (uri: string): Promise<Part> => {
  // Reuse imageToBase64 logic as it handles download and base64 conversion generically
  // We might want to rename it to fileToBase64 later, but it works for now.
  const base64 = await imageToBase64(uri);
  // Determine mime type - default to mp4
  const mimeType = uri.toLowerCase().endsWith('.mov') ? 'video/quicktime' : 'video/mp4';

  return {
    inlineData: {
      data: base64,
      mimeType,
    },
  };
};

// Analyze ingredients for substitutions
export const analyzeIngredientSubstitutions = async (
  recipeIngredients: Ingredient[],
  availableIngredients: string[]
): Promise<AISubstitutionResult> => {
  const prompt = `You are a professional chef assistant. Analyze the following recipe ingredients and available ingredients to suggest substitutions.

RECIPE INGREDIENTS:
${recipeIngredients.map((i) => `- ${i.amount} ${i.unit} ${i.name}${i.optional ? ' (optional)' : ''}`).join('\n')}

AVAILABLE INGREDIENTS:
${availableIngredients.map((i) => `- ${i}`).join('\n')}

Please analyze and respond with a JSON object in this exact format:
{
  "canMake": boolean (true if the recipe can be made with substitutions),
  "confidenceScore": number (0-100, how confident you are the result will be good),
  "missingIngredients": string[] (ingredients that are missing and have no good substitutes),
  "availableIngredients": string[] (required ingredients the user already has),
  "substitutions": [
    {
      "originalIngredient": string,
      "substitute": string,
      "ratio": string (e.g., "1:1" or "use half"),
      "notes": string (brief explanation),
      "impactOnTaste": "minimal" | "moderate" | "significant"
    }
  ],
  "tips": string[] (helpful cooking tips based on the substitutions)
}

Only respond with valid JSON, no additional text.`;

  try {
    const result = await textModel.generateContent(prompt);
    const response = result.response.text();

    // Extract JSON from response (handle markdown code blocks)
    const jsonMatch = response.match(/```json\n?([\s\S]*?)\n?```/) ||
      response.match(/```\n?([\s\S]*?)\n?```/) ||
      [null, response];
    const jsonStr = jsonMatch[1] || response;

    return JSON.parse(jsonStr.trim()) as AISubstitutionResult;
  } catch (error) {
    console.error('Error analyzing substitutions:', error);
    // Return a default response on error
    return {
      canMake: false,
      confidenceScore: 0,
      missingIngredients: recipeIngredients.map((i) => i.name),
      availableIngredients: [],
      substitutions: [],
      tips: ['Unable to analyze ingredients. Please try again.'],
    };
  }
};

// Analyze portion size from image
export const analyzePortionFromImage = async (
  imageUri: string,
  targetRecipeIngredients?: Ingredient[],
  ingredientHints?: string[]
): Promise<PortionAnalysis> => {
  const imagePart = await createImagePart(imageUri);

  let contextPrompt = '';
  if (targetRecipeIngredients && targetRecipeIngredients.length > 0) {
    contextPrompt = `
The user is preparing this recipe which requires:
${targetRecipeIngredients.map((i) => `- ${i.amount} ${i.unit} ${i.name}`).join('\n')}

Please compare what you see to what the recipe needs.`;
  }

  if (ingredientHints && ingredientHints.length > 0) {
    contextPrompt += `

USER-PROVIDED INGREDIENT CORRECTIONS:
The user has indicated this food contains the following ingredients: ${ingredientHints.join(', ')}.
Use this as strong guidance when identifying items and estimating portions and calories.
Re-examine the image with this context — look specifically for these ingredients and adjust your estimates accordingly.`;
  }

  const prompt = `You are a culinary and nutrition expert analyzing a photo of food. This could be raw ingredients, a prepared dish, a snack, a beverage, or any type of food item.

Your job is to identify ALL food items visible in the image - whether they are raw ingredients, cooked dishes, packaged foods, beverages, or anything edible.
${contextPrompt}

IMPORTANT RULES:
- Always identify at least one food item if any food is visible
- For prepared dishes (e.g., a plate of pasta, a burger, a salad), identify the dish as a whole AND its likely components
- Always provide calorie estimates, even if uncertain - give your best estimate based on typical portions
- Always estimate serving size based on visual cues (plate size, container, hand for scale, etc.)
- If you cannot identify the exact food, describe what you see and provide a reasonable calorie estimate for a similar food

Respond with a JSON object in this exact format:
{
  "detectedItems": [
    {
      "name": string (food item name - can be an ingredient OR a prepared dish),
      "estimatedAmount": number,
      "unit": string (cups, oz, pieces, servings, plate, bowl, etc.),
      "confidence": number (0-100, how confident you are in the identification),
      "estimatedCalories": number (ALWAYS provide a best-guess estimate, never 0 unless it's water)
    }
  ],
  "suggestedServings": number (how many servings this amount represents, minimum 1),
  "totalEstimatedCalories": number (sum of all detected items, always > 0 if food is present),
  "recommendations": string[] (tips about nutrition, portion size, or ingredient freshness)
}

Only respond with valid JSON, no additional text.`;

  const maxRetries = 2;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await visionModel.generateContent([prompt, imagePart]);
      const response = result.response.text();

      // Extract JSON from response
      const jsonMatch = response.match(/```json\n?([\s\S]*?)\n?```/) ||
        response.match(/```\n?([\s\S]*?)\n?```/) ||
        [null, response];
      const jsonStr = jsonMatch[1] || response;

      const parsed = JSON.parse(jsonStr.trim()) as PortionAnalysis;

      // Ensure we always have reasonable defaults
      if (parsed.suggestedServings <= 0) parsed.suggestedServings = 1;
      if (parsed.detectedItems.length > 0 && parsed.totalEstimatedCalories <= 0) {
        parsed.totalEstimatedCalories = parsed.detectedItems.reduce(
          (sum, item) => sum + (item.estimatedCalories || 0), 0
        );
      }

      return parsed;
    } catch (error) {
      console.error(`Error analyzing portion (attempt ${attempt + 1}):`, error);
      if (attempt === maxRetries) {
        return {
          detectedItems: [],
          suggestedServings: 0,
          totalEstimatedCalories: 0,
          recommendations: ['Unable to analyze the image. Please try again with a clearer photo.'],
        };
      }
      // Wait briefly before retry
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  // Fallback (should not reach here)
  return {
    detectedItems: [],
    suggestedServings: 0,
    totalEstimatedCalories: 0,
    recommendations: ['Unable to analyze the image. Please try again with a clearer photo.'],
  };
};

// Get cooking tips and suggestions
export const getCookingTips = async (
  recipeName: string,
  difficulty: string,
  ingredients: Ingredient[]
): Promise<string[]> => {
  const prompt = `You are a helpful cooking assistant. Provide 3-5 practical cooking tips for making "${recipeName}" (difficulty: ${difficulty}).

Key ingredients: ${ingredients.slice(0, 5).map((i) => i.name).join(', ')}

Respond with a JSON array of strings, each being a helpful tip:
["tip 1", "tip 2", "tip 3"]

Only respond with valid JSON, no additional text.`;

  try {
    const result = await textModel.generateContent(prompt);
    const response = result.response.text();

    const jsonMatch = response.match(/```json\n?([\s\S]*?)\n?```/) ||
      response.match(/```\n?([\s\S]*?)\n?```/) ||
      [null, response];
    const jsonStr = jsonMatch[1] || response;

    return JSON.parse(jsonStr.trim()) as string[];
  } catch (error) {
    console.error('Error getting cooking tips:', error);
    return ['Cook with love and patience!'];
  }
};

// Generate recipe from image
export const generateRecipeFromImage = async (
  imageUri: string
): Promise<{
  title: string;
  ingredients: string[];
  instructions: string[];
  cuisine: string;
  estimatedTime: number;
}> => {
  const imagePart = await createImagePart(imageUri);

  const prompt = `Analyze this food image and generate a recipe that would create this dish.

Respond with a JSON object:
{
  "title": string (name of the dish),
  "ingredients": string[] (list of ingredients with amounts),
  "instructions": string[] (step by step cooking instructions),
  "cuisine": string (type of cuisine),
  "estimatedTime": number (total cooking time in minutes)
}

Only respond with valid JSON, no additional text.`;

  try {
    const result = await visionModel.generateContent([prompt, imagePart]);
    const response = result.response.text();

    const jsonMatch = response.match(/```json\n?([\s\S]*?)\n?```/) ||
      response.match(/```\n?([\s\S]*?)\n?```/) ||
      [null, response];
    const jsonStr = jsonMatch[1] || response;

    return JSON.parse(jsonStr.trim());
  } catch (error) {
    console.error('Error generating recipe from image:', error);
    throw new Error('Could not generate recipe from image');
  }
};

// Extract recipe from video URL using Gemini Vision
export const extractRecipeFromVideo = async (
  videoUrl: string
): Promise<{
  title: string;
  ingredients: { name: string; amount: string; unit: string; optional?: boolean }[];
  instructions: string[];
  cuisine?: string;
  estimatedTime?: number;
  confidence: number;
} | null> => {
  try {
    const videoPart = await createVideoPart(videoUrl);

    const prompt = `You are a culinary expert. Analyze this cooking video and extract the recipe shown.

Identify:
1. The dish being prepared (title)
2. All ingredients visible or mentioned (with estimated amounts)
3. Step-by-step cooking instructions
4. The type of cuisine
5. Estimated total cooking time

Return ONLY valid JSON:
{
  "title": "Recipe Name",
  "ingredients": [
    {"name": "ingredient", "amount": "1", "unit": "cup", "optional": false}
  ],
  "instructions": ["Step 1...", "Step 2..."],
  "cuisine": "type",
  "estimatedTime": 30,
  "confidence": 0.8
}

If you cannot identify a recipe, return: {"error": "reason", "confidence": 0}`;

    const result = await visionModel.generateContent([prompt, videoPart]);
    const response = result.response.text();

    const jsonMatch = response.match(/```json\n?([\s\S]*?)\n?```/) ||
      response.match(/```\n?([\s\S]*?)\n?```/) ||
      [null, response];
    const jsonStr = jsonMatch[1] || response;

    const parsed = JSON.parse(jsonStr.trim());
    if (parsed.error) return null;
    return parsed;
  } catch (error) {
    console.error('Error extracting recipe from video:', error);
    return null;
  }
};

// Extract recipe from raw text content (plain text, JSON, XML, etc.)
export const extractRecipeFromText = async (
  text: string,
  format?: string
): Promise<{
  title: string;
  description?: string;
  ingredients: { name: string; amount: number; unit: string; optional?: boolean }[];
  instructions: string[];
  servings?: number;
  prepTime?: number;
  cookTime?: number;
  cuisine?: string;
  confidence: number;
} | null> => {
  try {
    const prompt = `You are a recipe extraction expert. The following content${format ? ` (in ${format} format)` : ''} contains recipe information.
Extract the recipe and return ONLY valid JSON:

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
  "cuisine": "type",
  "confidence": 0.9
}

All amounts must be numbers (convert fractions like "1/2" to 0.5).
If you cannot find a recipe, return: {"error": "reason", "confidence": 0}

Content:
${text.slice(0, 15000)}`;

    const result = await textModel.generateContent(prompt);
    const response = result.response.text();

    const jsonMatch = response.match(/```json\n?([\s\S]*?)\n?```/) ||
      response.match(/```\n?([\s\S]*?)\n?```/) ||
      [null, response];
    const jsonStr = jsonMatch[1] || response;

    const parsed = JSON.parse(jsonStr.trim());
    if (parsed.error) return null;
    return parsed;
  } catch (error) {
    console.error('Error extracting recipe from text:', error);
    return null;
  }
};

// Export the AI models for direct use if needed
export { textModel, visionModel };

// ────────────────────────────────────────────────────────
// Combined video + text recipe extraction
// ────────────────────────────────────────────────────────

/** Standard recipe extraction result from Gemini */
export interface GeminiRecipeResult {
  title: string;
  description?: string;
  ingredients: { name: string; amount: number; unit: string; optional?: boolean }[];
  instructions: string[];
  servings?: number;
  prepTime?: number;
  cookTime?: number;
  cuisine?: string;
  difficulty?: string;
  category?: string;
  tags?: string[];
  confidence: number;
}

/** Maximum file size for inline video analysis (20 MB) */
const MAX_INLINE_VIDEO_BYTES = 20 * 1024 * 1024;

/**
 * Heuristic: does the caption/description text look like it contains a
 * written-out recipe (both ingredients AND instructions)?
 *
 * When a creator writes the full recipe in the caption, that text is more
 * authoritative than what the AI infers from watching the video — the video
 * becomes supplementary visual context rather than the primary source.
 */
const captionLooksLikeRecipe = (text: string | undefined): boolean => {
  if (!text || text.length < 80) return false;
  const lower = text.toLowerCase();

  // Ingredient signals: measurement units, "ingredients" header, numbered amounts
  const ingredientPatterns = [
    /\b\d+\s*(cup|cups|tbsp|tsp|tablespoon|teaspoon|oz|ounce|lb|pound|g|gram|kg|ml|liter|litre|clove|bunch|pinch|dash|can|stick|slice|piece)/i,
    /\bingredients?\b/i,
    /\b\d+\/\d+\s*(cup|tsp|tbsp)/i,
  ];

  // Instruction signals: action verbs, step markers, sequential cooking language
  const instructionPatterns = [
    /\b(step\s*\d|directions?|instructions?|method|how to)\b/i,
    /\b(preheat|saut[ée]|simmer|boil|bake|roast|fry|whisk|stir|fold|chop|dice|mince|slice|season|marinate|drain|mix|combine|cook|heat|add|pour|place|serve|garnish|let\s+(it\s+)?rest|set\s+aside|bring\s+to)\b/i,
  ];

  const hasIngredients = ingredientPatterns.some((p) => p.test(lower));
  const hasInstructions = instructionPatterns.some((p) => p.test(lower));

  // Must have BOTH to be considered a full written recipe
  return hasIngredients && hasInstructions;
};

/**
 * Download a remote video to a temporary local file.
 * Returns the local path or null on failure.
 * Caller is responsible for deleting the file afterwards.
 */
export const downloadVideoToTemp = async (
  videoUrl: string,
): Promise<string | null> => {
  try {
    const tempId = generateTempId();
    const localPath = `${cacheDirectory}recipe_video_${tempId}.mp4`;
    const { uri } = await downloadAsync(videoUrl, localPath);
    return uri;
  } catch (e) {
    console.error('Video download failed:', e);
    return null;
  }
};

/** Delete a temp file safely (never throws) */
export const cleanupTempFile = async (path: string | null): Promise<void> => {
  if (!path) return;
  try {
    await deleteAsync(path, { idempotent: true });
  } catch {
    // Ignore cleanup errors
  }
};

/**
 * Unified recipe extraction from any combination of content:
 *   - video (local temp file path)
 *   - caption/description text
 *   - transcript text
 *   - thumbnail URL
 *   - page text / JSON-LD structured data
 *
 * Chooses the right Gemini model (vision vs text) based on available media.
 * If a video file is provided, it is read as base64 and passed inline.
 * Always returns a structured recipe result or null.
 *
 * Important: This function does NOT delete temp files — the caller must do so.
 */
export const extractRecipeFromContentBundle = async (bundle: {
  videoLocalPath?: string | null; // Already-downloaded temp file
  captionText?: string;
  transcript?: string;
  thumbnailUrl?: string;
  pageText?: string;
  jsonLd?: string;
  title?: string;
  author?: string;
  platform: string;
  sourceUrl: string;
}): Promise<GeminiRecipeResult | null> => {
  const parts: Part[] = [];
  let contextLines: string[] = [];

  // ── Assemble text context ──
  if (bundle.jsonLd) contextLines.push(`STRUCTURED RECIPE DATA (Schema.org):\n${bundle.jsonLd}`);
  if (bundle.title) contextLines.push(`TITLE: ${bundle.title}`);
  if (bundle.author) contextLines.push(`AUTHOR: ${bundle.author}`);
  if (bundle.captionText) contextLines.push(`CAPTION / DESCRIPTION:\n${bundle.captionText}`);
  if (bundle.transcript) contextLines.push(`VIDEO TRANSCRIPT:\n${bundle.transcript.slice(0, 12000)}`);
  if (bundle.pageText) contextLines.push(`PAGE CONTENT:\n${bundle.pageText.slice(0, 10000)}`);
  contextLines.push(`SOURCE: ${bundle.platform} — ${bundle.sourceUrl}`);

  // ── Add video if available and within size limit ──
  let usedVideo = false;
  if (bundle.videoLocalPath) {
    try {
      const info = await getInfoAsync(bundle.videoLocalPath);
      if (info.exists && (!info.size || info.size < MAX_INLINE_VIDEO_BYTES)) {
        const base64 = await readAsStringAsync(bundle.videoLocalPath, { encoding: 'base64' });
        const mimeType = bundle.videoLocalPath.toLowerCase().endsWith('.mov')
          ? 'video/quicktime'
          : 'video/mp4';
        parts.push({ inlineData: { data: base64, mimeType } });
        usedVideo = true;
      } else {
        console.log('Video too large for inline analysis, using text + thumbnail instead');
      }
    } catch (e) {
      console.error('Failed to read video file for Gemini:', e);
    }
  }

  // ── Add thumbnail ONLY if no video was attached (gives Gemini visual context) ──
  // When video is present, it already contains all the visual context needed.
  // Many social-media thumbnail CDN URLs (especially Instagram) are signed/expiring
  // and return HTML redirects instead of images, so we avoid fetching them when
  // we already have the video.
  if (!usedVideo && bundle.thumbnailUrl) {
    const imgPart = await createImagePartSafe(bundle.thumbnailUrl);
    if (imgPart) {
      parts.push(imgPart);
    } else {
      console.log('Skipping invalid thumbnail, proceeding with text-only analysis');
    }
  }

  const hasMedia = parts.length > 0;
  const contextStr = contextLines.join('\n\n');
  const captionIsRecipe = captionLooksLikeRecipe(bundle.captionText);

  // ── Build prompt ──
  const prompt = `You are a world-class culinary AI. Extract a complete, detailed recipe from the provided content (sourced from ${bundle.platform}).

${hasMedia ? (usedVideo
      ? 'A COOKING VIDEO is attached. Watch it carefully — observe every ingredient shown, every cooking step, listen to all audio/voiceover, and read any text overlays.'
      : 'A THUMBNAIL IMAGE is attached. Use it to identify the dish and its likely ingredients.')
      : ''}

AVAILABLE CONTEXT:
${contextStr}

INSTRUCTIONS:
- Combine ALL available information (video, text, captions, structured data) to produce the most complete recipe possible.
${captionIsRecipe
      ? `- IMPORTANT: The caption/description contains a WRITTEN RECIPE with ingredients and instructions. Treat the caption as the PRIMARY authoritative source for ingredient names, amounts, and cooking steps. Use the video only to fill in gaps or add details not mentioned in the caption (e.g. visual techniques, timing cues). Do NOT override caption amounts or steps with guesses from the video.`
      : `- If the video shows steps not mentioned in text, include them.
- If text mentions ingredients not visible in video, include those too.
- If information conflicts, prefer the video content.`}
- Convert ALL amounts to numbers (e.g. "1/2" → 0.5, "a pinch" → 0.125, "two" → 2).
- If amounts are not specified, estimate reasonable household quantities.
- Instructions should be clear, actionable steps.
- Estimate prep/cook times if not explicitly stated.
- Set confidence 0-1: ≥0.85 for well-documented recipes, 0.5-0.7 for reconstructed ones.

Return ONLY valid JSON:
{
  "title": "Recipe Name",
  "description": "Brief appealing description of the dish",
  "ingredients": [{"name": "ingredient", "amount": 1, "unit": "cup", "optional": false}],
  "instructions": ["Step 1: ...", "Step 2: ..."],
  "servings": 4,
  "prepTime": 15,
  "cookTime": 30,
  "difficulty": "easy|medium|hard",
  "cuisine": "italian|mexican|chinese|american|indian|japanese|thai|mediterranean|etc",
  "category": "dinner|lunch|breakfast|dessert|snack|appetizer|side|drink",
  "tags": ["tag1", "tag2"],
  "confidence": 0.85
}

If you truly cannot identify any recipe: {"error": "reason", "confidence": 0}`;

  try {
    const model = hasMedia ? visionModel : textModel;
    const content = hasMedia ? [prompt, ...parts] : prompt;
    const result = await model.generateContent(content);
    const response = result.response.text();

    const jsonMatch =
      response.match(/```json\n?([\s\S]*?)\n?```/) ||
      response.match(/```\n?([\s\S]*?)\n?```/) ||
      [null, response];
    const parsed = JSON.parse((jsonMatch[1] || response).trim());
    if (parsed.error) {
      console.log('Gemini found no recipe:', parsed.error);
      return null;
    }
    return parsed as GeminiRecipeResult;
  } catch (e) {
    console.error('Gemini content bundle extraction error:', e);
    return null;
  }
};

// ────────────────────────────────────────────────────────
// Streaming recipe extraction with visible thinking notes
// ────────────────────────────────────────────────────────

export type ThinkingPhase = 'idle' | 'watching' | 'reading' | 'building' | 'done';

export interface ThinkingCallbacks {
  onThinkingNote: (note: string) => void;
  onPhaseChange: (phase: ThinkingPhase) => void;
}

/**
 * Stream a recipe extraction from a content bundle, emitting "thinking" notes
 * as the AI watches the video. Falls back to `extractRecipeFromContentBundle`
 * if the streaming call fails.
 *
 * The prompt instructs Gemini to first output observation lines prefixed with
 * `>> `, then emit a ```json block with the structured recipe.
 */
export const extractRecipeWithThinking = async (
  bundle: Parameters<typeof extractRecipeFromContentBundle>[0],
  callbacks: ThinkingCallbacks,
): Promise<GeminiRecipeResult | null> => {
  const parts: Part[] = [];
  const contextLines: string[] = [];

  // ── Assemble text context (same as extractRecipeFromContentBundle) ──
  if (bundle.jsonLd) contextLines.push(`STRUCTURED RECIPE DATA (Schema.org):\n${bundle.jsonLd}`);
  if (bundle.title) contextLines.push(`TITLE: ${bundle.title}`);
  if (bundle.author) contextLines.push(`AUTHOR: ${bundle.author}`);
  if (bundle.captionText) contextLines.push(`CAPTION / DESCRIPTION:\n${bundle.captionText}`);
  if (bundle.transcript) contextLines.push(`VIDEO TRANSCRIPT:\n${bundle.transcript.slice(0, 12000)}`);
  if (bundle.pageText) contextLines.push(`PAGE CONTENT:\n${bundle.pageText.slice(0, 10000)}`);
  contextLines.push(`SOURCE: ${bundle.platform} — ${bundle.sourceUrl}`);

  // ── Add video ──
  let usedVideo = false;
  if (bundle.videoLocalPath) {
    try {
      const info = await getInfoAsync(bundle.videoLocalPath);
      if (info.exists && (!info.size || info.size < MAX_INLINE_VIDEO_BYTES)) {
        const base64 = await readAsStringAsync(bundle.videoLocalPath, { encoding: 'base64' });
        const mimeType = bundle.videoLocalPath.toLowerCase().endsWith('.mov')
          ? 'video/quicktime'
          : 'video/mp4';
        parts.push({ inlineData: { data: base64, mimeType } });
        usedVideo = true;
      }
    } catch (e) {
      console.error('Failed to read video file for streaming:', e);
    }
  }

  if (!usedVideo && bundle.thumbnailUrl) {
    const imgPart = await createImagePartSafe(bundle.thumbnailUrl);
    if (imgPart) parts.push(imgPart);
  }

  const hasMedia = parts.length > 0;
  const contextStr = contextLines.join('\n\n');
  const captionIsRecipe = captionLooksLikeRecipe(bundle.captionText);

  // ── Build streaming prompt with observation markers ──
  const prompt = `You are a world-class culinary AI. Extract a complete, detailed recipe from the provided content (sourced from ${bundle.platform}).

${hasMedia ? (usedVideo
      ? 'A COOKING VIDEO is attached. Watch it carefully — observe every ingredient shown, every cooking step, listen to all audio/voiceover, and read any text overlays.'
      : 'A THUMBNAIL IMAGE is attached. Use it to identify the dish and its likely ingredients.')
      : ''}

AVAILABLE CONTEXT:
${contextStr}

IMPORTANT OUTPUT FORMAT:
First, write your observation notes as you analyze the content. Each observation MUST be on its own line and start with ">> ". These are your real-time thinking notes. Write 4-8 short observations about what you see/hear.
${captionIsRecipe
      ? `Since the caption contains a written recipe, focus your observations on confirming/noting the caption details and any extra visual details from the video.`
      : ''}

Example observations:
>> Looks like a creamy pasta dish with garlic
>> Chef is using fettuccine noodles in boiling water
>> I see butter and minced garlic being sautéed
>> Heavy cream is being poured into the pan

After your observations, output the recipe as a JSON block.

INSTRUCTIONS:
- Combine ALL available information (video, text, captions, structured data) to produce the most complete recipe possible.
${captionIsRecipe
      ? `- IMPORTANT: The caption/description contains a WRITTEN RECIPE with ingredients and instructions. Treat the caption as the PRIMARY authoritative source for ingredient names, amounts, and cooking steps. Use the video only to fill in gaps or add details not mentioned in the caption (e.g. visual techniques, timing cues). Do NOT override caption amounts or steps with guesses from the video.`
      : `- If the video shows steps not mentioned in text, include them.
- If information conflicts, prefer the video content.`}
- Convert ALL amounts to numbers (e.g. "1/2" → 0.5, "a pinch" → 0.125).
- If amounts are not specified, estimate reasonable household quantities.
- Set confidence 0-1: ≥0.85 for well-documented recipes, 0.5-0.7 for reconstructed ones.

After your observations, return the recipe as a JSON code block:
\`\`\`json
{
  "title": "Recipe Name",
  "description": "Brief appealing description of the dish",
  "ingredients": [{"name": "ingredient", "amount": 1, "unit": "cup", "optional": false}],
  "instructions": ["Step 1: ...", "Step 2: ..."],
  "servings": 4,
  "prepTime": 15,
  "cookTime": 30,
  "difficulty": "easy|medium|hard",
  "cuisine": "italian|mexican|chinese|american|indian|japanese|thai|mediterranean|etc",
  "category": "dinner|lunch|breakfast|dessert|snack|appetizer|side|drink",
  "tags": ["tag1", "tag2"],
  "confidence": 0.85
}
\`\`\`

If you truly cannot identify any recipe: {"error": "reason", "confidence": 0}`;

  try {
    callbacks.onPhaseChange(captionIsRecipe ? 'reading' : 'watching');

    const model = hasMedia ? visionModel : textModel;
    const content = hasMedia ? [prompt, ...parts] : prompt;
    const streamResult = await model.generateContentStream(content);

    let fullText = '';
    let inJsonBlock = false;
    let lineBuffer = '';

    for await (const chunk of streamResult.stream) {
      const chunkText = chunk.text();
      fullText += chunkText;
      lineBuffer += chunkText;

      // Process complete lines from the buffer
      const lines = lineBuffer.split('\n');
      // Keep the last (potentially incomplete) line in the buffer
      lineBuffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();

        // Detect transition to JSON block
        if (trimmed.startsWith('```json') || trimmed === '```') {
          if (!inJsonBlock && trimmed.startsWith('```json')) {
            inJsonBlock = true;
            callbacks.onPhaseChange('building');
            continue;
          }
          if (inJsonBlock) {
            inJsonBlock = false;
            continue;
          }
        }

        // Emit observation notes
        if (!inJsonBlock && trimmed.startsWith('>> ')) {
          const note = trimmed.slice(3).trim();
          if (note) {
            callbacks.onThinkingNote(note);
          }
        }
      }
    }

    // Process any remaining text in the buffer
    if (lineBuffer.trim().startsWith('>> ') && !inJsonBlock) {
      const note = lineBuffer.trim().slice(3).trim();
      if (note) callbacks.onThinkingNote(note);
    }

    // Extract JSON from the full response
    const jsonMatch =
      fullText.match(/```json\n?([\s\S]*?)\n?```/) ||
      fullText.match(/```\n?([\s\S]*?)\n?```/) ||
      [null, fullText];
    const parsed = JSON.parse((jsonMatch[1] || fullText).trim());

    if (parsed.error) {
      console.log('Gemini streaming found no recipe:', parsed.error);
      return null;
    }

    return parsed as GeminiRecipeResult;
  } catch (e) {
    console.warn('Streaming extraction failed, falling back to non-streaming:', e);
    // Silent fallback to the existing non-streaming path
    callbacks.onPhaseChange('building');
    return extractRecipeFromContentBundle(bundle);
  }
};
