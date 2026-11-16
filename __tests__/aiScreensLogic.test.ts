// The small pieces the AI screens rely on: friendly error text, shop-order sorting, and the on-phone scaling.
jest.mock('expo-secure-store', () => ({ getItemAsync: async () => null, setItemAsync: async () => undefined, deleteItemAsync: async () => undefined }));
import { AISLE_LABEL, scaleRecipe, sortByAisle } from '../shared/index';
import { ApiError } from '@/lib/api';
import { aiErrorText } from '@/lib/aiError';

describe('aiErrorText', () => {
  it('turns server codes into one plain sentence', () => {
    expect(aiErrorText(new ApiError(409, 'limit_reached', 'raw'))).toContain('allowance');
    expect(aiErrorText(new ApiError(0, 'network', 'raw'))).toContain('connection');
    expect(aiErrorText(new ApiError(503, 'unavailable' as never, 'raw'))).toContain('busy or switched off');
    expect(aiErrorText(new ApiError(409, 'conflict' as never, 'Log a few readings first'))).toBe('Log a few readings first');
    expect(aiErrorText(new Error('boom'), 'Plain fallback')).toBe('Plain fallback');
  });
});

describe('shop order', () => {
  it('walks produce first and drinks last, keeping names alphabetical inside an aisle', () => {
    const items = [
      { name: 'cola', category: 'beverages' as const },
      { name: 'rice', category: 'grains' as const },
      { name: 'tomato', category: 'produce' as const },
      { name: 'apple', category: 'produce' as const },
    ];
    expect(sortByAisle(items).map((i) => i.name)).toEqual(['apple', 'tomato', 'rice', 'cola']);
    expect(AISLE_LABEL.produce).toBe('Fruit and vegetables');
  });
});

describe('scaling on the phone', () => {
  it('multiplies, converts units and oven temperature, and says steps are not rewritten', () => {
    const out = scaleRecipe({ servings: 2, ingredients: [{ name: 'flour', amount: 1, unit: 'cup' }], instructions: ['Bake at 350°F.'] }, { servings: 3, units: 'metric', temp: 'c' });
    expect(out.ingredients[0]).toMatchObject({ amount: 355, unit: 'ml' });
    expect(out.instructions[0]).toBe('Bake at 175°C.');
    expect(out.note).toContain('not changed');
  });
});
