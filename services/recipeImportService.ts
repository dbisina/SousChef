import { Timestamp } from 'firebase/firestore';
import {
  ImportedRecipe,
  URLExtractionResponse,
  CookbookScanResponse,
  PantryMatchResult,
} from '@/types/wantToCook';
import { Ingredient, PantryItem } from '@/types';
import { generateId } from '@/lib/firebase';
import {
  textModel,
  visionModel,
  createImagePart,
  extractRecipeFromVideo,
  extractRecipeFromText,
  extractRecipeFromContentBundle,
  extractRecipeWithThinking,
  downloadVideoToTemp,
  cleanupTempFile,
  GeminiRecipeResult,
  ThinkingCallbacks,
} from '@/lib/gemini';
import { extractPlatformContent, PlatformContent } from './platformExtractorService';
import { getInfoAsync } from 'expo-file-system/legacy';

const MAX_SHARED_VIDEO_BYTES = 20 * 1024 * 1024; // 20 MB limit for inline video analysis
const isLocalFile = (path: string) => path.startsWith('/') || path.startsWith('file://');

// Detect platform from URL
export const detectPlatform = (url: string): string => {
  const lowercaseUrl = url.toLowerCase();
  // Social / video platforms
  if (lowercaseUrl.includes('tiktok.com')) return 'tiktok';
  if (lowercaseUrl.includes('instagram.com')) return 'instagram';
  if (lowercaseUrl.includes('youtube.com') || lowercaseUrl.includes('youtu.be')) return 'youtube';
  if (lowercaseUrl.includes('pinterest.com') || lowercaseUrl.includes('pin.it')) return 'pinterest';
  if (lowercaseUrl.includes('facebook.com') || lowercaseUrl.includes('fb.watch')) return 'facebook';
  if (lowercaseUrl.includes('twitter.com') || lowercaseUrl.includes('x.com')) return 'x';
  if (lowercaseUrl.includes('threads.net')) return 'threads';
  if (lowercaseUrl.includes('snapchat.com') || lowercaseUrl.includes('t.snapchat.com')) return 'snapchat';
  if (lowercaseUrl.includes('reddit.com') || lowercaseUrl.includes('redd.it')) return 'reddit';
  // Recipe sites
  if (lowercaseUrl.includes('allrecipes.com')) return 'allrecipes';
  if (lowercaseUrl.includes('foodnetwork.com')) return 'foodnetwork';
  if (lowercaseUrl.includes('bonappetit.com')) return 'bonappetit';
  if (lowercaseUrl.includes('seriouseats.com')) return 'seriouseats';
  if (lowercaseUrl.includes('tasty.co')) return 'tasty';
  if (lowercaseUrl.includes('delish.com')) return 'delish';
  if (lowercaseUrl.includes('epicurious.com')) return 'epicurious';
  if (lowercaseUrl.includes('nytimes.com/cooking') || lowercaseUrl.includes('cooking.nytimes.com')) return 'nyt_cooking';
  if (lowercaseUrl.includes('bbc.co.uk/food') || lowercaseUrl.includes('bbcgoodfood.com')) return 'bbc_food';
  if (lowercaseUrl.includes('simplyrecipes.com')) return 'simplyrecipes';
  if (lowercaseUrl.includes('food52.com')) return 'food52';
  if (lowercaseUrl.includes('cookpad.com')) return 'cookpad';
  if (lowercaseUrl.includes('yummly.com')) return 'yummly';
  if (lowercaseUrl.includes('budgetbytes.com')) return 'budgetbytes';
  // File-like URLs
  if (lowercaseUrl.match(/\.(pdf)(\?|$)/)) return 'pdf';
  if (lowercaseUrl.match(/\.(json)(\?|$)/)) return 'json';
  if (lowercaseUrl.match(/\.(xml|rss|atom)(\?|$)/)) return 'xml';
  if (lowercaseUrl.match(/\.(txt|text|md)(\?|$)/)) return 'text';
  if (lowercaseUrl.match(/\.(jpg|jpeg|png|gif|webp|heic|heif|bmp|svg)(\?|$)/)) return 'image';
  if (lowercaseUrl.match(/\.(mp4|mov|avi|webm|mkv|m4v)(\?|$)/)) return 'video';
  if (lowercaseUrl.match(/\.(mp3|m4a|wav|ogg|aac|flac)(\?|$)/)) return 'audio';
  return 'website';
};

