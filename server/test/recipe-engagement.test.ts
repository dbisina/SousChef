import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { MadePost, Page, RateRecipeResponse, Recipe, RecipeComment, RecipeSummary, ToggleResponse } from '@shared';
import { makeApp, register, type TestApp } from './helpers';
import { call, createRecipe, makeAdmin } from './recipeHelpers';

let t: TestApp;
beforeAll(async () => {
  t = await makeApp();
});
afterAll(() => t.close());
beforeEach(() => t.reset());

const counts = async (id: string) => {
  const r = (await call(t, 'GET', `/v1/recipes/${id}`)).json<Recipe>();
  return { likes: r.likeCount, saves: r.saveCount, comments: r.commentCount, rating: r.rating, ratings: r.ratingCount };
};

describe('likes and saves', () => {
  it('counts a person once however many times they tap', async () => {
    const ama = await register(t);
    const kemi = await register(t);
    const recipe = await createRecipe(t, ama);

    const first = (await call(t, 'PUT', `/v1/recipes/${recipe.id}/like`, kemi)).json<ToggleResponse>();
    const again = (await call(t, 'PUT', `/v1/recipes/${recipe.id}/like`, kemi)).json<ToggleResponse>();
    expect(first).toEqual({ active: true, count: 1 });
    expect(again).toEqual({ active: true, count: 1 });

    const off = (await call(t, 'DELETE', `/v1/recipes/${recipe.id}/like`, kemi)).json<ToggleResponse>();
    const offAgain = (await call(t, 'DELETE', `/v1/recipes/${recipe.id}/like`, kemi)).json<ToggleResponse>();
    expect(off).toEqual({ active: false, count: 0 });
    expect(offAgain).toEqual({ active: false, count: 0 });
  });

  it('stays correct when the same request arrives many times at once', async () => {
    const ama = await register(t);
    const kemi = await register(t);
    const recipe = await createRecipe(t, ama);
    await Promise.all(Array.from({ length: 12 }, () => call(t, 'PUT', `/v1/recipes/${recipe.id}/like`, kemi)));
    expect((await counts(recipe.id)).likes).toBe(1);
  });

  it('stays correct when many different people act at once', async () => {
    const ama = await register(t);
    const recipe = await createRecipe(t, ama);
    const fans = await Promise.all(Array.from({ length: 8 }, () => register(t)));
    await Promise.all(
      fans.flatMap((fan) => [call(t, 'PUT', `/v1/recipes/${recipe.id}/like`, fan), call(t, 'PUT', `/v1/recipes/${recipe.id}/save`, fan)]),
    );
    expect(await counts(recipe.id)).toMatchObject({ likes: 8, saves: 8 });
    await Promise.all(fans.slice(0, 3).map((fan) => call(t, 'DELETE', `/v1/recipes/${recipe.id}/like`, fan)));
    expect((await counts(recipe.id)).likes).toBe(5);
  });

  it('needs a sign-in and a recipe that exists', async () => {
    const ama = await register(t);
    const recipe = await createRecipe(t, ama);
    expect((await call(t, 'PUT', `/v1/recipes/${recipe.id}/like`)).statusCode).toBe(401);
    expect((await call(t, 'PUT', '/v1/recipes/00000000-0000-7000-8000-000000000000/like', ama)).statusCode).toBe(404);
  });

  it('lists saved recipes, newest save first, and drops them when unsaved', async () => {
    const ama = await register(t);
    const kemi = await register(t);
    const a = await createRecipe(t, ama, { title: 'Alpha' });
    const b = await createRecipe(t, ama, { title: 'Bravo' });
    const c = await createRecipe(t, ama, { title: 'Charlie' });
    for (const r of [a, b, c]) await call(t, 'PUT', `/v1/recipes/${r.id}/save`, kemi);

    const page1 = (await call(t, 'GET', '/v1/me/saved-recipes?limit=2', kemi)).json<Page<RecipeSummary>>();
    expect(page1.items.map((r) => r.title)).toEqual(['Charlie', 'Bravo']);
    expect(page1.nextCursor).not.toBeNull();
    const page2 = (await call(t, 'GET', `/v1/me/saved-recipes?limit=2&cursor=${page1.nextCursor}`, kemi)).json<Page<RecipeSummary>>();
    expect(page2.items.map((r) => r.title)).toEqual(['Alpha']);
    expect(page2.nextCursor).toBeNull();

    await call(t, 'DELETE', `/v1/recipes/${b.id}/save`, kemi);
    const after = (await call(t, 'GET', '/v1/me/saved-recipes', kemi)).json<Page<RecipeSummary>>();
    expect(after.items.map((r) => r.title)).toEqual(['Charlie', 'Alpha']);
  });
});

