import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Cookbook, CookbookSummary, Page, RecipeSummary } from '@shared';
import { HOUSES, HOUSE_POSTS, PUZZLES } from '../src/seed/copy';
import { seedContent } from '../src/seed/run';
import content from '../seed/content.json';
import { makeApp, register, type TestApp } from './helpers';
import { call } from './recipeHelpers';

let t: TestApp;
beforeAll(async () => {
  t = await makeApp();
});
afterAll(() => t.close());
beforeEach(() => t.reset());

const counts = async () => ({
  houses: await t.db.user.count({ where: { kind: 'HOUSE' } }),
  recipes: await t.db.recipe.count(),
  cookbooks: await t.db.cookbook.count(),
  posts: await t.db.post.count(),
  puzzles: await t.db.dailyPuzzle.count(),
});

describe('first run', () => {
  it('adds the official accounts, recipes, cookbooks, posts and puzzles', async () => {
    const report = await seedContent(t.db);
    expect(report).toEqual({
      houses: { created: 3, existing: 0 },
      recipes: { created: 10, existing: 0 },
      cookbooks: { created: 3, existing: 0 },
      posts: { created: HOUSE_POSTS.length, existing: 0 },
      puzzles: 'set',
      photosRefreshed: 0,
      admin: null,
    });
    expect(await counts()).toEqual({ houses: 3, recipes: 10, cookbooks: 3, posts: HOUSE_POSTS.length, puzzles: PUZZLES.length });

    const houses = await t.db.user.findMany({ where: { kind: 'HOUSE' }, orderBy: { handle: 'asc' } });
    expect(houses.map((h) => h.handle)).toEqual(Object.values(HOUSES).map((h) => h.handle).sort());
    const official = await t.db.recipe.findMany({ include: { author: true } });
    expect(official.every((r) => r.isOfficial && r.status === 'PUBLISHED' && r.author.kind === 'HOUSE')).toBe(true);
    // nutrition is worked out by the server, in the units the recipe uses (300 g of chicken is not 300 ounces)
    expect(official.map((r) => [r.title, r.caloriesPerServing]).filter(([, kcal]) => (kcal as number) < 50 || (kcal as number) > 1500)).toEqual([]);
  });

  it('shows the recipes and cookbooks through the public API, cookbooks in their set order', async () => {
    await seedContent(t.db);
    const recipes = (await call(t, 'GET', '/v1/recipes?limit=50')).json<Page<RecipeSummary>>();
    expect(recipes.items).toHaveLength(10);
    const cookbooks = (await call(t, 'GET', '/v1/cookbooks?limit=20')).json<Page<CookbookSummary>>().items;
    expect(cookbooks.map((c) => c.title).sort()).toEqual(['Healthy & Quick', 'Kitchen Classics', 'Sweet Treats & Baking']);
    const classics = cookbooks.find((c) => c.title === 'Kitchen Classics') as CookbookSummary;
    const detail = (await call(t, 'GET', `/v1/cookbooks/${classics.id}`)).json<Cookbook>();
    expect(detail.recipeCount).toBe(3);
    const ordered = (await call(t, 'GET', `/v1/cookbooks/${classics.id}/recipes?limit=10`)).json<Page<RecipeSummary>>().items.map((r) => r.title);
    expect(ordered).toEqual(['Classic Chicken Stir-Fry', 'Creamy Mushroom Risotto', 'Grilled Salmon with Asparagus']);
  });

  it('puts every post under an official account and links it to a real recipe', async () => {
    await seedContent(t.db);
    const posts = await t.db.post.findMany({ include: { author: true, recipe: true } });
    expect(posts).toHaveLength(HOUSE_POSTS.length);
    expect(posts.every((p) => p.author.kind === 'HOUSE' && p.kind === 'recipe' && p.recipe?.status === 'PUBLISHED' && p.photoUrl.startsWith('https://'))).toBe(true);
    expect(posts[0]?.meta).toMatch(/^\d+ min · (Easy|Medium|Hard)$/);
  });

  it('never names a real person or carries personal data', async () => {
    await seedContent(t.db);
    const text = JSON.stringify(content) + JSON.stringify(HOUSES) + JSON.stringify(HOUSE_POSTS) + JSON.stringify(PUZZLES);
    expect(text).not.toMatch(/ramsay|gordon|julia child|jamie oliver/i);
    expect(text).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.]+/); // no email address
    expect(text).not.toMatch(/pushToken|ExponentPushToken/i);
  });
});