// Extract recipe from URL using AI
export const extractRecipeFromURL = async (
  url: string,
  onProgress?: (message: string) => void,
  thinkingCallbacks?: ThinkingCallbacks,
): Promise<URLExtractionResponse> => {
  try {
    const platform = detectPlatform(url);
    onProgress?.(`Detected ${platform} link...`);

    // ──── DIRECT MEDIA / FILE HANDLERS ────
    // Handle direct image URLs or local image files (shared from Photos/Files)
    if (platform === 'image') {
      console.log('Direct image detected, using Vision AI...');
      const isLocal = isLocalFile(url);
      const scanResult = await extractRecipeFromPhoto(url, isLocal ? 'Shared Photo' : 'Image');
      if (isLocal) await cleanupTempFile(url);
      if (scanResult.success && scanResult.recipe) {
        scanResult.recipe.sourceURL = isLocal ? 'shared-image' : url;
        scanResult.recipe.sourcePlatform = 'image';
        if (isLocal) scanResult.recipe.tags.push('shared-file');
        return { success: true, recipe: scanResult.recipe, confidence: scanResult.confidence };
      }
      return { success: false, error: 'Could not extract a recipe from this image.', confidence: 0 };
    }

    // Handle direct video URLs or local video files (shared from Photos/Files)
    if (platform === 'video') {
      console.log('Direct video detected, using Video AI...');

      // Guard: check file size for local files to prevent OOM
      if (isLocalFile(url)) {
        try {
          const info = await getInfoAsync(url);
          if (info.exists && info.size && info.size > MAX_SHARED_VIDEO_BYTES) {
            return {
              success: false,
              error: `Video is too large (${Math.round(info.size / 1024 / 1024)}MB). Please share a shorter clip under 20MB.`,
              confidence: 0,
            };
          }
        } catch (e) {
          console.warn('Could not check video file size:', e);
        }
      }

      try {
        const videoRecipe = await extractRecipeFromVideo(url);
        if (videoRecipe && videoRecipe.title) {
          const isLocal = isLocalFile(url);
          const recipe: ImportedRecipe = {
            id: generateId(),
            title: videoRecipe.title,
            description: 'Extracted from video analysis',
            sourceURL: isLocal ? 'shared-video' : url,
            sourcePlatform: 'video',
            videoURL: isLocal ? undefined : url,
            ingredients: (videoRecipe.ingredients || []).map((ing: any, idx: number) => ({
              name: ing.name || `Ingredient ${idx + 1}`,
              amount: typeof ing.amount === 'number' ? ing.amount : parseFloat(ing.amount) || 0,
              unit: ing.unit || 'unit',
              calories: 0,
              optional: !!ing.optional,
            })),
            instructions: videoRecipe.instructions || [],
            servings: 4,
            prepTime: 10,
            cookTime: videoRecipe.estimatedTime || 30,
            cuisine: videoRecipe.cuisine as any,
            tags: ['video-extraction', ...(isLocal ? ['shared-file'] : [])],
            extractedAt: Timestamp.now(),
            extractionConfidence: videoRecipe.confidence || 0.8,
            rawContent: 'Video Analysis',
          };

          // Clean up shared file after successful extraction
          if (isLocal) await cleanupTempFile(url);

          return { success: true, recipe, confidence: recipe.extractionConfidence };
        }
      } catch (e) {
        console.error('Direct video extraction failed:', e);
      }

      // Clean up shared file on failure too
      if (isLocalFile(url)) await cleanupTempFile(url);

      return { success: false, error: 'Could not extract a recipe from this video.', confidence: 0 };
    }

    // Handle direct audio URLs → download + transcribe with Gemini
    if (platform === 'audio') {
      console.log('Direct audio URL detected, attempting AI extraction...');
      try {
        const audioResult = await extractRecipeFromAudio(url);
        if (audioResult) {
          const recipe: ImportedRecipe = {
            id: generateId(),
            title: audioResult.title,
            description: audioResult.description || 'Extracted from audio',
            sourceURL: url,
            sourcePlatform: 'audio',
            ingredients: (audioResult.ingredients || []).map((ing: any, idx: number) => ({
              name: ing.name || `Ingredient ${idx + 1}`,
              amount: typeof ing.amount === 'number' ? ing.amount : parseFloat(ing.amount) || 0,
              unit: ing.unit || 'unit',
              calories: 0,
              optional: !!ing.optional,
            })),
            instructions: audioResult.instructions || [],
            servings: audioResult.servings || 4,
            prepTime: audioResult.prepTime,
            cookTime: audioResult.cookTime,
            cuisine: audioResult.cuisine as any,
            tags: ['audio-extraction'],
            extractedAt: Timestamp.now(),
            extractionConfidence: audioResult.confidence || 0.7,
            rawContent: 'Audio Analysis',
          };
          return { success: true, recipe, confidence: recipe.extractionConfidence };
        }
      } catch (e) {
        console.error('Audio extraction failed:', e);
      }
      return { success: false, error: 'Could not extract a recipe from this audio.', confidence: 0 };
    }

    // Handle JSON files / API responses
    if (platform === 'json') {
      console.log('JSON URL detected, parsing...');
      try {
        const resp = await fetch(url);
        const text = await resp.text();
        const aiResult = await extractRecipeFromText(text, 'JSON');
        if (aiResult) {
          return buildRecipeResponse(aiResult, url, 'json', ['json-import']);
        }
      } catch (e) {
        console.error('JSON parsing failed:', e);
      }
      return { success: false, error: 'Could not extract a recipe from this JSON.', confidence: 0 };
    }

    // Handle XML / RSS / Atom feeds
    if (platform === 'xml') {
      console.log('XML URL detected, parsing...');
      try {
        const resp = await fetch(url);
        const text = await resp.text();
        const aiResult = await extractRecipeFromText(text, 'XML');
        if (aiResult) {
          return buildRecipeResponse(aiResult, url, 'xml', ['xml-import']);
        }
      } catch (e) {
        console.error('XML parsing failed:', e);
      }
      return { success: false, error: 'Could not extract a recipe from this XML.', confidence: 0 };
    }

    // Handle plain text / markdown files
    if (platform === 'text') {
      console.log('Text URL detected, parsing...');
      try {
        const resp = await fetch(url);
        const text = await resp.text();
        const aiResult = await extractRecipeFromText(text, 'plain text');
        if (aiResult) {
          return buildRecipeResponse(aiResult, url, 'text', ['text-import']);
        }
      } catch (e) {
        console.error('Text parsing failed:', e);
      }
      return { success: false, error: 'Could not extract a recipe from this text file.', confidence: 0 };
    }

    // Handle PDF URLs → fetch as binary, convert to base64, use Gemini vision
    if (platform === 'pdf') {
      console.log('PDF URL detected, using Gemini to analyze...');
      try {
        const pdfRecipe = await extractRecipeFromPDF(url);
        if (pdfRecipe) {
          return buildRecipeResponse(pdfRecipe, url, 'pdf', ['pdf-import']);
        }
      } catch (e) {
        console.error('PDF extraction failed:', e);
      }
      return { success: false, error: 'Could not extract a recipe from this PDF.', confidence: 0 };
    }

    // ──── STANDARD WEB / SOCIAL URL HANDLING ────
    // Use the platform-specific extractor to get content (video URL, caption, etc.)
    onProgress?.('Extracting content...');
    const platformContent = await extractPlatformContent(url, platform);

    // Try to download video for short-video platforms, or YouTube when transcript is unavailable
    let tempVideoPath: string | null = null;
    const isShortVideoPlatform = ['tiktok', 'instagram', 'x', 'threads', 'facebook', 'snapchat'].includes(platform);
    // YouTube only sets videoUrl when its transcript is missing/too short (fallback mode)
    const isYouTubeFallback = platform === 'youtube' && !!platformContent.videoUrl;

    if (platformContent.videoUrl && (isShortVideoPlatform || isYouTubeFallback)) {
      onProgress?.(isYouTubeFallback ? 'Transcript unavailable — downloading low-res video...' : 'Downloading video...');
      tempVideoPath = await downloadVideoToTemp(platformContent.videoUrl);
    }

    try {
      // ── Combined Gemini analysis (video + caption + everything) ──
      onProgress?.(tempVideoPath ? 'Analyzing video & content with AI...' : 'Analyzing content with AI...');

      const contentBundle = {
        videoLocalPath: tempVideoPath,
        captionText: platformContent.captionText,
        transcript: platformContent.transcript,
        thumbnailUrl: platformContent.thumbnailUrl,
        pageText: platformContent.pageText,
        jsonLd: platformContent.jsonLd,
        title: platformContent.title,
        author: platformContent.author,
        platform,
        sourceUrl: url,
      };

      // Use streaming with visible thinking for video imports when callbacks are provided
      const geminiResult = tempVideoPath && thinkingCallbacks
        ? await extractRecipeWithThinking(contentBundle, thinkingCallbacks)
        : await extractRecipeFromContentBundle(contentBundle);

      if (geminiResult && geminiResult.title) {
        onProgress?.('Building recipe...');
        const recipe = buildRecipeFromGeminiResult(geminiResult, url, platform, platformContent);
        return { success: true, recipe, confidence: recipe.extractionConfidence };
      }

      // ── Fallback: If combined analysis failed and we didn't try video, try thumbnail vision ──
      if (!tempVideoPath && platformContent.thumbnailUrl) {
        onProgress?.('Trying visual analysis...');
        const scanResult = await extractRecipeFromPhoto(platformContent.thumbnailUrl, platformContent.title || platform);
        if (scanResult.success && scanResult.recipe) {
          scanResult.recipe.sourceURL = url;
          scanResult.recipe.sourcePlatform = platform;
          scanResult.recipe.tags.push('visual-extraction');
          return { success: true, recipe: scanResult.recipe, confidence: scanResult.confidence * 0.9 };
        }
      }

      return {
        success: false,
        error: 'Could not extract a recipe from this URL. Try a different link or paste the recipe text manually.',
        confidence: 0,
      };
    } finally {
      // ── ALWAYS clean up temp video file ──
      await cleanupTempFile(tempVideoPath);
    }
  } catch (error) {
    console.error('Recipe extraction error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to extract recipe',
      confidence: 0,
    };
  }
};


