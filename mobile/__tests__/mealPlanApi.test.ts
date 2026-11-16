// Meal plans and the waste log, through the service functions, against a pretend server.
const mockFirebaseTouched = jest.fn();
jest.mock('firebase/firestore', () => ({ Timestamp: { now: () => ({}), fromDate: (d: Date) => ({ toDate: () => d }) } }));
jest.mock('@/lib/firebase', () => {
  const touch = () => mockFirebaseTouched();
  return {
    db: {}, collection: touch, doc: touch, getDoc: touch, getDocs: touch, setDoc: touch, deleteDoc: touch, query: touch, where: touch, orderBy: touch, generateId: touch,
    Timestamp: { now: () => ({}), fromDate: (d: Date) => ({ toDate: () => d }) },
  };
});
jest.mock('expo-secure-store', () => ({ getItemAsync: async () => null, setItemAsync: async () => undefined, deleteItemAsync: async () => undefined }));

import { api, resetApiForTests } from '@/lib/api';
import * as plans from '@/services/mealPlanService';
import { toAppPlan } from '@/services/mealPlanApi';
import type { MealPlan } from '@shared/index';

const apiPlan = (over: Partial<MealPlan> = {}): MealPlan => ({
  weekStart: '2026-11-09',
  days: [{ date: '2026-11-09', dinner: { recipeId: 'r1', recipeName: 'Jollof', servings: 4, imageUrl: 'https://m.test/j.jpg' } }, { date: '2026-11-10' }],
  shoppingList: [{ id: 's1', name: 'rice', amount: 2, unit: 'cup', category: 'grains', recipes: ['r1'], recipeNames: ['Jollof'], inPantry: false, pantryAmount: 0, toBuy: 2, checked: false }],
  stats: { pantryItemsUsed: 1, expiringItemsUsed: 0, ingredientOverlap: 10, estimatedSavings: 5, totalMeals: 1, uniqueRecipes: 1 },
  isGenerated: false,
  createdAt: '2026-11-08T10:00:00.000Z',
  updatedAt: '2026-11-08T11:00:00.000Z',
  ...over,
});
const reply = (status: number, body?: unknown) => ({ ok: status < 300, status, json: async () => body ?? null }) as Response;
const tokens = { accessToken: 'a1', accessTokenExpiresAt: new Date(Date.now() + 900_000).toISOString(), refreshToken: 'r1' };
let server: jest.Mock;
const sent = (i: number) => {
  const [url, init] = server.mock.calls[i] as [string, RequestInit];
  return { method: init.method, path: new URL(String(url)).pathname, search: new URL(String(url)).search, body: init.body ? JSON.parse(String(init.body)) : undefined };
};

beforeEach(async () => {
  mockFirebaseTouched.mockClear();
  process.env.EXPO_PUBLIC_API_URL = 'https://api.test';
  resetApiForTests();
  server = jest.fn();
  global.fetch = server as unknown as typeof fetch;
  await api().setTokens(tokens);
});
afterAll(() => {
  delete process.env.EXPO_PUBLIC_API_URL;
});

