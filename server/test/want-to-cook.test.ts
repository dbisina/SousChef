import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { ApiErrorBody, ImportedRecipe, Page, ShoppingItem, WantToCookItem } from '@shared';
import { makeApp, register, type TestApp } from './helpers';
import { call, createRecipe } from './recipeHelpers';

let t: TestApp;
beforeAll(async () => {
  t = await makeApp();
});
afterAll(() => t.close());
beforeEach(() => t.reset());

const imported = (overrides: Partial<ImportedRecipe> = {}): ImportedRecipe => ({
  title: 'Street-style suya',
  description: 'From a video',
  sourceUrl: 'https://www.tiktok.com/@chef.ama/video/7234567890123456789',
  sourcePlatform: 'tiktok',
  ingredients: [
    { name: 'beef', amount: 500, unit: 'g' },
    { name: 'suya spice', amount: 3, unit: 'tbsp' },
    { name: 'onion', amount: 1, unit: 'piece' },
  ],
  instructions: ['Slice', 'Coat', 'Grill'],
  servings: 4,
  tags: ['grill'],
  extractionConfidence: 0.8,
  ...overrides,
});

const list = async (who: Awaited<ReturnType<typeof register>>, query = '') =>
  (await call(t, 'GET', `/v1/me/want-to-cook${query}`, who)).json<Page<WantToCookItem>>();

