// Want-to-cook, the shopping list and link import against a pretend server.
const mockFirebaseTouched = jest.fn();
jest.mock('firebase/firestore', () => ({ Timestamp: { now: () => ({ toMillis: () => 0 }), fromDate: (d: Date) => ({ toDate: () => d, toMillis: () => d.getTime() }) } }));
jest.mock('@/lib/firebase', () => {
  const touch = () => mockFirebaseTouched();
  return {
    db: {}, collection: touch, doc: touch, getDoc: touch, getDocs: touch, setDoc: touch, updateDoc: touch, deleteDoc: touch, query: touch, where: touch, orderBy: touch, addDoc: touch,
    generateId: () => 'gen-' + Math.random().toString(36).slice(2, 8),
    Timestamp: { now: () => ({ toMillis: () => 0, toDate: () => new Date(0) }), fromDate: (d: Date) => ({ toDate: () => d, toMillis: () => d.getTime() }) },
  };
});
jest.mock('expo-secure-store', () => ({ getItemAsync: async () => null, setItemAsync: async () => undefined, deleteItemAsync: async () => undefined }));
const mockPlatformExtract = jest.fn();
const mockAskFrames = jest.fn();
jest.mock('@/lib/importFrames', () => ({ askForFrames: (...a: unknown[]) => mockAskFrames(...a) }));
jest.mock('@/lib/upload', () => ({ uploadFile: async (uri: string) => ({ id: `up-${uri}`, url: uri }) }));
jest.mock('@/lib/gemini', () => ({ textModel: {}, visionModel: {}, createImagePart: jest.fn(), extractRecipeFromVideo: jest.fn(), extractRecipeFromText: jest.fn(), extractRecipeFromContentBundle: jest.fn(), extractRecipeWithThinking: jest.fn(), downloadVideoToTemp: jest.fn(), cleanupTempFile: jest.fn() }));
jest.mock('@/services/platformExtractorService', () => ({ extractPlatformContent: (...a: unknown[]) => mockPlatformExtract(...a) }));
jest.mock('@/services/youtubeDownloadService', () => ({ downloadYouTubeVideo: jest.fn(), isYouTubeDownloadAvailable: () => false }));
jest.mock('expo-file-system/legacy', () => ({ getInfoAsync: jest.fn() }));

import { api, resetApiForTests } from '@/lib/api';
import { extractRecipeFromURL } from '@/services/recipeImportService';
import { toAppItem, importedToApi } from '@/services/wantToCookApi';
import { useWantToCookStore } from '@/stores/wantToCookStore';
import type { ImportedRecipe as ApiImported, ShoppingItem, WantToCookItem as ApiItem } from '@shared/index';

const imported: ApiImported = {
  title: 'Egusi', description: 'Soup', sourceUrl: 'https://site.test/egusi', sourcePlatform: 'website',
  ingredients: [{ name: 'egusi', amount: 1, unit: 'cup' }, { name: 'salt', amount: 1, unit: 'tsp', optional: true }], instructions: ['Cook'], servings: 4, tags: ['soup'], extractionConfidence: 0.9,
};
const wtc = (over: Partial<ApiItem> = {}): ApiItem => ({
  id: 'w1', status: 'saved', savedAt: '2026-11-01T10:00:00.000Z', plannedFor: null, cookedAt: null, notes: '', recipe: null, imported,
  pantryMatch: { matchPercent: 50, matching: ['egusi'], missing: ['salt'], canMake: false }, ...over,
});
const shop = (over: Partial<ShoppingItem> = {}): ShoppingItem => ({ id: 's1', name: 'rice', amount: 2, unit: 'cup', category: null, checked: false, recipeId: null, recipeTitle: null, createdAt: '2026-11-01T10:00:00.000Z', ...over });
const reply = (status: number, body?: unknown) => ({ ok: status < 300, status, json: async () => body ?? null }) as Response;
const tokens = { accessToken: 'a1', accessTokenExpiresAt: new Date(Date.now() + 900_000).toISOString(), refreshToken: 'r1' };
let server: jest.Mock;
const sent = (i: number) => {
  const [url, init] = server.mock.calls[i] as [string, RequestInit];
  return { method: init.method, path: new URL(String(url)).pathname, search: new URL(String(url)).search, body: init.body ? JSON.parse(String(init.body)) : undefined };
};
const settle = () => new Promise((r) => setTimeout(r, 0));
const store = () => useWantToCookStore.getState();

