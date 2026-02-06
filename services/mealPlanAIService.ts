import { textModel } from '@/lib/gemini';
import {
  MealPlanDay,
  MealPlanPreferences,
  MealPlanAIResponse,
  ShoppingListItem,
  MealPlanStats,
  ShoppingCategory,
  MealType,
} from '@/types/mealplan';
import { Recipe, PantryItem, Ingredient } from '@/types';
import { generateId } from '@/lib/firebase';

// AI prompt for meal plan optimization
const MEAL_PLAN_PROMPT = `You are a meal planning expert focused on reducing food waste and maximizing ingredient efficiency.

EXPIRING SOON (MUST USE FIRST - these items will spoil if not used):
{expiringItems}

PANTRY AVAILABLE (items the user already has):
{pantryItems}

RECIPES TO CHOOSE FROM:
{recipes}

USER PREFERENCES:
- Servings per meal: {servings}
- Meals to include: {mealTypes}
- Days to plan: {days}
- Dietary restrictions: {restrictions}
- Cuisine preferences: {cuisines}
- Max prep time: {maxPrepTime} minutes
- Max cook time: {maxCookTime} minutes
- Prioritize expiring items: {prioritizeExpiring}
- Maximize ingredient overlap: {maximizeOverlap}

OPTIMIZATION GOALS (in order of priority):
1. Use ALL expiring items before they spoil - this is the most important goal
2. Maximize ingredient reuse across meals (buy ingredients that work in multiple recipes)
3. Minimize shopping list size by choosing recipes with overlapping ingredients
4. Use existing pantry items as much as possible
5. Balance nutrition and variety across the week
6. Respect user preferences and restrictions

Return a JSON object with this exact structure:
{
  "plan": [
    {
      "date": "YYYY-MM-DD",
      "breakfast": {"recipeId": "...", "recipeName": "...", "servings": N} or null,
      "lunch": {"recipeId": "...", "recipeName": "...", "servings": N} or null,
      "dinner": {"recipeId": "...", "recipeName": "...", "servings": N} or null,
      "snack": {"recipeId": "...", "recipeName": "...", "servings": N} or null
    }
  ],
  "shoppingList": [
    {
      "name": "ingredient name",
      "amount": 2,
      "unit": "lbs",
      "category": "produce|dairy|meat|seafood|grains|spices|condiments|canned|frozen|beverages|bakery|other",
      "recipes": ["recipeId1", "recipeId2"],
      "recipeNames": ["Recipe 1", "Recipe 2"],
      "inPantry": true/false,
      "pantryAmount": 0,
      "toBuy": 2
    }
  ],
  "stats": {
    "pantryItemsUsed": N,
    "expiringItemsUsed": N,
    "ingredientOverlap": N (percentage 0-100),
    "estimatedSavings": N.NN (dollars saved),
    "totalMeals": N,
    "uniqueRecipes": N
  },
  "notes": ["Using chicken in 3 meals this week", "Tomatoes used before Friday expiry"],
  "optimizationInsights": ["Ingredient overlap: onions appear in 5 recipes"]
}

IMPORTANT:
- Only use recipes from the provided list
- Use recipe IDs exactly as provided
- Calculate amounts needed based on servings
- Mark items as inPantry if user has them
- toBuy should be amount needed minus pantryAmount
- Respond ONLY with valid JSON, no additional text`;

// Generate an optimized meal plan using AI
export const generateMealPlan = async (
  preferences: MealPlanPreferences,
  recipes: Recipe[],
  pantryItems: PantryItem[],
  expiringItems: PantryItem[],
  weekDates: string[]
): Promise<MealPlanAIResponse> => {
  // Format expiring items for the prompt
  const expiringItemsText =
    expiringItems.length > 0
      ? expiringItems
          .map(
            (item) =>
              `- ${item.amount} ${item.unit} ${item.name} (expires: ${item.expiryDate?.toDate().toLocaleDateString() || 'soon'})`
          )
          .join('\n')
      : 'None';

  // Format pantry items for the prompt
  const pantryItemsText =
    pantryItems.length > 0
      ? pantryItems
          .map((item) => `- ${item.amount} ${item.unit} ${item.name}`)
          .join('\n')
      : 'None';

  // Format recipes for the prompt (limit to relevant info)
  const recipesText = recipes
    .map(
      (r) =>
        `ID: ${r.id} | "${r.title}" (${r.category}, ${r.cuisine}) | Prep: ${r.prepTime}min, Cook: ${r.cookTime}min | Servings: ${r.servings} | Ingredients: ${r.ingredients.map((i) => i.name).join(', ')}`
    )
    .join('\n');

  // Build the prompt
  const prompt = MEAL_PLAN_PROMPT.replace('{expiringItems}', expiringItemsText)
    .replace('{pantryItems}', pantryItemsText)
    .replace('{recipes}', recipesText)
    .replace('{servings}', preferences.servingsPerMeal.toString())
    .replace('{mealTypes}', preferences.mealsToInclude.join(', '))
    .replace('{days}', preferences.daysToGenerate.toString())
    .replace(
      '{restrictions}',
      preferences.dietaryRestrictions.length > 0
        ? preferences.dietaryRestrictions.join(', ')
        : 'None'
    )
    .replace(
      '{cuisines}',
      preferences.cuisinePreferences.length > 0
        ? preferences.cuisinePreferences.join(', ')
        : 'Any'
    )
    .replace('{maxPrepTime}', preferences.maxPrepTime?.toString() || 'any')
    .replace('{maxCookTime}', preferences.maxCookTime?.toString() || 'any')
    .replace('{prioritizeExpiring}', preferences.prioritizeExpiring ? 'yes' : 'no')
    .replace('{maximizeOverlap}', preferences.maximizeOverlap ? 'yes' : 'no');

  try {
    const result = await textModel.generateContent(prompt);
    const response = result.response.text();

    // Extract JSON from response
    const jsonMatch = response.match(/```json\n?([\s\S]*?)\n?```/) ||
      response.match(/```\n?([\s\S]*?)\n?```/) ||
      [null, response];
    const jsonStr = jsonMatch[1] || response;

    const parsed = JSON.parse(jsonStr.trim()) as MealPlanAIResponse;

    // Add IDs to shopping list items
    const shoppingListWithIds: ShoppingListItem[] = parsed.shoppingList.map(
      (item) => ({
        ...item,
        id: generateId(),
        checked: false,
      })
    );

    // Validate and ensure dates match
    const validatedPlan = validateAndFixPlan(parsed.plan, weekDates, recipes);

    return {
      ...parsed,
      plan: validatedPlan,
      shoppingList: shoppingListWithIds,
    };
  } catch (error) {
    console.error('Error generating meal plan:', error);
    throw new Error('Failed to generate meal plan. Please try again.');
  }
};

