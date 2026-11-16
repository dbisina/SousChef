import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Cookbook, CookbookSummary, Page, RecipeSummary, ToggleResponse } from '@shared';
import { makeApp, register, type TestApp } from './helpers';
import { call, createRecipe, makeAdmin } from './recipeHelpers';

let t: TestApp;
beforeAll(async () => {
  t = await makeApp();
});
afterAll(() => t.close());
beforeEach(() => t.reset());

const cover = 'https://img.example.com/cover.jpg';
type Who = Awaited<ReturnType<typeof register>>;

async function setup() {
  const admin = await makeAdmin(t);
  const ama = await register(t);
  const recipes = [await createRecipe(t, ama, { title: 'First' }), await createRecipe(t, ama, { title: 'Second' }), await createRecipe(t, ama, { title: 'Third' })];
  return { admin, ama, recipes };
}
const create = (admin: Who, body: object) => call(t, 'POST', '/v1/admin/cookbooks', admin, { title: 'Sunday Lunches', coverImageUrl: cover, recipeIds: [], ...body });

describe('staff', () => {
  it('only an admin can write cookbooks', async () => {
    const { ama } = await setup();
    const body = { title: 'Sneaky', coverImageUrl: cover, recipeIds: [] };
    expect((await call(t, 'POST', '/v1/admin/cookbooks', undefined, body)).statusCode).toBe(401);
    expect((await call(t, 'POST', '/v1/admin/cookbooks', ama, body)).statusCode).toBe(403);
    expect((await call(t, 'PATCH', '/v1/admin/cookbooks/00000000-0000-7000-8000-000000000000', ama, { title: 'x' })).statusCode).toBe(403);
    expect((await call(t, 'DELETE', '/v1/admin/cookbooks/00000000-0000-7000-8000-000000000000', ama)).statusCode).toBe(403);
  });

  it('creates a cookbook with its recipes in order', async () => {
    const { admin, recipes } = await setup();
    const [a, b, c] = recipes as [(typeof recipes)[0], (typeof recipes)[0], (typeof recipes)[0]];
    const res = await create(admin, { category: 'weekend', recipeIds: [c.id, a.id, b.id] });
    expect(res.statusCode).toBe(201);
    const book = res.json<Cookbook>();
    expect(book).toMatchObject({ title: 'Sunday Lunches', category: 'weekend', recipeCount: 3, likeCount: 0, published: true });

    const inside = (await call(t, 'GET', `/v1/cookbooks/${book.id}/recipes`)).json<Page<RecipeSummary>>();
    expect(inside.items.map((r) => r.title)).toEqual(['Third', 'First', 'Second']);
  });

  it('refuses unknown or repeated recipes and bad input', async () => {
    const { admin, recipes } = await setup();
    const id = recipes[0]?.id as string;
    expect((await create(admin, { recipeIds: ['00000000-0000-7000-8000-000000000000'] })).statusCode).toBe(400);
    expect((await create(admin, { recipeIds: [id, id] })).statusCode).toBe(400);
    expect((await create(admin, { title: 'x' })).statusCode).toBe(400);
    expect((await create(admin, { coverImageUrl: 'not a url' })).statusCode).toBe(400);
  });

  it('edits, reorders and deletes', async () => {
    const { admin, recipes } = await setup();
    const [a, b, c] = recipes as [(typeof recipes)[0], (typeof recipes)[0], (typeof recipes)[0]];
    const book = (await create(admin, { recipeIds: [a.id, b.id] })).json<Cookbook>();

    const edited = await call(t, 'PATCH', `/v1/admin/cookbooks/${book.id}`, admin, { title: 'Renamed', recipeIds: [c.id, b.id], category: null });
    expect(edited.json<Cookbook>()).toMatchObject({ title: 'Renamed', recipeCount: 2, category: null });
    const inside = (await call(t, 'GET', `/v1/cookbooks/${book.id}/recipes`)).json<Page<RecipeSummary>>();
    expect(inside.items.map((r) => r.title)).toEqual(['Third', 'Second']);

    expect((await call(t, 'PATCH', `/v1/admin/cookbooks/${book.id}`, admin, {})).statusCode).toBe(400);
    expect((await call(t, 'PATCH', '/v1/admin/cookbooks/00000000-0000-7000-8000-000000000000', admin, { title: 'Nope' })).statusCode).toBe(404);
    expect((await call(t, 'DELETE', `/v1/admin/cookbooks/${book.id}`, admin)).statusCode).toBe(204);
    expect((await call(t, 'GET', `/v1/cookbooks/${book.id}`)).statusCode).toBe(404);
    expect((await call(t, 'DELETE', `/v1/admin/cookbooks/${book.id}`, admin)).statusCode).toBe(404);
  });
});

