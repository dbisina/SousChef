import { GoogleGenerativeAI, Part } from '@google/generative-ai';
import * as FileSystem from 'expo-file-system';
import { readAsStringAsync } from 'expo-file-system/legacy'; // Fix deprecated API usage
import {
  AISubstitutionResult,
  Ingredient,
  PortionAnalysis,
  SubstitutionSuggestion,
} from '@/types';

// Initialize Gemini AI client
const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY || '';
const genAI = new GoogleGenerativeAI(apiKey);

// Model configurations
const textModel = genAI.getGenerativeModel({ model: 'gemini-1.5-flash-001' });
const visionModel = genAI.getGenerativeModel({ model: 'gemini-1.5-flash-001' });

// Convert local image to base64 for Gemini Vision
export const imageToBase64 = async (uri: string): Promise<string> => {
  const base64 = await readAsStringAsync(uri, {
    encoding: 'base64',
  });
  return base64;
};

// Create image part for Gemini Vision
export const createImagePart = async (uri: string): Promise<Part> => {
  const base64 = await imageToBase64(uri);
  const mimeType = uri.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';

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
  targetRecipeIngredients?: Ingredient[]
): Promise<PortionAnalysis> => {
  const imagePart = await createImagePart(imageUri);

  let contextPrompt = '';
  if (targetRecipeIngredients && targetRecipeIngredients.length > 0) {
    contextPrompt = `
The user is preparing this recipe which requires:
${targetRecipeIngredients.map((i) => `- ${i.amount} ${i.unit} ${i.name}`).join('\n')}

Please compare what you see to what the recipe needs.`;
  }

  const prompt = `You are a culinary expert analyzing a photo of food ingredients. Identify each ingredient visible in the image, estimate the quantity/portion size, and provide calorie estimates.
${contextPrompt}

Respond with a JSON object in this exact format:
{
  "detectedItems": [
    {
      "name": string (ingredient name),
      "estimatedAmount": number,
      "unit": string (cups, oz, pieces, etc.),
      "confidence": number (0-100, how confident you are in the identification),
      "estimatedCalories": number
    }
  ],
  "suggestedServings": number (how many servings this amount could make),
  "totalEstimatedCalories": number,
  "recommendations": string[] (tips about the portions, freshness observations, etc.)
}

Only respond with valid JSON, no additional text.`;

  try {
    const result = await visionModel.generateContent([prompt, imagePart]);
    const response = result.response.text();

    // Extract JSON from response
    const jsonMatch = response.match(/```json\n?([\s\S]*?)\n?```/) ||
      response.match(/```\n?([\s\S]*?)\n?```/) ||
      [null, response];
    const jsonStr = jsonMatch[1] || response;

    return JSON.parse(jsonStr.trim()) as PortionAnalysis;
  } catch (error) {
    console.error('Error analyzing portion:', error);
    return {
      detectedItems: [],
      suggestedServings: 0,
      totalEstimatedCalories: 0,
      recommendations: ['Unable to analyze the image. Please try again with a clearer photo.'],
    };
  }
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

// Export the AI models for direct use if needed
export { textModel, visionModel };