// Validate and fix the AI-generated plan
const validateAndFixPlan = (
  plan: MealPlanDay[],
  weekDates: string[],
  recipes: Recipe[]
): MealPlanDay[] => {
  const recipeMap = new Map(recipes.map((r) => [r.id, r]));

  // Ensure we have a day for each date
  return weekDates.map((date) => {
    const existingDay = plan.find((d) => d.date === date);

    if (!existingDay) {
      return { date };
    }

    // Validate each meal
    const validatedDay: MealPlanDay = { date };

    const validateMeal = (meal: MealPlanDay[MealType] | undefined) => {
      if (!meal) return undefined;
      const recipe = recipeMap.get(meal.recipeId);
      if (!recipe) return undefined;
      return {
        ...meal,
        recipeName: recipe.title,
        imageURL: recipe.imageURL,
      };
    };

    if (existingDay.breakfast) {
      validatedDay.breakfast = validateMeal(existingDay.breakfast);
    }
    if (existingDay.lunch) {
      validatedDay.lunch = validateMeal(existingDay.lunch);
    }
    if (existingDay.dinner) {
      validatedDay.dinner = validateMeal(existingDay.dinner);
    }
    if (existingDay.snack) {
      validatedDay.snack = validateMeal(existingDay.snack);
    }

    return validatedDay;
  });
};

// Calculate shopping list from recipes manually (fallback if AI fails)
export const calculateShoppingList = (
  days: MealPlanDay[],
  recipes: Recipe[],
  pantryItems: PantryItem[]
): ShoppingListItem[] => {
  const recipeMap = new Map(recipes.map((r) => [r.id, r]));
  const pantryMap = new Map(
    pantryItems.map((p) => [p.name.toLowerCase(), p])
  );
  const ingredientMap = new Map<
    string,
    {
      name: string;
      totalAmount: number;
      unit: string;
      category: ShoppingCategory;
      recipes: Set<string>;
      recipeNames: Set<string>;
    }
  >();

  // Aggregate ingredients from all planned meals
  days.forEach((day) => {
    const meals = [day.breakfast, day.lunch, day.dinner, day.snack].filter(
      Boolean
    );

    meals.forEach((meal) => {
      if (!meal) return;
      const recipe = recipeMap.get(meal.recipeId);
      if (!recipe) return;

      const servingMultiplier = meal.servings / recipe.servings;

      recipe.ingredients.forEach((ing) => {
        const key = ing.name.toLowerCase();
        const existing = ingredientMap.get(key);

        if (existing) {
          existing.totalAmount += ing.amount * servingMultiplier;
          existing.recipes.add(meal.recipeId);
          existing.recipeNames.add(recipe.title);
        } else {
          ingredientMap.set(key, {
            name: ing.name,
            totalAmount: ing.amount * servingMultiplier,
            unit: ing.unit,
            category: inferCategory(ing.name),
            recipes: new Set([meal.recipeId]),
            recipeNames: new Set([recipe.title]),
          });
        }
      });
    });
  });

  // Convert to shopping list with pantry deductions
  const shoppingList: ShoppingListItem[] = [];

  ingredientMap.forEach((data, key) => {
    const pantryItem = pantryMap.get(key);
    const pantryAmount = pantryItem ? pantryItem.amount : 0;
    const toBuy = Math.max(0, data.totalAmount - pantryAmount);

    shoppingList.push({
      id: generateId(),
      name: data.name,
      amount: data.totalAmount,
      unit: data.unit,
      category: data.category,
      recipes: Array.from(data.recipes),
      recipeNames: Array.from(data.recipeNames),
      inPantry: pantryAmount > 0,
      pantryAmount,
      toBuy,
      checked: false,
    });
  });

  // Sort by category
  return shoppingList.sort((a, b) => a.category.localeCompare(b.category));
};