describe('reading', () => {
  it('lists published cookbooks newest first, by category, in pages', async () => {
    const { admin } = await setup();
    for (const [title, category] of [['One', 'a'], ['Two', 'b'], ['Three', 'a']] as const) await create(admin, { title, category });
    await create(admin, { title: 'Hidden', published: false });

    const all = (await call(t, 'GET', '/v1/cookbooks?limit=2')).json<Page<CookbookSummary>>();
    expect(all.items.map((c) => c.title)).toEqual(['Three', 'Two']);
    const rest = (await call(t, 'GET', `/v1/cookbooks?limit=2&cursor=${all.nextCursor}`)).json<Page<CookbookSummary>>();
    expect(rest.items.map((c) => c.title)).toEqual(['One']);
    expect(rest.nextCursor).toBeNull();
    expect((await call(t, 'GET', '/v1/cookbooks?category=a')).json<Page<CookbookSummary>>().items.map((c) => c.title)).toEqual(['Three', 'One']);
  });

  it('hides an unpublished cookbook from everyone but staff', async () => {
    const { admin, ama } = await setup();
    const book = (await create(admin, { published: false })).json<Cookbook>();
    expect((await call(t, 'GET', `/v1/cookbooks/${book.id}`)).statusCode).toBe(404);
    expect((await call(t, 'GET', `/v1/cookbooks/${book.id}`, ama)).statusCode).toBe(404);
    expect((await call(t, 'GET', `/v1/cookbooks/${book.id}/recipes`, ama)).statusCode).toBe(404);
    expect((await call(t, 'PUT', `/v1/cookbooks/${book.id}/like`, ama)).statusCode).toBe(404);
    expect((await call(t, 'GET', `/v1/cookbooks/${book.id}`, admin)).statusCode).toBe(200);
  });

  it('leaves out recipes that are no longer public, and drops deleted ones', async () => {
    const { admin, ama, recipes } = await setup();
    const [a, b, c] = recipes as [(typeof recipes)[0], (typeof recipes)[0], (typeof recipes)[0]];
    const book = (await create(admin, { recipeIds: [a.id, b.id, c.id] })).json<Cookbook>();
    await call(t, 'PATCH', `/v1/recipes/${b.id}`, ama, { status: 'draft' });
    await call(t, 'DELETE', `/v1/recipes/${c.id}`, ama);
    const inside = (await call(t, 'GET', `/v1/cookbooks/${book.id}/recipes`)).json<Page<RecipeSummary>>();
    expect(inside.items.map((r) => r.title)).toEqual(['First']);
    expect((await call(t, 'GET', `/v1/cookbooks/${book.id}`)).json<Cookbook>().recipeCount).toBe(2); // c is gone; b is only hidden
  });

  it('pages through a cookbook\'s recipes', async () => {
    const { admin, recipes } = await setup();
    const book = (await create(admin, { recipeIds: recipes.map((r) => r.id) })).json<Cookbook>();
    const p1 = (await call(t, 'GET', `/v1/cookbooks/${book.id}/recipes?limit=2`)).json<Page<RecipeSummary>>();
    const p2 = (await call(t, 'GET', `/v1/cookbooks/${book.id}/recipes?limit=2&cursor=${p1.nextCursor}`)).json<Page<RecipeSummary>>();
    expect([...p1.items, ...p2.items].map((r) => r.title)).toEqual(['First', 'Second', 'Third']);
    expect(p2.nextCursor).toBeNull();
  });
});