describe('running again', () => {
  it('adds nothing the second time', async () => {
    await seedContent(t.db);
    const before = await counts();
    const again = await seedContent(t.db);
    expect(again).toMatchObject({ houses: { created: 0, existing: 3 }, recipes: { created: 0, existing: 10 }, cookbooks: { created: 0, existing: 3 }, posts: { created: 0 }, puzzles: 'kept' });
    expect(await counts()).toEqual(before);
  });

  it('fills in only what is missing', async () => {
    await seedContent(t.db);
    await t.db.cookbook.deleteMany({});
    const again = await seedContent(t.db);
    expect(again.cookbooks).toEqual({ created: 3, existing: 0 });
    expect(again.recipes.created).toBe(0);
  });

  it('fixes a photo link that has changed in the seed data, on recipes, cookbooks and posts that already exist', async () => {
    await seedContent(t.db);
    await t.db.recipe.updateMany({ where: { title: 'Classic Chicken Stir-Fry' }, data: { imageUrl: 'https://example.com/dead.jpg' } });
    await t.db.cookbook.updateMany({ where: { title: 'Kitchen Classics' }, data: { coverImageUrl: 'https://example.com/dead.jpg' } });
    await t.db.post.updateMany({ where: { title: 'Stir-fry in 30 minutes' }, data: { photoUrl: 'https://example.com/dead.jpg' } });
    const dry = await seedContent(t.db, { dryRun: true });
    expect(dry.photosRefreshed).toBe(3);
    expect((await t.db.recipe.findFirstOrThrow({ where: { title: 'Classic Chicken Stir-Fry' } })).imageUrl).toBe('https://example.com/dead.jpg'); // a dry run changes nothing
    const real = await seedContent(t.db);
    expect(real.photosRefreshed).toBe(3);
    expect((await t.db.recipe.findFirstOrThrow({ where: { title: 'Classic Chicken Stir-Fry' } })).imageUrl).toMatch(/^https:\/\/images\.unsplash\.com\//);
    expect((await t.db.post.findFirstOrThrow({ where: { title: 'Stir-fry in 30 minutes' } })).photoUrl).toMatch(/unsplash/);
    expect((await seedContent(t.db)).photosRefreshed).toBe(0);
  });

  it('leaves puzzles that staff have already set alone', async () => {
    await t.db.dailyPuzzle.create({ data: { position: 1, answer: 'Staff Pick', aliases: [], clues: ['Chosen by staff'] } });
    expect((await seedContent(t.db)).puzzles).toBe('kept');
    expect(await t.db.dailyPuzzle.findMany()).toMatchObject([{ answer: 'Staff Pick' }]);
  });
});

describe('dry run', () => {
  it('says what would happen and writes nothing', async () => {
    const lines: string[] = [];
    const report = await seedContent(t.db, { dryRun: true }, (l) => lines.push(l));
    expect(report).toMatchObject({ houses: { created: 3 }, puzzles: 'would-set' });
    expect(lines.some((l) => l.startsWith('would create official account'))).toBe(true);
    expect(await counts()).toEqual({ houses: 0, recipes: 0, cookbooks: 0, posts: 0, puzzles: 0 });
  });
});

describe('making someone staff', () => {
  it('promotes an existing account (any capitals) and nobody else', async () => {
    const ama = await register(t, { email: 'ama@example.com' });
    const ben = await register(t, { email: 'ben@example.com' });
    const report = await seedContent(t.db, { adminEmail: 'AMA@Example.com' });
    expect(report.admin).toBe('AMA@Example.com');
    expect((await t.db.user.findUniqueOrThrow({ where: { id: ama.user.id } })).role).toBe('ADMIN');
    expect((await t.db.user.findUniqueOrThrow({ where: { id: ben.user.id } })).role).not.toBe('ADMIN');
  });

  it('says to register first when there is no such account, and a dry run does not promote', async () => {
    await expect(seedContent(t.db, { adminEmail: 'nobody@example.com' })).rejects.toThrow(/Register in the app first/);
    const ama = await register(t, { email: 'ama@example.com' });
    await seedContent(t.db, { dryRun: true, adminEmail: 'ama@example.com' });
    expect((await t.db.user.findUniqueOrThrow({ where: { id: ama.user.id } })).role).not.toBe('ADMIN');
  });
});