// ─── HELPER: Build ImportedRecipe from Gemini content bundle result ───
const buildRecipeFromGeminiResult = (
  result: GeminiRecipeResult,
  sourceURL: string,
  platform: string,
  content: PlatformContent,
): ImportedRecipe => {
  return {
    id: generateId(),
    title: result.title || 'Untitled Recipe',
    description: result.description || '',
    imageURL: content.thumbnailUrl,
    videoURL: content.videoUrl,
    sourceURL,
    sourcePlatform: platform,
    ingredients: (result.ingredients || []).map((ing: any, idx: number) => ({
      name: ing.name || `Ingredient ${idx + 1}`,
      amount: typeof ing.amount === 'number' ? ing.amount : parseFloat(ing.amount) || 1,
      unit: ing.unit || 'piece',
      calories: 0,
      optional: !!ing.optional,
    })),
    instructions: result.instructions || [],
    servings: result.servings || 4,
    prepTime: result.prepTime ?? undefined,
    cookTime: result.cookTime ?? undefined,
    difficulty: (result.difficulty as any) || undefined,
    cuisine: (result.cuisine as any) || undefined,
    category: (result.category as any) || undefined,
    tags: [
      ...(result.tags || []),
      content.videoUrl ? 'video-extraction' : 'text-extraction',
      platform,
    ],
    extractedAt: Timestamp.now(),
    extractionConfidence: result.confidence || 0.7,
    rawContent: (content.captionText || content.pageText || '').slice(0, 1000),
  };
};

