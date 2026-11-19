// Recipes in server mode: the cook screen, recipe page, lists, likes, saves, ratings and comments all read the enplace server
// through the recipe store. (They used to read the old Firebase database, which has none of the server's recipes: "Recipe not found".)
jest.mock('expo-secure-store', () => ({ getItemAsync: async () => null, setItemAsync: async () => undefined, deleteItemAsync: async () => undefined }));
jest.mock('@/lib/firebase', () => ({
  Timestamp: { fromDate: (d: Date) => ({ toDate: () => d, toMillis: () => d.getTime() }), now: () => ({ toMillis: () => 0 }) },
  db: {},
  collection: () => {
    throw new Error('Firestore must not be touched in server mode');
  },
  doc: () => {
    throw new Error('Firestore must not be touched in server mode');
  },
  getDoc: () => {
    throw new Error('Firestore must not be touched in server mode');
  },
  getDocs: () => {
    throw new Error('Firestore must not be touched in server mode');
  },
  setDoc: jest.fn(),
  updateDoc: jest.fn(),
  deleteDoc: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  orderBy: jest.fn(),
  limit: jest.fn(),
  startAfter: jest.fn(),
  increment: jest.fn(),
  arrayUnion: jest.fn(),
  arrayRemove: jest.fn(),
}));

jest.mock('firebase/firestore', () => ({ Timestamp: { now: () => ({}) } }));
const tokens = { accessToken: 'a1', accessTokenExpiresAt: new Date(Date.now() + 900_000).toISOString(), refreshToken: 'r1' };
const reply = (status: number, body?: unknown) => ({ ok: status < 300, status, json: async () => body ?? null });
const author = { id: 'house1', handle: 'souschef_quick', displayName: 'enplace Quick Meals', photoUrl: null, isChef: true, isVerifiedChef: true, isOfficial: true };
const full = (id: string) => ({
  id,
  title: 'Garlic Butter Pasta',
  description: 'Fast and rich',
  imageUrl: 'https://img.test/p.jpg',
  youtubeUrl: null,
  status: 'published',
  isOfficial: true,
  isExclusive: false,
  author,
  category: 'dinner',
  cuisine: 'italian',
  difficulty: 'easy',
  prepTime: 5,
  cookTime: 15,
  servings: 2,
  ingredients: [{ name: 'spaghetti', amount: 200, unit: 'g' }],
  instructions: ['Boil', 'Toss'],
  nutrition: { caloriesPerServing: 500, totalCalories: 1000, protein: 15, carbs: 70, fat: 18, fiber: 4 },
  caloriesPerServing: 500,
  tags: [],
  dietaryFlags: [],
  allergens: [],
  likeCount: 2,
  saveCount: 1,
  commentCount: 0,
  ratingCount: 0,
  rating: null,
  createdAt: '2026-11-01T00:00:00.000Z',
});

type Route = (method: string, path: string, body: Record<string, unknown> | undefined) => unknown;
let routes: Route[] = [];
let calls: string[] = [];
let store: typeof import('@/stores/recipeStore');
let apiMod: typeof import('@/lib/api');

beforeEach(async () => {
  routes = [];
  calls = [];
  global.fetch = jest.fn(async (input: string | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    const method = init?.method ?? 'GET';
    const body = init?.body && typeof init.body === 'string' ? (JSON.parse(init.body) as Record<string, unknown>) : undefined;
    calls.push(`${method} ${url.pathname}`);
    for (const r of routes) {
      const out = r(method, url.pathname, body);
      if (out) return out;
    }
    return reply(404, { error: { code: 'not_found', message: 'Recipe not found' } });
  }) as unknown as typeof fetch;
  process.env.EXPO_PUBLIC_API_URL = 'https://api.test';
  jest.isolateModules(() => {
    apiMod = require('@/lib/api');
    store = require('@/stores/recipeStore');
  });
  await apiMod.api().setTokens(tokens);
});
afterAll(() => {
  delete process.env.EXPO_PUBLIC_API_URL;
});

