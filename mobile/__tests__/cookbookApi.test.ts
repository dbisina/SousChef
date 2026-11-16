// The curated cookbooks store against a pretend server.
const mockFirebaseTouched = jest.fn();
jest.mock('firebase/firestore', () => ({ Timestamp: { now: () => ({}), fromDate: (d: Date) => ({ toDate: () => d }) } }));
jest.mock('@/lib/firebase', () => {
  const touch = () => mockFirebaseTouched();
  return {
    db: {}, collection: touch, doc: touch, getDoc: touch, getDocs: touch, updateDoc: touch, query: touch, orderBy: touch, limit: touch, increment: touch, arrayUnion: touch, arrayRemove: touch,
    COLLECTIONS: { COOKBOOKS: 'cookbooks', RECIPES: 'recipes', USERS: 'users' },
    Timestamp: { now: () => ({}), fromDate: (d: Date) => ({ toDate: () => d }) },
  };
});
jest.mock('expo-secure-store', () => ({ getItemAsync: async () => null, setItemAsync: async () => undefined, deleteItemAsync: async () => undefined }));

import { api, resetApiForTests } from '@/lib/api';
import { useCookbookStore } from '@/stores/cookbookStore';
import { toAppCookbook } from '@/services/cookbookApi';
import type { Cookbook as ApiCookbook, RecipeSummary } from '@shared/index';

const book = (over: Partial<ApiCookbook> = {}): ApiCookbook => ({
  id: 'c1', title: 'Sunday Feasts', description: 'Slow food', coverImageUrl: 'https://m.test/c.jpg', category: 'weekend', recipeCount: 2, likeCount: 5, saveCount: 1,
  createdAt: '2026-11-01T10:00:00.000Z', published: true, updatedAt: '2026-11-02T10:00:00.000Z', viewer: null, ...over,
});
const recipe = (id: string): RecipeSummary => ({
  id, title: id, description: '', imageUrl: 'https://m.test/r.jpg',
  author: { id: 'u1', handle: 'a', displayName: 'A', photoUrl: null, isChef: false, isVerifiedChef: false, kind: 'person' },
  isOfficial: true, isExclusive: false, category: 'dinner', cuisine: 'italian', difficulty: 'easy', prepTime: 5, cookTime: 5, servings: 2, caloriesPerServing: 300,
  tags: [], dietaryFlags: [], allergens: [], likeCount: 0, saveCount: 0, commentCount: 0, rating: null, ratingCount: 0, createdAt: '2026-11-01T10:00:00.000Z',
});
const reply = (status: number, body?: unknown) => ({ ok: status < 300, status, json: async () => body ?? null }) as Response;
const tokens = { accessToken: 'a1', accessTokenExpiresAt: new Date(Date.now() + 900_000).toISOString(), refreshToken: 'r1' };
let server: jest.Mock;
const sent = (i: number) => {
  const [url, init] = server.mock.calls[i] as [string, RequestInit];
  return { method: init.method, path: new URL(String(url)).pathname };
};

beforeEach(async () => {
  mockFirebaseTouched.mockClear();
  process.env.EXPO_PUBLIC_API_URL = 'https://api.test';
  resetApiForTests();
  server = jest.fn();
  global.fetch = server as unknown as typeof fetch;
  await api().setTokens(tokens);
  useCookbookStore.setState({ cookbooks: [], currentCookbook: null, currentCookbookRecipes: [], isLoading: false, error: null });
});
afterAll(() => {
  delete process.env.EXPO_PUBLIC_API_URL;
});

describe('cookbooks', () => {
  it('maps the server\'s cookbook (likes, cover, category)', () => {
    const c = toAppCookbook(book(), ['r1']);
    expect(c).toMatchObject({ id: 'c1', coverImageURL: 'https://m.test/c.jpg', likes: 5, category: 'weekend', recipeIds: ['r1'] });
    expect(c.updatedAt.toDate().toISOString()).toBe('2026-11-02T10:00:00.000Z');
    expect(toAppCookbook({ ...book(), category: null })).not.toHaveProperty('category');
  });

  it('lists cookbooks', async () => {
    server.mockResolvedValueOnce(reply(200, { items: [book(), book({ id: 'c2' })], nextCursor: null }));
    await useCookbookStore.getState().fetchCookbooks();
    expect(useCookbookStore.getState().cookbooks.map((c) => c.id)).toEqual(['c1', 'c2']);
    expect(mockFirebaseTouched).not.toHaveBeenCalled();
  });

  it('opens a cookbook together with its recipes', async () => {
    server.mockImplementation(async (url: string) =>
      new URL(String(url)).pathname.endsWith('/recipes') ? reply(200, { items: [recipe('r1'), recipe('r2')], nextCursor: null }) : reply(200, book()),
    );
    const opened = await useCookbookStore.getState().fetchCookbookById('c1');
    expect(opened?.recipeIds).toEqual(['r1', 'r2']);
    expect(useCookbookStore.getState().currentCookbookRecipes.map((r) => r.id)).toEqual(['r1', 'r2']);
    expect(useCookbookStore.getState().isLoading).toBe(false);
  });

  it('says nothing is there for a missing cookbook', async () => {
    server.mockResolvedValue(reply(404, { error: { code: 'not_found', message: 'Not found' } }));
    expect(await useCookbookStore.getState().fetchCookbookById('nope')).toBeNull();
    expect(useCookbookStore.getState().currentCookbook).toBeNull();
  });

  it('likes and unlikes using the count the server sends back', async () => {
    useCookbookStore.setState({ cookbooks: [toAppCookbook(book())], currentCookbook: toAppCookbook(book()) });
    server.mockResolvedValueOnce(reply(200, { active: true, count: 9 }));
    await useCookbookStore.getState().likeCookbook('c1');
    expect(useCookbookStore.getState().cookbooks[0]?.likes).toBe(9); // not "5 + 1": someone else may have liked too
    expect(useCookbookStore.getState().currentCookbook?.likes).toBe(9);
    expect(sent(0)).toEqual({ method: 'PUT', path: '/v1/cookbooks/c1/like' });

    server.mockResolvedValueOnce(reply(200, { active: false, count: 8 }));
    await useCookbookStore.getState().unlikeCookbook('c1');
    expect(useCookbookStore.getState().cookbooks[0]?.likes).toBe(8);
    expect(sent(1)).toEqual({ method: 'DELETE', path: '/v1/cookbooks/c1/like' });
  });

  it('saves and unsaves on the server', async () => {
    server.mockResolvedValue(reply(200, { active: true, count: 2 }));
    await useCookbookStore.getState().saveCookbook('c1', 'u1');
    await useCookbookStore.getState().unsaveCookbook('c1', 'u1');
    expect([sent(0), sent(1)]).toEqual([{ method: 'PUT', path: '/v1/cookbooks/c1/save' }, { method: 'DELETE', path: '/v1/cookbooks/c1/save' }]);
    expect(mockFirebaseTouched).not.toHaveBeenCalled();
  });
});