// Infer shopping category from ingredient name
const inferCategory = (name: string): ShoppingCategory => {
  const lowered = name.toLowerCase();

  const categoryPatterns: { pattern: RegExp; category: ShoppingCategory }[] = [
    // Produce
    { pattern: /lettuce|spinach|kale|tomato|onion|garlic|pepper|carrot|celery|broccoli|cucumber|avocado|lemon|lime|orange|apple|banana|berries|mushroom|potato|zucchini|squash|herb|parsley|cilantro|basil|mint/, category: 'produce' },
    // Dairy
    { pattern: /milk|cheese|butter|cream|yogurt|egg|sour cream/, category: 'dairy' },
    // Meat
    { pattern: /chicken|beef|pork|lamb|turkey|bacon|sausage|ham|ground meat|steak/, category: 'meat' },
    // Seafood
    { pattern: /fish|salmon|tuna|shrimp|crab|lobster|scallop|cod|tilapia/, category: 'seafood' },
    // Grains
    { pattern: /rice|pasta|bread|flour|oat|quinoa|couscous|noodle|tortilla/, category: 'grains' },
    // Spices
    { pattern: /salt|pepper|cumin|paprika|oregano|thyme|rosemary|cinnamon|nutmeg|ginger|chili|curry|turmeric/, category: 'spices' },
    // Condiments
    { pattern: /oil|vinegar|soy sauce|ketchup|mustard|mayo|honey|syrup|sauce|dressing/, category: 'condiments' },
    // Canned
    { pattern: /canned|beans|chickpea|lentil|tomato sauce|broth|stock|coconut milk/, category: 'canned' },
    // Frozen
    { pattern: /frozen|ice cream/, category: 'frozen' },
    // Beverages
    { pattern: /juice|wine|beer|coffee|tea|soda/, category: 'beverages' },
    // Bakery
    { pattern: /bread|bagel|croissant|muffin|roll|bun/, category: 'bakery' },
  ];

  for (const { pattern, category } of categoryPatterns) {
    if (pattern.test(lowered)) {
      return category;
    }
  }

  return 'other';
};

// Calculate meal plan stats
export const calculateMealPlanStats = (
  days: MealPlanDay[],
  shoppingList: ShoppingListItem[],
  expiringItemsUsed: number
): MealPlanStats => {
  // Count unique recipes
  const recipeIds = new Set<string>();
  let totalMeals = 0;

  days.forEach((day) => {
    if (day.breakfast) {
      recipeIds.add(day.breakfast.recipeId);
      totalMeals++;
    }
    if (day.lunch) {
      recipeIds.add(day.lunch.recipeId);
      totalMeals++;
    }
    if (day.dinner) {
      recipeIds.add(day.dinner.recipeId);
      totalMeals++;
    }
    if (day.snack) {
      recipeIds.add(day.snack.recipeId);
      totalMeals++;
    }
  });

  // Calculate pantry items used
  const pantryItemsUsed = shoppingList.filter((item) => item.inPantry).length;

  // Calculate ingredient overlap (items used in multiple recipes)
  const multiUseItems = shoppingList.filter((item) => item.recipes.length > 1);
  const ingredientOverlap = Math.round(
    (multiUseItems.length / shoppingList.length) * 100
  );

  // Estimate savings (rough calculation)
  const averageItemCost = 3; // Average $3 per ingredient
  const overlapSavings = multiUseItems.reduce(
    (sum, item) => sum + (item.recipes.length - 1) * averageItemCost * 0.5,
    0
  );
  const expiringItemSavings = expiringItemsUsed * averageItemCost;
  const estimatedSavings = Math.round((overlapSavings + expiringItemSavings) * 100) / 100;

  return {
    pantryItemsUsed,
    expiringItemsUsed,
    ingredientOverlap: isNaN(ingredientOverlap) ? 0 : ingredientOverlap,
    estimatedSavings,
    totalMeals,
    uniqueRecipes: recipeIds.size,
  };
};

// Get suggestions for improving a meal plan
export const getMealPlanSuggestions = async (
  currentPlan: MealPlanDay[],
  expiringItems: PantryItem[]
): Promise<string[]> => {
  if (expiringItems.length === 0) {
    return ['Your meal plan looks great! No expiring items to worry about.'];
  }

  const unusedExpiring = expiringItems.filter((item) => {
    // Check if item is used in any meal
    const usedInMeal = currentPlan.some((day) => {
      // This would need recipe data to properly check
      return false;
    });
    return !usedInMeal;
  });

  const suggestions: string[] = [];

  if (unusedExpiring.length > 0) {
    suggestions.push(
      `Consider adding meals that use: ${unusedExpiring.map((i) => i.name).join(', ')}`
    );
  }

  return suggestions;
};
