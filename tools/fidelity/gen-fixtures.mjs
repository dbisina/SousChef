// Generates fixtures/*.json (store-state patches). Content is taken from the design HTML text.
// "$daysFromNow" / "$ts" markers are turned into Timestamp-like objects in the page by run.mjs.
// Re-run after editing: node tools/fidelity/gen-fixtures.mjs  (from the repo root)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const A = (f) => '/__assets/' + f + '.jpg'; // served from .redesign-assets by serve.mjs
const now = { $daysFromNow: 0 };
const ing = (name, amount, unit, calories = 80) => ({ name, amount, unit, calories, optional: false });
const nutrition = { caloriesPerServing: 520, totalCalories: 1040, protein: 38, carbs: 32, fat: 24, fiber: 7 };

const salmon = {
  id: 'fx-salmon', title: 'Herb salmon with broccoli', description: '',
  imageURL: A('salmon'), authorId: 'chef', authorName: '[CHEF NAME]', isOfficial: true, status: 'published',
  category: 'dinner', cuisine: 'mediterranean', difficulty: 'easy', prepTime: 10, cookTime: 15, servings: 2,
  ingredients: [ing('Salmon', 2, 'fillets', 300), ing('Broccoli', 1, 'head', 55), ing('Garlic', 3, 'cloves', 12), ing('Avocado', 1, 'whole', 240), ing('Lemon', 1, 'whole', 17), ing('Olive oil', 2, 'tbsp', 240)],
  instructions: ['Heat the oven to 200C.', 'Roast the broccoli with garlic and oil for 12 minutes.', 'Lay the fillets skin-side down in a hot pan and cook 4–5 minutes until crisp and golden.', 'Rest the fish, squeeze over lemon.', 'Plate everything with the herbs.', 'Serve warm.'],
  nutrition, tags: ['quick', 'high-protein'], likes: 0, rating: 4.8, ratingCount: 120, createdAt: now,
};
const recipes = [
  salmon,
  { ...salmon, id: 'fx-pancakes', title: 'Blueberry pancakes', imageURL: A('pancakes'), prepTime: 5, cookTime: 15, category: 'breakfast' },
  { ...salmon, id: 'fx-ramen', title: 'Spicy egg ramen', imageURL: A('ramen'), prepTime: 5, cookTime: 10, category: 'lunch' },
  { ...salmon, id: 'fx-chicken', title: 'Grilled chicken avocado salad', imageURL: A('salad'), prepTime: 10, cookTime: 10, category: 'lunch' },
];
const imported = (id, title, platform, img, cook, prep = 15, nIng = 4) => ({
  id, ownerId: 'guest', status: 'saved', savedAt: now, addedToShoppingList: false, pantryMatchPercent: 60,
  importedRecipe: {
    id: id + '-r', title, description: '', imageURL: A(img), sourceURL: 'https://' + platform + '.example/' + id, sourcePlatform: platform,
    ingredients: [ing('Chicken breast', 2, 'pieces', 330), ing('Eggs', 1, '', 70), ing('Panko', 100, 'g', 350), ing('Rice', 200, 'g', 260), ing('Soy sauce', 2, 'tbsp', 20), ing('Spring onion', 2, 'stalks', 10)].slice(0, nIng),
    instructions: ['Crumb the chicken.', 'Fry until golden.', 'Serve over rice.'], servings: 2, prepTime: prep, cookTime: cook, difficulty: 'easy',
    tags: ['weeknight'], extractedAt: now, extractionConfidence: 0.9,
  },
});
const wtc = [
  { ...imported('fx-salmon', 'Chicken katsu rice bowl', 'tiktok', 'ricebowl', 20, 15, 2), pantryMatchPercent: undefined },
  imported('fx-tacos', 'Chickpea avocado tacos', 'tiktok', 'tacos', 20),
  imported('fx-penne', 'Creamy garlic penne', 'youtube', 'penne', 25),
  { ...imported('fx-brownie', 'Fudgy brownies', 'website', 'brownie', 45), status: 'cooked', cookedAt: now },
];
// Want to Cook as drawn in WantToCook.html (hero, two tiles, one cookbook row).
const wtcDesign = [
  imported('fx-tacos', 'Chickpea avocado tacos', 'tiktok', 'tacos2', 10, 10, 6),
  imported('fx-penne', 'Creamy garlic penne', 'youtube', 'penne', 15, 10),
  { ...imported('fx-brownie', 'Fudgy brownies', 'website', 'brownie', 30, 15), status: 'cooked', cookedAt: now },
  imported('fx-greens', 'Kale & chickpea bowl', 'Cookbook scan', 'greens', 10, 5),
];
const cookbook = { id: 'fx-book', title: 'Weeknight Comforts', description: 'Curated cookbook', coverImageURL: A('cookbook'), recipeIds: recipes.map((r) => r.id), likes: 348, createdAt: now, updatedAt: now };

