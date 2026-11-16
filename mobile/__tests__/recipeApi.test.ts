// Recipes and uploads against a pretend server, through the same service functions the screens call.
const mockFirebaseTouched = jest.fn();
jest.mock('firebase/firestore', () => ({ Timestamp: { now: () => ({}), fromDate: (d: Date) => ({ toDate: () => d, iso: d.toISOString() }) } }));
jest.mock('@/lib/firebase', () => {
  const touch = () => mockFirebaseTouched();
  return {
    db: {},
    collection: touch,
    doc: touch,
    getDoc: touch,
    getDocs: touch,
    setDoc: touch,
    updateDoc: touch,
    deleteDoc: touch,
    query: touch,
    where: touch,
    orderBy: touch,
    limit: touch,
    generateId: touch,
    deleteImage: touch,
    Timestamp: { now: () => ({}), fromDate: (d: Date) => ({ toDate: () => d, iso: d.toISOString() }) },
  };
});
jest.mock('@/lib/cloudinary', () => ({ uploadImage: () => mockFirebaseTouched(), deleteImageByUrl: () => mockFirebaseTouched(), isCloudinaryUrl: () => true }));
jest.mock('expo-secure-store', () => {
  const m = new Map<string, string>();
  return {
    getItemAsync: async (k: string) => m.get(k) ?? null,
    setItemAsync: async (k: string, v: string) => void m.set(k, v),
    deleteItemAsync: async (k: string) => void m.delete(k),
  };
});

import { api, resetApiForTests, createApiClient } from '@/lib/api';
import * as recipes from '@/services/recipeService';
import { apiMadePosts, toAppRecipe, toCreateRequest } from '@/services/recipeApi';
import type { Recipe as ApiRecipe, RecipeSummary } from '@shared/index';
import type { RecipeFormData } from '@/types';

const author = { id: 'u1', handle: 'ama', displayName: 'Ama Okafor', photoUrl: 'https://m.test/ama.jpg', isChef: true, isVerifiedChef: false, kind: 'person' as const };
const summary = (over: Partial<RecipeSummary> = {}): RecipeSummary => ({
  id: 'r1',
  title: 'Jollof',
  description: 'Smoky',
  imageUrl: 'https://m.test/jollof.jpg',
  author,
  isOfficial: false,
  isExclusive: false,
  category: 'dinner',
  cuisine: 'nigerian',
  difficulty: 'medium',
  prepTime: 20,
  cookTime: 40,
  servings: 4,
  caloriesPerServing: 520,
  tags: ['party'],
  dietaryFlags: [],
  allergens: [],
  likeCount: 7,
  saveCount: 3,
  commentCount: 2,
  rating: 4.5,
  ratingCount: 6,
  createdAt: '2026-11-01T10:00:00.000Z',
  ...over,
});
const full = (over: Partial<ApiRecipe> = {}): ApiRecipe => ({
  ...summary(),
  status: 'published',
  youtubeUrl: 'https://youtu.be/abc',
  ingredients: [{ name: 'rice', amount: 2, unit: 'cup', calories: 400, optional: false }],
  instructions: ['Cook'],
  nutrition: { caloriesPerServing: 520, totalCalories: 2080, protein: 12, carbs: 80, fat: 10, fiber: 3 },
  updatedAt: '2026-11-02T10:00:00.000Z',
  viewer: null,
  ...over,
});
const form: RecipeFormData = {
  title: 'Jollof',
  description: 'Smoky',
  youtubeURL: '',
  category: 'dinner',
  cuisine: 'nigerian',
  difficulty: 'medium',
  prepTime: 20,
  cookTime: 40,
  servings: 4,
  ingredients: [{ name: 'rice', amount: 2, unit: 'cup', optional: false }],
  instructions: ['Cook'],
  tags: ['party'],
};

const tokens = { accessToken: 'a1', accessTokenExpiresAt: new Date(Date.now() + 900_000).toISOString(), refreshToken: 'r1' };
const reply = (status: number, body?: unknown) => ({ ok: status < 300, status, json: async () => body ?? null, blob: async () => new Blob(['pixels'], { type: 'image/png' }) }) as unknown as Response;
let server: jest.Mock;
const seen = () => server.mock.calls.map(([url, init]) => `${(init as RequestInit | undefined)?.method ?? 'GET'} ${new URL(String(url)).pathname}${new URL(String(url)).search}`);

beforeEach(async () => {
  mockFirebaseTouched.mockClear();
  process.env.EXPO_PUBLIC_API_URL = 'https://api.test';
  resetApiForTests();
  server = jest.fn();
  global.fetch = server as unknown as typeof fetch;
  await api().setTokens(tokens); // signed in
});
afterAll(() => {
  delete process.env.EXPO_PUBLIC_API_URL;
});