// ─── HELPER: Build a standardized URLExtractionResponse from an AI extraction result ───
const buildRecipeResponse = (
  aiResult: {
    title: string;
    description?: string;
    ingredients: { name: string; amount: number; unit: string; optional?: boolean }[];
    instructions: string[];
    servings?: number;
    prepTime?: number;
    cookTime?: number;
    cuisine?: string;
    confidence: number;
  },
  sourceURL: string,
  sourcePlatform: string,
  tags: string[]
): URLExtractionResponse => {
  const recipe: ImportedRecipe = {
    id: generateId(),
    title: aiResult.title || 'Untitled Recipe',
    description: aiResult.description || '',
    sourceURL,
    sourcePlatform,
    ingredients: (aiResult.ingredients || []).map((ing: any, idx: number) => ({
      name: ing.name || `Ingredient ${idx + 1}`,
      amount: typeof ing.amount === 'number' ? ing.amount : parseFloat(ing.amount) || 1,
      unit: ing.unit || 'piece',
      calories: 0,
      optional: !!ing.optional,
    })),
    instructions: aiResult.instructions || [],
    servings: aiResult.servings || 4,
    prepTime: aiResult.prepTime,
    cookTime: aiResult.cookTime,
    cuisine: aiResult.cuisine as any,
    tags,
    extractedAt: Timestamp.now(),
    extractionConfidence: aiResult.confidence || 0.7,
    rawContent: sourcePlatform,
  };
  return { success: true, recipe, confidence: recipe.extractionConfidence };
};