beforeEach(async () => {
  mockFirebaseTouched.mockClear();
  mockPlatformExtract.mockReset();
  process.env.EXPO_PUBLIC_API_URL = 'https://api.test';
  resetApiForTests();
  server = jest.fn();
  global.fetch = server as unknown as typeof fetch;
  await api().setTokens(tokens);
  useWantToCookStore.setState({ items: [], shoppingList: [], error: null, isLoading: false });
});
afterAll(() => {
  delete process.env.EXPO_PUBLIC_API_URL;
});

describe('mapping', () => {
  it('maps a saved link recipe with the server\'s pantry numbers', () => {
    const item = toAppItem(wtc());
    expect(item).toMatchObject({ id: 'w1', status: 'saved', pantryMatchPercent: 50, matchingIngredients: ['egusi'], missingIngredients: ['salt'] });
    expect(item.importedRecipe?.ingredients[1]).toMatchObject({ name: 'salt', optional: true, calories: 0 });
    expect(item.importedRecipe?.sourceURL).toBe('https://site.test/egusi');
    expect(item).not.toHaveProperty('recipeId');
  });

  it('maps a saved app recipe to its id', () => {
    const item = toAppItem(wtc({ imported: null, recipe: { id: 'r9' } as never }));
    expect(item.recipeId).toBe('r9');
    expect(item).not.toHaveProperty('importedRecipe');
  });

  it('round-trips an imported recipe without losing optional ingredients', () => {
    const back = importedToApi(toAppItem(wtc()).importedRecipe!);
    expect(back.ingredients).toEqual(imported.ingredients);
    expect(back.extractionConfidence).toBe(0.9);
  });
});

describe('the store', () => {
  it('loads the list and the shopping list together', async () => {
    server.mockImplementation(async (url: string) => (new URL(String(url)).pathname.endsWith('shopping-list') ? reply(200, { items: [shop()] }) : reply(200, { items: [wtc()] })));
    await store().fetchWantToCookItems('u1');
    expect(store().items.map((i) => i.id)).toEqual(['w1']);
    expect(store().shoppingList.map((i) => i.id)).toEqual(['s1']);
    expect(mockFirebaseTouched).not.toHaveBeenCalled();
  });

  it('saves an app recipe by id and an imported one in full', async () => {
    server.mockResolvedValueOnce(reply(201, wtc({ id: 'a', imported: null, recipe: { id: 'r1' } as never })));
    await store().addToWantToCook('u1', { id: 'r1' } as never, false);
    expect(sent(0)).toMatchObject({ method: 'POST', path: '/v1/me/want-to-cook', body: { recipeId: 'r1' } });
    server.mockResolvedValueOnce(reply(201, wtc({ id: 'b' })));
    const local = toAppItem(wtc()).importedRecipe!;
    await store().addToWantToCook('u1', local, true);
    expect(sent(1).body.imported.title).toBe('Egusi');
    expect(store().items.map((i) => i.id)).toEqual(['b', 'a']);
  });

  it('changes status and removes, using what the server sends back', async () => {
    useWantToCookStore.setState({ items: [toAppItem(wtc())] });
    server.mockResolvedValueOnce(reply(200, wtc({ status: 'cooked', cookedAt: '2026-11-03T10:00:00.000Z' })));
    await store().markAsCooked('w1');
    expect(sent(0)).toMatchObject({ method: 'PATCH', path: '/v1/me/want-to-cook/w1', body: { status: 'cooked' } });
    expect(store().items[0]).toMatchObject({ status: 'cooked' });
    server.mockResolvedValueOnce(reply(204));
    await store().removeFromWantToCook('w1');
    expect(store().items).toEqual([]);
    expect(sent(1)).toMatchObject({ method: 'DELETE', path: '/v1/me/want-to-cook/w1' });
  });
});

