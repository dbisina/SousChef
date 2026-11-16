import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  isMonday,
  weekDates,
  weekStartOf,
  type MealPlan,
  type Page,
  type PlanShoppingItem,
  type WasteEntry,
  type WasteStats,
} from '@shared';
import { DAY_MS, makeApp, register, type TestApp } from './helpers';
import { call } from './recipeHelpers';

let t: TestApp;
beforeAll(async () => {
  // Long-lived access tokens: some tests move the server's clock by weeks and must stay signed in.
  t = await makeApp({ ACCESS_TOKEN_TTL_SECONDS: String(120 * 86400) });
});
afterAll(() => t.close());
beforeEach(() => t.reset());

const WEEK = '2026-11-16'; // a Monday
const meal = (name = 'Jollof Rice', recipeId = randomUUID()) => ({ recipeId, recipeName: name, servings: 2 });
const shopItem = (id: string, name = 'Rice'): PlanShoppingItem => ({
  id, name, amount: 2, unit: 'kg', category: 'grains', recipes: [], recipeNames: [], inPantry: false, pantryAmount: 0, toBuy: 2, checked: false,
});
const putPlan = (who: Awaited<ReturnType<typeof register>>, body: object, week = WEEK) => call(t, 'PUT', `/v1/me/meal-plans/${week}`, who, body);

describe('weeks', () => {
  it('names a week by its Monday', () => {
    expect(weekStartOf(new Date('2026-11-16T00:00:00Z'))).toBe('2026-11-16'); // Monday
    expect(weekStartOf(new Date('2026-11-18T13:00:00Z'))).toBe('2026-11-16'); // Wednesday
    expect(weekStartOf(new Date('2026-11-22T23:59:59Z'))).toBe('2026-11-16'); // Sunday night
    expect(weekStartOf(new Date('2026-11-23T00:00:00Z'))).toBe('2026-11-23');
    expect(weekDates(WEEK)).toEqual(['2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20', '2026-11-21', '2026-11-22']);
    expect(isMonday(WEEK)).toBe(true);
    expect(isMonday('2026-11-17')).toBe(false);
    expect(isMonday('2026-02-30')).toBe(false);
  });
});