// ─── HELPER: Extract recipe from audio URL using Gemini ───
const extractRecipeFromAudio = async (url: string): Promise<{
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
    // Import the imageToBase64 helper (works for any file type)
    const { imageToBase64 } = await import('@/lib/gemini');
    const base64 = await imageToBase64(url);

    const mimeType = url.toLowerCase().includes('.mp3') ? 'audio/mpeg'
      : url.toLowerCase().includes('.m4a') ? 'audio/mp4'
        : url.toLowerCase().includes('.wav') ? 'audio/wav'
          : url.toLowerCase().includes('.ogg') ? 'audio/ogg'
            : url.toLowerCase().includes('.flac') ? 'audio/flac'
              : 'audio/mpeg';

    const audioPart = { inlineData: { data: base64, mimeType } };

    const prompt = `You are a culinary expert. Listen to this audio and extract any recipe information.
Identify the dish name, ingredients with amounts, and step-by-step instructions.

Return ONLY valid JSON:
{
  "title": "Recipe Name",
  "description": "Brief description",
  "ingredients": [{"name": "ingredient", "amount": 1, "unit": "cup", "optional": false}],
  "instructions": ["Step 1", "Step 2"],
  "servings": 4,
  "prepTime": 15,
  "cookTime": 30,
  "cuisine": "type",
  "confidence": 0.7
}

If no recipe found, return: {"error": "no recipe", "confidence": 0}`;

    const result = await visionModel.generateContent([prompt, audioPart]);
    const response = result.response.text();

    const jsonMatch = response.match(/```json\n?([\s\S]*?)\n?```/) ||
      response.match(/```\n?([\s\S]*?)\n?```/) ||
      [null, response];
    const parsed = JSON.parse((jsonMatch[1] || response).trim());
    if (parsed.error) return null;
    return parsed;
  } catch (error) {
    console.error('Audio recipe extraction error:', error);
    return null;
  }
};

