// Writing a recipe the easy way: plain-text ingredients, a pasted method, and a draft that survives leaving the screen.
const mockStore = new Map<string, string>();
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: async (k: string) => mockStore.get(k) ?? null,
    setItem: async (k: string, v: string) => void mockStore.set(k, v),
    removeItem: async (k: string) => void mockStore.delete(k),
  },
}));

import { formatIngredientLine, parseIngredientLine, parseIngredientLines } from '@/lib/ingredientLines';
import { splitSteps } from '@/lib/stepSplit';
import { clearDraft, emptyDraft, hasContent, loadDraft, saveDraft } from '@/lib/recipeDraft';

describe('ingredient lines', () => {
  it.each([
    ['2 cups flour', { name: 'flour', amount: 2, unit: 'cup' }],
    ['1 1/2 tbsp olive oil', { name: 'olive oil', amount: 1.5, unit: 'tbsp' }],
    ['½ tsp salt', { name: 'salt', amount: 0.5, unit: 'tsp' }],
    ['1½ cups milk', { name: 'milk', amount: 1.5, unit: 'cup' }],
    ['3/4 cup sugar', { name: 'sugar', amount: 0.75, unit: 'cup' }],
    ['500g chicken thighs', { name: 'chicken thighs', amount: 500, unit: 'g' }],
    ['2 cups of rice', { name: 'rice', amount: 2, unit: 'cup' }],
    ['3 eggs', { name: 'eggs', amount: 3, unit: '' }],
    ['2-3 cloves garlic', { name: 'garlic', amount: 2, unit: 'clove' }],
    ['pinch of salt', { name: 'salt', amount: 1, unit: 'pinch' }],
    ['salt to taste', { name: 'salt to taste', amount: 0, unit: '' }],
    ['- 2 tablespoons butter', { name: 'butter', amount: 2, unit: 'tbsp' }],
    ['1. 4 tomatoes', { name: 'tomatoes', amount: 4, unit: '' }],
  ])('reads "%s"', (line, expected) => {
    expect(parseIngredientLine(line)).toMatchObject(expected);
  });

  it('keeps words that start like a unit as words, and notices "optional"', () => {
    expect(parseIngredientLine('garlic powder')).toMatchObject({ name: 'garlic powder', amount: 0, unit: '' });
    expect(parseIngredientLine('lemon juice')).toMatchObject({ name: 'lemon juice', unit: '' });
    expect(parseIngredientLine('1 tsp chilli flakes (optional)')).toMatchObject({ name: 'chilli flakes', optional: true });
  });

  it('skips empty lines and headings, and reads a whole pasted list', () => {
    const list = parseIngredientLines('Ingredients:\n\n2 cups flour\n1 tsp salt; 3 eggs\n');
    expect(list.map((i) => i.name)).toEqual(['flour', 'salt', 'eggs']);
  });

  it('writes an ingredient back as one line', () => {
    expect(formatIngredientLine({ name: 'flour', amount: 2, unit: 'cup', optional: false })).toBe('2 cup flour');
    expect(formatIngredientLine({ name: 'salt to taste', amount: 0, unit: '', optional: false })).toBe('salt to taste');
    expect(formatIngredientLine({ name: 'chilli', amount: 1, unit: 'tsp', optional: true })).toBe('1 tsp chilli (optional)');
  });
});

describe('splitting a method into steps', () => {
  it('splits numbered steps', () => {
    expect(splitSteps('1. Chop the onions.\n2) Fry them.\nStep 3: Add the rice.')).toEqual(['Chop the onions.', 'Fry them.', 'Add the rice.']);
  });
  it('splits on blank lines, then lines', () => {
    expect(splitSteps('Mix it all.\n\nBake for 20 minutes.')).toEqual(['Mix it all.', 'Bake for 20 minutes.']);
    expect(splitSteps('Mix it all\nBake for 20 minutes')).toEqual(['Mix it all', 'Bake for 20 minutes']);
  });
  it('splits one block of dictated text by sentence, without breaking amounts', () => {
    const steps = splitSteps('Blend the beans with 1.5 cups of water. Add the pepper and mix well. Steam for one hour.');
    expect(steps).toEqual(['Blend the beans with 1.5 cups of water.', 'Add the pepper and mix well.', 'Steam for one hour.']);
  });
  it('returns nothing for nothing', () => {
    expect(splitSteps('  \n ')).toEqual([]);
  });
});

describe('the recipe draft', () => {
  beforeEach(() => mockStore.clear());

  it('is saved per person, comes back, and is cleared', async () => {
    expect(await loadDraft('u1')).toBeNull();
    await saveDraft('u1', { ...emptyDraft(), title: 'Jollof', ingredientsText: '2 cups rice', step: 1 });
    expect(await loadDraft('u2')).toBeNull();
    expect(await loadDraft('u1')).toMatchObject({ title: 'Jollof', ingredientsText: '2 cups rice', step: 1 });
    await clearDraft('u1');
    expect(await loadDraft('u1')).toBeNull();
  });

  it('does not keep or offer a draft with nothing typed', async () => {
    expect(hasContent(emptyDraft())).toBe(false);
    await saveDraft('u1', { ...emptyDraft(), title: 'x' });
    await saveDraft('u1', emptyDraft());
    expect(await loadDraft('u1')).toBeNull();
  });

  it('starts fresh when the saved text is damaged', async () => {
    mockStore.set('enplace.recipeDraft.v1.u1', '{not json');
    expect(await loadDraft('u1')).toBeNull();
  });
});