describe('meal plan', () => {
  it('needs a sign-in', async () => {
    expect((await call(t, 'GET', '/v1/me/meal-plans')).statusCode).toBe(401);
    expect((await call(t, 'PUT', `/v1/me/meal-plans/${WEEK}`, undefined, { days: [] })).statusCode).toBe(401);
  });

  it('saves a plan as seven days with the totals worked out by the server', async () => {
    const ama = await register(t);
    const jollof = meal('Jollof Rice');
    const res = await putPlan(ama, {
      days: [
        { date: '2026-11-16', dinner: jollof, lunch: meal('Salad') },
        { date: '2026-11-18', dinner: meal('Jollof Rice', jollof.recipeId) },
      ],
      shoppingList: [shopItem('a')],
      stats: { estimatedSavings: 12.5, ingredientOverlap: 40, totalMeals: 999 } as never, // totals from the client are ignored
      isGenerated: true,
    });
    expect(res.statusCode).toBe(200);
    const plan = res.json<MealPlan>();
    expect(plan.weekStart).toBe(WEEK);
    expect(plan.days.map((d) => d.date)).toEqual(weekDates(WEEK));
    expect(plan.days[1]).toEqual({ date: '2026-11-17' });
    expect(plan.stats).toMatchObject({ totalMeals: 3, uniqueRecipes: 2, estimatedSavings: 12.5, ingredientOverlap: 40, pantryItemsUsed: 0 });
    expect(plan.isGenerated).toBe(true);
    expect(plan.shoppingList).toHaveLength(1);
  });

  it('replaces the plan when saved again, keeping earlier stats the new request does not mention', async () => {
    const ama = await register(t);
    await putPlan(ama, { days: [{ date: WEEK, dinner: meal() }], stats: { estimatedSavings: 7 } });
    const again = (await putPlan(ama, { days: [{ date: WEEK, lunch: meal('Soup') }] })).json<MealPlan>();
    expect(again.days[0]).toMatchObject({ lunch: { recipeName: 'Soup' } });
    expect(again.days[0]?.dinner).toBeUndefined();
    expect(again.stats).toMatchObject({ totalMeals: 1, estimatedSavings: 7 });
    expect((await call(t, 'GET', '/v1/me/meal-plans', ama)).json<Page<MealPlan>>().items).toHaveLength(1);
  });

  it.each([
    ['a day outside the week', { days: [{ date: '2026-11-23' }] }, WEEK],
    ['the same day twice', { days: [{ date: WEEK }, { date: WEEK }] }, WEEK],
    ['a recipe id that is not an id', { days: [{ date: WEEK, dinner: { recipeId: 'x', recipeName: 'A', servings: 1 } }] }, WEEK],
    ['zero servings', { days: [{ date: WEEK, dinner: { ...meal(), servings: 0 } }] }, WEEK],
    ['a week that does not start on a Monday', { days: [] }, '2026-11-17'],
    ['a date that is not a date', { days: [] }, '2026-13-40'],
  ])('refuses %s', async (_label, body, week) => {
    const ama = await register(t);
    expect((await putPlan(ama, body, week)).statusCode).toBe(400);
  });

  it('finds this week\'s plan, a given week, and lists newest first in pages', async () => {
    const ama = await register(t);
    expect((await call(t, 'GET', '/v1/me/meal-plans/current', ama)).json<{ plan: MealPlan | null }>().plan).toBeNull();
    expect((await call(t, 'GET', `/v1/me/meal-plans/${WEEK}`, ama)).statusCode).toBe(404);

    const thisWeek = weekStartOf(new Date());
    await putPlan(ama, { days: [] }, thisWeek);
    expect((await call(t, 'GET', '/v1/me/meal-plans/current', ama)).json<{ plan: MealPlan }>().plan.weekStart).toBe(thisWeek);

    for (const w of ['2026-11-02', '2026-11-09', WEEK]) await putPlan(ama, { days: [] }, w);
    // This week may coincide with one of the fixed weeks, whatever day the test runs on, so compare distinct weeks.
    const all = [...new Set([thisWeek, WEEK, '2026-11-09', '2026-11-02'])].sort().reverse();
    const page1 = (await call(t, 'GET', '/v1/me/meal-plans?limit=2', ama)).json<Page<MealPlan>>();
    expect(page1.items.map((p) => p.weekStart)).toEqual(all.slice(0, 2));
    const page2 = (await call(t, 'GET', `/v1/me/meal-plans?limit=2&cursor=${page1.nextCursor}`, ama)).json<Page<MealPlan>>();
    expect(page2.items.map((p) => p.weekStart)).toEqual(all.slice(2));
    expect(page2.nextCursor).toBeNull();
  });

  it('keeps one person\'s plans from another', async () => {
    const ama = await register(t);
    const kemi = await register(t);
    await putPlan(ama, { days: [{ date: WEEK, dinner: meal() }] });
    expect((await call(t, 'GET', `/v1/me/meal-plans/${WEEK}`, kemi)).statusCode).toBe(404);
    expect((await call(t, 'DELETE', `/v1/me/meal-plans/${WEEK}`, kemi)).statusCode).toBe(404);
    expect((await call(t, 'GET', '/v1/me/meal-plans', kemi)).json<Page<MealPlan>>().items).toEqual([]);
    expect((await call(t, 'GET', `/v1/me/meal-plans/${WEEK}`, ama)).statusCode).toBe(200);
  });

  it('deletes a plan', async () => {
    const ama = await register(t);
    await putPlan(ama, { days: [] });
    expect((await call(t, 'DELETE', `/v1/me/meal-plans/${WEEK}`, ama)).statusCode).toBe(204);
    expect((await call(t, 'DELETE', `/v1/me/meal-plans/${WEEK}`, ama)).statusCode).toBe(404);
  });
});

