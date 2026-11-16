import { formatPrice, rateNutrient, rateNutrition } from '@/lib/nutrition';

describe('traffic-light ratings (UK, per 100 g)', () => {
  it('rates fat at the boundaries', () => {
    expect(rateNutrient('fat', 3).level).toBe('low');
    expect(rateNutrient('fat', 3.1).level).toBe('medium');
    expect(rateNutrient('fat', 17.5).level).toBe('medium');
    expect(rateNutrient('fat', 17.6).level).toBe('high');
  });
  it('rates saturates, sugars and salt', () => {
    expect(rateNutrient('saturates', 1.5).level).toBe('low');
    expect(rateNutrient('saturates', 5.1).level).toBe('high');
    expect(rateNutrient('sugars', 5).level).toBe('low');
    expect(rateNutrient('sugars', 22.6).level).toBe('high');
    expect(rateNutrient('salt', 0.3).level).toBe('low');
    expect(rateNutrient('salt', 1.5).level).toBe('medium');
    expect(rateNutrient('salt', 1.6).level).toBe('high');
  });
  it('returns word and tone', () => {
    expect(rateNutrient('salt', 2)).toEqual({ level: 'high', word: 'High', tone: 'red' });
    expect(rateNutrient('salt', 1)).toEqual({ level: 'medium', word: 'Medium', tone: 'amber' });
    expect(rateNutrient('salt', 0.1)).toEqual({ level: 'low', word: 'Low', tone: 'green' });
  });
  it('rates a whole dish like the design (smash burger)', () => {
    const r = rateNutrition({ fat: 18.5, saturates: 8.1, sugars: 4.2, salt: 1.6 });
    expect([r.fat.word, r.saturates.word, r.salt.word, r.sugars.word]).toEqual([
      'High',
      'High',
      'High',
      'Low',
    ]);
  });
  it('formats pence', () => {
    expect(formatPrice(950)).toBe('£9.50');
    expect(formatPrice(1149)).toBe('£11.49');
  });
});
