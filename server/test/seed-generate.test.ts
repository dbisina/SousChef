import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AiRouter } from '../src/ai/router';
import { routerSettings } from '../src/ai/factory';
import { believableNutrition, findWikipediaPhoto, generateContent, generatePuzzles, rephotoDish, type DishDef } from '../src/seed/generate';
import { seedContent } from '../src/seed/run';
import { FakeAiProvider } from './aiHelpers';
import { FakeStorage, makeApp, testConfig, type TestApp } from './helpers';

let t: TestApp;
beforeAll(async () => {
  t = await makeApp();
});
afterAll(() => t.close());
beforeEach(() => t.reset());

const PHOTO = Buffer.alloc(40_000, 7);

const recipeJson = (title: string) =>
  JSON.stringify({
    description: `A reliable ${title} that works every time and is easy to repeat.`,
    servings: 4,
    prepTime: 15,
    cookTime: 30,
    difficulty: 'easy',
    ingredients: [
      { name: 'olive oil', amount: 2, unit: 'tbsp' },
      { name: 'onion', amount: 1, unit: 'piece' },
      { name: 'garlic', amount: 3, unit: 'clove' },
      { name: 'salt', amount: 1, unit: 'tsp' },
      { name: 'water', amount: 300, unit: 'ml' },
    ],
    instructions: ['Heat the oil in a wide pan over medium heat.', 'Cook the onion for five minutes until soft and golden.', 'Stir in the garlic and cook for one minute.', 'Add the water and salt, then simmer for twenty minutes.'],
    tags: ['easy'],
    dietaryFlags: ['vegan'],
    allergens: [],
    nutritionPerServing: { calories: 420, protein: 15, carbs: 55, fat: 14, fiber: 6 },
    postTitle: `Make ${title} tonight`,
    postCaption: 'Take your time with the onions. They carry the flavour of the whole dish.',
  });

function wikipedia(photo: { licence: string; width?: number; mime?: string }): typeof fetch {
  return (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
    if (url.includes('en.wikipedia.org')) return json({ query: { pages: { '1': { pageimage: 'Dish.jpg', thumbnail: { source: 'https://upload.wikimedia.org/dish.jpg', width: photo.width ?? 1000 } } } } });
    if (url.includes('commons.wikimedia.org')) {
      return json({ query: { pages: { '2': { imageinfo: [{ mime: photo.mime ?? 'image/jpeg', extmetadata: { LicenseShortName: { value: photo.licence }, Artist: { value: '<a href="x">Jane Cook</a>' } } }] } } } });
    }
    if (url.startsWith('https://upload.wikimedia.org')) return new Response(new Uint8Array(PHOTO), { status: 200 });
    if (url.startsWith('https://upload.test/')) return init?.method === 'PUT' ? new Response(null, { status: 200 }) : new Response(null, { status: 404 });
    return new Response(null, { status: 404 });
  }) as typeof fetch;
}

function router(see: (title: string) => boolean = () => true) {
  const vision = new FakeAiProvider('nebius-vision', true);
  const text = new FakeAiProvider('deepseek');
  vision.handler = (r) => JSON.stringify({ match: see(r.prompt) });
  text.handler = (r) => recipeJson(/Dish: (.*)/.exec(r.prompt)?.[1] ?? 'Dish');
  const config = testConfig({ AI_VISION_FIRST: 'nebius-vision' });
  const ai = new AiRouter(t.db, { ...routerSettings(config, [text, vision]), routes: { ...routerSettings(config, [text, vision]).routes, extract_recipe: ['deepseek'], judge_plate: ['nebius-vision'] } }, { warn: () => undefined });
  return { ai, vision, text };
}

const dishes: DishDef[] = [
  { title: 'Onion Stew', house: 'kitchen', cuisine: 'american', category: 'dinner', wiki: 'Onion stew' },
  { title: 'Garlic Soup', house: 'kitchen', cuisine: 'french', category: 'lunch', wiki: 'Garlic soup' },
  { title: 'Plain Broth', house: 'kitchen', cuisine: 'other', category: 'lunch', wiki: 'Broth' },
  { title: 'Herb Bread', house: 'kitchen', cuisine: 'italian', category: 'side', wiki: 'Herb bread' },
];

