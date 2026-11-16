// The rules of Daily Dish, shared so the server enforces exactly what the app shows. Dates are "YYYY-MM-DD" in UTC.

export const MAX_CLUES = 6;
export const MAX_GUESSES = 6;
/** Puzzle #1 is played on this date; the number goes up by one each day. */
export const PUZZLE_EPOCH = '2026-01-06';

const DAY_MS = 86_400_000;

export const dateKeyOf = (d: Date): string => d.toISOString().slice(0, 10);

export const dayIndex = (key: string): number => {
  const [y, m, d] = key.split('-').map(Number) as [number, number, number];
  return Math.floor(Date.UTC(y, m - 1, d) / DAY_MS);
};

export const puzzleNumberFor = (key: string): number => dayIndex(key) - dayIndex(PUZZLE_EPOCH) + 1;

/** Lowercase, no accents or punctuation, single spaces: so "Jollof  Rice!" and "jollof rice" are the same guess. */
export const normalizeGuess = (s: string): string =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

export function isCorrectGuess(answer: string, aliases: string[], guess: string): boolean {
  const g = normalizeGuess(guess);
  if (!g) return false;
  return [answer, ...aliases].some((a) => normalizeGuess(a) === g);
}

/** 100 for a first-clue solve, minus 15 per extra clue and 5 per wrong guess. Never below 10; 0 if not solved. */
export function scoreSolve(input: { solved: boolean; cluesShown: number; guessCount: number }): number {
  if (!input.solved) return 0;
  const wrong = input.guessCount - 1;
  return Math.max(10, 100 - (input.cluesShown - 1) * 15 - wrong * 5);
}

export interface Streak {
  current: number;
  best: number;
  lastSolvedDate: string;
}

export const EMPTY_STREAK: Streak = { current: 0, best: 0, lastSolvedDate: '' };

/** The streak after finishing a game on `today`. A failed game resets it to 0; a second solve on the same day changes nothing. */
export function updateStreak(streak: Streak, today: string, solved: boolean): Streak {
  if (!solved) return { ...streak, current: 0 };
  if (streak.lastSolvedDate === today) return streak;
  const consecutive = streak.lastSolvedDate !== '' && dayIndex(today) - dayIndex(streak.lastSolvedDate) === 1;
  const current = consecutive ? streak.current + 1 : 1;
  return { current, best: Math.max(streak.best, current), lastSolvedDate: today };
}

/** The streak to show: it lapses once a whole day has been missed. */
export function activeStreak(streak: Streak, today: string): number {
  if (streak.lastSolvedDate === '') return 0;
  return dayIndex(today) - dayIndex(streak.lastSolvedDate) <= 1 ? streak.current : 0;
}
