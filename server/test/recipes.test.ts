import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { ApiErrorBody, Page, Recipe, RecipeSummary } from '@shared';
import { makeApp, register, type TestApp } from './helpers';
import { call, createRecipe, makeAdmin, recipePayload } from './recipeHelpers';

let t: TestApp;
beforeAll(async () => {
  t = await makeApp();
});
afterAll(() => t.close());
beforeEach(() => t.reset());

describe('create', () => {
  it('stores the recipe, works out the nutrition, and credits the author', async () => {
    const ama = await register(t, { displayName: 'Ama' });
    const recipe = await createRecipe(t, ama);
    expect(recipe.title).toBe('Jollof Rice');
    expect(recipe.author.id).toBe(ama.user.id);
    expect(recipe.author.kind).toBe('person');
    expect(recipe.status).toBe('published');
    expect(recipe.ingredients).toHaveLength(3);
    expect(recipe.ingredients.every((i) => typeof i.calories === 'number')).toBe(true);
    expect(recipe.nutrition.totalCalories).toBeGreaterThan(0);
    expect(recipe.caloriesPerServing).toBe(recipe.nutrition.caloriesPerServing);
    expect(recipe.likeCount).toBe(0);
    expect(recipe.rating).toBeNull();
    expect(recipe.viewer).toEqual({ liked: false, saved: false, myRating: null });
  });

  it('needs a signed-in person', async () => {
    const res = await call(t, 'POST', '/v1/recipes', undefined, recipePayload());
    expect(res.statusCode).toBe(401);
  });

  it.each([
    ['no ingredients', { ingredients: [] }],
    ['no steps', { instructions: [] }],
    ['an image that is not a web address', { imageUrl: 'javascript:alert(1)' }],
    ['a cuisine that does not exist', { cuisine: 'martian' as never }],
    ['zero servings', { servings: 0 }],
  ])('refuses %s', async (_label, overrides) => {
    const ama = await register(t);
    const res = await call(t, 'POST', '/v1/recipes', ama, recipePayload(overrides));
    expect(res.statusCode).toBe(400);
    expect(res.json<ApiErrorBody>().error.code).toBe('validation_error');
  });

  it('lets only an admin mark a recipe official or exclusive', async () => {
    const ama = await register(t);
    const refused = await call(t, 'POST', '/v1/recipes', ama, recipePayload({ isOfficial: true }));
    expect(refused.statusCode).toBe(403);

    const admin = await makeAdmin(t);
    const ok = await createRecipe(t, admin, { isOfficial: true, isExclusive: true });
    expect(ok.isOfficial).toBe(true);
    expect(ok.isExclusive).toBe(true);
  });
});

describe('read', () => {
  it('shows a published recipe to anyone, and the viewer state to a signed-in person', async () => {
    const ama = await register(t);
    const kemi = await register(t);
    const recipe = await createRecipe(t, ama);

    const anonymous = await call(t, 'GET', `/v1/recipes/${recipe.id}`);
    expect(anonymous.statusCode).toBe(200);
    expect(anonymous.json<Recipe>().viewer).toBeNull();

    await call(t, 'PUT', `/v1/recipes/${recipe.id}/like`, kemi);
    await call(t, 'PUT', `/v1/recipes/${recipe.id}/rating`, kemi, { rating: 4 });
    const seen = (await call(t, 'GET', `/v1/recipes/${recipe.id}`, kemi)).json<Recipe>();
    expect(seen.viewer).toEqual({ liked: true, saved: false, myRating: 4 });
  });

  it('keeps a draft private to its author (and admins)', async () => {
    const ama = await register(t);
    const kemi = await register(t);
    const draft = await createRecipe(t, ama, { status: 'draft' });

    expect((await call(t, 'GET', `/v1/recipes/${draft.id}`, ama)).statusCode).toBe(200);
    expect((await call(t, 'GET', `/v1/recipes/${draft.id}`, kemi)).statusCode).toBe(404);
    expect((await call(t, 'GET', `/v1/recipes/${draft.id}`)).statusCode).toBe(404);
    expect((await call(t, 'GET', `/v1/recipes/${draft.id}`, await makeAdmin(t))).statusCode).toBe(200);

    const everyone = (await call(t, 'GET', '/v1/recipes')).json<Page<RecipeSummary>>();
    expect(everyone.items).toHaveLength(0);
    const mine = (await call(t, 'GET', '/v1/me/recipes', ama)).json<Page<RecipeSummary>>();
    expect(mine.items.map((r) => r.id)).toEqual([draft.id]);
    // Hidden things cannot be liked either.
    expect((await call(t, 'PUT', `/v1/recipes/${draft.id}/like`, kemi)).statusCode).toBe(404);
  });

  it('answers 404 for an unknown or malformed id', async () => {
    expect((await call(t, 'GET', '/v1/recipes/00000000-0000-7000-8000-000000000000')).statusCode).toBe(404);
    expect((await call(t, 'GET', '/v1/recipes/not-an-id')).statusCode).toBe(400);
  });
});