describe('likes and saves', () => {
  it('counts each person once and shows the viewer their own state', async () => {
    const { admin, ama } = await setup();
    const kemi = await register(t);
    const book = (await create(admin, {})).json<Cookbook>();

    expect((await call(t, 'PUT', `/v1/cookbooks/${book.id}/like`, ama)).json<ToggleResponse>()).toEqual({ active: true, count: 1 });
    expect((await call(t, 'PUT', `/v1/cookbooks/${book.id}/like`, ama)).json<ToggleResponse>()).toEqual({ active: true, count: 1 });
    expect((await call(t, 'PUT', `/v1/cookbooks/${book.id}/like`, kemi)).json<ToggleResponse>().count).toBe(2);
    expect((await call(t, 'DELETE', `/v1/cookbooks/${book.id}/like`, kemi)).json<ToggleResponse>()).toEqual({ active: false, count: 1 });
    expect((await call(t, 'DELETE', `/v1/cookbooks/${book.id}/like`, kemi)).json<ToggleResponse>()).toEqual({ active: false, count: 1 });
    await call(t, 'PUT', `/v1/cookbooks/${book.id}/save`, ama);

    expect((await call(t, 'GET', `/v1/cookbooks/${book.id}`, ama)).json<Cookbook>().viewer).toEqual({ liked: true, saved: true });
    expect((await call(t, 'GET', `/v1/cookbooks/${book.id}`, kemi)).json<Cookbook>().viewer).toEqual({ liked: false, saved: false });
    expect((await call(t, 'GET', `/v1/cookbooks/${book.id}`)).json<Cookbook>().viewer).toBeNull();
    expect((await call(t, 'PUT', `/v1/cookbooks/${book.id}/like`)).statusCode).toBe(401);
  });

  it('stays exact when many people act together', async () => {
    const { admin } = await setup();
    const book = (await create(admin, {})).json<Cookbook>();
    const fans = await Promise.all(Array.from({ length: 8 }, () => register(t)));
    await Promise.all(fans.flatMap((f) => [call(t, 'PUT', `/v1/cookbooks/${book.id}/like`, f), call(t, 'PUT', `/v1/cookbooks/${book.id}/like`, f), call(t, 'PUT', `/v1/cookbooks/${book.id}/save`, f)]));
    expect((await call(t, 'GET', `/v1/cookbooks/${book.id}`)).json<Cookbook>()).toMatchObject({ likeCount: 8, saveCount: 8 });
  });

  it('lists a person\'s saved cookbooks, newest save first', async () => {
    const { admin, ama } = await setup();
    const [one, two, three] = [
      (await create(admin, { title: 'One' })).json<Cookbook>(),
      (await create(admin, { title: 'Two' })).json<Cookbook>(),
      (await create(admin, { title: 'Three' })).json<Cookbook>(),
    ];
    for (const b of [one, two, three]) await call(t, 'PUT', `/v1/cookbooks/${b.id}/save`, ama);
    const p1 = (await call(t, 'GET', '/v1/me/saved-cookbooks?limit=2', ama)).json<Page<CookbookSummary>>();
    expect(p1.items.map((c) => c.title)).toEqual(['Three', 'Two']);
    const p2 = (await call(t, 'GET', `/v1/me/saved-cookbooks?limit=2&cursor=${p1.nextCursor}`, ama)).json<Page<CookbookSummary>>();
    expect(p2.items.map((c) => c.title)).toEqual(['One']);
    await call(t, 'DELETE', `/v1/cookbooks/${two.id}/save`, ama);
    expect((await call(t, 'GET', '/v1/me/saved-cookbooks', ama)).json<Page<CookbookSummary>>().items.map((c) => c.title)).toEqual(['Three', 'One']);
  });
});
