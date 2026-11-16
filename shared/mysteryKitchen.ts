// Mystery Kitchen: everyone gets the same basket of ingredients and a twist, cooks a dish, and photographs the plate.
// The server picks the dish, keeps the clock and the scores, and has an AI judge look at each plate.
import type { Participant } from './chat';

export const HINT_COST = 10;
export const MAX_TIME_BONUS = 5;
export const MAX_PLAYERS = 10;
export const MAX_HINTS = 3;
/** Score given when the AI judge is unavailable, so a broken judge never punishes anyone. */
export const FAIR_PLAY_SCORE = 60;

export type MkMode = 'solo' | 'group';
export type MkPhase = 'lobby' | 'cooking' | 'done';
export type MkDifficulty = 'easy' | 'medium' | 'hard';

/** Seconds on the clock for each difficulty. */
export const MK_TOTAL_SEC: Record<MkDifficulty, number> = { easy: 45 * 60, medium: 30 * 60, hard: 20 * 60 };

/** Points removed for using hints. */
export const hintPenalty = (hintsUsed: number): number => Math.min(MAX_HINTS, Math.max(0, hintsUsed)) * HINT_COST;

/** Up to 5 bonus points for finishing early. */
export function timeBonus(timeLeftSec: number, totalSec: number): number {
  if (totalSec <= 0) return 0;
  const frac = Math.min(1, Math.max(0, timeLeftSec / totalSec));
  return Math.round(frac * MAX_TIME_BONUS);
}

/** Final score: judge score + time bonus - 10 per hint, kept between 0 and 100. */
export function scorePlate(input: { judgeScore: number; hintsUsed: number; timeLeftSec: number; totalSec: number }): number {
  const raw = input.judgeScore + timeBonus(input.timeLeftSec, input.totalSec) - hintPenalty(input.hintsUsed);
  return Math.min(100, Math.max(0, Math.round(raw)));
}

/** Four digits, 1000 to 9999. */
export function generateRoomCode(random: () => number = Math.random): string {
  return `${Math.floor(1000 + random() * 9000)}`;
}

export const isRoomCode = (s: string): boolean => /^[1-9]\d{3}$/.test(s);

/** Whole seconds left on the clock, never below zero. Before the start, the full time. */
export function secondsLeft(startedAtMs: number | null, totalSec: number, nowMs: number): number {
  if (startedAtMs == null) return totalSec;
  return Math.max(0, totalSec - Math.floor((nowMs - startedAtMs) / 1000));
}

/** A room can start with one player alone, or two or more in a group. */
export const canStart = (mode: MkMode, players: number): boolean => (mode === 'solo' ? players === 1 : players >= 2);

/* ---------------------------------------------------------------- API */

export interface CreateRoomRequest {
  mode: MkMode;
  difficulty?: MkDifficulty;
}

export interface JoinRoomRequest {
  code: string;
}

export interface SubmitPlateRequest {
  /** A finished upload (purpose `made_post`) of the plate. */
  uploadId: string;
  note?: string;
}

export interface MkPlayerView {
  user: Participant;
  submitted: boolean;
}

export interface MkResult {
  rank: number;
  user: Participant;
  score: number;
  judgeScore: number;
  hintsUsed: number;
  feedback: string;
  photoUrl: string | null;
  /** `fair_play` when the AI judge was unavailable and a fixed score was given. */
  judgedBy: 'ai' | 'fair_play';
}

/** A room as one player sees it. Other players' hints and scores stay hidden until the game is over. */
export interface MkRoomView {
  code: string;
  mode: MkMode;
  phase: MkPhase;
  difficulty: MkDifficulty;
  totalSec: number;
  secondsLeft: number;
  host: Participant;
  players: MkPlayerView[];
  /** The ingredients everyone cooks with. Null until the game starts. */
  basket: string[] | null;
  twist: string | null;
  /** The hints this player has bought so far. */
  hints: string[];
  /** How to cook it, step by step, without naming the dish. Empty until the game starts. */
  steps: string[];
  /** A real photo for each basket ingredient that has one (by the ingredient's name), so players can see what to get. */
  ingredientPhotos: Record<string, string>;
  hintsLeft: number;
  /** Has this player handed in a plate? */
  submitted: boolean;
  canStart: boolean;
  /** Only once the game is over. */
  dish: string | null;
  /** A real photo of the intended dish, once the game is over (the plate is judged against it). */
  dishPhotoUrl: string | null;
  results: MkResult[] | null;
}

/** A picture of one cooking step (made by an image model; paid plans only). */
export interface StepImageResponse {
  url: string;
}
