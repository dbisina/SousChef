import {
  AFTER_MEAL_TARGET,
  buildDoctorReport,
  formatRise,
  glucoseStatus,
  mealResponseFor,
  mealRise,
  timeInRange,
} from '@/lib/health';
import type { HealthReading, MealLog } from '@/types/health';

describe('glucose helpers', () => {
  it('after-meal target is under 8.5', () => {
    expect(AFTER_MEAL_TARGET).toBe(8.5);
    expect(glucoseStatus(8.4, '2h-after')).toBe('in-range');
    expect(glucoseStatus(8.5, '2h-after')).toBe('high');
    expect(glucoseStatus(8.9, '1h-after')).toBe('high');
    expect(glucoseStatus(3.5, '2h-after')).toBe('low');
  });
  it('fasting range is 4.0 to 7.0', () => {
    expect(glucoseStatus(5.4, 'fasting')).toBe('in-range');
    expect(glucoseStatus(7.1, 'fasting')).toBe('high');
    expect(glucoseStatus(3.8, 'before-meal')).toBe('low');
  });
  it('meal rise is one decimal', () => {
    expect(mealRise(5.6, 8.9)).toBe(3.3);
    expect(formatRise(3.3)).toBe('+3.3');
    expect(formatRise(-0.4)).toBe('-0.4');
  });
  it('time in range', () => {
    expect(timeInRange([])).toBe(0);
    expect(timeInRange([5, 6, 11, 3])).toBe(50);
    expect(timeInRange([3.9, 10])).toBe(100);
  });
});

describe('meal response and the doctor report', () => {
  const now = new Date(2026, 10, 13, 16, 0, 0);
  const at = (daysBack: number, hour: number) => new Date(2026, 10, 13 - daysBack, hour, 0, 0).toISOString();
  const meal = (id: string, daysBack: number, variant?: string): MealLog => ({ id, title: 'Rice bowl', mealType: 'Lunch', at: at(daysBack, 12), carbsG: 60, portionLabel: '1 bowl', group: 'Rice bowls', ...(variant ? { variant } : {}) });
  const glucose = (id: string, mealId: string, daysBack: number, hour: number, timing: 'before-meal' | '2h-after', mmol: number): HealthReading => ({ id, kind: 'glucose', at: at(daysBack, hour), source: 'manual', mealId, timing, mmol });
  const meals = [meal('m1', 0), meal('m2', 1), meal('m3', 2, '1 cup of rice')];
  const readings: HealthReading[] = [
    glucose('g1', 'm1', 0, 11, 'before-meal', 5.6),
    glucose('g2', 'm1', 0, 14, '2h-after', 8.9),
    glucose('g3', 'm2', 1, 11, 'before-meal', 5.5),
    glucose('g4', 'm2', 1, 14, '2h-after', 8.0),
    glucose('g5', 'm3', 2, 11, 'before-meal', 5.4),
    glucose('g6', 'm3', 2, 14, '2h-after', 9.4),
    { id: 'bp1', kind: 'bp', at: at(1, 9), source: 'manual', systolic: 128, diastolic: 82 },
  ];

  it('works out the rise for a meal and compares it with similar meals', () => {
    const r = mealResponseFor(meals[0]!, readings, meals);
    expect(r.before?.mmol).toBe(5.6);
    expect(r.after?.mmol).toBe(8.9);
    expect(r.rise).toBe(3.3);
    expect(r.similar[0]?.label).toBe('Rice bowls');
    expect(r.similar.some((x) => x.label === 'With 1 cup of rice')).toBe(true);
  });

  it('builds a doctor report with numbers only', () => {
    const rep = buildDoctorReport('30d', readings, meals, now);
    expect(rep.glucoseReadings).toBe(6);
    expect(rep.timeInRangePct).toBeGreaterThanOrEqual(0);
    expect(rep.timeInRangePct).toBeLessThanOrEqual(100);
    expect(rep.avgBp).not.toBeNull();
    expect(rep.highestRiseGroup).toBe('Rice bowls');
  });

  it('is empty, not invented, when nothing has been logged', () => {
    const rep = buildDoctorReport('30d', [], [], now);
    expect(rep.glucoseReadings).toBe(0);
    expect(rep.avgBp).toBeNull();
  });
});