describe('update and delete', () => {
  it('lets the author edit, and recomputes nutrition when the servings change', async () => {
    const ama = await register(t);
    const recipe = await createRecipe(t, ama, { servings: 4 });
    const res = await call(t, 'PATCH', `/v1/recipes/${recipe.id}`, ama, { title: 'Party Jollof', servings: 8 });
    expect(res.statusCode).toBe(200);
    const updated = res.json<Recipe>();
    expect(updated.title).toBe('Party Jollof');
    expect(updated.servings).toBe(8);
    expect(updated.nutrition.totalCalories).toBe(recipe.nutrition.totalCalories);
    expect(updated.caloriesPerServing).toBe(Math.round(recipe.nutrition.totalCalories / 8));
  });

  it('refuses an empty change and a stranger, but allows an admin', async () => {
    const ama = await register(t);
    const kemi = await register(t);
    const recipe = await createRecipe(t, ama);
    expect((await call(t, 'PATCH', `/v1/recipes/${recipe.id}`, ama, {})).statusCode).toBe(400);
    expect((await call(t, 'PATCH', `/v1/recipes/${recipe.id}`, kemi, { title: 'Mine now' })).statusCode).toBe(404);
    const admin = await makeAdmin(t);
    expect((await call(t, 'PATCH', `/v1/recipes/${recipe.id}`, admin, { title: 'Edited by staff' })).statusCode).toBe(200);
  });

  it('deletes only for the author or an admin', async () => {
    const ama = await register(t);
    const kemi = await register(t);
    const recipe = await createRecipe(t, ama);
    expect((await call(t, 'DELETE', `/v1/recipes/${recipe.id}`, kemi)).statusCode).toBe(404);
    expect((await call(t, 'DELETE', `/v1/recipes/${recipe.id}`, ama)).statusCode).toBe(204);
    expect((await call(t, 'GET', `/v1/recipes/${recipe.id}`)).statusCode).toBe(404);
  });
});

describe('list', () => {
  it('filters by category, cuisine, difficulty, calories, diet flags and allergens', async () => {
    const ama = await register(t);
    await createRecipe(t, ama, { title: 'Egusi Soup', category: 'dinner', cuisine: 'nigerian', difficulty: 'hard', dietaryFlags: ['gluten-free'], allergens: ['fish'] });
    await createRecipe(t, ama, { title: 'Pancakes', category: 'breakfast', cuisine: 'american', difficulty: 'easy', allergens: ['eggs', 'milk'] });
    await createRecipe(t, ama, { title: 'Light Salad', category: 'lunch', cuisine: 'mediterranean', difficulty: 'easy', ingredients: [{ name: 'tomato', amount: 1, unit: 'piece' }] });

    const titles = async (query: string) =>
      (await call(t, 'GET', `/v1/recipes?${query}`)).json<Page<RecipeSummary>>().items.map((r) => r.title).sort();

    expect(await titles('category=breakfast')).toEqual(['Pancakes']);
    expect(await titles('cuisine=nigerian')).toEqual(['Egusi Soup']);
    expect(await titles('difficulty=easy')).toEqual(['Light Salad', 'Pancakes']);
    expect(await titles('dietaryFlags=gluten-free')).toEqual(['Egusi Soup']);
    expect(await titles('excludeAllergens=eggs,fish')).toEqual(['Light Salad']);
    expect(await titles('maxCalories=100')).toEqual(['Light Salad']);
    expect(await titles('authorId=' + ama.user.id)).toHaveLength(3);
  });

  it('rejects a bad filter value instead of ignoring it', async () => {
    expect((await call(t, 'GET', '/v1/recipes?category=snacks')).statusCode).toBe(400);
    expect((await call(t, 'GET', '/v1/recipes?limit=500')).statusCode).toBe(400);
  });

  it('pages newest first without repeating or skipping anything', async () => {
    const ama = await register(t);
    const made: string[] = [];
    for (let i = 0; i < 7; i++) made.push((await createRecipe(t, ama, { title: `Recipe ${i}` })).id);

    const seen: string[] = [];
    let cursor: string | null = null;
    let pages = 0;
    do {
      const url: string = `/v1/recipes?limit=3${cursor ? `&cursor=${cursor}` : ''}`;
      const page: Page<RecipeSummary> = (await call(t, 'GET', url)).json<Page<RecipeSummary>>();
      seen.push(...page.items.map((r) => r.id));
      cursor = page.nextCursor;
      pages++;
    } while (cursor);

    expect(pages).toBe(3);
    expect(seen).toEqual([...made].reverse());
  });

  it('can sort by most liked', async () => {
    const ama = await register(t);
    const fans = [await register(t), await register(t), await register(t)];
    const quiet = await createRecipe(t, ama, { title: 'Quiet' });
    const loved = await createRecipe(t, ama, { title: 'Loved' });
    for (const fan of fans) await call(t, 'PUT', `/v1/recipes/${loved.id}/like`, fan);
    await call(t, 'PUT', `/v1/recipes/${quiet.id}/like`, fans[0]);

    const page = (await call(t, 'GET', '/v1/recipes?sort=popular')).json<Page<RecipeSummary>>();
    expect(page.items.map((r) => [r.title, r.likeCount])).toEqual([['Loved', 3], ['Quiet', 1]]);
  });
});

