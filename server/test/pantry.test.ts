import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { matchPantry, type ApiErrorBody, type PantryItem, type PantrySummary } from '@shared';
import { DAY_MS, makeApp, register, type TestApp } from './helpers';
import { call } from './recipeHelpers';

let t: TestApp;
beforeAll(async () => {
  // Long-lived access tokens: one test moves the server's clock by days and must stay signed in.
  t = await makeApp({ ACCESS_TOKEN_TTL_SECONDS: String(60 * 86400) });
});
afterAll(() => t.close());
beforeEach(() => t.reset());

const item = (overrides: Record<string, unknown> = {}) => ({ name: 'Milk', amount: 2, unit: 'l', category: 'dairy', ...overrides });
const days = (n: number) => new Date(Date.now() + n * DAY_MS).toISOString();

describe('pantry', () => {
  it('needs a sign-in', async () => {
    expect((await call(t, 'GET', '/v1/me/pantry')).statusCode).toBe(401);
    expect((await call(t, 'POST', '/v1/me/pantry', undefined, item())).statusCode).toBe(401);
  });

  it('adds, lists, edits and removes an item', async () => {
    const ama = await register(t);
    const created = await call(t, 'POST', '/v1/me/pantry', ama, item({ expiresAt: '2030-01-31' }));
    expect(created.statusCode).toBe(201);
    const milk = created.json<PantryItem>();
    expect(milk).toMatchObject({ name: 'Milk', amount: 2, unit: 'l', category: 'dairy' });
    expect(milk.expiresAt).toBe('2030-01-31T00:00:00.000Z');

    const edited = (await call(t, 'PATCH', `/v1/me/pantry/${milk.id}`, ama, { amount: 1.5, expiresAt: null })).json<PantryItem>();
    expect(edited).toMatchObject({ amount: 1.5, expiresAt: null });

    expect((await call(t, 'GET', '/v1/me/pantry', ama)).json<{ items: PantryItem[] }>().items.map((i) => i.id)).toEqual([milk.id]);
    expect((await call(t, 'DELETE', `/v1/me/pantry/${milk.id}`, ama)).statusCode).toBe(204);
    expect((await call(t, 'GET', '/v1/me/pantry', ama)).json<{ items: PantryItem[] }>().items).toEqual([]);
  });

  it('keeps each person\'s pantry to themselves', async () => {
    const ama = await register(t);
    const kemi = await register(t);
    const milk = (await call(t, 'POST', '/v1/me/pantry', ama, item())).json<PantryItem>();
    expect((await call(t, 'GET', '/v1/me/pantry', kemi)).json<{ items: PantryItem[] }>().items).toEqual([]);
    expect((await call(t, 'PATCH', `/v1/me/pantry/${milk.id}`, kemi, { amount: 9 })).statusCode).toBe(404);
    expect((await call(t, 'DELETE', `/v1/me/pantry/${milk.id}`, kemi)).statusCode).toBe(404);
    expect((await call(t, 'POST', `/v1/me/pantry/${milk.id}/use`, kemi, { amount: 1 })).statusCode).toBe(404);
    expect((await call(t, 'GET', '/v1/me/pantry', ama)).json<{ items: PantryItem[] }>().items[0]?.amount).toBe(2);
  });

  it.each([
    ['no name', { name: ' ' }],
    ['a zero amount', { amount: 0 }],
    ['an unknown category', { category: 'sweets' }],
    ['a date that is not a date', { expiresAt: 'someday' }],
  ])('refuses %s', async (_label, overrides) => {
    const ama = await register(t);
    const res = await call(t, 'POST', '/v1/me/pantry', ama, item(overrides));
    expect(res.statusCode).toBe(400);
    expect(res.json<ApiErrorBody>().error.code).toBe('validation_error');
  });

  it('adds many at once, and only all or none', async () => {
    const ama = await register(t);
    const ok = await call(t, 'POST', '/v1/me/pantry/bulk', ama, { items: [item(), item({ name: 'Rice', category: 'grains' })] });
    expect(ok.statusCode).toBe(201);
    expect(ok.json<{ items: PantryItem[] }>().items).toHaveLength(2);
    const bad = await call(t, 'POST', '/v1/me/pantry/bulk', ama, { items: [item({ name: 'Eggs' }), item({ amount: -1 })] });
    expect(bad.statusCode).toBe(400);
    expect((await call(t, 'GET', '/v1/me/pantry', ama)).json<{ items: PantryItem[] }>().items).toHaveLength(2);
  });

  it('filters by category, text, and by how soon things expire', async () => {
    const ama = await register(t);
    await call(t, 'POST', '/v1/me/pantry/bulk', ama, {
      items: [
        item({ name: 'Fresh Milk', expiresAt: days(10) }),
        item({ name: 'Yoghurt', expiresAt: days(2) }),
        item({ name: 'Old Cream', expiresAt: days(-1) }),
        item({ name: 'Rice', category: 'grains' }),
      ],
    });
    const names = async (query: string) =>
      (await call(t, 'GET', `/v1/me/pantry?${query}`, ama)).json<{ items: PantryItem[] }>().items.map((i) => i.name).sort();

    expect(await names('category=grains')).toEqual(['Rice']);
    expect(await names('q=milk')).toEqual(['Fresh Milk']);
    expect(await names('q=GRAINS')).toEqual(['Rice']); // category is searched too
    expect(await names('filter=expiring')).toEqual(['Yoghurt']);
    expect(await names('filter=expired')).toEqual(['Old Cream']);

    t.advance(8 * DAY_MS); // the clock is the server's, so "expiring" moves with it
    expect(await names('filter=expiring')).toEqual(['Fresh Milk']);
    expect(await names('filter=expired')).toEqual(['Old Cream', 'Yoghurt']);
  });

  it('counts items per category', async () => {
    const ama = await register(t);
    await call(t, 'POST', '/v1/me/pantry/bulk', ama, { items: [item(), item({ name: 'Cheese' }), item({ name: 'Rice', category: 'grains' })] });
    const summary = (await call(t, 'GET', '/v1/me/pantry/summary', ama)).json<PantrySummary>();
    expect(summary).toMatchObject({ dairy: 2, grains: 1, produce: 0, other: 0 });
  });

  it('clears everything for that person only', async () => {
    const ama = await register(t);
    const kemi = await register(t);
    await call(t, 'POST', '/v1/me/pantry', ama, item());
    await call(t, 'POST', '/v1/me/pantry', kemi, item());
    expect((await call(t, 'DELETE', '/v1/me/pantry', ama)).statusCode).toBe(204);
    expect((await call(t, 'GET', '/v1/me/pantry', ama)).json<{ items: PantryItem[] }>().items).toEqual([]);
    expect((await call(t, 'GET', '/v1/me/pantry', kemi)).json<{ items: PantryItem[] }>().items).toHaveLength(1);
  });

  it('stops at 500 items', async () => {
    const ama = await register(t);
    await t.db.pantryItem.createMany({
      data: Array.from({ length: 499 }, (_, i) => ({ userId: ama.user.id, name: `Item ${i}`, nameKey: `item ${i}`, amount: 1, unit: 'x', category: 'other' })),
    });
    expect((await call(t, 'POST', '/v1/me/pantry', ama, item())).statusCode).toBe(201);
    const over = await call(t, 'POST', '/v1/me/pantry', ama, item({ name: 'One too many' }));
    expect(over.statusCode).toBe(409);
    expect(over.json<ApiErrorBody>().error.code).toBe('limit_reached');
  });
});