describe('plans', () => {
  it('maps a plan: the week is the id, and meal photos use the app\'s field name', () => {
    const p = toAppPlan(apiPlan());
    expect(p).toMatchObject({ id: '2026-11-09', weekStartDate: '2026-11-09', isGenerated: false });
    expect(p.days[0]?.dinner).toEqual({ recipeId: 'r1', recipeName: 'Jollof', servings: 4, imageURL: 'https://m.test/j.jpg' });
    expect(p.days[1]).toEqual({ date: '2026-11-10' });
    expect(p.createdAt.toDate().toISOString()).toBe('2026-11-08T10:00:00.000Z');
  });

  it('finds this week\'s plan, or null', async () => {
    server.mockResolvedValueOnce(reply(200, { plan: apiPlan() }));
    expect((await plans.getCurrentMealPlan('u1'))?.id).toBe('2026-11-09');
    server.mockResolvedValueOnce(reply(200, { plan: null }));
    expect(await plans.getCurrentMealPlan('u1')).toBeNull();
  });

  it('finds a plan by week, null when there is none or the server fails', async () => {
    server.mockResolvedValueOnce(reply(200, apiPlan()));
    expect((await plans.getMealPlanByWeek('u1', '2026-11-09'))?.weekStartDate).toBe('2026-11-09');
    expect(sent(0).path).toBe('/v1/me/meal-plans/2026-11-09');
    server.mockResolvedValueOnce(reply(404, { error: { code: 'not_found', message: 'x' } }));
    expect(await plans.getMealPlanByWeek('u1', '2026-11-16')).toBeNull();
    server.mockResolvedValueOnce(reply(500, { error: { code: 'internal', message: 'x' } }));
    expect(await plans.getMealPlanByWeek('u1', '2026-11-16')).toBeNull();
  });

  it('lists plans', async () => {
    server.mockResolvedValueOnce(reply(200, { items: [apiPlan(), apiPlan({ weekStart: '2026-11-02' })], nextCursor: null }));
    expect((await plans.getMealPlans('u1')).map((p) => p.id)).toEqual(['2026-11-09', '2026-11-02']);
  });

  it('saves a plan for its week, sending the app\'s names in the server\'s', async () => {
    server.mockResolvedValueOnce(reply(200, apiPlan()));
    const local = toAppPlan(apiPlan());
    const saved = await plans.saveMealPlan('u1', { weekStartDate: local.weekStartDate, days: local.days, shoppingList: local.shoppingList, stats: local.stats, isGenerated: true });
    expect(saved.id).toBe('2026-11-09');
    const call = sent(0);
    expect(call).toMatchObject({ method: 'PUT', path: '/v1/me/meal-plans/2026-11-09' });
    expect(call.body.days[0].dinner).toEqual({ recipeId: 'r1', recipeName: 'Jollof', servings: 4, imageUrl: 'https://m.test/j.jpg' });
    expect(call.body.isGenerated).toBe(true);
    expect(call.body.stats).toEqual({ pantryItemsUsed: 1, expiringItemsUsed: 0, ingredientOverlap: 10, estimatedSavings: 5 }); // totals are the server's job
    expect(mockFirebaseTouched).not.toHaveBeenCalled();
  });

  it('sets, clears and checks things inside a plan', async () => {
    server.mockResolvedValue(reply(200, apiPlan()));
    await plans.updateMeal('u1', '2026-11-09', '2026-11-10', 'lunch', { recipeId: 'r2', recipeName: 'Soup', servings: 2, imageURL: 'https://m.test/s.jpg' });
    await plans.updateMeal('u1', '2026-11-09', '2026-11-10', 'lunch', null);
    await plans.updateShoppingListItem('u1', '2026-11-09', 's1', true);
    await plans.deleteMealPlan('u1', '2026-11-09');
    expect(sent(0)).toMatchObject({ method: 'PUT', path: '/v1/me/meal-plans/2026-11-09/days/2026-11-10/lunch', body: { recipeId: 'r2', imageUrl: 'https://m.test/s.jpg' } });
    expect(sent(1)).toMatchObject({ method: 'DELETE', path: '/v1/me/meal-plans/2026-11-09/days/2026-11-10/lunch' });
    expect(sent(2)).toMatchObject({ method: 'PUT', path: '/v1/me/meal-plans/2026-11-09/shopping/s1/checked', body: { checked: true } });
    expect(sent(3)).toMatchObject({ method: 'DELETE', path: '/v1/me/meal-plans/2026-11-09' });
  });
});

describe('waste', () => {
  const entry = { id: 'w1', itemName: 'Milk', amount: 1, unit: 'cup', reason: 'expired' as const, estimatedValue: 2.5, notes: 'forgot', wastedAt: '2026-11-10T08:00:00.000Z' };

  it('logs, lists and deletes entries', async () => {
    server.mockResolvedValueOnce(reply(201, entry));
    const logged = await plans.logWasteEntry('u1', { itemName: 'Milk', amount: 1, unit: 'cup', reason: 'expired', estimatedValue: 2.5, notes: 'forgot' });
    expect(logged).toMatchObject({ id: 'w1', notes: 'forgot' });
    expect(logged.date.toDate().toISOString()).toBe('2026-11-10T08:00:00.000Z');
    expect(sent(0).body).toEqual({ itemName: 'Milk', amount: 1, unit: 'cup', reason: 'expired', estimatedValue: 2.5, notes: 'forgot' });

    server.mockResolvedValueOnce(reply(200, { items: [entry], nextCursor: null }));
    expect(await plans.getWasteLog('u1', 20)).toHaveLength(1);
    expect(sent(1).search).toBe('?limit=20');

    server.mockResolvedValueOnce(reply(204));
    await plans.deleteWasteEntry('u1', 'w1');
    expect(sent(2)).toMatchObject({ method: 'DELETE', path: '/v1/me/waste/w1' });
  });

  it('reads the totals the server keeps, and copes with a failure', async () => {
    const stats = { totalWasted: 12, wastedThisWeek: 2, wastedThisMonth: 5, itemsWastedThisMonth: 3, topWastedItems: [{ name: 'Milk', count: 2 }], wasteByReason: { expired: 2, spoiled: 1, leftover: 0, overcooked: 0, other: 0 }, trendDirection: 'improving', savedByPlanning: 7 };
    server.mockResolvedValueOnce(reply(200, stats));
    expect(await plans.getWasteStats('u1')).toEqual(stats);
    server.mockRejectedValueOnce(new TypeError('offline'));
    expect(await plans.getWasteStats('u1')).toBeNull();
    server.mockRejectedValueOnce(new TypeError('offline'));
    expect(await plans.getWasteLog('u1')).toEqual([]);
  });
});