describe('want to cook', () => {
  it('needs a sign-in', async () => {
    expect((await call(t, 'GET', '/v1/me/want-to-cook')).statusCode).toBe(401);
  });

  it('saves one of our recipes, with how much of it the pantry covers', async () => {
    const ama = await register(t);
    const kemi = await register(t);
    const recipe = await createRecipe(t, ama); // tomato, onion, olive oil
    await call(t, 'POST', '/v1/me/pantry/bulk', kemi, {
      items: [
        { name: 'Tomatoes', amount: 6, unit: 'piece', category: 'produce' },
        { name: 'Onion', amount: 3, unit: 'piece', category: 'produce' },
      ],
    });

    const res = await call(t, 'POST', '/v1/me/want-to-cook', kemi, { recipeId: recipe.id });
    expect(res.statusCode).toBe(201);
    const saved = res.json<WantToCookItem>();
    expect(saved.status).toBe('saved');
    expect(saved.recipe?.title).toBe('Jollof Rice');
    expect(saved.imported).toBeNull();
    expect(saved.pantryMatch).toMatchObject({ matchPercent: 67, missing: ['olive oil'], canMake: false });
  });

  it('saving the same recipe twice keeps one item', async () => {
    const ama = await register(t);
    const kemi = await register(t);
    const recipe = await createRecipe(t, ama);
    const first = await call(t, 'POST', '/v1/me/want-to-cook', kemi, { recipeId: recipe.id });
    const again = await call(t, 'POST', '/v1/me/want-to-cook', kemi, { recipeId: recipe.id });
    expect(first.statusCode).toBe(201);
    expect(again.statusCode).toBe(200);
    expect(again.json<WantToCookItem>().id).toBe(first.json<WantToCookItem>().id);
    expect((await list(kemi)).items).toHaveLength(1);
  });

  it('saves an imported recipe', async () => {
    const ama = await register(t);
    const res = await call(t, 'POST', '/v1/me/want-to-cook', ama, { imported: imported() });
    expect(res.statusCode).toBe(201);
    const saved = res.json<WantToCookItem>();
    expect(saved.recipe).toBeNull();
    expect(saved.imported?.title).toBe('Street-style suya');
    expect(saved.pantryMatch.matchPercent).toBe(0);
  });

  it('refuses a recipe you cannot see, nothing at all, or both at once', async () => {
    const ama = await register(t);
    const kemi = await register(t);
    const draft = await createRecipe(t, ama, { status: 'draft' });
    expect((await call(t, 'POST', '/v1/me/want-to-cook', kemi, { recipeId: draft.id })).statusCode).toBe(404);
    expect((await call(t, 'POST', '/v1/me/want-to-cook', ama, { recipeId: draft.id })).statusCode).toBe(201); // your own draft is fine
    expect((await call(t, 'POST', '/v1/me/want-to-cook', kemi, {})).statusCode).toBe(400);
    const recipe = await createRecipe(t, ama);
    expect((await call(t, 'POST', '/v1/me/want-to-cook', kemi, { recipeId: recipe.id, imported: imported() })).statusCode).toBe(400);
    expect((await call(t, 'POST', '/v1/me/want-to-cook', kemi, { imported: imported({ sourceUrl: 'ftp://nope' }) })).statusCode).toBe(400);
  });

  it('moves through the stages and remembers when it was cooked', async () => {
    const ama = await register(t);
    const item = (await call(t, 'POST', '/v1/me/want-to-cook', ama, { imported: imported() })).json<WantToCookItem>();
    const patch = async (body: object) => (await call(t, 'PATCH', `/v1/me/want-to-cook/${item.id}`, ama, body)).json<WantToCookItem>();

    const planned = await patch({ status: 'planned', plannedFor: '2030-05-01', notes: 'for Sunday' });
    expect(planned).toMatchObject({ status: 'planned', notes: 'for Sunday', cookedAt: null });
    expect(planned.plannedFor).toBe('2030-05-01T00:00:00.000Z');

    const cooked = await patch({ status: 'cooked' });
    expect(cooked.status).toBe('cooked');
    expect(cooked.cookedAt).not.toBeNull();

    const back = await patch({ status: 'saved' });
    expect(back).toMatchObject({ status: 'saved', cookedAt: null });
    expect((await call(t, 'PATCH', `/v1/me/want-to-cook/${item.id}`, ama, {})).statusCode).toBe(400);
  });

  it('filters by status, pages, and keeps people apart', async () => {
    const ama = await register(t);
    const kemi = await register(t);
    const a = (await call(t, 'POST', '/v1/me/want-to-cook', ama, { imported: imported({ title: 'One' }) })).json<WantToCookItem>();
    await call(t, 'POST', '/v1/me/want-to-cook', ama, { imported: imported({ title: 'Two' }) });
    await call(t, 'POST', '/v1/me/want-to-cook', ama, { imported: imported({ title: 'Three' }) });
    await call(t, 'PATCH', `/v1/me/want-to-cook/${a.id}`, ama, { status: 'cooked' });

    expect((await list(ama, '?status=cooked')).items.map((i) => i.imported?.title)).toEqual(['One']);
    const page1 = await list(ama, '?limit=2');
    expect(page1.items.map((i) => i.imported?.title)).toEqual(['Three', 'Two']);
    const page2 = await list(ama, `?limit=2&cursor=${page1.nextCursor}`);
    expect(page2.items.map((i) => i.imported?.title)).toEqual(['One']);
    expect(page2.nextCursor).toBeNull();

    expect((await list(kemi)).items).toEqual([]);
    expect((await call(t, 'PATCH', `/v1/me/want-to-cook/${a.id}`, kemi, { notes: 'mine' })).statusCode).toBe(404);
    expect((await call(t, 'DELETE', `/v1/me/want-to-cook/${a.id}`, kemi)).statusCode).toBe(404);
  });

  it('removes an item, and drops a saved recipe when the recipe is deleted or hidden', async () => {
    const ama = await register(t);
    const kemi = await register(t);
    const recipe = await createRecipe(t, ama);
    const other = await createRecipe(t, ama, { title: 'Second Recipe' });
    const saved = (await call(t, 'POST', '/v1/me/want-to-cook', kemi, { recipeId: recipe.id })).json<WantToCookItem>();
    await call(t, 'POST', '/v1/me/want-to-cook', kemi, { recipeId: other.id });

    expect((await call(t, 'DELETE', `/v1/me/want-to-cook/${saved.id}`, kemi)).statusCode).toBe(204);
    expect((await list(kemi)).items).toHaveLength(1);

    await call(t, 'PATCH', `/v1/recipes/${other.id}`, ama, { status: 'draft' }); // author takes it down
    expect((await list(kemi)).items).toEqual([]);
    await call(t, 'PATCH', `/v1/recipes/${other.id}`, ama, { status: 'published' });
    expect((await list(kemi)).items).toHaveLength(1);
    await call(t, 'DELETE', `/v1/recipes/${other.id}`, ama);
    expect((await list(kemi)).items).toEqual([]);
  });

  it('tracks the pantry as it changes', async () => {
    const ama = await register(t);
    const item = (await call(t, 'POST', '/v1/me/want-to-cook', ama, { imported: imported() })).json<WantToCookItem>();
    expect(item.pantryMatch.matchPercent).toBe(0);
    await call(t, 'POST', '/v1/me/pantry/bulk', ama, {
      items: [
        { name: 'Beef', amount: 1, unit: 'kg', category: 'meat' },
        { name: 'Onions', amount: 2, unit: 'piece', category: 'produce' },
        { name: 'Suya spice mix', amount: 1, unit: 'jar', category: 'spices' },
      ],
    });
    expect((await list(ama)).items[0]?.pantryMatch).toMatchObject({ matchPercent: 100, canMake: true });
  });
});

