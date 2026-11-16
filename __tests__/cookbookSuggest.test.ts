// "What can I cook from the cookbooks I own?" is worked out on the phone from the recipes on file: no AI, no invented names.
const mockGemini = jest.fn();
jest.mock('@/lib/gemini', () => ({ textModel: { generateContent: (...a: unknown[]) => mockGemini(...a) } }));
import { suggestRecipesFromCookbooks } from '@/services/cookbookLibraryService';
import type { PantryItem } from '@/types';

const pantry = (...names: string[]) => names.map((name) => ({ name, amount: 1, unit: 'piece' }) as unknown as PantryItem);
const books = [
  {
    title: 'Everyday Stir-Fries',
    recipes: [
      { name: 'Chicken and Broccoli', keyIngredients: ['chicken breast', 'broccoli', 'soy sauce'] },
      { name: 'Garlic Noodles', keyIngredients: ['noodles', 'garlic', 'butter'] },
      { name: 'Mystery Dish' }, // no ingredients on file: cannot be judged
    ],
  },
  { title: 'Sunday Roasts', recipes: [{ name: 'Roast Chicken', keyIngredients: ['whole chicken', 'lemon', 'thyme'] }] },
];

beforeEach(() => {
  mockGemini.mockReset();
  global.fetch = jest.fn(async () => ({ ok: false, status: 500, json: async () => ({}) })) as unknown as typeof fetch;
});

describe('suggestRecipesFromCookbooks', () => {
  it('ranks recipes on file by how much of them is in the pantry, without asking an AI', async () => {
    const out = await suggestRecipesFromCookbooks(books, pantry('chicken', 'broccoli', 'soy sauce', 'garlic'));
    expect(mockGemini).not.toHaveBeenCalled();
    expect(out.map((s) => s.recipeName)).toEqual(['Chicken and Broccoli', 'Garlic Noodles', 'Roast Chicken']);
    expect(out[0]).toMatchObject({ cookbookTitle: 'Everyday Stir-Fries', confidence: 1, missingIngredients: [], reason: 'You have every key ingredient.' });
    expect(out[0]?.matchingIngredients).toEqual(['chicken breast', 'broccoli', 'soy sauce']);
    expect(out[2]).toMatchObject({ cookbookTitle: 'Sunday Roasts', confidence: 0.33, missingIngredients: ['lemon', 'thyme'], reason: 'You have 1 of 3 key ingredients.' });
  });

  it('only ever names recipes that are on file, and leaves out ones with nothing in common', async () => {
    const out = await suggestRecipesFromCookbooks(books, pantry('milk', 'rice'));
    expect(out).toEqual([]);
    const some = await suggestRecipesFromCookbooks(books, pantry('butter'));
    expect(some.map((s) => s.recipeName)).toEqual(['Garlic Noodles']);
    expect(some.some((s) => s.recipeName === 'Mystery Dish')).toBe(false);
  });

  it('works with no cookbooks or an empty pantry, and keeps at most five', async () => {
    expect(await suggestRecipesFromCookbooks([], pantry('egg'))).toEqual([]);
    expect(await suggestRecipesFromCookbooks(books, [])).toEqual([]);
    const many = [{ title: 'Big', recipes: Array.from({ length: 9 }, (_, i) => ({ name: `Dish ${i}`, keyIngredients: ['egg', `thing${i}`] })) }];
    expect(await suggestRecipesFromCookbooks(many, pantry('egg'))).toHaveLength(5);
  });
});
