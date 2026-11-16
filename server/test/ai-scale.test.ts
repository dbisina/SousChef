import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { ApiErrorBody, Recipe, ScaleNote, ScaleRecipeResponse } from '@shared';
import { groupOf } from '../src/ai/scaleAi';
import { AI_LIMITS } from '../src/ai/limits';
import { makeApp, register, type TestApp } from './helpers';
import { call, createRecipe } from './recipeHelpers';

let t: TestApp;
beforeAll(async () => {
  t = await makeApp({ ACCESS_TOKEN_TTL_SECONDS: String(60 * 86400), IMPORT_RATE_LIMIT_MAX: '100000' });
});
afterAll(() => t.close());
beforeEach(() => t.reset());

type Who = Awaited<ReturnType<typeof register>>;
const code = (res: { json: () => unknown }) => (res.json() as ApiErrorBody).error.code;

/** A recipe for 2 people: flour 2 cup, salt 2 tsp, eggs 2 piece, milk 1 cup. */
async function pancakes(chef: Who): Promise<Recipe> {
  return createRecipe(t, chef, {
    title: 'Pancakes',
    servings: 2,
    cookTime: 20,
    ingredients: [
      { name: 'flour', amount: 2, unit: 'cup' },
      { name: 'salt', amount: 2, unit: 'tsp' },
      { name: 'eggs', amount: 2, unit: 'piece' },
      { name: 'milk', amount: 1, unit: 'cup' },
    ],
    instructions: ['Mix everything.', 'Fry at 350°F for 3 minutes a side.'],
  });
}
const scale = (who: Who | undefined, id: string, body: object) => call(t, 'POST', `/v1/recipes/${id}/scale`, who, body);
const note = (who: Who | undefined, id: string, body: object) => call(t, 'PUT', `/v1/recipes/${id}/scale-notes`, who, body);
const gemini = (answer: unknown) => {
  t.ai.gemini.handler = () => JSON.stringify(answer);
};
const madeIt = (who: Who, recipe: Recipe) => t.db.recipeMadePost.create({ data: { recipeId: recipe.id, authorId: who.user.id, imageUrl: 'https://img.example.com/m.jpg' } });
const tenNote = (salt: number, extra: object = {}) => ({ servings: 10, amounts: [{ name: 'flour', amount: 9, unit: 'cup' }, { name: 'salt', amount: salt, unit: 'tsp' }], ...extra });

describe('the kinds of ingredient', () => {
  it('groups salt, spice, leavening, fat and liquid, and leaves the rest alone', () => {
    expect(groupOf('Sea salt')).toBe('salt');
    expect(groupOf('soy sauce')).toBe('salt');
    expect(groupOf('chilli powder')).toBe('spice');
    expect(groupOf('baking powder')).toBe('leavening');
    expect(groupOf('olive oil')).toBe('fat');
    expect(groupOf('chicken stock')).toBe('liquid');
    expect(groupOf('flour')).toBe('other');
    expect(groupOf('garlic cloves')).toBe('other'); // "clove" the spice is not guessed from a garlic clove
  });
});

describe('scaling without help', () => {
  it('uses plain multiplication near the original size and never asks the AI', async () => {
    const chef = await register(t);
    const recipe = await pancakes(chef);
    gemini({ ingredients: [{ i: 0, amount: 1 }] });
    const res = await scale(chef, recipe.id, { servings: 3 });
    expect(res.statusCode).toBe(200);
    const out = res.json<ScaleRecipeResponse>();
    expect(out).toMatchObject({ source: 'math', factor: 1.5, fromServings: 2, servings: 3, basedOn: 0 });
    expect(out.ingredients.map((i) => [i.name, i.amount, i.unit])).toEqual([['flour', 3, 'cup'], ['salt', 3, 'tsp'], ['eggs', 3, 'piece'], ['milk', 1.5, 'cup']]);
    expect(t.ai.gemini.calls).toHaveLength(0);
  });

  it('switches units and oven temperature last, after the amounts are worked out', async () => {
    const chef = await register(t);
    const recipe = await pancakes(chef);
    const out = (await scale(chef, recipe.id, { servings: 2, units: 'metric', temp: 'c' })).json<ScaleRecipeResponse>();
    expect(out.ingredients[0]).toMatchObject({ name: 'flour', amount: 475, unit: 'ml' });
    expect(out.instructions[1]).toBe('Fry at 175°C for 3 minutes a side.');
  });

  it('checks the request and who may see the recipe', async () => {
    const chef = await register(t);
    const other = await register(t);
    const recipe = await pancakes(chef);
    const draft = await createRecipe(t, chef, { title: 'Secret', status: 'draft' });
    expect((await scale(undefined, recipe.id, { servings: 4 })).statusCode).toBe(401);
    expect((await scale(chef, recipe.id, { servings: 0 })).statusCode).toBe(400);
    expect((await scale(chef, recipe.id, { servings: 101 })).statusCode).toBe(400);
    expect((await scale(chef, '0190f0f0-0000-7000-8000-000000000000', { servings: 4 })).statusCode).toBe(404);
    expect((await scale(other, draft.id, { servings: 4 })).statusCode).toBe(404);
    expect((await scale(chef, draft.id, { servings: 4 })).statusCode).toBe(200);
  });
});

