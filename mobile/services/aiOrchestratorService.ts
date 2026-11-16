/**
 * AI Orchestrator Service
 *
 * Central intelligence layer that understands context across the entire app:
 * pantry, meal plans, health conditions, recipes, shopping list, and cooking state.
 *
 * Powers:
 * - Interactive cooking mode Q&A
 * - Voice-driven pantry/cart additions
 * - Context-aware recipe suggestions
 * - Health condition-aware meal recommendations
 * - Smart substitutions considering user's full profile
 */

import { textModel, visionModel } from '@/lib/gemini';
import { Recipe, Ingredient, User, PantryItem } from '@/types';
import { useLanguageStore } from '@/stores/languageStore';
import { SUPPORTED_LANGUAGES } from '@/lib/i18n';

// ── Context bundle passed to the AI for any query ──
export interface AppContext {
  user: User | null;
  currentRecipe?: Recipe;
  currentStep?: number;
  pantryItems?: PantryItem[];
  shoppingList?: string[];
  recentMeals?: string[];
  weightLossGoal?: {
    dailyCalorieTarget: number;
    caloriesConsumedToday: number;
  };
}

// ── Response types ──
export interface AIResponse {
  text: string;
  action?: AIAction;
}

export type AIAction =
  | { type: 'set_timer'; minutes: number; label: string }
  | { type: 'next_step' }
  | { type: 'previous_step' }
  | { type: 'add_to_pantry'; items: { name: string; amount: number; unit: string; category: string }[] }
  | { type: 'add_to_cart'; items: { name: string; amount: number; unit: string }[] }
  | { type: 'suggest_recipe'; query: string }
  | { type: 'adjust_servings'; servings: number }
  | { type: 'show_nutrition' }
  | { type: 'show_substitution'; ingredient: string }
  | { type: 'none' };

// ── System prompt builder ──
function buildSystemPrompt(context: AppContext): string {
  // Get user's preferred language
  const langCode = useLanguageStore.getState().language;
  const langConfig = SUPPORTED_LANGUAGES.find((l) => l.code === langCode);
  const langInstruction = langCode !== 'en' && langConfig
    ? `\nIMPORTANT: Always respond in ${langConfig.name} (${langConfig.nativeName}). All text in your responses must be in ${langConfig.nativeName}.`
    : '';

  const parts: string[] = [
    `You are SousChef AI, an intelligent cooking assistant embedded in a recipe app.`,
    `You help users cook, manage their pantry, plan meals, and achieve health goals.`,
    `Respond conversationally but concisely. When an action is needed, include it in your JSON response.`,
    langInstruction,
  ];

  // User health profile
  if (context.user) {
    const prefs = context.user.dietaryPreferences || [];
    const allergies = context.user.allergies || [];
    const conditions = context.user.healthConditions || [];

    if (prefs.length || allergies.length || conditions.length) {
      parts.push(`\nUSER HEALTH PROFILE:`);
      if (conditions.length) parts.push(`- Health conditions: ${conditions.join(', ')}`);
      if (prefs.length) parts.push(`- Dietary preferences: ${prefs.join(', ')}`);
      if (allergies.length) parts.push(`- Allergies (CRITICAL - never suggest these): ${allergies.join(', ')}`);
      parts.push(`ALWAYS consider these when suggesting food, substitutions, or recipes.`);
    }
  }

  // Weight loss context
  if (context.weightLossGoal) {
    const remaining = context.weightLossGoal.dailyCalorieTarget - context.weightLossGoal.caloriesConsumedToday;
    parts.push(`\nWEIGHT LOSS GOAL: Target ${context.weightLossGoal.dailyCalorieTarget} cal/day. Consumed today: ${context.weightLossGoal.caloriesConsumedToday}. Remaining: ${remaining} cal.`);
    parts.push(`Help user stay on track. Suggest lower-calorie alternatives when appropriate.`);
  }

  // Current cooking context
  if (context.currentRecipe) {
    const r = context.currentRecipe;
    parts.push(`\nCURRENTLY COOKING: "${r.title}"`);
    parts.push(`Ingredients: ${r.ingredients.map((i) => `${i.amount} ${i.unit} ${i.name}`).join(', ')}`);
    parts.push(`Total steps: ${r.instructions.length}`);
    if (context.currentStep !== undefined) {
      parts.push(`Current step (${context.currentStep + 1}/${r.instructions.length}): "${r.instructions[context.currentStep]}"`);
      if (context.currentStep + 1 < r.instructions.length) {
        parts.push(`Next step: "${r.instructions[context.currentStep + 1]}"`);
      }
    }
    parts.push(`Answer questions about this recipe, suggest timing, warn about tricky steps.`);
  }

  // Pantry
  if (context.pantryItems?.length) {
    const items = context.pantryItems.slice(0, 30).map((i) => `${i.name} (${i.amount} ${i.unit})`);
    parts.push(`\nPANTRY (${context.pantryItems.length} items): ${items.join(', ')}`);
  }

  parts.push(`\nRESPONSE FORMAT: Return ONLY valid JSON:`);
  parts.push(`{"text": "your response to the user", "action": {"type": "action_type", ...params} }`);
  parts.push(`Action types: set_timer, next_step, previous_step, add_to_pantry, add_to_cart, suggest_recipe, adjust_servings, show_nutrition, show_substitution, none`);
  parts.push(`Use action "none" if no app action is needed (just conversation).`);
  parts.push(`For add_to_pantry: {"type": "add_to_pantry", "items": [{"name": "...", "amount": 1, "unit": "...", "category": "produce|dairy|meat|seafood|grains|spices|condiments|canned|frozen|beverages|other"}]}`);
  parts.push(`For add_to_cart: {"type": "add_to_cart", "items": [{"name": "...", "amount": 1, "unit": "..."}]}`);
  parts.push(`For set_timer: {"type": "set_timer", "minutes": 5, "label": "Boil pasta"}`);

  return parts.join('\n');
}