describe('editing one meal', () => {
  const slot = (date: string, type: string) => `/v1/me/meal-plans/${WEEK}/days/${date}/${type}`;

  it('sets and clears a slot, starting the week if there is no plan yet', async () => {
    const ama = await register(t);
    const set = await call(t, 'PUT', slot('2026-11-18', 'dinner'), ama, meal('Egusi Soup'));
    expect(set.statusCode).toBe(200);
    const plan = set.json<MealPlan>();
    expect(plan.days[2]?.dinner?.recipeName).toBe('Egusi Soup');
    expect(plan.stats).toMatchObject({ totalMeals: 1, uniqueRecipes: 1 });

    const replaced = (await call(t, 'PUT', slot('2026-11-18', 'dinner'), ama, meal('Pounded Yam'))).json<MealPlan>();
    expect(replaced.days[2]?.dinner?.recipeName).toBe('Pounded Yam');
    expect(replaced.stats.totalMeals).toBe(1);

    const cleared = (await call(t, 'DELETE', slot('2026-11-18', 'dinner'), ama)).json<MealPlan>();
    expect(cleared.days[2]).toEqual({ date: '2026-11-18' });
    expect(cleared.stats.totalMeals).toBe(0);
  });

  it('refuses a day outside the week or a meal that does not exist', async () => {
    const ama = await register(t);
    expect((await call(t, 'PUT', slot('2026-11-23', 'dinner'), ama, meal())).statusCode).toBe(400);
    expect((await call(t, 'PUT', slot('2026-11-18', 'brunch'), ama, meal())).statusCode).toBe(400);
    expect((await call(t, 'PUT', slot('2026-11-18', 'dinner'), ama, { recipeName: 'x' })).statusCode).toBe(400);
  });

  it('keeps every change when several arrive together', async () => {
    const ama = await register(t);
    const dates = weekDates(WEEK);
    await Promise.all(dates.map((d, i) => call(t, 'PUT', slot(d, 'dinner'), ama, meal(`Dinner ${i}`))));
    const plan = (await call(t, 'GET', `/v1/me/meal-plans/${WEEK}`, ama)).json<MealPlan>();
    expect(plan.days.map((d) => d.dinner?.recipeName)).toEqual(dates.map((_, i) => `Dinner ${i}`));
    expect(plan.stats.totalMeals).toBe(7);
  });
});

describe('ticking off the plan\'s shopping list', () => {
  const check = (who: Awaited<ReturnType<typeof register>>, itemId: string, checked: boolean) =>
    call(t, 'PUT', `/v1/me/meal-plans/${WEEK}/shopping/${itemId}/checked`, who, { checked });

  it('ticks and unticks, and refuses an item or a plan that is not there', async () => {
    const ama = await register(t);
    expect((await check(ama, 'a', true)).statusCode).toBe(404); // no plan yet
    await putPlan(ama, { days: [], shoppingList: [shopItem('a'), shopItem('b', 'Salt')] });
    expect((await check(ama, 'a', true)).json<MealPlan>().shoppingList.map((i) => i.checked)).toEqual([true, false]);
    expect((await check(ama, 'a', false)).json<MealPlan>().shoppingList.map((i) => i.checked)).toEqual([false, false]);
    expect((await check(ama, 'zzz', true)).statusCode).toBe(404);
  });

  it('keeps every tick when several arrive together', async () => {
    const ama = await register(t);
    const ids = ['a', 'b', 'c', 'd', 'e'];
    await putPlan(ama, { days: [], shoppingList: ids.map((id) => shopItem(id)) });
    await Promise.all(ids.map((id) => check(ama, id, true)));
    const plan = (await call(t, 'GET', `/v1/me/meal-plans/${WEEK}`, ama)).json<MealPlan>();
    expect(plan.shoppingList.every((i) => i.checked)).toBe(true);
  });
});