describe('using up an ingredient', () => {
  it('takes some away, and removes the item when nothing is left', async () => {
    const ama = await register(t);
    const flour = (await call(t, 'POST', '/v1/me/pantry', ama, item({ name: 'Flour', amount: 1, unit: 'kg', category: 'grains' }))).json<PantryItem>();
    const some = (await call(t, 'POST', `/v1/me/pantry/${flour.id}/use`, ama, { amount: 0.25 })).json<{ item: PantryItem | null }>();
    expect(some.item?.amount).toBe(0.75);
    const rest = (await call(t, 'POST', `/v1/me/pantry/${flour.id}/use`, ama, { amount: 5 })).json<{ item: PantryItem | null }>();
    expect(rest.item).toBeNull();
    expect((await call(t, 'GET', '/v1/me/pantry', ama)).json<{ items: PantryItem[] }>().items).toEqual([]);
  });

  it('is exact when many requests arrive together', async () => {
    const ama = await register(t);
    const rice = (await call(t, 'POST', '/v1/me/pantry', ama, item({ name: 'Rice', amount: 10, unit: 'cup', category: 'grains' }))).json<PantryItem>();
    await Promise.all(Array.from({ length: 8 }, () => call(t, 'POST', `/v1/me/pantry/${rice.id}/use`, ama, { amount: 1 })));
    const left = (await call(t, 'GET', '/v1/me/pantry', ama)).json<{ items: PantryItem[] }>().items[0];
    expect(left?.amount).toBe(2);
  });
});

describe('matching a recipe against the pantry', () => {
  const need = (...names: string[]) => names.map((name) => ({ name }));

  it('counts a name that contains, or is contained in, a pantry name', () => {
    const m = matchPantry(need('Tomatoes', 'chicken breast', 'olive oil', 'saffron'), ['tomato', 'Chicken', 'oil']);
    expect(m.matching).toEqual(['Tomatoes', 'chicken breast', 'olive oil']);
    expect(m.missing).toEqual(['saffron']);
    expect(m.matchPercent).toBe(75);
    expect(m.canMake).toBe(false);
  });

  it('compares whole words, so a word hidden inside another does not count', () => {
    expect(matchPantry(need('oil'), ['boil']).matchPercent).toBe(0);
    expect(matchPantry(need('egg'), ['eggplant']).matchPercent).toBe(0);
    expect(matchPantry(need('eggs'), ['egg']).matchPercent).toBe(100);
    expect(matchPantry(need('Berries', 'potatoes'), ['berry', 'Potato']).matchPercent).toBe(100);
    expect(matchPantry(need('chicken breast'), ['breast']).matchPercent).toBe(100);
    expect(matchPantry(need('salted butter'), ['salt']).matchPercent).toBe(0);
  });

  it('ignores optional ingredients unless they are all there is', () => {
    const m = matchPantry([{ name: 'rice' }, { name: 'parsley', optional: true }], ['rice']);
    expect(m).toMatchObject({ matchPercent: 100, canMake: true, missing: [] });
    expect(matchPantry([{ name: 'parsley', optional: true }], [])).toMatchObject({ matchPercent: 0, missing: ['parsley'] });
  });

  it('is 0 and cannot-make for a recipe with nothing in it', () => {
    expect(matchPantry([], ['rice'])).toEqual({ matchPercent: 0, matching: [], missing: [], canMake: false });
  });
});