// ── Main query function ──
export async function askAI(
  userMessage: string,
  context: AppContext,
): Promise<AIResponse> {
  try {
    const systemPrompt = buildSystemPrompt(context);
    const fullPrompt = `${systemPrompt}\n\nUser says: "${userMessage}"`;

    const result = await textModel.generateContent(fullPrompt);
    const response = result.response.text();

    // Parse JSON response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        text: parsed.text || 'I can help with that!',
        action: parsed.action || { type: 'none' },
      };
    }

    // Fallback: treat entire response as text
    return { text: response.trim(), action: { type: 'none' } };
  } catch (error) {
    console.error('[AI Orchestrator] Error:', error);
    return {
      text: "Sorry, I'm having trouble right now. Try again in a moment.",
      action: { type: 'none' },
    };
  }
}

// ── Specialized: Parse voice input for pantry/cart additions ──
export async function parseVoiceForPantryOrCart(
  transcript: string,
  mode: 'pantry' | 'cart',
): Promise<AIResponse> {
  const prompt = `Parse this voice input into ${mode} items. The user wants to add items to their ${mode === 'pantry' ? 'pantry (food they have at home)' : 'shopping cart (food they need to buy)'}.

Voice input: "${transcript}"

Return ONLY valid JSON:
{
  "text": "confirmation message",
  "action": {
    "type": "${mode === 'pantry' ? 'add_to_pantry' : 'add_to_cart'}",
    "items": [{"name": "item name", "amount": 1, "unit": "unit"${mode === 'pantry' ? ', "category": "produce|dairy|meat|seafood|grains|spices|condiments|canned|frozen|beverages|other"' : ''}}]
  }
}

Parse quantities naturally: "two pounds of chicken" -> amount: 2, unit: "lbs", name: "chicken"
"a dozen eggs" -> amount: 12, unit: "pieces", name: "eggs"
"milk" (no quantity) -> amount: 1, unit: "unit", name: "milk"
Multiple items: "eggs, milk, and bread" -> 3 separate items`;

  try {
    const result = await textModel.generateContent(prompt);
    const response = result.response.text();
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        text: parsed.text || `Added to ${mode}!`,
        action: parsed.action || { type: 'none' },
      };
    }
    return { text: `Couldn't understand that. Try saying the items again.`, action: { type: 'none' } };
  } catch (error) {
    console.error('[AI Orchestrator] Voice parse error:', error);
    return { text: 'Voice parsing failed. Please try again.', action: { type: 'none' } };
  }
}

