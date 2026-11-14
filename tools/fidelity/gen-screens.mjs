// One-off generator for screens.json (kept so the mapping is reproducible). Theme is read from the design's `.s.dk`.
import fs from 'node:fs';
const map = {
  Main: ['/onboarding'], Login: ['/auth/login'], Register: ['/auth/register'], SetupTaste: ['/setup'],
  Home: ['/(tabs)'], Reels: ['/reels'], StoryView: ['/story/story-ama'], PostDetail: ['/post/post-katsu'],
  CreatePost: ['/post/new'], Community: ['/community/budget'], You: ['/(tabs)/you', 'user'], Messages: ['/messages'],
  Chat: ['/messages/conv-ama'], Restaurant: ['/restaurant/smash', 'restaurant'], OrderSheet: ['/order/sheet?dishId=double-smash', 'orderSheet'],
  Onboarding2: ['/onboarding?slide=1'], Onboarding3: ['/onboarding?slide=2'],
  OrderTracking: ['/order/order-fixture', 'orders'], PlayHub: ['/(tabs)/play'], MKLobby: ['/play/mystery/lobby', 'mkLobby'],
  MKRound: ['/play/mystery/round', 'mkRound'], MKReveal: ['/play/mystery/reveal', 'mkReveal'], DailyDish: ['/play/daily-dish'],
  HealthHome: ['/health'], LogReading: ['/health/log'], MealResponse: ['/health/meal/meal-today-b'],
  DoctorReport: ['/health/report'], Kitchen: ['/(tabs)/kitchen'], Create: ['/create'], Import: ['/import'],
  Browse: ['/(tabs)/browse', 'recipes'], Pantry: ['/(tabs)/pantry', 'pantry'], Shopping: ['/(tabs)/shopping', 'shopping'],
  Cook: ['/cook/fx-salmon?stage=cooking&step=2', 'cook'], CookDone: ['/cook/fx-salmon?stage=done&min=24', 'cook'], Imported: ['/imported-recipe/fx-salmon', 'recipes'], WantToCook: ['/want-to-cook', 'wanttocook'],
  Upload: ['/(tabs)/upload'], Shelf: ['/cookbook-library', 'shelf'], Cookbook: ['/cookbook/fx-book', 'recipes'],
  UserProfile: ['/user/ama'], MealPlan: ['/(tabs)/mealplan', 'mealplan'], PlanShopping: ['/mealplan/shopping', 'mealplan'],
  Waste: ['/mealplan/waste', 'mealplan'], FoodScanner: ['/(tabs)/scan'], WeightLoss: ['/settings/weight-loss'],
  Profile: ['/(tabs)/profile', 'user'], Subscription: ['/subscription'], EditProfile: ['/settings/edit-profile'],
  Dietary: ['/settings/dietary'], Appearance: ['/settings/appearance'], Notifications: ['/settings/notifications'],
  VoiceSettings: ['/settings/voice'], Language: ['/settings/language'], Help: ['/settings/help'], Legal: ['/settings/terms'],
  Advertise: ['/settings/advertise'], AddOfficial: ['/admin/add-recipe', 'admin'], ManageAds: ['/admin/manage-ads'],
  Analytics: ['/settings/analytics'], Seed: ['/admin/seed'], Recipe: ['/recipe/fx-salmon', 'recipes'],
  ShelfCookbook: ['/shelf-cookbook/fx-book', 'shelf'], ShelfRecipe: ['/shelf-recipe/fx-salmon', 'shelf'],
};
const notes = {
  AddPantry: 'bottom sheet inside Pantry (no route)', Voice: 'full-screen overlay opened from Cook (no route)',
  Scanner: 'camera barcode overlay (no route; needs camera)', PlanGenerator: 'sheet inside MealPlan (no route)',
  Paywall: 'native RevenueCat paywall UI (not renderable on web)',
  Onboarding2: 'step 2 of /onboarding (state inside Main route)', Onboarding3: 'step 3 of /onboarding (state inside Main route)',
  ScanResult: 'state inside FoodScanner (needs camera result)',
};
const files = fs.readdirSync('../../docs/redesign/screens').filter((f) => f.endsWith('.html')).map((f) => f.slice(0, -5)).sort();
const out = {};
for (const n of files) {
  const html = fs.readFileSync(`../../docs/redesign/screens/${n}.html`, 'utf8');
  const dk = /<div class="s[^"]*\bdk\b/.test(html);
  const m = map[n] && [map[n][0].replace('/(tabs)', '') || '/', map[n][1]];
  out[n] = m ? { route: m[0], theme: dk ? 'dark' : 'light', ...(m[1] ? { fixture: m[1] } : {}) }
             : { route: null, theme: dk ? 'dark' : 'light', note: notes[n] || 'no RN route' };
}
fs.writeFileSync('screens.json', JSON.stringify(out, null, 1));
console.log(Object.keys(out).length, 'screens');
