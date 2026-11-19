import { buildScanShareText } from '@/lib/shareScan';
import type { PortionAnalysis } from '@/types';

const item = (name: string) => ({ name, estimatedAmount: 100, unit: 'g', confidence: 0.9, estimatedCalories: 100 });

const base: PortionAnalysis = {
  detectedItems: [item('Jollof rice'), item('Fried plantain')],
  suggestedServings: 1,
  totalEstimatedCalories: 612.4,
  recommendations: [],
  totalNutrition: { proteinG: 24.2, carbsG: 80.6, fatG: 20.1, fiberG: 5, sugarG: 6, sodiumMg: 800 },
};

describe('buildScanShareText', () => {
  it('lists calories, macros and items', () => {
    const text = buildScanShareText(base);
    expect(text).toContain('about 612 kcal');
    expect(text).toContain('Protein 24 g · Carbs 81 g · Fat 20 g');
    expect(text).toContain('On the plate: Jollof rice, Fried plantain');
    expect(text).toContain('not medical advice');
  });

  it('mentions servings only when there is more than one', () => {
    expect(buildScanShareText(base)).not.toContain('servings');
    expect(buildScanShareText({ ...base, suggestedServings: 2 })).toContain('(2 servings)');
  });

  it('caps the item list and counts the rest', () => {
    const many = { ...base, detectedItems: ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map(item) };
    expect(buildScanShareText(many)).toContain('a, b, c, d, e and 2 more');
  });

  it('works without macros or items', () => {
    const text = buildScanShareText({ ...base, totalNutrition: undefined, detectedItems: [] });
    expect(text).not.toContain('Protein');
    expect(text).not.toContain('On the plate');
    expect(text).toContain('about 612 kcal');
  });
});
