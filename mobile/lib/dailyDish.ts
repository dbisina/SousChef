import type {
  DailyDishPuzzle,
  DailyDishState,
  DailyDishStreak,
} from '@/types/play';

export const MAX_CLUES = 6;
export const MAX_GUESSES = 6;
/** Puzzle #1 date; puzzle number increments daily. */
export const PUZZLE_EPOCH = '2026-01-06';

const DAY_MS = 86_400_000;

export const toDateKey = (d: Date): string => {
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const dayIndex = (key: string): number => {
  const [y, m, d] = key.split('-').map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / DAY_MS);
};

export function puzzleNumberFor(date: Date): number {
  return dayIndex(toDateKey(date)) - dayIndex(PUZZLE_EPOCH) + 1;
}

export function puzzleForNumber(number: number, puzzles: DailyDishPuzzle[]): DailyDishPuzzle {
  const i = ((number - 1) % puzzles.length + puzzles.length) % puzzles.length;
  return puzzles[i];
}

export function newGame(puzzleNumber: number): DailyDishState {
  return { puzzleNumber, cluesShown: 1, guesses: [], status: 'playing' };
}

export const normalizeGuess = (s: string): string =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

/** Clues revealed so far, padded with null for the hidden slots (shown as "?"). */
export function clueSlots(puzzle: DailyDishPuzzle, state: DailyDishState): (string | null)[] {
  return Array.from({ length: MAX_CLUES }, (_, i) =>
    i < state.cluesShown && i < puzzle.clues.length ? puzzle.clues[i] : null,
  );
}

export function nextClue(state: DailyDishState): DailyDishState {
  if (state.status !== 'playing' || state.cluesShown >= MAX_CLUES) return state;
  return { ...state, cluesShown: state.cluesShown + 1 };
}

export function isCorrect(puzzle: DailyDishPuzzle, guess: string): boolean {
  const g = normalizeGuess(guess);
  if (!g) return false;
  return [puzzle.answer, ...puzzle.aliases].some((a) => normalizeGuess(a) === g);
}

export function submitGuess(
  puzzle: DailyDishPuzzle,
  state: DailyDishState,
  guess: string,
): DailyDishState {
  if (state.status !== 'playing' || !normalizeGuess(guess)) return state;
  const guesses = [...state.guesses, guess.trim()];
  if (isCorrect(puzzle, guess)) return { ...state, guesses, status: 'solved' };
  if (guesses.length >= MAX_GUESSES) return { ...state, guesses, status: 'failed' };
  return { ...state, guesses };
}

/** 100 for a first-clue solve, minus 15 per extra clue and 5 per wrong guess. Min 10. */
export function scoreSolve(state: DailyDishState): number {
  if (state.status !== 'solved') return 0;
  const wrong = state.guesses.length - 1;
  return Math.max(10, 100 - (state.cluesShown - 1) * 15 - wrong * 5);
}

export const EMPTY_STREAK: DailyDishStreak = { current: 0, best: 0, lastSolvedDate: '' };

/** Streak after finishing a game today. A failed game resets the streak to 0. */
export function updateStreak(
  streak: DailyDishStreak,
  today: string,
  solved: boolean,
): DailyDishStreak {
  if (!solved) return { ...streak, current: 0 };
  if (streak.lastSolvedDate === today) return streak;
  const consecutive =
    streak.lastSolvedDate !== '' && dayIndex(today) - dayIndex(streak.lastSolvedDate) === 1;
  const current = consecutive ? streak.current + 1 : 1;
  return { current, best: Math.max(streak.best, current), lastSolvedDate: today };
}

/** Streak value to display: it lapses when a full day was missed. */
export function activeStreak(streak: DailyDishStreak, today: string): number {
  if (streak.lastSolvedDate === '') return 0;
  const gap = dayIndex(today) - dayIndex(streak.lastSolvedDate);
  return gap <= 1 ? streak.current : 0;
}
