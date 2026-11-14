const MIN = 60_000;

/** ISO timestamp `minutes` before now. */
export const minutesAgo = (minutes: number, now: Date = new Date()): string =>
  new Date(now.getTime() - minutes * MIN).toISOString();

/** ISO timestamp for today at hh:mm local time. */
export const todayAt = (hour: number, minute = 0, now: Date = new Date()): string => {
  const d = new Date(now);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
};

/** ISO timestamp for `daysBack` days ago at hh:mm local time. */
export const daysAgoAt = (daysBack: number, hour: number, minute = 0, now: Date = new Date()): string => {
  const d = new Date(now);
  d.setDate(d.getDate() - daysBack);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
};