describe('from a saved recipe to the shopping list', () => {
  it('adds only what is missing, and marks the recipe as shopping', async () => {
    const ama = await register(t);
    const saved = (await call(t, 'POST', '/v1/me/want-to-cook', ama, { imported: imported() })).json<WantToCookItem>();
    await call(t, 'POST', '/v1/me/pantry', ama, { name: 'Onion', amount: 2, unit: 'piece', category: 'produce' });

    const res = await call(t, 'POST', `/v1/me/want-to-cook/${saved.id}/shopping-list`, ama);
    expect(res.statusCode).toBe(200);
    const body = res.json<{ added: ShoppingItem[]; item: WantToCookItem }>();
    expect(body.added.map((i) => [i.name, i.amount, i.unit]).sort()).toEqual([['beef', 500, 'g'], ['suya spice', 3, 'tbsp']]);
    expect(body.added.every((i) => i.recipeTitle === 'Street-style suya')).toBe(true);
    expect(body.item.status).toBe('shopping');

    const onList = (await call(t, 'GET', '/v1/me/shopping-list', ama)).json<{ items: ShoppingItem[] }>().items;
    expect(onList).toHaveLength(2);
  });

  it('does nothing when the pantry already has it all', async () => {
    const ama = await register(t);
    const saved = (await call(t, 'POST', '/v1/me/want-to-cook', ama, { imported: imported({ ingredients: [{ name: 'beef', amount: 1, unit: 'kg' }] }) })).json<WantToCookItem>();
    await call(t, 'POST', '/v1/me/pantry', ama, { name: 'Beef', amount: 1, unit: 'kg', category: 'meat' });
    const body = (await call(t, 'POST', `/v1/me/want-to-cook/${saved.id}/shopping-list`, ama)).json<{ added: ShoppingItem[]; item: WantToCookItem }>();
    expect(body.added).toEqual([]);
    expect(body.item.status).toBe('saved');
  });

  it('is only for your own saved recipes', async () => {
    const ama = await register(t);
    const kemi = await register(t);
    const saved = (await call(t, 'POST', '/v1/me/want-to-cook', ama, { imported: imported() })).json<WantToCookItem>();
    expect((await call(t, 'POST', `/v1/me/want-to-cook/${saved.id}/shopping-list`, kemi)).statusCode).toBe(404);
  });
});