// ── Specialized: Get cooking advice for current step ──
export async function getCookingAdvice(
  question: string,
  recipe: Recipe,
  currentStep: number,
  pantryItems: PantryItem[],
  userAllergies: string[],
): Promise<string> {
  const step = recipe.instructions[currentStep];
  const pantryNames = pantryItems.map((i) => i.name).join(', ');

  const prompt = `You are helping someone cook "${recipe.title}".
They are on step ${currentStep + 1}: "${step}"
Their question: "${question}"
Their pantry has: ${pantryNames}
Their allergies: ${userAllergies.join(', ') || 'none'}

Give a helpful, concise answer. If they ask about substitutions, only suggest things safe for their allergies and preferably from their pantry. Keep it under 3 sentences.`;

  try {
    const result = await textModel.generateContent(prompt);
    return result.response.text().trim();
  } catch (error) {
    return "I'm not sure about that. Check the recipe instructions for guidance.";
  }
}

// ── Specialized: Generate condition-safe meal plan ──
export async function generateConditionSafeMealPlan(
  user: User,
  days: number,
  pantryItems: PantryItem[],
  calorieTarget?: number,
): Promise<string> {
  const conditions = user.healthConditions || [];
  const allergies = user.allergies || [];
  const prefs = user.dietaryPreferences || [];
  const pantryNames = pantryItems.slice(0, 20).map((i) => i.name);

  const prompt = `Generate a ${days}-day meal plan for someone with:
${conditions.length ? `Health conditions: ${conditions.join(', ')}` : ''}
${allergies.length ? `Allergies (MUST AVOID): ${allergies.join(', ')}` : ''}
${prefs.length ? `Dietary preferences: ${prefs.join(', ')}` : ''}
${calorieTarget ? `Daily calorie target: ${calorieTarget} calories` : ''}
${pantryNames.length ? `Available ingredients: ${pantryNames.join(', ')}` : ''}

For each day, provide breakfast, lunch, dinner with:
- Recipe name
- Estimated calories
- Key ingredients
- Why it's safe for their conditions

Be specific about portions for calorie accuracy. Prioritize using available ingredients.

Return as structured JSON:
{"days": [{"day": 1, "meals": [{"type": "breakfast", "name": "...", "calories": 300, "ingredients": ["..."], "safetyNote": "Low glycemic, no allergens"}]}]}`;

  try {
    const result = await textModel.generateContent(prompt);
    return result.response.text().trim();
  } catch (error) {
    console.error('[AI Orchestrator] Meal plan generation error:', error);
    throw new Error('Failed to generate meal plan');
  }
}

// ── Specialized: Adapt recipe for health conditions ──
export async function adaptRecipeForConditions(
  recipe: Recipe,
  user: User,
  pantryItems?: PantryItem[],
): Promise<{
  adaptedTitle: string;
  changes: string[];
  adaptedIngredients: { original: string; replacement: string; reason: string }[];
  adaptedInstructions: string[];
  estimatedCalories: number;
}> {
  const conditions = user.healthConditions || [];
  const allergies = user.allergies || [];
  const pantryNames = pantryItems?.map((i) => i.name) || [];

  const prompt = `Adapt this recipe to be safe for someone with:
Health conditions: ${conditions.join(', ') || 'none'}
Allergies: ${allergies.join(', ') || 'none'}
Available substitutes from pantry: ${pantryNames.join(', ') || 'none specified'}

RECIPE: "${recipe.title}"
Ingredients: ${recipe.ingredients.map((i) => `${i.amount} ${i.unit} ${i.name}`).join(', ')}
Instructions: ${recipe.instructions.join(' | ')}

Return ONLY valid JSON:
{
  "adaptedTitle": "Modified recipe name",
  "changes": ["Summary of each change made"],
  "adaptedIngredients": [{"original": "sugar", "replacement": "stevia", "reason": "Diabetic-safe sweetener"}],
  "adaptedInstructions": ["Step 1...", "Step 2..."],
  "estimatedCalories": 350
}

Only change what's necessary. If the recipe is already safe, return it as-is with empty changes.`;

  try {
    const result = await textModel.generateContent(prompt);
    const response = result.response.text();
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    throw new Error('Invalid AI response');
  } catch (error) {
    console.error('[AI Orchestrator] Recipe adaptation error:', error);
    return {
      adaptedTitle: recipe.title,
      changes: ['Could not generate adaptations at this time.'],
      adaptedIngredients: [],
      adaptedInstructions: recipe.instructions,
      estimatedCalories: recipe.nutrition?.caloriesPerServing || 0,
    };
  }
}