describe('ratings', () => {
  it('averages ratings and lets a person change theirs', async () => {
    const ama = await register(t);
    const kemi = await register(t);
    const tunde = await register(t);
    const recipe = await createRecipe(t, ama);

    expect((await call(t, 'PUT', `/v1/recipes/${recipe.id}/rating`, kemi, { rating: 5 })).json<RateRecipeResponse>()).toEqual({ rating: 5, ratingCount: 1 });
    expect((await call(t, 'PUT', `/v1/recipes/${recipe.id}/rating`, tunde, { rating: 2 })).json<RateRecipeResponse>()).toEqual({ rating: 3.5, ratingCount: 2 });
    // Kemi changes their mind: still two ratings, new average.
    expect((await call(t, 'PUT', `/v1/recipes/${recipe.id}/rating`, kemi, { rating: 4, review: 'Better the second day' })).json<RateRecipeResponse>()).toEqual({ rating: 3, ratingCount: 2 });
  });

  it('stays correct when ratings arrive together', async () => {
    const ama = await register(t);
    const recipe = await createRecipe(t, ama);
    const raters = await Promise.all(Array.from({ length: 6 }, () => register(t)));
    await Promise.all(raters.map((r, i) => call(t, 'PUT', `/v1/recipes/${recipe.id}/rating`, r, { rating: (i % 5) + 1 })));
    // 1,2,3,4,5,1 = 16 over 6 people
    expect(await counts(recipe.id)).toMatchObject({ ratings: 6, rating: 2.7 });
  });

  it('refuses rating your own recipe and out-of-range scores', async () => {
    const ama = await register(t);
    const kemi = await register(t);
    const recipe = await createRecipe(t, ama);
    expect((await call(t, 'PUT', `/v1/recipes/${recipe.id}/rating`, ama, { rating: 5 })).statusCode).toBe(403);
    expect((await call(t, 'PUT', `/v1/recipes/${recipe.id}/rating`, kemi, { rating: 6 })).statusCode).toBe(400);
    expect((await call(t, 'PUT', `/v1/recipes/${recipe.id}/rating`, kemi, { rating: 0 })).statusCode).toBe(400);
    expect((await call(t, 'PUT', `/v1/recipes/${recipe.id}/rating`, kemi, { rating: 3.5 })).statusCode).toBe(400);
  });
});

describe('comments', () => {
  it('adds, lists newest first, pages, and keeps the count right', async () => {
    const ama = await register(t);
    const kemi = await register(t, { displayName: 'Kemi' });
    const recipe = await createRecipe(t, ama);
    for (const text of ['first', 'second', 'third']) {
      const res = await call(t, 'POST', `/v1/recipes/${recipe.id}/comments`, kemi, { text });
      expect(res.statusCode).toBe(201);
      expect(res.json<RecipeComment>().author.displayName).toBe('Kemi');
    }
    expect((await counts(recipe.id)).comments).toBe(3);

    const page1 = (await call(t, 'GET', `/v1/recipes/${recipe.id}/comments?limit=2`)).json<Page<RecipeComment>>();
    expect(page1.items.map((c) => c.text)).toEqual(['third', 'second']);
    const page2 = (await call(t, 'GET', `/v1/recipes/${recipe.id}/comments?limit=2&cursor=${page1.nextCursor}`)).json<Page<RecipeComment>>();
    expect(page2.items.map((c) => c.text)).toEqual(['first']);
    expect(page2.nextCursor).toBeNull();
  });

  it('rejects empty text', async () => {
    const ama = await register(t);
    const recipe = await createRecipe(t, ama);
    expect((await call(t, 'POST', `/v1/recipes/${recipe.id}/comments`, ama, { text: '   ' })).statusCode).toBe(400);
  });

  it('lets the commenter, the recipe author and an admin delete; nobody else', async () => {
    const ama = await register(t);
    const kemi = await register(t);
    const tunde = await register(t);
    const admin = await makeAdmin(t);
    const recipe = await createRecipe(t, ama);
    const post = async (who = kemi) => (await call(t, 'POST', `/v1/recipes/${recipe.id}/comments`, who, { text: 'hi' })).json<RecipeComment>();
    const del = (c: RecipeComment, who: typeof ama) => call(t, 'DELETE', `/v1/recipes/${recipe.id}/comments/${c.id}`, who);

    expect((await del(await post(), tunde)).statusCode).toBe(404); // a stranger
    expect((await del(await post(), kemi)).statusCode).toBe(204); // the commenter
    expect((await del(await post(), ama)).statusCode).toBe(204); // the recipe's author
    expect((await del(await post(), admin)).statusCode).toBe(204);
    // Two comments from the stranger test remain: the one that was refused, and none else.
    expect((await counts(recipe.id)).comments).toBe(1);
  });
});