describe('the server\'s recipe as the app\'s recipe', () => {
  it('maps a full recipe', () => {
    const r = toAppRecipe(full());
    expect(r).toMatchObject({
      id: 'r1',
      imageURL: 'https://m.test/jollof.jpg',
      youtubeURL: 'https://youtu.be/abc',
      authorId: 'u1',
      authorName: 'Ama Okafor',
      authorPhotoURL: 'https://m.test/ama.jpg',
      likes: 7,
      saveCount: 3,
      rating: 4.5,
      ratingCount: 6,
      commentCount: 2,
      status: 'published',
    });
    expect(r.ingredients).toHaveLength(1);
    expect(r.nutrition.protein).toBe(12);
    expect(r.createdAt.toDate().toISOString()).toBe('2026-11-01T10:00:00.000Z');
  });

  it('maps a list entry safely: no steps yet, calories kept, no rating when unrated', () => {
    const r = toAppRecipe(summary({ rating: null, ratingCount: 0 }));
    expect(r.ingredients).toEqual([]);
    expect(r.instructions).toEqual([]);
    expect(r.nutrition).toMatchObject({ caloriesPerServing: 520, totalCalories: 2080 });
    expect(r).not.toHaveProperty('rating');
    expect(r).not.toHaveProperty('youtubeURL');
  });

  it('turns the form into a create request without sending calories', () => {
    const req = toCreateRequest({ ...form, youtubeURL: 'https://youtu.be/x' }, 'https://m.test/p.jpg', true);
    expect(req).toMatchObject({ imageUrl: 'https://m.test/p.jpg', youtubeUrl: 'https://youtu.be/x', isOfficial: true });
    expect(req.ingredients[0]).toEqual({ name: 'rice', amount: 2, unit: 'cup', optional: false });
    expect(toCreateRequest(form, 'x', false)).not.toHaveProperty('isOfficial');
    expect(toCreateRequest(form, 'x', false)).not.toHaveProperty('youtubeUrl');
  });
});