describe('the shopping list', () => {
  it('shows new lines at once and swaps in the server\'s copies', async () => {
    server.mockResolvedValueOnce(reply(201, { items: [shop({ id: 'srv1', name: 'rice', recipeTitle: 'Jollof', recipeId: 'r1' })] }));
    store().addToShoppingList([{ name: 'rice', amount: 2, unit: 'cup', recipeId: 'r1', recipeName: 'Jollof' }]);
    expect(store().shoppingList[0]?.id.startsWith('pending-')).toBe(true);
    await settle();
    expect(store().shoppingList.map((i) => i.id)).toEqual(['srv1']);
    expect(store().shoppingList[0]).toMatchObject({ recipeName: 'Jollof', recipeId: 'r1' });
    expect(sent(0).body).toEqual({ items: [{ name: 'rice', amount: 2, unit: 'cup', recipeId: 'r1', recipeTitle: 'Jollof' }] });
  });

  it('ticks, removes and clears on the server too', async () => {
    useWantToCookStore.setState({ shoppingList: [toAppShop('s1', false), toAppShop('s2', true)] });
    server.mockResolvedValue(reply(204));
    store().toggleShoppingItem('s1');
    expect(store().shoppingList[0]?.checked).toBe(true); // at once, before the server answers
    await settle();
    expect(sent(0)).toMatchObject({ method: 'PATCH', path: '/v1/me/shopping-list/s1', body: { checked: true } });
    store().removeFromShoppingList('s2');
    await settle();
    expect(sent(1)).toMatchObject({ method: 'DELETE', path: '/v1/me/shopping-list/s2' });
    store().clearCheckedItems();
    await settle();
    expect(sent(2)).toMatchObject({ method: 'DELETE', path: '/v1/me/shopping-list', search: '?checkedOnly=true' });
    store().clearShoppingList();
    await settle();
    expect(sent(3).search).toBe('?checkedOnly=false');
    expect(store().shoppingList).toEqual([]);
  });

  it('puts the list back as the server has it when an action fails', async () => {
    useWantToCookStore.setState({ shoppingList: [toAppShop('s1', false)] });
    server.mockRejectedValueOnce(new TypeError('offline')).mockResolvedValueOnce(reply(200, { items: [shop({ id: 's1', checked: false })] }));
    store().toggleShoppingItem('s1');
    await settle();
    await settle();
    expect(store().shoppingList[0]?.checked).toBe(false);
  });
});

function toAppShop(id: string, checked: boolean) {
  return { id, name: id, amount: 1, unit: 'cup', checked, addedAt: { toDate: () => new Date(0) } } as never;
}

describe('link import', () => {
  it('reads a link on the server first', async () => {
    server.mockResolvedValueOnce(reply(201, { id: 'imp1', status: 'done', platform: 'website', recipe: imported, cached: false, message: null }));
    const res = await extractRecipeFromURL('https://site.test/egusi');
    expect(res).toMatchObject({ success: true, confidence: 0.9 });
    expect(res.recipe?.title).toBe('Egusi');
    expect(sent(0)).toMatchObject({ method: 'POST', path: '/v1/imports', body: { url: 'https://site.test/egusi' } });
    expect(mockPlatformExtract).not.toHaveBeenCalled();
  });

  it('falls back to the on-device reader when the server needs video frames, or cannot be reached', async () => {
    mockPlatformExtract.mockRejectedValue(new Error('device reader ran'));
    server.mockResolvedValueOnce(reply(201, { id: 'imp2', status: 'needs_frames', platform: 'tiktok', recipe: null, cached: false, message: 'No recipe in the caption' }));
    const first = await extractRecipeFromURL('https://www.tiktok.com/@a/video/1');
    expect(first.success).toBe(false);
    expect(mockPlatformExtract).toHaveBeenCalledTimes(1);

    server.mockRejectedValueOnce(new TypeError('offline'));
    await extractRecipeFromURL('https://site.test/other');
    expect(mockPlatformExtract).toHaveBeenCalledTimes(2);
  });

  it('asks for screenshots when the caption has no recipe, sends them, and uses what the server reads from them', async () => {
    mockAskFrames.mockResolvedValueOnce(['file:///a.jpg', 'file:///b.jpg']);
    server
      .mockResolvedValueOnce(reply(201, { id: 'imp3', status: 'needs_frames', platform: 'tiktok', recipe: null, cached: false, message: 'Send frames' }))
      .mockResolvedValueOnce(reply(200, { id: 'imp3', status: 'done', platform: 'tiktok', recipe: imported, cached: false, message: null }));
    const res = await extractRecipeFromURL('https://www.tiktok.com/@a/video/2');
    expect(res).toMatchObject({ success: true });
    expect(res.recipe?.title).toBe('Egusi');
    expect(sent(1)).toMatchObject({ method: 'POST', path: '/v1/imports/imp3/frames', body: { uploadIds: ['up-file:///a.jpg', 'up-file:///b.jpg'] } });
    expect(mockPlatformExtract).not.toHaveBeenCalled();
  });

  it('keeps files on the phone and direct media off the server', async () => {
    mockPlatformExtract.mockRejectedValue(new Error('x'));
    await extractRecipeFromURL('https://site.test/photo.jpg').catch(() => undefined);
    await extractRecipeFromURL('file:///photo.jpg').catch(() => undefined);
    expect(server.mock.calls.filter(([u]) => String(u).endsWith('/v1/imports'))).toHaveLength(0);
  });
});
