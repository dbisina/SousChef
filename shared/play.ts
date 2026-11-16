// Games. Dates are ISO strings; day keys are "YYYY-MM-DD" in UTC.
import type { Participant } from './chat';

/* ---------------------------------------------------------------- Daily Dish */

export type DailyStatus = 'playing' | 'solved' | 'failed';

/** Today's Daily Dish as one person sees it. The answer and the unrevealed clues never leave the server until they should. */
export interface DailyDishView {
  date: string;
  puzzleNumber: number;
  status: DailyStatus;
  /** One slot per clue; null where a clue is still hidden. */
  clues: (string | null)[];
  cluesShown: number;
  cluesTotal: number;
  guesses: string[];
  maxGuesses: number;
  score: number;
  /** Only once the game is over. */
  answer: string | null;
  photoUrl: string | null;
  streak: { current: number; best: number };
}

export interface DailyGuessRequest {
  guess: string;
  /** The player's own date (so midnight in their country starts their day). Within a day of the server's, or ignored. */
  date?: string;
}

export interface DailyDateRequest {
  date?: string;
}

export interface DailyLeaderboardEntry {
  user: Participant;
  score: number;
  cluesShown: number;
  guesses: number;
}

export interface DailyPuzzleInput {
  answer: string;
  /** Other accepted names for the dish. */
  aliases?: string[];
  /** Easiest last: the first clue is the hardest, the last gives it away. */
  clues: string[];
  photoUrl?: string;
}

/** Staff replace the whole rotation. Puzzles are used in this order, repeating when they run out. */
export interface SetDailyPuzzlesRequest {
  puzzles: DailyPuzzleInput[];
}

export interface AdminDailyPuzzle extends DailyPuzzleInput {
  position: number;
  aliases: string[];
}