describe('food waste', () => {
  const log = (who: Awaited<ReturnType<typeof register>>, overrides: Record<string, unknown> = {}) =>
    call(t, 'POST', '/v1/me/waste', who, { itemName: 'Bread', amount: 1, unit: 'loaf', reason: 'expired', estimatedValue: 5, ...overrides });
  const ago = (days: number) => new Date(Date.now() - days * DAY_MS).toISOString();
  const stats = async (who: Awaited<ReturnType<typeof register>>) => (await call(t, 'GET', '/v1/me/waste/stats', who)).json<WasteStats>();

  it('needs a sign-in, checks input, and logs an entry', async () => {
    const ama = await register(t);
    expect((await call(t, 'GET', '/v1/me/waste/stats')).statusCode).toBe(401);
    expect((await log(ama, { reason: 'dropped' })).statusCode).toBe(400);
    expect((await log(ama, { estimatedValue: -1 })).statusCode).toBe(400);
    expect((await log(ama, { itemName: ' ' })).statusCode).toBe(400);
    const ok = await log(ama, { notes: 'forgot it' });
    expect(ok.statusCode).toBe(201);
    expect(ok.json<WasteEntry>()).toMatchObject({ itemName: 'Bread', reason: 'expired', estimatedValue: 5, notes: 'forgot it' });
  });

  it('lists newest first with paging, deletes only your own', async () => {
    const ama = await register(t);
    const kemi = await register(t);
    const old = (await log(ama, { itemName: 'Old', wastedAt: ago(10) })).json<WasteEntry>();
    await log(ama, { itemName: 'Newer', wastedAt: ago(1) });
    await log(ama, { itemName: 'Newest', wastedAt: ago(0) });
    const page1 = (await call(t, 'GET', '/v1/me/waste?limit=2', ama)).json<Page<WasteEntry>>();
    expect(page1.items.map((e) => e.itemName)).toEqual(['Newest', 'Newer']);
    const page2 = (await call(t, 'GET', `/v1/me/waste?limit=2&cursor=${page1.nextCursor}`, ama)).json<Page<WasteEntry>>();
    expect(page2.items.map((e) => e.itemName)).toEqual(['Old']);
    expect((await call(t, 'DELETE', `/v1/me/waste/${old.id}`, kemi)).statusCode).toBe(404);
    expect((await call(t, 'DELETE', `/v1/me/waste/${old.id}`, ama)).statusCode).toBe(204);
  });

  it('works out the stats from the log, so deleting an entry takes it out of them', async () => {
    const ama = await register(t);
    expect(await stats(ama)).toMatchObject({ totalWasted: 0, wastedThisWeek: 0, itemsWastedThisMonth: 0, topWastedItems: [], trendDirection: 'stable', savedByPlanning: 0 });

    await log(ama, { itemName: 'Bread', estimatedValue: 5, wastedAt: ago(1), reason: 'expired' });
    await log(ama, { itemName: 'bread', estimatedValue: 4, wastedAt: ago(3), reason: 'spoiled' });
    await log(ama, { itemName: 'Milk', estimatedValue: 10, wastedAt: ago(20), reason: 'expired' });
    const gone = (await log(ama, { itemName: 'Rice', estimatedValue: 100, wastedAt: ago(90), reason: 'other' })).json<WasteEntry>();

    const s = await stats(ama);
    expect(s).toMatchObject({ totalWasted: 119, wastedThisWeek: 9, wastedThisMonth: 19, itemsWastedThisMonth: 3 });
    expect(s.topWastedItems[0]).toEqual({ name: expect.stringMatching(/^bread$/i), count: 2 });
    expect(s.wasteByReason).toEqual({ expired: 2, spoiled: 1, leftover: 0, overcooked: 0, other: 1 });

    await call(t, 'DELETE', `/v1/me/waste/${gone.id}`, ama);
    expect((await stats(ama)).totalWasted).toBe(19);
  });

  it('says whether waste is improving, steady or worsening against the month before', async () => {
    const better = await register(t);
    await log(better, { estimatedValue: 100, wastedAt: ago(45) });
    await log(better, { estimatedValue: 20, wastedAt: ago(5) });
    expect((await stats(better)).trendDirection).toBe('improving');

    const worse = await register(t);
    await log(worse, { estimatedValue: 20, wastedAt: ago(45) });
    await log(worse, { estimatedValue: 100, wastedAt: ago(5) });
    expect((await stats(worse)).trendDirection).toBe('worsening');

    const same = await register(t);
    await log(same, { estimatedValue: 50, wastedAt: ago(45) });
    await log(same, { estimatedValue: 52, wastedAt: ago(5) });
    expect((await stats(same)).trendDirection).toBe('stable');

    const nothingBefore = await register(t);
    await log(nothingBefore, { estimatedValue: 50, wastedAt: ago(5) });
    expect((await stats(nothingBefore)).trendDirection).toBe('stable');
  });

  it('adds up what meal planning has saved', async () => {
    const ama = await register(t);
    await putPlan(ama, { days: [], stats: { estimatedSavings: 12.5 } }, '2026-11-09');
    await putPlan(ama, { days: [], stats: { estimatedSavings: 7.5 } });
    expect((await stats(ama)).savedByPlanning).toBe(20);
  });

  it('moves with the server clock', async () => {
    const ama = await register(t);
    await log(ama, { estimatedValue: 8 });
    expect((await stats(ama)).wastedThisWeek).toBe(8);
    t.advance(10 * DAY_MS);
    const later = await stats(ama);
    expect(later.wastedThisWeek).toBe(0);
    expect(later.wastedThisMonth).toBe(8);
  });
});

describe('deleting an account', () => {
  it('takes meal plans and the waste log with it', async () => {
    const ama = await register(t);
    await putPlan(ama, { days: [] });
    await call(t, 'POST', '/v1/me/waste', ama, { itemName: 'Bread', amount: 1, unit: 'loaf', reason: 'expired', estimatedValue: 5 });
    expect((await call(t, 'DELETE', '/v1/me', ama, { password: 'correct horse battery' })).statusCode).toBe(204);
    expect(await t.db.mealPlan.count()).toBe(0);
    expect(await t.db.wasteEntry.count()).toBe(0);
  });
});
