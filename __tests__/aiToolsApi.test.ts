// Substitutions, meal plans and cookbook scans through the server.
jest.mock('expo-secure-store', () => ({ getItemAsync: async () => null, setItemAsync: async () => undefined, deleteItemAsync: async () => undefined }));
const mockFirebaseTouched = jest.fn();
jest.mock('firebase/firestore', () => ({ Timestamp: { now: () => ({}), fromDate: (d: Date) => ({ toDate: () => d }) } }));
jest.mock('@/lib/firebase', () => {
  const touch = () => mockFirebaseTouched();
  return { db: {}, doc: touch, getDoc: touch, getDocs: touch, setDoc: touch, collection: touch, query: touch, where: touch, orderBy: touch, generateId: () => 'gen-id', Timestamp: { now: () => ({}), fromDate: (d: Date) => ({ toDate: () => d }) } };
});
jest.mock('@/lib/gemini', () => ({
  textModel: { generateContent: jest.fn(() => mockFirebaseTouched()) },
  visionModel: {},
  createImagePart: jest.fn(() => mockFirebaseTouched()),
  analyzeIngredientSubstitutions: jest.fn(() => mockFirebaseTouched()),
  analyzePortionFromImage: jest.fn(),
  getCookingTips: jest.fn(),
  generateRecipeFromImage: jest.fn(),
  extractRecipeFromVideo: jest.fn(),
  extractRecipeFromText: jest.fn(),
  extractRecipeFromContentBundle: jest.fn(),
  extractRecipeWithThinking: jest.fn(),
  downloadVideoToTemp: jest.fn(),
  cleanupTempFile: jest.fn(),
}));
jest.mock('@/services/platformExtractorService', () => ({ extractPlatformContent: jest.fn() }));
jest.mock('@/services/youtubeDownloadService', () => ({ downloadYouTubeVideo: jest.fn(), isYouTubeDownloadAvailable: () => false }));
jest.mock('expo-file-system/legacy', () => ({ getInfoAsync: jest.fn() }));
jest.mock('@/stores/languageStore', () => ({ useLanguageStore: { getState: () => ({ language: 'en' }) } }));
jest.mock('@/lib/i18n', () => ({ SUPPORTED_LANGUAGES: [] }));
jest.mock('@/services/pantryService', () => ({ getPantryItemNames: async () => ['1 cup rice'] }));

import { api, resetApiForTests } from '@/lib/api';
import { analyzeRecipeWithIngredients, getIngredientSubstitution } from '@/services/aiService';
import { generateMealPlan } from '@/services/mealPlanAIService';
import { extractRecipeFromMultiplePhotos, extractRecipeFromPhoto } from '@/services/recipeImportService';
import { DEFAULT_MEAL_PLAN_PREFERENCES } from '@/types/mealplan';
import type { Ingredient, Recipe } from '@/types';

const reply = (status: number, body?: unknown) => ({ ok: status < 300, status, json: async () => body ?? null, blob: async () => new Blob(['px'], { type: 'image/jpeg' }) }) as unknown as Response;
const tokens = { accessToken: 'a1', accessTokenExpiresAt: new Date(Date.now() + 900_000).toISOString(), refreshToken: 'r1' };
type Route = (method: string, path: string, body: Record<string, unknown> | undefined) => Response | undefined;
let routes: Route[] = [];
let calls: string[] = [];
const bodies: Record<string, unknown>[] = [];

beforeEach(async () => {
  routes = [];
  calls = [];
  bodies.length = 0;
  mockFirebaseTouched.mockClear();
  process.env.EXPO_PUBLIC_API_URL = 'https://api.test';
  resetApiForTests();
  global.fetch = jest.fn(async (input: string | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    const method = init?.method ?? 'GET';
    const body = init?.body && typeof init.body === 'string' ? (JSON.parse(init.body) as Record<string, unknown>) : undefined;
    calls.push(`${method} ${url.pathname}`);
    if (body) bodies.push(body);
    for (const r of routes) {
      const out = r(method, url.pathname, body);
      if (out) return out;
    }
    return reply(404, { error: { code: 'not_found', message: 'no route' } });
  }) as unknown as typeof fetch;
  await api().setTokens(tokens);
});
afterAll(() => {
  delete process.env.EXPO_PUBLIC_API_URL;
});

