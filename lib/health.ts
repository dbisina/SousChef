import type {
  BloodPressureReading,
  DoctorReport,
  GlucoseReading,
  GlucoseStatus,
  GlucoseTiming,
  HealthReading,
  MealLog,
  MealResponse,
  ReportRange,
  SimilarMeals,
} from '@/types/health';

/** Numbers only. No advice text is produced anywhere in this module. */

/** Upper bound for readings taken after a meal (mmol/L). */
export const AFTER_MEAL_TARGET = 8.5;
/** Fasting / before-meal / bedtime range (mmol/L). */
export const FASTING_RANGE: readonly [number, number] = [4.0, 7.0];
/** General time-in-range band (mmol/L). */
export const TIME_IN_RANGE_BAND: readonly [number, number] = [3.9, 10.0];

export const RANGE_DAYS: Record<ReportRange, number> = { '2w': 14, '30d': 30, '90d': 90 };

const DAY_MS = 86_400_000;

export const round1 = (n: number): number => Math.round(n * 10) / 10;

export function isAfterMeal(timing: GlucoseTiming): boolean {
  return timing === '1h-after' || timing === '2h-after';
}

/** Status of one glucose value for its timing. After-meal target is under 8.5. */
export function glucoseStatus(mmol: number, timing: GlucoseTiming): GlucoseStatus {
  if (isAfterMeal(timing)) {
    if (mmol < FASTING_RANGE[0]) return 'low';
    return mmol < AFTER_MEAL_TARGET ? 'in-range' : 'high';
  }
  if (mmol < FASTING_RANGE[0]) return 'low';
  return mmol <= FASTING_RANGE[1] ? 'in-range' : 'high';
}

/** Rise after a meal in mmol/L, one decimal. */
export function mealRise(before: number, after: number): number {
  return round1(after - before);
}

export function formatRise(rise: number): string {
  return `${rise >= 0 ? '+' : '-'}${Math.abs(rise).toFixed(1)}`;
}

/** Percentage (integer) of values inside the band, inclusive. 0 when empty. */
export function timeInRange(
  values: number[],
  band: readonly [number, number] = TIME_IN_RANGE_BAND,
): number {
  if (values.length === 0) return 0;
  const inside = values.filter((v) => v >= band[0] && v <= band[1]).length;
  return Math.round((inside / values.length) * 100);
}

export function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export const isGlucose = (r: HealthReading): r is GlucoseReading => r.kind === 'glucose';
export const isBp = (r: HealthReading): r is BloodPressureReading => r.kind === 'bp';

export function readingsInRange(readings: HealthReading[], from: Date, to: Date): HealthReading[] {
  const a = from.getTime();
  const b = to.getTime();
  return readings.filter((r) => {
    const t = new Date(r.at).getTime();
    return t >= a && t <= b;
  });
}

export function isSameLocalDay(iso: string, day: Date): boolean {
  const d = new Date(iso);
  return (
    d.getFullYear() === day.getFullYear() &&
    d.getMonth() === day.getMonth() &&
    d.getDate() === day.getDate()
  );
}

/** Rise for a meal, from its linked before / after glucose readings. */
export function mealResponseFor(
  meal: MealLog,
  readings: HealthReading[],
  allMeals: MealLog[],
): MealResponse {
  const glucose = readings.filter(isGlucose).filter((r) => r.mealId === meal.id);
  const before = glucose.find((r) => r.timing === 'before-meal');
  const after =
    glucose.find((r) => r.timing === '2h-after') ?? glucose.find((r) => r.timing === '1h-after');
  const rise = before && after ? mealRise(before.mmol, after.mmol) : undefined;
  return { meal, before, after, rise, similar: similarMeals(meal, readings, allMeals) };
}

function riseOf(mealId: string, readings: HealthReading[]): number | undefined {
  const g = readings.filter(isGlucose).filter((r) => r.mealId === mealId);
  const b = g.find((r) => r.timing === 'before-meal');
  const a = g.find((r) => r.timing === '2h-after') ?? g.find((r) => r.timing === '1h-after');
  return b && a ? mealRise(b.mmol, a.mmol) : undefined;
}

/**
 * Average rise for other meals in the same group, plus one entry per
 * distinct portion variant ("With 1 cup of rice").
 */
export function similarMeals(
  meal: MealLog,
  readings: HealthReading[],
  allMeals: MealLog[],
): SimilarMeals[] {
  const same = allMeals.filter((m) => m.group === meal.group && m.id !== meal.id);
  const withRise = same
    .map((m) => ({ m, rise: riseOf(m.id, readings) }))
    .filter((x): x is { m: MealLog; rise: number } => x.rise != null);
  if (withRise.length === 0) return [];
  const out: SimilarMeals[] = [
    {
      label: meal.group,
      meals: withRise.length,
      avgRise: round1(average(withRise.map((x) => x.rise))),
    },
  ];
  const variants = new Map<string, number[]>();
  for (const { m, rise } of withRise) {
    if (!m.variant || m.variant === meal.variant) continue;
    variants.set(m.variant, [...(variants.get(m.variant) ?? []), rise]);
  }
  variants.forEach((rs, variant) => {
    out.push({ label: `With ${variant}`, meals: rs.length, avgRise: round1(average(rs)) });
  });
  return out;
}

export function highestRiseGroup(meals: MealLog[], readings: HealthReading[]): string | null {
  const byGroup = new Map<string, number[]>();
  for (const m of meals) {
    const r = riseOf(m.id, readings);
    if (r == null) continue;
    byGroup.set(m.group, [...(byGroup.get(m.group) ?? []), r]);
  }
  let best: string | null = null;
  let bestAvg = -Infinity;
  byGroup.forEach((rs, group) => {
    const avg = average(rs);
    if (avg > bestAvg) {
      bestAvg = avg;
      best = group;
    }
  });
  return best;
}

export function buildDoctorReport(
  range: ReportRange,
  readings: HealthReading[],
  meals: MealLog[],
  now: Date,
  condition = 'Type 2 diabetes',
): DoctorReport {
  const from = new Date(now.getTime() - RANGE_DAYS[range] * DAY_MS);
  const inRange = readingsInRange(readings, from, now);
  const glucose = inRange.filter(isGlucose);
  const bp = inRange.filter(isBp);
  const mealsIn = meals.filter((m) => {
    const t = new Date(m.at).getTime();
    return t >= from.getTime() && t <= now.getTime();
  });
  return {
    range,
    from: from.toISOString(),
    to: now.toISOString(),
    condition,
    avgGlucose: round1(average(glucose.map((r) => r.mmol))),
    timeInRangePct: timeInRange(glucose.map((r) => r.mmol)),
    avgBp:
      bp.length === 0
        ? null
        : {
            systolic: Math.round(average(bp.map((r) => r.systolic))),
            diastolic: Math.round(average(bp.map((r) => r.diastolic))),
          },
    glucoseReadings: glucose.length,
    mealsLogged: mealsIn.length,
    highestRiseGroup: highestRiseGroup(mealsIn, inRange),
  };
}
