// The plate scanner with the server on: the server reads the photo, and the screen gets calories and nutrition.
const mockPlate = jest.fn();
jest.mock('@/lib/api', () => ({ apiEnabled: () => true }));
jest.mock('@/lib/gemini', () => ({ analyzePortionFromImage: jest.fn(() => { throw new Error('no AI key on the phone'); }) }));
jest.mock('@/services/pantryService', () => ({ getPantryItemNames: jest.fn() }));
jest.mock('@/services/aiToolsApi', () => ({ apiPlateNutrition: (...a: unknown[]) => mockPlate(...a), apiAnalyzeRecipe: jest.fn(), apiSubstitutions: jest.fn() }));

import { analyzePortionImage } from '@/services/aiService';

const facts = (calories: number, p: number, c: number, f: number) => ({ calories, proteinG: p, carbsG: c, fatG: f, fiberG: 2, sugarG: 3, sodiumMg: 400 });

it('shows each food with calories and macros, and the totals and the "estimates" note from the server', async () => {
  mockPlate.mockResolvedValue({
    items: [
      { name: 'Jollof rice', estimatedAmount: 1.5, unit: 'cup', confidence: 0.8, ...facts(320, 6, 58, 7) },
      { name: 'Grilled chicken', estimatedAmount: 150, unit: 'g', confidence: 0.9, ...facts(250, 38, 0, 10) },
    ],
    total: facts(570, 44, 58, 17),
    suggestedServings: 1,
    recommendations: ['Add some greens.'],
    note: 'These are estimates from a photo.',
  });
  const out = await analyzePortionImage('file:///plate.jpg', undefined, ['plantain']);
  expect(mockPlate).toHaveBeenCalledWith('file:///plate.jpg', ['plantain']);
  expect(out.totalEstimatedCalories).toBe(570);
  expect(out.totalNutrition).toEqual({ proteinG: 44, carbsG: 58, fatG: 17, fiberG: 2, sugarG: 3, sodiumMg: 400 });
  expect(out.detectedItems[1]).toMatchObject({ name: 'Grilled chicken', estimatedCalories: 250, confidence: 0.9, nutrition: { proteinG: 38, carbsG: 0, fatG: 10 } });
  expect(out.recommendations).toEqual(['Add some greens.']);
  expect(out.note).toContain('estimates');
});

it('never falls back to an AI key on the phone when the server fails', async () => {
  mockPlate.mockRejectedValue(new Error('limit reached'));
  await expect(analyzePortionImage('file:///plate.jpg')).rejects.toThrow('limit reached');
});