const pantryItem = (id, name, amount, unit, category, days) => ({ id, name, amount, unit, category, addedAt: now, expiryDate: { $daysFromNow: days } });
const pantry = [
  pantryItem('p1', 'Chicken thighs', 2, 'pieces', 'meat', 2), pantryItem('p2', 'Spinach', 1, 'bag', 'produce', 1),
  pantryItem('p3', 'Eggs', 6, 'pieces', 'dairy', 14), pantryItem('p4', 'Greek yogurt', 1, 'tub', 'dairy', 2),
  pantryItem('p5', 'Rice', 1, 'kg', 'grains', 200),
];

const qs = (id, name, amount, unit, category, recipeName, checked = false) => ({ id, name, amount, unit, category, checked, recipeName, addedAt: now });
const shoppingList = {
  id: 'sl', userId: 'guest', name: 'Shopping', recipeIds: ['fx-salmon'], createdAt: now, updatedAt: now,
  items: [
    qs('s1', 'Broccoli', 1, 'head', 'produce', 'Herb salmon'), qs('s2', 'Avocado', 2, 'pieces', 'produce', 'Herb salmon', true),
    qs('s3', 'Cherry tomatoes', 250, 'g', 'produce', 'Herb salmon'), qs('s4', 'Salmon fillets', 2, 'pieces', 'seafood', 'Herb salmon'),
    qs('s5', 'Steak', 400, 'g', 'meat', 'Steak tacos'),
  ],
};

const monday = (() => { const d = new Date(); const day = (d.getDay() + 6) % 7; d.setDate(d.getDate() - day); return d; })();
const iso = (d) => d.toISOString().slice(0, 10);
const meal = (id, name, img) => ({ recipeId: id, recipeName: name, servings: 2, imageURL: A(img) });
const days = Array.from({ length: 7 }, (_, i) => {
  const d = new Date(monday); d.setDate(d.getDate() + i);
  return { date: iso(d), breakfast: meal('fx-pancakes', 'Fried egg avocado toast', 'toast'), lunch: meal('fx-chicken', 'Rainbow tofu grain bowl', 'bowl'), dinner: meal('fx-salmon', 'Herb salmon with broccoli', 'salmon') };
});
const sli = (id, name, amount, unit, category, inPantry) => ({ id, name, amount, unit, category, recipes: ['fx-salmon'], recipeNames: ['Herb salmon with broccoli'], inPantry, pantryAmount: inPantry ? amount : 0, toBuy: inPantry ? 0 : amount, checked: false });
const plan = {
  id: 'plan', userId: 'guest', weekStartDate: iso(monday), days, isGenerated: true, createdAt: now, updatedAt: now,
  shoppingList: [sli('m1', 'Broccoli', 1, 'head', 'produce', false), sli('m2', 'Avocado', 2, 'pieces', 'produce', false), sli('m3', 'Cherry tomatoes', 250, 'g', 'produce', false), sli('m4', 'Salmon fillets', 2, 'pieces', 'seafood', false), sli('m5', 'Steak', 400, 'g', 'meat', false), sli('m6', 'Eggs', 6, 'pieces', 'dairy', true)],
  stats: { pantryItemsUsed: 9, expiringItemsUsed: 3, ingredientOverlap: 68, estimatedSavings: 14, totalMeals: 21, uniqueRecipes: 12 },
};
const order = {
  id: 'order-fixture', number: '2841', restaurantId: 'smash', restaurantName: 'Smash Shack',
  lines: [{ dishId: 'double-smash', name: 'Double smash', qty: 1, extras: [], unitPence: 1050 }],
  subtotalPence: 1050, deliveryPence: 199, totalPence: 1249, status: 'Preparing', placedAt: new Date(Date.now() - 4 * 60000).toISOString(),
  etaMin: 12, rider: { name: 'Tunde', rating: 4.9, photo: 'rider' }, loggedToHealth: false, demo: true,
};