describe('finding a real photo', () => {
  it('takes the lead picture when its licence allows reuse, and credits the photographer when the licence asks', async () => {
    const free = await findWikipediaPhoto('Dish', wikipedia({ licence: 'CC BY-SA 4.0' }));
    expect(free?.credit).toBe('Photo: Jane Cook (CC BY-SA 4.0), Wikimedia Commons');
    const pd = await findWikipediaPhoto('Dish', wikipedia({ licence: 'Public domain' }));
    expect(pd?.credit).toBeNull();
  });

  it('waits and tries again when Wikimedia says to slow down', async () => {
    let limited = 2;
    const inner = wikipedia({ licence: 'CC0' });
    const flaky = (async (input: string | URL | Request, init?: RequestInit) => {
      if (limited-- > 0) return new Response(null, { status: 429, headers: { 'retry-after': '1' } });
      return inner(input, init);
    }) as typeof fetch;
    expect((await findWikipediaPhoto('Dish', flaky, 0))?.credit).toBeNull();
  });

  it('refuses a restrictive licence, a small picture and a file that is not a photo', async () => {
    expect(await findWikipediaPhoto('Dish', wikipedia({ licence: 'CC BY-NC 4.0' }))).toBeNull();
    expect(await findWikipediaPhoto('Dish', wikipedia({ licence: 'Fair use' }))).toBeNull();
    expect(await findWikipediaPhoto('Dish', wikipedia({ licence: 'CC0', width: 300 }))).toBeNull();
    expect(await findWikipediaPhoto('Dish', wikipedia({ licence: 'CC0', mime: 'image/svg+xml' }))).toBeNull();
  });
});

describe('checking the nutrition a model gives', () => {
  it('accepts a believable estimate and refuses nonsense', () => {
    expect(believableNutrition({ calories: 420, protein: 15, carbs: 55, fat: 14, fiber: 6 }, 4)).toEqual({ caloriesPerServing: 420, totalCalories: 1680, protein: 15, carbs: 55, fat: 14, fiber: 6 });
    expect(believableNutrition({ calories: 6, protein: 1, carbs: 1, fat: 0, fiber: 0 }, 4)).toBeNull(); // too small for a meal
    expect(believableNutrition({ calories: 4000, protein: 100, carbs: 400, fat: 200, fiber: 0 }, 1)).toBeNull(); // too large
    expect(believableNutrition({ calories: 500, protein: 5, carbs: 5, fat: 5, fiber: 0 }, 2)).toBeNull(); // macros do not add up
    expect(believableNutrition({ calories: Number.NaN, protein: 5, carbs: 5, fat: 5, fiber: 0 }, 2)).toBeNull();
  });
});

