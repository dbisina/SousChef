// Meal-plan weeks run Monday to Sunday and are named by their Monday, as YYYY-MM-DD. Everything here works in UTC
// calendar days, so the answer never depends on which machine runs it.

const DAY_MS = 86_400_000;

export const isoDay = (d: Date): string => d.toISOString().slice(0, 10);

/** True for a real calendar date written YYYY-MM-DD ("2026-02-30" is not). */
export const isIsoDay = (value: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(d.getTime()) && isoDay(d) === value;
};

/** The Monday of the week that contains this moment. */
export const weekStartOf = (d: Date): string => {
  const midnight = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const sinceMonday = (d.getUTCDay() + 6) % 7; // Monday = 0 ... Sunday = 6
  return isoDay(new Date(midnight - sinceMonday * DAY_MS));
};

export const isMonday = (value: string): boolean => isIsoDay(value) && new Date(`${value}T00:00:00.000Z`).getUTCDay() === 1;

/** The seven dates of a week, Monday first. */
export const weekDates = (weekStart: string): string[] => {
  const start = Date.parse(`${weekStart}T00:00:00.000Z`);
  return Array.from({ length: 7 }, (_, i) => isoDay(new Date(start + i * DAY_MS)));
};