describe('shopping list', () => {
  const add = (who: Awaited<ReturnType<typeof register>>, ...items: object[]) => call(t, 'POST', '/v1/me/shopping-list', who, { items });
  const items = async (who: Awaited<ReturnType<typeof register>>) =>
    (await call(t, 'GET', '/v1/me/shopping-list', who)).json<{ items: ShoppingItem[] }>().items;

  it('adds lines and adds to a line that is already there', async () => {
    const ama = await register(t);
    await add(ama, { name: 'Rice', amount: 1, unit: 'kg' });
    await add(ama, { name: ' rice ', amount: 2, unit: 'kg' }, { name: 'Rice', amount: 1, unit: 'bag' });
    const list = await items(ama);
    expect(list.map((i) => [i.name, i.amount, i.unit]).sort()).toEqual([['Rice', 1, 'bag'], ['Rice', 3, 'kg']]);
  });

  it('ticks off, edits, removes, and clears only the ticked ones', async () => {
    const ama = await register(t);
    const [a, b, c] = (await add(ama, { name: 'Salt', amount: 1, unit: 'bag' }, { name: 'Flour', amount: 1, unit: 'kg' }, { name: 'Eggs', amount: 12, unit: 'piece' })).json<{ items: ShoppingItem[] }>().items as [ShoppingItem, ShoppingItem, ShoppingItem];

    expect((await call(t, 'PATCH', `/v1/me/shopping-list/${a.id}`, ama, { checked: true })).json<ShoppingItem>().checked).toBe(true);
    expect((await call(t, 'PATCH', `/v1/me/shopping-list/${b.id}`, ama, { amount: 2 })).json<ShoppingItem>().amount).toBe(2);
    // ticked lines sink to the bottom
    expect((await items(ama)).map((i) => i.name)).toEqual(['Eggs', 'Flour', 'Salt']);

    expect((await call(t, 'DELETE', '/v1/me/shopping-list?checkedOnly=true', ama)).statusCode).toBe(204);
    expect((await items(ama)).map((i) => i.name).sort()).toEqual(['Eggs', 'Flour']);
    expect((await call(t, 'DELETE', `/v1/me/shopping-list/${c.id}`, ama)).statusCode).toBe(204);
    expect((await call(t, 'DELETE', '/v1/me/shopping-list', ama)).statusCode).toBe(204);
    expect(await items(ama)).toEqual([]);
  });

  it('keeps people apart and checks input', async () => {
    const ama = await register(t);
    const kemi = await register(t);
    const [salt] = (await add(ama, { name: 'Salt', amount: 1, unit: 'bag' })).json<{ items: ShoppingItem[] }>().items as [ShoppingItem];
    expect(await items(kemi)).toEqual([]);
    expect((await call(t, 'PATCH', `/v1/me/shopping-list/${salt.id}`, kemi, { checked: true })).statusCode).toBe(404);
    expect((await call(t, 'DELETE', `/v1/me/shopping-list/${salt.id}`, kemi)).statusCode).toBe(404);
    const bad = await add(ama, { name: '', amount: 1, unit: 'x' });
    expect(bad.statusCode).toBe(400);
    expect(bad.json<ApiErrorBody>().error.code).toBe('validation_error');
    expect((await call(t, 'POST', '/v1/me/shopping-list', ama, { items: [] })).statusCode).toBe(400);
  });
});

describe('deleting an account', () => {
  it('takes the pantry, saved recipes and shopping list with it', async () => {
    const ama = await register(t);
    await call(t, 'POST', '/v1/me/pantry', ama, { name: 'Milk', amount: 1, unit: 'l', category: 'dairy' });
    await call(t, 'POST', '/v1/me/want-to-cook', ama, { imported: imported() });
    await call(t, 'POST', '/v1/me/shopping-list', ama, { items: [{ name: 'Salt', amount: 1, unit: 'bag' }] });
    expect((await call(t, 'DELETE', '/v1/me', ama, { password: 'correct horse battery' })).statusCode).toBe(204);
    expect(await t.db.pantryItem.count()).toBe(0);
    expect(await t.db.wantToCookItem.count()).toBe(0);
    expect(await t.db.shoppingItem.count()).toBe(0);
  });
});