describe('generating real content', () => {
  it('writes a recipe per dish with a verified photo on our own store, a post each, and a cookbook; skips what it cannot verify', async () => {
    await seedContent(t.db);
    const storage = new FakeStorage();
    const { ai } = router((prompt) => !prompt.includes('Plain Broth'));
    const report = await generateContent({ db: t.db, ai, storage, fetchImpl: wikipedia({ licence: 'CC0' }) }, dishes);
    expect(report.created).toEqual(['Onion Stew', 'Garlic Soup', 'Herb Bread']);
    expect(report.skipped).toEqual([{ title: 'Plain Broth', reason: 'the photo does not clearly show the dish' }]);
    expect(report.cookbooks).toBe(0); // fewer than four recipes: no cookbook yet
    const recipe = await t.db.recipe.findFirstOrThrow({ where: { title: 'Onion Stew' } });
    expect(recipe.imageUrl).toBe('https://media.test/seed/onion-stew.jpg');
    expect(recipe.isOfficial).toBe(true);
    expect(recipe.ingredientNames).toContain('garlic');
    expect(recipe.caloriesPerServing).toBe(420);
    expect(await t.db.post.count({ where: { title: 'Make Onion Stew tonight' } })).toBe(1);
  });

  it('is safe to run again, and builds a cookbook once an account has four recipes', async () => {
    await seedContent(t.db);
    const storage = new FakeStorage();
    const { ai } = router();
    const first = await generateContent({ db: t.db, ai, storage, fetchImpl: wikipedia({ licence: 'CC0' }) }, dishes);
    expect(first.created).toHaveLength(4);
    expect(first.cookbooks).toBe(1);
    const again = await generateContent({ db: t.db, ai, storage, fetchImpl: wikipedia({ licence: 'CC0' }) }, dishes);
    expect(again.created).toEqual([]);
    expect(again.existing).toBe(4);
    expect(again.cookbooks).toBe(0);
    expect(await t.db.cookbook.count({ where: { title: 'Kitchen Favourites' } })).toBe(1);
  });

  it('gives a recipe a new photo that its posts follow, and keeps the old one when nothing passes', async () => {
    await seedContent(t.db);
    const storage = new FakeStorage();
    const { ai } = router();
    await generateContent({ db: t.db, ai, storage, fetchImpl: wikipedia({ licence: 'CC BY-SA 4.0' }) }, dishes);
    const before = await t.db.recipe.findFirstOrThrow({ where: { title: 'Onion Stew' } });
    expect(before.description).toContain('Photo: Jane Cook');

    const said = await rephotoDish({ db: t.db, ai, storage, fetchImpl: wikipedia({ licence: 'CC0' }) }, dishes, 'Onion Stew');
    expect(said).toContain('new photo https://media.test/seed/onion-stew-');
    const after = await t.db.recipe.findFirstOrThrow({ where: { title: 'Onion Stew' } });
    expect(after.imageUrl).not.toBe(before.imageUrl);
    expect(after.description).not.toContain('Photo:'); // the old credit went with the old photo
    expect((await t.db.post.findFirstOrThrow({ where: { recipeId: after.id } })).photoUrl).toBe(after.imageUrl);

    const { ai: strict } = router(() => false); // the vision check refuses everything
    expect(await rephotoDish({ db: t.db, ai: strict, storage, fetchImpl: wikipedia({ licence: 'CC0' }) }, dishes, 'Onion Stew')).toContain('kept the old photo');
    expect((await t.db.recipe.findFirstOrThrow({ where: { title: 'Onion Stew' } })).imageUrl).toBe(after.imageUrl);
    expect(await rephotoDish({ db: t.db, ai, storage }, dishes, 'No Such Dish')).toContain('not in the dish list');
  });

  it('does not spend on a recipe when there is no usable photo, and honours the limit and dry run', async () => {
    await seedContent(t.db);
    const { ai, text } = router();
    const none = await generateContent({ db: t.db, ai, storage: new FakeStorage(), fetchImpl: wikipedia({ licence: 'CC BY-NC 4.0' }) }, dishes);
    expect(none.created).toEqual([]);
    expect(none.skipped).toHaveLength(4);
    expect(text.calls).toHaveLength(0);
    const limited = await generateContent({ db: t.db, ai, storage: new FakeStorage(), fetchImpl: wikipedia({ licence: 'CC0' }) }, dishes, { limit: 2 });
    expect(limited.created).toHaveLength(2);
    const before = await t.db.recipe.count();
    await generateContent({ db: t.db, ai, storage: new FakeStorage(), fetchImpl: wikipedia({ licence: 'CC0' }) }, dishes, { dryRun: true });
    expect(await t.db.recipe.count()).toBe(before);
  });

  it('needs the file store', async () => {
    const { ai } = router();
    await expect(generateContent({ db: t.db, ai, storage: null }, dishes)).rejects.toThrow(/file store/);
  });
});

describe('generating Daily Dish puzzles', () => {
  const puzzle = (answer: string, clues?: string[]) => ({
    answer,
    aliases: [],
    clues: clues ?? ['A dish with a long history', 'Eaten across a whole region', 'Built on one main grain', 'Seasoned with a signature spice', 'Often served at celebrations', 'Best known by this exact bowl'],
  });

  it('adds new dishes after the existing ones, never twice, never with the name in a clue', async () => {
    const { ai, text } = router();
    await new (await import('../src/play/dailyDish')).DailyDishService(t.db).setPuzzles([puzzle('Paella')]);
    text.handler = () =>
      JSON.stringify({
        puzzles: [
          puzzle('Biryani'),
          puzzle('Paella'), // already there
          puzzle('Pho', ['The pho of the north', 'x'.repeat(10), 'y'.repeat(10), 'z'.repeat(10), 'w'.repeat(10), 'v'.repeat(10)]), // names itself
          { answer: 'Short', clues: ['too few clues'] },
          puzzle('Moqueca'),
        ],
      });
    const added = await generatePuzzles(t.db, ai, 3);
    expect(added).toBe(2);
    const all = await t.db.dailyPuzzle.findMany({ orderBy: { position: 'asc' } });
    expect(all.map((p) => p.answer)).toEqual(['Paella', 'Biryani', 'Moqueca']);
  });
});
