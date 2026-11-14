import { SAMPLE } from '@/assets/sample';
import type { PhotoSource } from '@/components/ui';
import { average, isGlucose, isSameLocalDay, round1 } from '@/lib/health';
import type { GlucoseReading, GlucoseStatus, GlucoseTiming, HealthPeriod, HealthReading, MealLog } from '@/types/health';

const DAY_MS = 86_400_000;

export const TIMING_OPTIONS: { value: GlucoseTiming; label: string; short: string }[] = [
  { value: 'fasting', label: 'Fasting', short: 'Fasting' },
  { value: 'before-meal', label: 'Before meal', short: 'Before meal' },
  { value: '1h-after', label: '1 h after', short: '1 h after' },
  { value: '2h-after', label: '2 h after', short: '2 h after' },
  { value: 'bedtime', label: 'Bedtime', short: 'Bedtime' },
];

export const STATUS_WORD: Record<GlucoseStatus, string> = {
  low: 'Low',
  'in-range': 'In range',
  high: 'High',
};

export const timeText = (iso: string): string =>
  new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

export const hourText = (d: Date): string =>
  d.toLocaleTimeString([], { hour: 'numeric' }).replace(/\s/g, '').toLowerCase();

export const dayText = (iso: string, now: Date = new Date()): string => {
  const d = new Date(iso);
  if (isSameLocalDay(iso, now)) return 'Today';
  if (isSameLocalDay(iso, new Date(now.getTime() - DAY_MS))) return 'Yesterday';
  return d.toLocaleDateString([], { day: 'numeric', month: 'short' });
};

/** "This morning", "Today", "3 days ago", "2 weeks ago". */
export function agoText(iso: string, now: Date = new Date()): string {
  if (isSameLocalDay(iso, now)) return new Date(iso).getHours() < 12 ? 'This morning' : 'Today';
  const days = Math.max(1, Math.round((now.getTime() - new Date(iso).getTime()) / DAY_MS));
  if (days === 1) return 'Yesterday';
  if (days < 14) return `${days} days ago`;
  return `${Math.round(days / 7)} weeks ago`;
}

/** Sample photo for a logged meal (title keywords, then meal type). */
export function healthMealPhoto(meal: Pick<MealLog, 'title' | 'mealType' | 'group'>): PhotoSource {
  const k = `${meal.title} ${meal.group}`.toLowerCase();
  if (/rice|bowl/.test(k)) return SAMPLE.ricebowl as PhotoSource;
  if (/toast|egg/.test(k)) return SAMPLE.toast as PhotoSource;
  if (/salad/.test(k)) return SAMPLE.salad as PhotoSource;
  if (/pasta|noodle/.test(k)) return SAMPLE.pasta as PhotoSource;
  if (/burger/.test(k)) return SAMPLE.burger as PhotoSource;
  if (/taco/.test(k)) return SAMPLE.tacos as PhotoSource;
  const byType = { Breakfast: SAMPLE.toast, Lunch: SAMPLE.bowl, Dinner: SAMPLE.salmon, Snack: SAMPLE.brownie };
  return byType[meal.mealType] as PhotoSource;
}

export const GLUCOSE_CHART_MAX = 12;

export interface ChartBar {
  value: number;
  label: string;
}

/** Bars (mmol/L) for the glucose chart of the chosen period. */
export function glucoseBars(readings: HealthReading[], period: HealthPeriod, now: Date): ChartBar[] {
  const glucose = readings.filter(isGlucose);
  if (period === 'today') {
    return glucose
      .filter((r) => isSameLocalDay(r.at, now))
      .sort((a, b) => a.at.localeCompare(b.at))
      .slice(-6)
      .map((r) => ({ value: r.mmol, label: hourText(new Date(r.at)) }));
  }
  const days = period === 'week' ? 7 : 30;
  const step = period === 'week' ? 1 : 3;
  const out: ChartBar[] = [];
  for (let end = days; end > 0; end -= step) {
    const from = now.getTime() - end * DAY_MS;
    const to = now.getTime() - (end - step) * DAY_MS;
    const vals = glucose.filter((r) => {
      const t = new Date(r.at).getTime();
      return t > from && t <= to;
    });
    if (vals.length > 0) {
      out.push({
        value: round1(average(vals.map((r) => r.mmol))),
        label: new Date(to).toLocaleDateString([], { day: 'numeric', month: 'short' }),
      });
    }
  }
  return out;
}

export function describeGlucose(r: GlucoseReading, meals: MealLog[]): string {
  const meal = r.mealId ? meals.find((m) => m.id === r.mealId) : undefined;
  const opt = TIMING_OPTIONS.find((o) => o.value === r.timing)?.short ?? r.timing;
  return meal && (r.timing === '1h-after' || r.timing === '2h-after')
    ? `${opt} ${meal.mealType.toLowerCase()}`
    : opt;
}