describe('"I made this" posts', () => {
  it('adds, lists and removes photo posts', async () => {
    const ama = await register(t);
    const kemi = await register(t);
    const tunde = await register(t);
    const recipe = await createRecipe(t, ama);

    const res = await call(t, 'POST', `/v1/recipes/${recipe.id}/made`, kemi, { imageUrl: 'https://img.example.com/mine.jpg', caption: 'Turned out great' });
    expect(res.statusCode).toBe(201);
    const post = res.json<MadePost>();
    expect(post.caption).toBe('Turned out great');

    const list = (await call(t, 'GET', `/v1/recipes/${recipe.id}/made`)).json<Page<MadePost>>();
    expect(list.items.map((p) => p.id)).toEqual([post.id]);

    expect((await call(t, 'DELETE', `/v1/recipes/${recipe.id}/made/${post.id}`, tunde)).statusCode).toBe(404);
    expect((await call(t, 'DELETE', `/v1/recipes/${recipe.id}/made/${post.id}`, kemi)).statusCode).toBe(204);
    expect((await call(t, 'GET', `/v1/recipes/${recipe.id}/made`)).json<Page<MadePost>>().items).toHaveLength(0);
  });
});

describe('reports', () => {
  it('hides a recipe once enough different people report it, and counts each person once', async () => {
    const ama = await register(t);
    const recipe = await createRecipe(t, ama);
    const [r1, r2, r3] = await Promise.all([register(t), register(t), register(t)]);

    const flag = (who: typeof ama) => call(t, 'POST', `/v1/recipes/${recipe.id}/flag`, who, { reason: 'Not a real recipe' });
    expect((await flag(r1!)).statusCode).toBe(204);
    await flag(r1!); // same person again: still one report
    expect((await flag(r2!)).statusCode).toBe(204);
    expect((await call(t, 'GET', `/v1/recipes/${recipe.id}`)).statusCode).toBe(200);

    await flag(r3!);
    expect((await call(t, 'GET', `/v1/recipes/${recipe.id}`)).statusCode).toBe(404);
    expect((await call(t, 'GET', '/v1/recipes')).json<Page<RecipeSummary>>().items).toHaveLength(0);
    // The author still sees it, can't republish it, and an admin can restore it.
    const own = (await call(t, 'GET', `/v1/recipes/${recipe.id}`, ama)).json<Recipe>();
    expect(own.status).toBe('flagged');
    expect((await call(t, 'PATCH', `/v1/recipes/${recipe.id}`, ama, { status: 'published' })).statusCode).toBe(403);
    const admin = await makeAdmin(t);
    expect((await call(t, 'PATCH', `/v1/recipes/${recipe.id}`, admin, { status: 'published' })).statusCode).toBe(200);
    expect((await call(t, 'GET', `/v1/recipes/${recipe.id}`)).statusCode).toBe(200);
  });

  it('does not let an author report their own recipe', async () => {
    const ama = await register(t);
    const recipe = await createRecipe(t, ama);
    expect((await call(t, 'POST', `/v1/recipes/${recipe.id}/flag`, ama, { reason: 'oops' })).statusCode).toBe(403);
  });
});

describe('deleting an account', () => {
  it('removes the person\'s recipes and puts every total back the way it was', async () => {
    const ama = await register(t);
    const kemi = await register(t);
    const recipe = await createRecipe(t, ama);
    const kemisOwn = await createRecipe(t, kemi, { title: 'Kemi special' });

    await call(t, 'PUT', `/v1/recipes/${recipe.id}/like`, kemi);
    await call(t, 'PUT', `/v1/recipes/${recipe.id}/save`, kemi);
    await call(t, 'POST', `/v1/recipes/${recipe.id}/comments`, kemi, { text: 'lovely' });
    await call(t, 'PUT', `/v1/recipes/${recipe.id}/rating`, kemi, { rating: 5 });
    expect(await counts(recipe.id)).toEqual({ likes: 1, saves: 1, comments: 1, rating: 5, ratings: 1 });

    const res = await call(t, 'DELETE', '/v1/me', kemi, { password: 'correct horse battery' });
    expect(res.statusCode).toBe(204);

    expect(await counts(recipe.id)).toEqual({ likes: 0, saves: 0, comments: 0, rating: null, ratings: 0 });
    expect((await call(t, 'GET', `/v1/recipes/${kemisOwn.id}`)).statusCode).toBe(404);
    expect((await call(t, 'GET', `/v1/recipes/${recipe.id}`)).statusCode).toBe(200);
  });
});
