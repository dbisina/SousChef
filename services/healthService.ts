import { buildSampleHealth } from '@/data/sample/health';
import type {
  GlucoseTiming,
  HealthReading,
  MealLog,
  MealType,
  ReadingSource,
} from '@/types/health';
import type { MenuDish } from '@/types/order';
import { rateNutrition } from '@/lib/nutrition';

export type NewReadingInput =
  | { kind: 'glucose'; mmol: number; timing: GlucoseTiming; mealId?: string; at?: Date }
  | { kind: 'bp'; systolic: number; diastolic: number; at?: Date }
  | { kind: 'cholesterol'; ldl: number; at?: Date };

/** Health data source. Numbers only: no advice text, no AI calls. */
export interface HealthService {
  seedSample(now?: Date): { readings: HealthReading[]; meals: MealLog[] };
  buildReading(input: NewReadingInput, source?: ReadingSource): HealthReading;
  mealFromDish(dish: MenuDish, orderId: string, now?: Date): MealLog;
}

let counter = 0;
const uid = (p: string) => `${p}-${Date.now().toString(36)}-${(counter++).toString(36)}`;

export function mealTypeFor(date: Date): MealType {
  const h = date.getHours();
  if (h < 11) return 'Breakfast';
  if (h < 16) return 'Lunch';
  if (h < 22) return 'Dinner';
  return 'Snack';
}

export const localHealthService: HealthService = {
  seedSample: (now) => buildSampleHealth(now),
  buildReading(input, source = 'manual') {
    const at = (input.at ?? new Date()).toISOString();
    const base = { id: uid('r'), at, source };
    if (input.kind === 'glucose') {
      return { ...base, kind: 'glucose', mmol: input.mmol, timing: input.timing, mealId: input.mealId };
    }
    if (input.kind === 'bp') {
      return { ...base, kind: 'bp', systolic: input.systolic, diastolic: input.diastolic };
    }
    return { ...base, kind: 'cholesterol', ldl: input.ldl };
  },
  mealFromDish(dish, orderId, now = new Date()) {
    return {
      id: uid('meal'),
      title: dish.name,
      mealType: mealTypeFor(now),
      at: now.toISOString(),
      carbsG: dish.carbsG,
      portionLabel: `${dish.portionG} g`,
      group: dish.category,
      ratings: rateNutrition(dish.per100g),
      fromOrderId: orderId,
    };
  },
};

export const healthService: HealthService = localHealthService;
