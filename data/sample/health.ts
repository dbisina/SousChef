import type { GlucoseTiming, HealthReading, MealLog } from '@/types/health';
import { rateNutrition } from '@/lib/nutrition';
import { daysAgoAt, todayAt } from './util';

/** Deterministic PRNG so sample history is stable between launches. */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const r1 = (n: number) => Math.round(n * 10) / 10;

export interface SampleHealth {
  readings: HealthReading[];
  meals: MealLog[];
}

/** Sample health history relative to `now`: today (design values) plus 90 days of history. */
export function buildSampleHealth(now: Date = new Date()): SampleHealth {
  const readings: HealthReading[] = [];
  const meals: MealLog[] = [];

  const glucose = (id: string, at: string, mmol: number, timing: GlucoseTiming, mealId?: string) =>
    readings.push({ id, kind: 'glucose', at, mmol, timing, mealId, source: 'sample' });

  // Today (matches HealthHome / MealResponse designs).
  glucose('s-today-fast', todayAt(7, 0, now), 5.4, 'fasting');
  meals.push({
    id: 'meal-today-b',
    title: 'Egg on toast',
    mealType: 'Breakfast',
    at: todayAt(7, 30, now),
    carbsG: 28,
    portionLabel: '2 slices',
    group: 'Toast and eggs',
    ratings: rateNutrition({ fat: 8, saturates: 2.4, sugars: 3, salt: 0.7 }),
    sample: true,
  });
  glucose('s-today-b1', todayAt(7, 25, now), 5.9, 'before-meal', 'meal-today-b');
  glucose('s-today-b2', todayAt(9, 30, now), 7.1, '2h-after', 'meal-today-b');
  meals.push({
    id: 'meal-today-l',
    title: 'Chicken rice bowl',
    mealType: 'Lunch',
    at: todayAt(13, 5, now),
    carbsG: 62,
    portionLabel: '1.5 cups rice',
    group: 'Rice bowls',
    variant: '1.5 cups of rice',
    ratings: rateNutrition({ fat: 7.1, saturates: 1.8, sugars: 1.2, salt: 1.7 }),
    sample: true,
  });
  glucose('s-today-l1', todayAt(12, 50, now), 5.6, 'before-meal', 'meal-today-l');
  glucose('s-today-l2', todayAt(15, 5, now), 8.9, '2h-after', 'meal-today-l');
  readings.push({ id: 's-today-bp', kind: 'bp', at: todayAt(7, 30, now), systolic: 128, diastolic: 82, source: 'sample' });
  readings.push({ id: 's-ldl', kind: 'cholesterol', at: daysAgoAt(14, 9, 0, now), ldl: 3.1, source: 'sample' });

  // History: 90 days.
  const rand = mulberry32(312);
  for (let d = 1; d <= 90; d++) {
    glucose(`s-d${d}-fast`, daysAgoAt(d, 7, 0, now), r1(4.8 + rand() * 1.8), 'fasting');
    if (d % 3 === 0) {
      readings.push({
        id: `s-d${d}-bp`,
        kind: 'bp',
        at: daysAgoAt(d, 7, 30, now),
        systolic: Math.round(120 + rand() * 12),
        diastolic: Math.round(76 + rand() * 8),
        source: 'sample',
      });
    }
    // Lunch: rice bowl on odd days with 1 cup of rice on every 4th, otherwise a salad.
    const rice = d % 2 === 1;
    const oneCup = rice && d % 4 === 1;
    const lunchId = `meal-d${d}-l`;
    meals.push({
      id: lunchId,
      title: rice ? 'Rice bowl' : 'Chicken salad',
      mealType: 'Lunch',
      at: daysAgoAt(d, 13, 0, now),
      carbsG: rice ? (oneCup ? 45 : 62) : 18,
      portionLabel: rice ? (oneCup ? '1 cup rice' : '1.5 cups rice') : '1 bowl',
      group: rice ? 'Rice bowls' : 'Salads',
      variant: rice ? (oneCup ? '1 cup of rice' : '1.5 cups of rice') : undefined,
      sample: true,
    });
    const before = r1(5.2 + rand() * 0.9);
    const rise = rice ? (oneCup ? 1.4 + rand() * 0.8 : 2.6 + rand() * 1.0) : 0.6 + rand() * 0.6;
    glucose(`s-d${d}-lb`, daysAgoAt(d, 12, 45, now), before, 'before-meal', lunchId);
    glucose(`s-d${d}-la`, daysAgoAt(d, 15, 0, now), r1(before + rise), '2h-after', lunchId);
    // Dinner every second day.
    if (d % 2 === 0) {
      const dinnerId = `meal-d${d}-d`;
      meals.push({
        id: dinnerId,
        title: 'Jollof rice and chicken',
        mealType: 'Dinner',
        at: daysAgoAt(d, 19, 0, now),
        carbsG: 70,
        portionLabel: '1 plate',
        group: 'Rice bowls',
        variant: '1.5 cups of rice',
        sample: true,
      });
      const b = r1(5.4 + rand() * 0.8);
      glucose(`s-d${d}-db`, daysAgoAt(d, 18, 45, now), b, 'before-meal', dinnerId);
      glucose(`s-d${d}-da`, daysAgoAt(d, 21, 0, now), r1(b + 2.8 + rand() * 1.2), '2h-after', dinnerId);
    }
  }
  return { readings, meals };
}
