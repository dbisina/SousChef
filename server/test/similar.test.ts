import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { BecauseYouCooked, SimilarRecipes } from '@shared';
import { makeApp, register, type TestApp } from './helpers';
import { call, createRecipe } from './recipeHelpers';
import { makePost } from './socialHelpers';

let t: TestApp;
beforeAll(async () => {
  t = await makeApp({ ACCESS_TOKEN_TTL_SECONDS: String(60 * 86400), RATE_LIMIT_MAX: '100000' });
});
afterAll(() => t.close());
beforeEach(() => t.reset());

type Who = Awaited<ReturnType<typeof register>>;
const ing = (...names: string[]) => names.map((name) => ({ name, amount: 100, unit: 'g' }));

async function menu(chef: Who) {
  const greenCurry = await createRecipe(t, chef, { title: 'Green Curry', cuisine: 'thai', ingredients: ing('coconut milk', 'green curry paste', 'chicken', 'basil') });
  const redCurry = await createRecipe(t, chef, { title: 'Red Curry', cuisine: 'thai', ingredients: ing('coconut milk', 'red curry paste', 'chicken', 'bamboo shoots') });
  const pizza = await createRecipe(t, chef, { title: 'Margherita', cuisine: 'italian', category: 'lunch', difficulty: 'hard', prepTime: 90, cookTime: 15, ingredients: ing('pizza dough', 'mozzarella', 'tomato', 'oregano') });
  return { greenCurry, redCurry, pizza };
}

describe('more like this', () => {
  it('lists the dishes most like a recipe, never the recipe itself, and works signed out', async () => {
    const chef = await register(t);
    const { greenCurry, redCurry, pizza } = await menu(chef);
    const res = await call(t, 'GET', `/v1/recipes/${greenCurry.id}/similar`);
    expect(res.statusCode).toBe(200);
    const ids = res.json<SimilarRecipes>().items.map((r) => r.id);
    expect(ids[0]).toBe(redCurry.id);
    expect(ids).not.toContain(greenCurry.id);
    expect(ids.indexOf(pizza.id) === -1 || ids.indexOf(pizza.id) > 0).toBe(true);
    expect(res.json<SimilarRecipes>().items[0]).toMatchObject({ title: 'Red Curry', author: { id: chef.user.id } });
  });

  it('lists one of each name, so a copy of a recipe is not "more like this"', async () => {
    const chef = await register(t);
    const { greenCurry } = await menu(chef);
    await createRecipe(t, chef, { title: 'Red Curry', cuisine: 'thai', ingredients: ing('coconut milk', 'red curry paste', 'chicken', 'bamboo shoots') });
    await createRecipe(t, chef, { title: 'Green Curry', cuisine: 'thai', ingredients: ing('coconut milk', 'green curry paste', 'chicken', 'basil') });
    const titles = (await call(t, 'GET', `/v1/recipes/${greenCurry.id}/similar`)).json<SimilarRecipes>().items.map((r) => r.title);
    expect(titles.filter((x) => x === 'Red Curry')).toHaveLength(1);
    expect(titles).not.toContain('Green Curry'); // the same name as the recipe being looked at
  });

  it('gives nothing for a recipe that does not exist, and respects the limit', async () => {
    const chef = await register(t);
    const { greenCurry } = await menu(chef);
    expect((await call(t, 'GET', `/v1/recipes/${randomUUID()}/similar`)).json<SimilarRecipes>().items).toEqual([]);
    expect((await call(t, 'GET', `/v1/recipes/${greenCurry.id}/similar?limit=1`)).json<SimilarRecipes>().items).toHaveLength(1);
    expect((await call(t, 'GET', `/v1/recipes/${greenCurry.id}/similar?limit=99`)).statusCode).toBe(400);
    expect((await call(t, 'GET', '/v1/recipes/not-an-id/similar')).statusCode).toBe(400);
  });
});

describe('because you cooked', () => {
  const row = async (who: Who | undefined) => (await call(t, 'GET', '/v1/feed/because-you-cooked', who)).json<BecauseYouCooked>();

  it('needs sign-in, and is empty for someone who has cooked and saved nothing', async () => {
    const ama = await register(t);
    expect((await call(t, 'GET', '/v1/feed/because-you-cooked')).statusCode).toBe(401);
    expect(await row(ama)).toEqual({ basedOn: null, items: [] });
  });

  it('is built on the last recipe saved, leaving out what they already saved, and prefers what they cooked', async () => {
    const [chef, ama] = [await register(t), await register(t)] as [Who, Who];
    const { greenCurry, redCurry, pizza } = await menu(chef);
    await call(t, 'PUT', `/v1/recipes/${greenCurry.id}/save`, ama);
    const saved = await row(ama);
    expect(saved.basedOn).toEqual({ id: greenCurry.id, title: 'Green Curry' });
    expect(saved.items[0]?.id).toBe(redCurry.id);
    expect(saved.items.map((r) => r.id)).not.toContain(greenCurry.id);

    // she makes the pizza and shares it: what she cooked is now the starting point
    await makePost(t, ama, { recipeId: pizza.id });
    const cooked = await row(ama);
    expect(cooked.basedOn).toEqual({ id: pizza.id, title: 'Margherita' });
    expect(cooked.items.map((r) => r.id)).not.toContain(greenCurry.id); // already saved
  });

  it('is empty for someone who turned personalisation off', async () => {
    const [chef, ama] = [await register(t), await register(t)] as [Who, Who];
    const { greenCurry } = await menu(chef);
    await call(t, 'PUT', `/v1/recipes/${greenCurry.id}/save`, ama);
    await call(t, 'PUT', '/v1/me/feed-preferences', ama, { personalised: false });
    expect(await row(ama)).toEqual({ basedOn: null, items: [] });
  });
});