const ing = (name: string, optional = false): Ingredient => ({ name, amount: 1, unit: 'cup', calories: 0, optional });
const recipe = { id: 'r1', title: 'Jollof', ingredients: [ing('rice'), ing('tomato'), ing('thyme', true)] } as unknown as Recipe;
const suggestion = (substitute: string) => ({ original: 'x', substitute, ratio: '1:1', notes: 'ok', impact: 'minimal', inPantry: false });

describe('substitutions', () => {
  it('asks the server for one ingredient and maps the answer for the screens', async () => {
    routes = [(m, p) => (m === 'POST' && p === '/v1/ai/substitute' ? reply(200, { suggestions: [suggestion('oat milk')] }) : undefined)];
    const res = await getIngredientSubstitution('milk', ['rice']);
    expect(res.substitutions).toEqual([{ originalIngredient: 'x', substitute: 'oat milk', ratio: '1:1', notes: 'ok', impactOnTaste: 'minimal' }]);
    expect(res.canMake).toBe(true);
    expect(bodies[0]).toEqual({ ingredient: 'milk', pantry: ['rice'] });
    expect(mockFirebaseTouched).not.toHaveBeenCalled(); // no AI key on the phone
  });

  it('works out what is missing itself and asks for a replacement for each missing item', async () => {
    routes = [(m, p, b) => (m === 'POST' && p === '/v1/ai/substitute' ? reply(200, { suggestions: [{ ...suggestion('passata'), original: b?.['ingredient'] }] }) : undefined)];
    const res = await analyzeRecipeWithIngredients(recipe, ['rice']);
    expect(res.availableIngredients).toEqual(['rice']);
    expect(res.missingIngredients).toEqual(['tomato']); // thyme is optional
    expect(res.substitutions.map((s) => s.substitute)).toEqual(['passata']);
    expect(res.canMake).toBe(true); // the missing one has a replacement
    expect(calls).toEqual(['POST /v1/ai/substitute']);
  });

  it('does not fail the whole answer when one replacement cannot be found', async () => {
    const res = await analyzeRecipeWithIngredients(recipe, ['rice']); // 404 from the server
    expect(res.missingIngredients).toEqual(['tomato']);
    expect(res.substitutions).toEqual([]);
    expect(res.canMake).toBe(false);
  });
});