describe('through the service functions', () => {
  it('creates a recipe: uploads the photo, then sends the recipe', async () => {
    server
      .mockResolvedValueOnce(reply(200, null)) // reading the local photo
      .mockResolvedValueOnce(reply(201, { id: 'up1', uploadUrl: 'https://files.test/up?sig=1', headers: { 'Content-Type': 'image/png' }, publicUrl: 'https://m.test/up1.png', expiresAt: 'x' }))
      .mockResolvedValueOnce(reply(200)) // the bytes go to the file store
      .mockResolvedValueOnce(reply(200, { id: 'up1', url: 'https://m.test/up1.png', status: 'ready' }))
      .mockResolvedValueOnce(reply(201, full({ id: 'new1', imageUrl: 'https://m.test/up1.png' })));
    const id = await recipes.createRecipe(form, 'file:///photo.png', 'u1', 'Ama', false);
    expect(id).toBe('new1');
    expect(seen()).toEqual(['GET /photo.png', 'POST /v1/uploads', 'PUT /up?sig=1', 'POST /v1/uploads/up1/complete', 'POST /v1/recipes']);
    expect(JSON.parse(String((server.mock.calls[1][1] as RequestInit).body))).toEqual({ purpose: 'recipe_image', contentType: 'image/png', size: 6 });
    // the bytes go to the file store with its headers and no sign-in token
    expect((server.mock.calls[2][1] as RequestInit).headers).toEqual({ 'Content-Type': 'image/png' });
    expect(JSON.parse(String((server.mock.calls[4][1] as RequestInit).body)).imageUrl).toBe('https://m.test/up1.png');
    expect(mockFirebaseTouched).not.toHaveBeenCalled();
  });

  it('fails clearly when the file store refuses the bytes', async () => {
    server
      .mockResolvedValueOnce(reply(200))
      .mockResolvedValueOnce(reply(201, { id: 'up1', uploadUrl: 'https://files.test/up', headers: {}, publicUrl: 'x', expiresAt: 'x' }))
      .mockResolvedValueOnce(reply(403));
    await expect(recipes.createRecipe(form, 'file:///photo.png', 'u1', 'Ama')).rejects.toThrow(/upload did not go through/);
  });

  it('opens one recipe, and answers null when it is gone', async () => {
    server.mockResolvedValueOnce(reply(200, full()));
    expect((await recipes.getRecipeById('r1'))?.title).toBe('Jollof');
    server.mockResolvedValueOnce(reply(404, { error: { code: 'not_found', message: 'Not found' } }));
    expect(await recipes.getRecipeById('nope')).toBeNull();
    server.mockResolvedValueOnce(reply(500, { error: { code: 'internal', message: 'x' } }));
    await expect(recipes.getRecipeById('r1')).rejects.toMatchObject({ status: 500 });
  });

  it('lists with filters, following the pages', async () => {
    server
      .mockResolvedValueOnce(reply(200, { items: [summary({ id: 'a' }), summary({ id: 'b' })], nextCursor: 'c1' }))
      .mockResolvedValueOnce(reply(200, { items: [summary({ id: 'c' })], nextCursor: null }));
    const list = await recipes.getRecipes({ category: 'dinner', maxPrepTime: 30, dietaryFlags: ['vegan', 'low-gi'], searchQuery: 'rice' });
    expect(list.map((r) => r.id)).toEqual(['a', 'b', 'c']);
    const [first, second] = seen();
    expect(first).toContain('category=dinner');
    expect(first).toContain('maxPrepTime=30');
    expect(first).toContain('dietaryFlags=vegan%2Clow-gi');
    expect(first).toContain('q=rice');
    expect(first).toContain('limit=50');
    expect(first).not.toContain('cursor');
    expect(second).toContain('cursor=c1');
  });

  it('stops after a few pages instead of downloading everything', async () => {
    server.mockImplementation(async () => reply(200, { items: [summary()], nextCursor: 'more' }));
    expect(await recipes.getRecipes()).toHaveLength(4);
  });

  it('lists official, popular and a person\'s recipes through the same endpoint', async () => {
    server.mockResolvedValue(reply(200, { items: [summary()], nextCursor: null }));
    await recipes.getOfficialRecipes();
    await recipes.getPopularRecipes(500);
    await recipes.getRecipesByUser('u9');
    expect(seen()[0]).toContain('isOfficial=true');
    expect(seen()[1]).toContain('sort=popular');
    expect(seen()[1]).toContain('limit=50'); // never more than the server allows
    expect(seen()[2]).toContain('authorId=u9');
  });

  it('searches, and ranks by what is in the pantry using the server\'s percentage', async () => {
    server.mockResolvedValueOnce(reply(200, { items: [summary()], nextCursor: null }));
    expect(await recipes.searchRecipes('jollof')).toHaveLength(1);
    expect(seen()[0]).toContain('q=jollof');

    server.mockResolvedValueOnce(reply(200, { items: [{ recipe: summary(), matchPercent: 80, missing: ['salt'] }] }));
    const ranked = await recipes.getRecipesByIngredients(['rice', 'tomato']);
    expect(ranked).toEqual([{ recipe: expect.objectContaining({ id: 'r1' }), matchScore: 80 }]);
    expect(JSON.parse(String((server.mock.calls[1][1] as RequestInit).body))).toMatchObject({ ingredients: ['rice', 'tomato'] });

    server.mockClear();
    expect(await recipes.getRecipesByIngredients([])).toEqual([]);
    expect(server).not.toHaveBeenCalled();
  });

  it('updates only what changed, keeps a photo that is already online, and can clear the video', async () => {
    server.mockResolvedValue(reply(200, full()));
    await recipes.updateRecipe('r1', { title: 'New', youtubeURL: '' }, 'https://m.test/same.jpg');
    const call = server.mock.calls[0];
    expect(new URL(String(call[0])).pathname).toBe('/v1/recipes/r1');
    expect((call[1] as RequestInit).method).toBe('PATCH');
    expect(JSON.parse(String((call[1] as RequestInit).body))).toEqual({ title: 'New', youtubeUrl: null, imageUrl: 'https://m.test/same.jpg' });
    expect(server).toHaveBeenCalledTimes(1); // no upload
  });

  it('deletes', async () => {
    server.mockResolvedValueOnce(reply(204));
    await recipes.deleteRecipe('r1');
    expect(seen()).toEqual(['DELETE /v1/recipes/r1']);
  });

  it('works on a client built by hand too (the pieces are not tied to the shared one)', async () => {
    const f = jest.fn(async () => reply(200, { ok: true }));
    const c = createApiClient({ baseUrl: 'https://x.test', fetch: f as unknown as typeof fetch, storage: { load: async () => null, save: async () => undefined } });
    expect(await c.get('/readyz')).toEqual({ ok: true });
  });
});

describe('"I made this" photos', () => {
  const made = { id: 'mp1', recipeId: 'r1', author, imageUrl: 'https://m.test/made.jpg', caption: 'Nailed it', createdAt: '2026-11-02T10:00:00.000Z' };

  it('lists them in the shape the gallery reads', async () => {
    
    server.mockResolvedValueOnce(reply(200, { items: [made], nextCursor: null }));
    const posts = await apiMadePosts('r1');
    expect(posts[0]).toMatchObject({ id: 'mp1', authorId: 'u1', authorName: 'Ama Okafor', authorPhotoURL: 'https://m.test/ama.jpg', imageURL: 'https://m.test/made.jpg', caption: 'Nailed it' });
    expect(seen()[0]).toContain('/v1/recipes/r1/made?limit=20');
  });
});