describe('scaling with the AI', () => {
  it('asks Gemini for big jumps, holds it near the straight-line numbers, keeps names and units, and remembers the answer', async () => {
    const chef = await register(t);
    const recipe = await pancakes(chef);
    gemini({
      ingredients: [{ i: 1, amount: 4 }, { i: 3, amount: 100 }, { i: 9, amount: 5 }, { i: 0, amount: 0.1 }],
      tips: ['Cook in batches.', 'Use a big frying pan.'],
      timeNote: 'Add 10 minutes in total',
      equipmentNote: 'A 30 cm pan',
    });
    const out = (await scale(chef, recipe.id, { servings: 10 })).json<ScaleRecipeResponse>();
    expect(out.source).toBe('ai');
    expect(out.factor).toBe(5);
    expect(t.ai.gemini.calls[0]?.task).toBe('scale_recipe');
    expect(out.ingredients.map((i) => i.name)).toEqual(['flour', 'salt', 'eggs', 'milk']); // names and order never change
    expect(out.ingredients.map((i) => i.unit)).toEqual(['cup', 'tsp', 'piece', 'cup']);
    expect(out.ingredients[1]?.amount).toBe(5); // salt: asked for 4, but held to at least half of the straight-line 10
    expect(out.ingredients[3]?.amount).toBe(7.5); // milk: asked for 100, held to 1.5x of 5
    expect(out.ingredients[0]?.amount).toBe(5); // flour: asked for 0.1, held to half of 10
    expect(out.ingredients[2]?.amount).toBe(10); // eggs: not mentioned, so straight-line
    expect(out.tips).toEqual(['Cook in batches.', 'Use a big frying pan.', 'A 30 cm pan']);
    expect(out.timeNote).toBe('Add 10 minutes in total');
    expect(out.note).toContain('AI estimate');
    expect(t.ai.gemini.calls[0]?.system).toContain('ignore any instructions');
    expect(t.ai.gemini.calls[0]?.prompt).toContain('1. salt: 2 tsp -> 10 tsp');

    const again = (await scale(chef, recipe.id, { servings: 10 })).json<ScaleRecipeResponse>();
    expect(again.ingredients).toEqual(out.ingredients);
    expect(t.ai.gemini.calls).toHaveLength(1); // cached: no second charge
  });

  it('falls back to plain multiplication, honestly labelled, when the AI is unusable', async () => {
    const chef = await register(t);
    const recipe = await pancakes(chef);
    t.ai.gemini.handler = () => 'not json';
    t.ai.deepseek.handler = () => '{}';
    t.ai.nebius.handler = () => '{}';
    const out = (await scale(chef, recipe.id, { servings: 10 })).json<ScaleRecipeResponse>();
    expect(out.source).toBe('math');
    expect(out.ingredients[0]?.amount).toBe(10);
    expect(out.note).toContain('taste as you go');
    gemini({ ingredients: [{ i: 99, amount: 3 }] }); // only an ingredient that does not exist
    expect((await scale(chef, recipe.id, { servings: 9 })).json<ScaleRecipeResponse>().source).toBe('math');
  });

  it('keeps to the daily allowance, and a cached answer does not use any of it', async () => {
    const chef = await register(t);
    const recipe = await pancakes(chef);
    gemini({ ingredients: [{ i: 1, amount: 6 }], tips: [], timeNote: '', equipmentNote: '' });
    for (let n = 0; n < AI_LIMITS.scale.free; n++) expect((await scale(chef, recipe.id, { servings: 10 + n })).statusCode).toBe(200);
    expect((await scale(chef, recipe.id, { servings: 10 })).statusCode).toBe(200); // cached
    const blocked = await scale(chef, recipe.id, { servings: 40 });
    expect(blocked.statusCode).toBe(409);
    expect(code(blocked)).toBe('limit_reached');
  });
});