// ─── HELPER: Extract recipe from PDF URL using Gemini ───
const extractRecipeFromPDF = async (url: string): Promise<{
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
    const { imageToBase64 } = await import('@/lib/gemini');
    const base64 = await imageToBase64(url);

    const pdfPart = { inlineData: { data: base64, mimeType: 'application/pdf' } };

    const prompt = `You are a recipe extraction expert. Analyze this PDF document and extract the recipe(s) it contains.

Return ONLY valid JSON:
{
  "title": "Recipe Name",
  "description": "Brief description",
  "ingredients": [{"name": "ingredient", "amount": 1, "unit": "cup", "optional": false}],
  "instructions": ["Step 1", "Step 2"],
  "servings": 4,
  "prepTime": 15,
  "cookTime": 30,
  "cuisine": "type",
  "confidence": 0.85
}

All amounts must be numbers (convert "1/2" to 0.5).
If no recipe found, return: {"error": "no recipe", "confidence": 0}`;

    const result = await visionModel.generateContent([prompt, pdfPart]);
    const response = result.response.text();

    const jsonMatch = response.match(/```json\n?([\s\S]*?)\n?```/) ||
      response.match(/```\n?([\s\S]*?)\n?```/) ||
      [null, response];
    const parsed = JSON.parse((jsonMatch[1] || response).trim());
    if (parsed.error) return null;
    return parsed;
  } catch (error) {
    console.error('PDF recipe extraction error:', error);
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

// Extract recipe from cookbook photo using Gemini Vision
export const extractRecipeFromPhoto = async (
  imageUri: string,
  cookbookName?: string
): Promise<CookbookScanResponse> => {
  try {
    const imagePart = await createImagePart(imageUri);

    const prompt = `You are a cookbook recipe extractor. Analyze the image of a cookbook page and extract the recipe.

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
}

Extract the recipe from this cookbook page${cookbookName ? ` from "${cookbookName}"` : ''}.`;

    const result = await visionModel.generateContent([prompt, imagePart]);
    const response = result.response.text();

    // Extract JSON from response
    const jsonMatch = response.match(/```json\n?([\s\S]*?)\n?```/) ||
      response.match(/```\n?([\s\S]*?)\n?```/) ||
      [null, response];
    const jsonStr = jsonMatch[1] || response;

    const parsed = JSON.parse(jsonStr.trim());

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

// Extract recipe from MULTIPLE cookbook page photos using Gemini Vision
// Sends all pages in a single request so the AI can piece together the full recipe
export const extractRecipeFromMultiplePhotos = async (
  imageUris: string[],
  cookbookName?: string
): Promise<CookbookScanResponse> => {
  try {
    // Convert all images to parts in parallel
    const imageParts = await Promise.all(
      imageUris.map((uri) => createImagePart(uri))
    );

    const prompt = `You are a cookbook recipe extractor. You are given ${imageUris.length} photos of consecutive cookbook pages that together contain a single recipe. Analyze ALL pages and combine the information into one complete recipe.

Some pages may have the title and ingredients, others may have the instructions or additional notes. Merge everything into one coherent recipe.

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
}

Extract and combine the recipe from these ${imageUris.length} cookbook pages${cookbookName ? ` from "${cookbookName}"` : ''}.`;

    const result = await visionModel.generateContent([prompt, ...imageParts]);
    const response = result.response.text();

    // Extract JSON from response
    const jsonMatch = response.match(/```json\n?([\s\S]*?)\n?```/) ||
      response.match(/```\n?([\s\S]*?)\n?```/) ||
      [null, response];
    const jsonStr = jsonMatch[1] || response;

    const parsed = JSON.parse(jsonStr.trim());

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
    console.error('Multi-photo extraction error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to scan recipe from multiple pages',
      confidence: 0,
    };
  }
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