describe('meal plan', () => {
  const prefs = { ...DEFAULT_MEAL_PLAN_PREFERENCES, daysToGenerate: 2, dietaryRestrictions: ['peanuts'], maxPrepTime: 30, calorieTarget: 1800 };
  const generated = {
    days: [{ date: '2026-11-16', dinner: { recipeId: 'r1', recipeName: 'Jollof', servings: 2, imageUrl: 'https://m.test/j.jpg' } }, { date: '2026-11-17' }],
    shoppingList: [{ id: 'rice-cup', name: 'rice', amount: 2, unit: 'cup', category: 'grains', recipes: ['r1'], recipeNames: ['Jollof'], inPantry: false, pantryAmount: 0, toBuy: 2, checked: false }],
    stats: { pantryItemsUsed: 0, expiringItemsUsed: 0, ingredientOverlap: 0, estimatedSavings: 0, totalMeals: 1, uniqueRecipes: 1 },
    notes: ['Rice twice'],
  };

  it('asks the server, with the person\'s choices, and maps the plan for the screens', async () => {
    routes = [(m, p) => (m === 'POST' && p === '/v1/ai/meal-plan' ? reply(200, generated) : undefined)];
    const res = await generateMealPlan(prefs, [], [], [], '2026-11-16');
    expect(bodies[0]).toMatchObject({ startDate: '2026-11-16', days: 2, mealTypes: ['breakfast', 'lunch', 'dinner'], servings: 2, restrictions: ['peanuts'], maxPrepTime: 30, calorieTarget: 1800, prioritizeExpiring: true });
    expect(res.plan[0]?.dinner).toEqual({ recipeId: 'r1', recipeName: 'Jollof', servings: 2, imageURL: 'https://m.test/j.jpg' });
    expect(res.plan[1]).toEqual({ date: '2026-11-17' });
    expect(res.shoppingList[0]).toMatchObject({ id: 'rice-cup', toBuy: 2, checked: false });
    expect(res.notes).toEqual(['Rice twice']);
    expect(mockFirebaseTouched).not.toHaveBeenCalled();
  });

  it('lets the upgrade prompt through, and turns other failures into one friendly message', async () => {
    routes = [(m, p) => (m === 'POST' && p === '/v1/ai/meal-plan' ? reply(403, { error: { code: 'upgrade_required', message: 'This needs a paid plan' } }) : undefined)];
    await expect(generateMealPlan(prefs, [], [], [], '2026-11-16')).rejects.toMatchObject({ code: 'upgrade_required' });
    routes = [(m, p) => (m === 'POST' && p === '/v1/ai/meal-plan' ? reply(503, { error: { code: 'ai_unavailable', message: 'resting' } }) : undefined)];
    await expect(generateMealPlan(prefs, [], [], [], '2026-11-16')).rejects.toThrow('Failed to generate meal plan');
  });
});

describe('cookbook photos', () => {
  const imported = { title: 'Moi Moi', description: '', sourceUrl: 'scan:Mama', ingredients: [{ name: 'beans', amount: 2, unit: 'cup' }], instructions: ['Steam'], servings: 6, tags: [], extractionConfidence: 0.8 };
  const uploadRoutes = (id: string): Route[] => [
    (m, p) => (m === 'GET' && p.endsWith('.jpg') ? reply(200) : undefined),
    (m, p) => (m === 'POST' && p === '/v1/uploads' ? reply(201, { id, uploadUrl: `https://files.test/${id}`, headers: {}, publicUrl: `https://m.test/${id}.jpg`, expiresAt: 'x' }) : undefined),
    (m, p) => (m === 'PUT' && p === `/${id}` ? reply(200) : undefined),
    (m, p) => (m === 'POST' && p === `/v1/uploads/${id}/complete` ? reply(200, { id, url: `https://m.test/${id}.jpg`, status: 'ready' }) : undefined),
  ];

  it('uploads the page photo and has the server read it', async () => {
    routes = [...uploadRoutes('up1'), (m, p) => (m === 'POST' && p === '/v1/imports/scan' ? reply(200, { recipe: imported }) : undefined)];
    const res = await extractRecipeFromPhoto('file:///page.jpg', 'Mama');
    expect(res).toMatchObject({ success: true, confidence: 0.8, recipe: { title: 'Moi Moi', sourceURL: 'scan:Mama' } });
    expect(bodies.at(-1)).toEqual({ uploadIds: ['up1'], bookName: 'Mama' });
    expect(mockFirebaseTouched).not.toHaveBeenCalled();
  });

  it('reads several pages as one recipe, and reports a failure instead of throwing', async () => {
    routes = [...uploadRoutes('up2'), (m, p) => (m === 'POST' && p === '/v1/imports/scan' ? reply(400, { error: { code: 'validation_error', message: 'No recipe could be read from those photos' } }) : undefined)];
    const res = await extractRecipeFromMultiplePhotos(['file:///a.jpg', 'file:///b.jpg']);
    expect(res.success).toBe(false);
    expect(res.error).toBe('No recipe could be read from those photos'); // the server's own words
    expect(bodies.at(-1)).toMatchObject({ uploadIds: ['up2', 'up2'] });
  });
});