describe('search', () => {
  it('finds whole words, close spellings and ignores the rest', async () => {
    const ama = await register(t);
    await createRecipe(t, ama, { title: 'Jollof Rice', description: 'Smoky party rice' });
    await createRecipe(t, ama, { title: 'Pepper Soup', description: 'Spicy broth with goat meat' });
    await createRecipe(t, ama, { title: 'Plantain Porridge', description: 'Sweet and savoury' });

    const search = async (q: string) =>
      (await call(t, 'GET', `/v1/recipes?q=${encodeURIComponent(q)}`)).json<Page<RecipeSummary>>().items.map((r) => r.title);

    expect(await search('goat')).toEqual(['Pepper Soup']);
    expect(await search('jolof')).toEqual(['Jollof Rice']); // one letter off
    expect(await search('porridge')).toEqual(['Plantain Porridge']);
    expect(await search('lasagne')).toEqual([]);
  });

  it('combines text with filters and does not return drafts', async () => {
    const ama = await register(t);
    await createRecipe(t, ama, { title: 'Rice Pudding', category: 'dessert' });
    await createRecipe(t, ama, { title: 'Rice and Stew', category: 'dinner' });
    await createRecipe(t, ama, { title: 'Rice Secret', category: 'dinner', status: 'draft' });
    const found = (await call(t, 'GET', '/v1/recipes?q=rice&category=dinner')).json<Page<RecipeSummary>>();
    expect(found.items.map((r) => r.title)).toEqual(['Rice and Stew']);
  });

  it('pages through search results', async () => {
    const ama = await register(t);
    for (let i = 0; i < 5; i++) await createRecipe(t, ama, { title: `Yam porridge ${i}` });
    const first = (await call(t, 'GET', '/v1/recipes?q=yam&limit=2')).json<Page<RecipeSummary>>();
    expect(first.items).toHaveLength(2);
    expect(first.nextCursor).toBe('2');
    const last = (await call(t, 'GET', '/v1/recipes?q=yam&limit=2&cursor=4')).json<Page<RecipeSummary>>();
    expect(last.items).toHaveLength(1);
    expect(last.nextCursor).toBeNull();
  });
});

describe('match what is in the pantry', () => {
  it('ranks recipes by how much of them the person already has', async () => {
    const ama = await register(t);
    await createRecipe(t, ama, {
      title: 'Tomato Stew',
      ingredients: [{ name: 'Tomato', amount: 4, unit: 'piece' }, { name: 'Onion', amount: 1, unit: 'piece' }],
    });
    await createRecipe(t, ama, {
      title: 'Fancy Pie',
      ingredients: [{ name: 'tomato', amount: 1, unit: 'piece' }, { name: 'butter', amount: 1, unit: 'tbsp' }, { name: 'garlic', amount: 1, unit: 'piece' }, { name: 'onion', amount: 1, unit: 'piece' }],
    });
    await createRecipe(t, ama, { title: 'Unrelated', ingredients: [{ name: 'chicken breast', amount: 1, unit: 'lb' }] });

    const res = await call(t, 'POST', '/v1/recipes/match', undefined, { ingredients: ['tomato', ' ONION '] });
    const { items } = res.json<{ items: { recipe: RecipeSummary; matchPercent: number; missing: string[] }[] }>();
    expect(items.map((m) => [m.recipe.title, m.matchPercent])).toEqual([['Tomato Stew', 100], ['Fancy Pie', 50]]);
    expect(items[1]?.missing.sort()).toEqual(['butter', 'garlic']);
  });
});