const w = (name, o) => fs.writeFileSync(path.join(HERE, 'fixtures', name + '.json'), JSON.stringify(o, null, 1));
fs.mkdirSync(path.join(HERE, 'fixtures'), { recursive: true });
w('recipes', { wait: 1500, stores: {
  recipe: { recipes, currentRecipe: salmon, isLoading: false, error: null },
  wantToCook: { items: wtc, isLoading: false, error: null },
  cookbook: { cookbooks: [cookbook], currentCookbook: cookbook, currentCookbookRecipes: recipes, isLoading: false, error: null },
} });
// Cook mode: a running step timer (4:32 left of 12:36) and a 5 day streak for the done screen.
w('cook', { wait: 1500, stores: {
  recipe: { recipes, currentRecipe: salmon, isLoading: false, error: null },
  voice: { timers: [{ id: 'fx-timer', name: 'Step 3', totalSeconds: 756, remainingSeconds: 272, isRunning: true, createdAt: now, endTime: now }], activeTimerCount: 1 },
  gamification: { streak: { currentStreak: 5, longestStreak: 5, lastCookDate: null } },
} });
w('wanttocook', { wait: 1500, stores: { wantToCook: { items: wtcDesign, isLoading: false, error: null } } });
w('pantry', { wait: 1200, stores: { pantry: { items: pantry, isLoading: false, error: null } } });
w('shopping', { wait: 1200, stores: { wantToCook: { shoppingList, items: wtc, isLoading: false }, pantry: { items: pantry } } });
w('mealplan', { wait: 1500, stores: { mealPlan: { currentPlan: plan, isLoading: false, isGenerating: false, error: null }, recipe: { recipes }, pantry: { items: pantry } } });
w('orders', { wait: 800, stores: { order: { orders: [order] } } });

// Mystery Kitchen: drive the real store actions, then reload so route guards see the round.
w('mkLobby', { navigate: true, wait: 600, stores: {}, calls: [{ store: 'play', fn: 'hostRound' }] });
w('mkRound', { navigate: true, wait: 600, stores: {}, calls: [{ store: 'play', fn: 'hostRound' }, { store: 'play', fn: 'startRound' }] });
w('mkReveal', { navigate: true, wait: 600, stores: {}, calls: [{ store: 'play', fn: 'hostRound' }, { store: 'play', fn: 'startRound' }, { store: 'play', fn: 'submitPlate' }] });

const rec = (id, name, page) => ({ id, name, pageNumber: page, source: 'fetched', description: name, keyIngredients: ['Salmon', 'Broccoli'],
  fullContent: { description: name, imageURL: A('salmon'), prepTime: 10, cookTime: 15, servings: 2, difficulty: 'easy',
    ingredients: [{ name: 'Salmon', amount: '2', unit: 'fillets' }, { name: 'Broccoli', amount: '1', unit: 'head' }], instructions: ['Sear the salmon.', 'Roast the broccoli.'] } });
const book = (id, title, author, img, n, status) => ({ id, title, author, coverImageURL: A(img), description: 'Cookbook', addedAt: new Date().toISOString(), recipesScanned: n,
  recipes: [rec('fx-salmon', 'Herb salmon with broccoli', 12), rec('fx-chicken', 'Grilled chicken avocado salad', 40)], fetchStatus: status });
w('shelf', { wait: 800, stores: { cookbookLibrary: { cookbooks: [book('fx-book', 'Weeknight Italian', 'Ama Cooks', 'cookbook', 32, 'done'), book('fx-book2', 'The Green Table', 'Kemi', 'greens', 18, 'done'), book('fx-book3', 'Bakes & Brunch', 'Dayo', 'pancakes', 0, 'fetching')], isLoading: false } } });
w('admin', { wait: 600, stores: { auth: { user: { id: 'admin1', email: 'admin@example.com', displayName: 'Admin', role: 'admin', createdAt: now, savedRecipes: [], dietaryPreferences: [], allergies: [], healthConditions: [] }, isGuest: false } } });

// Signed-in (non-guest) user for screens that gate on a real account.
w('user', { wait: 600, stores: { auth: { user: { id: 'user1', email: 'me@example.com', displayName: '[YOUR NAME]', role: 'user', createdAt: now, savedRecipes: [], dietaryPreferences: [], allergies: [], healthConditions: [] }, isGuest: false } } });
