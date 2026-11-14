import {
  AFTER_MEAL_TARGET,
  buildDoctorReport,
  formatRise,
  glucoseStatus,
  mealResponseFor,
  mealRise,
  timeInRange,
} from '@/lib/health';
import { buildSampleHealth } from '@/data/sample/health';

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

describe('sample health data', () => {
  const now = new Date(2026, 10, 13, 16, 0, 0);
  const { readings, meals } = buildSampleHealth(now);

  it('reproduces the lunch response from the design', () => {
    const lunch = meals.find((m) => m.id === 'meal-today-l')!;
    const r = mealResponseFor(lunch, readings, meals);
    expect(r.before?.mmol).toBe(5.6);
    expect(r.after?.mmol).toBe(8.9);
    expect(r.rise).toBe(3.3);
    expect(r.similar[0].label).toBe('Rice bowls');
    expect(r.similar.some((s) => s.label === 'With 1 cup of rice')).toBe(true);
  });
  it('builds a doctor report with numbers only', () => {
    const rep = buildDoctorReport('30d', readings, meals, now);
    expect(rep.glucoseReadings).toBeGreaterThan(50);
    expect(rep.timeInRangePct).toBeGreaterThanOrEqual(0);
    expect(rep.timeInRangePct).toBeLessThanOrEqual(100);
    expect(rep.avgBp).not.toBeNull();
    expect(rep.highestRiseGroup).toBe('Rice bowls');
  });
});