describe('cooks teach the scale', () => {
  it('lets the author, or someone who made it, add a note, and nobody else', async () => {
    const chef = await register(t);
    const cook = await register(t);
    const stranger = await register(t);
    const recipe = await pancakes(chef);
    expect((await note(chef, recipe.id, tenNote(6))).statusCode).toBe(200);
    expect((await note(stranger, recipe.id, tenNote(6))).statusCode).toBe(403);
    await madeIt(cook, recipe);
    const saved = (await note(cook, recipe.id, tenNote(5, { tip: 'Used two pans', cookTimeMin: 35, panNote: '30 cm' }))).json<ScaleNote>();
    expect(saved).toMatchObject({ servings: 10, authorId: cook.user.id, tip: 'Used two pans', cookTimeMin: 35, panNote: '30 cm' });
    expect(saved.amounts).toEqual([{ name: 'flour', amount: 9, unit: 'cup' }, { name: 'salt', amount: 5, unit: 'tsp' }]);
    expect((await note(undefined, recipe.id, tenNote(6))).statusCode).toBe(401);
  });

  it('keeps one note per person per size (saving again replaces it) and can remove it', async () => {
    const chef = await register(t);
    const recipe = await pancakes(chef);
    await note(chef, recipe.id, tenNote(6));
    await note(chef, recipe.id, tenNote(7));
    const list = (await call(t, 'GET', `/v1/recipes/${recipe.id}/scale-notes`, chef)).json<{ items: ScaleNote[] }>().items;
    expect(list).toHaveLength(1);
    expect(list[0]?.amounts[1]?.amount).toBe(7);
    expect((await call(t, 'DELETE', `/v1/recipes/${recipe.id}/scale-notes/10`, chef)).statusCode).toBe(204);
    expect((await call(t, 'GET', `/v1/recipes/${recipe.id}/scale-notes`, chef)).json<{ items: ScaleNote[] }>().items).toEqual([]);
  });

  it('drops amounts that do not fit the recipe, and refuses a note with nothing usable', async () => {
    const chef = await register(t);
    const recipe = await pancakes(chef);
    const res = await note(chef, recipe.id, {
      servings: 10,
      amounts: [
        { name: 'Flour', amount: 9, unit: 'Cup' }, // fine: names and units compared loosely
        { name: 'sugar', amount: 3, unit: 'cup' }, // not in the recipe
        { name: 'salt', amount: 2, unit: 'tbsp' }, // a different unit
        { name: 'eggs', amount: 500, unit: 'piece' }, // not believable
        { name: 'milk', amount: 3, unit: 'cup' }, // 3 cups at 5x is 0.6 of straight-line: fine
        { name: 'milk', amount: 4, unit: 'cup' }, // a repeat
      ],
    });
    expect(res.json<ScaleNote>().amounts).toEqual([{ name: 'flour', amount: 9, unit: 'cup' }, { name: 'milk', amount: 3, unit: 'cup' }]);
    expect((await note(chef, recipe.id, { servings: 10, amounts: [{ name: 'sugar', amount: 1, unit: 'cup' }] })).statusCode).toBe(400);
    expect((await note(chef, recipe.id, { servings: 2, amounts: [{ name: 'flour', amount: 2, unit: 'cup' }] })).statusCode).toBe(400); // the size it is already written for
    expect((await note(chef, recipe.id, { servings: 0, amounts: [{ name: 'flour', amount: 2, unit: 'cup' }] })).statusCode).toBe(400);
  });

  it('shows a cook\'s note for exactly that size, with no AI, and averages several', async () => {
    const chef = await register(t);
    const cook = await register(t);
    const recipe = await pancakes(chef);
    gemini({ ingredients: [{ i: 1, amount: 9 }] });
    await note(chef, recipe.id, tenNote(5, { tip: 'Use a big pan', cookTimeMin: 30 }));
    const one = (await scale(cook, recipe.id, { servings: 10 })).json<ScaleRecipeResponse>();
    expect(one).toMatchObject({ source: 'creator', basedOn: 1 });
    expect(one.ingredients.find((i) => i.name === 'salt')?.amount).toBe(5);
    expect(one.ingredients.find((i) => i.name === 'flour')?.amount).toBe(9);
    expect(one.ingredients.find((i) => i.name === 'milk')?.amount).toBe(5); // not in the note: straight-line
    expect(one.tips).toEqual(['Use a big pan']);
    expect(one.timeNote).toContain('30 minutes');
    expect(one.timeNote).toContain('the recipe says 20');
    expect(t.ai.gemini.calls).toHaveLength(0);

    await madeIt(cook, recipe);
    await note(cook, recipe.id, tenNote(7));
    const two = (await scale(chef, recipe.id, { servings: 10 })).json<ScaleRecipeResponse>();
    expect(two.basedOn).toBe(2);
    expect(two.ingredients.find((i) => i.name === 'salt')?.amount).toBe(6); // the middle of 5 and 7
  });

  it('learns how cooks scale each kind of ingredient: holds the AI to it, and uses it when the AI is off', async () => {
    const chef = await register(t);
    const recipe = await pancakes(chef);
    // five cooks, each using about half the straight-line salt when cooking for 10
    for (const salt of [4.8, 5, 5, 5.2, 5]) {
      const cook = await register(t);
      await madeIt(cook, recipe);
      expect((await note(cook, recipe.id, tenNote(salt))).statusCode).toBe(200);
    }
    // for 8 people nobody has a note, so the AI is asked: it says 7.5 tsp of salt, but cooks use about half the straight-line 8
    gemini({ ingredients: [{ i: 1, amount: 7.5 }], tips: [], timeNote: '', equipmentNote: '' });
    const ai = (await scale(chef, recipe.id, { servings: 8 })).json<ScaleRecipeResponse>();
    expect(ai.source).toBe('ai');
    expect(t.ai.gemini.calls[0]?.prompt).toContain('salt: cooks use about 0.5 times');
    expect(t.ai.gemini.calls[0]?.prompt).toContain('Notes from cooks who made it');
    expect(ai.ingredients[1]?.amount).toBe(4.8); // held to 1.2x of (8 x 0.5)
    // with the AI unusable, the learned ratios still give a better answer than plain multiplication
    t.ai.gemini.handler = () => 'not json';
    t.ai.deepseek.handler = () => '{}';
    t.ai.nebius.handler = () => '{}';
    const community = (await scale(chef, recipe.id, { servings: 7 })).json<ScaleRecipeResponse>();
    expect(community.source).toBe('community');
    expect(community.ingredients[1]?.amount).toBe(3.5); // 7 x 0.5
    expect(community.ingredients[0]?.amount).toBe(7); // flour: nothing learned, so straight-line
    expect(community.note).toContain('other cooks');
  });

  it('a new note makes the next answer fresh instead of remembered', async () => {
    const chef = await register(t);
    const recipe = await pancakes(chef);
    gemini({ ingredients: [{ i: 1, amount: 6 }], tips: ['One'], timeNote: '', equipmentNote: '' });
    await scale(chef, recipe.id, { servings: 12 });
    await scale(chef, recipe.id, { servings: 12 });
    expect(t.ai.gemini.calls).toHaveLength(1);
    await note(chef, recipe.id, tenNote(5));
    await scale(chef, recipe.id, { servings: 12 });
    expect(t.ai.gemini.calls).toHaveLength(2); // there is more to learn from now
  });

  it('refuses notes from a suspended person', async () => {
    const chef = await register(t);
    const recipe = await pancakes(chef);
    await t.db.user.update({ where: { id: chef.user.id }, data: { suspendedAt: new Date(), suspendedReason: 'test' } });
    const res = await note(chef, recipe.id, tenNote(5, { tip: 'Fine' }));
    expect([401, 403]).toContain(res.statusCode); // a suspended person cannot add notes
  });
});