describe('recipes from the server', () => {
  it('opens a recipe by its server id (the cook screen no longer says "Recipe not found")', async () => {
    routes = [(m, p) => (m === 'GET' && p === '/v1/recipes/r1' ? reply(200, full('r1')) : undefined)];
    const recipe = await store.useRecipeStore.getState().fetchRecipeById('r1');
    expect(recipe?.title).toBe('Garlic Butter Pasta');
    expect(recipe?.instructions).toEqual(['Boil', 'Toss']);
    expect(recipe?.authorName).toBe('enplace Quick Meals');
    expect(store.useRecipeStore.getState().currentRecipe?.id).toBe('r1');
  });

  it('gives null for a recipe that is not there instead of throwing', async () => {
    expect(await store.useRecipeStore.getState().fetchRecipeById('nope')).toBeNull();
    expect(store.useRecipeStore.getState().error).toBeNull();
  });

  it('lists recipes from the server, with the filters', async () => {
    let query = '';
    global.fetch = jest.fn(async (input: string | URL) => {
      query = new URL(String(input)).search;
      return reply(200, { items: [full('r1'), full('r2')], nextCursor: null });
    }) as unknown as typeof fetch;
    store.useRecipeStore.getState().setFilters({ category: 'dinner', difficulty: 'easy' });
    await store.useRecipeStore.getState().fetchRecipes(true);
    expect(store.useRecipeStore.getState().recipes.map((r) => r.id)).toEqual(['r1', 'r2']);
    expect(store.useRecipeStore.getState().hasMore).toBe(false);
    expect(query).toContain('category=dinner');
    expect(query).toContain('difficulty=easy');
  });

  it('likes, saves, rates and comments through the server', async () => {
    routes = [
      (m, p) => (p === '/v1/recipes/r1/like' ? reply(200, { active: m === 'PUT', count: 3 }) : undefined),
      (m, p) => (p === '/v1/recipes/r1/save' ? reply(200, { active: m === 'PUT', count: 2 }) : undefined),
      (m, p, b) => (m === 'PUT' && p === '/v1/recipes/r1/rating' ? reply(200, { rating: b?.['rating'], ratingCount: 1 }) : undefined),
      (m, p, b) => (m === 'POST' && p === '/v1/recipes/r1/comments' ? reply(201, { id: 'c1', recipeId: 'r1', author, text: b?.['text'], createdAt: '2026-11-02T00:00:00.000Z' }) : undefined),
      (m, p) => (m === 'GET' && p === '/v1/recipes/r1/comments' ? reply(200, { items: [{ id: 'c1', recipeId: 'r1', author, text: 'Lovely', createdAt: '2026-11-02T00:00:00.000Z' }], nextCursor: null }) : undefined),
      (m, p) => (m === 'POST' && p === '/v1/recipes/r1/flag' ? reply(204) : undefined),
    ];
    const s = store.useRecipeStore.getState();
    await s.likeRecipe('r1', 'me');
    await s.unlikeRecipe('r1', 'me');
    await s.saveRecipe('r1', 'me');
    await s.unsaveRecipe('r1', 'me');
    await s.rateRecipe('r1', 'me', 5, 'great');
    await s.addComment('r1', { recipeId: 'r1', authorId: 'me', authorName: 'Me', text: 'Lovely' });
    const comments = await s.fetchComments('r1');
    await s.flagRecipe('r1', 'spam');
    expect(comments[0]).toMatchObject({ id: 'c1', text: 'Lovely', authorName: 'enplace Quick Meals' });
    expect(calls).toEqual([
      'PUT /v1/recipes/r1/like',
      'DELETE /v1/recipes/r1/like',
      'PUT /v1/recipes/r1/save',
      'DELETE /v1/recipes/r1/save',
      'PUT /v1/recipes/r1/rating',
      'POST /v1/recipes/r1/comments',
      'GET /v1/recipes/r1/comments',
      'POST /v1/recipes/r1/flag',
    ]);
  });
});
