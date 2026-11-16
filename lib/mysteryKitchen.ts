import type { MKSubmission, MysteryKitchenRound } from '@/types/play';

export const HINT_COST = 10;
export const MAX_TIME_BONUS = 5;
export const MAX_PLAYERS = 10;

/** Points removed for using hints. */
export const hintPenalty = (hintsUsed: number): number => Math.max(0, hintsUsed) * HINT_COST;

/** Up to 5 bonus points for finishing early. */
export function timeBonus(timeLeftSec: number, totalSec: number): number {
  if (totalSec <= 0) return 0;
  const frac = Math.min(1, Math.max(0, timeLeftSec / totalSec));
  return Math.round(frac * MAX_TIME_BONUS);
}

/** Final score: judge score + time bonus - 10 per hint, clamped to 0..100. */
export function scorePlate(input: {
  judgeScore: number;
  hintsUsed: number;
  timeLeftSec: number;
  totalSec: number;
}): number {
  const raw =
    input.judgeScore + timeBonus(input.timeLeftSec, input.totalSec) - hintPenalty(input.hintsUsed);
  return Math.min(100, Math.max(0, Math.round(raw)));
}

/** Highest score first. Ties keep submission order. */
export function rankSubmissions(subs: MKSubmission[]): MKSubmission[] {
  return subs
    .map((s, i) => ({ s, i }))
    .sort((a, b) => b.s.score - a.s.score || a.i - b.i)
    .map((x) => x.s);
}

export function generateRoomCode(random: () => number = Math.random): string {
  return `${Math.floor(1000 + random() * 9000)}`;
}

export function secondsLeft(round: Pick<MysteryKitchenRound, 'startedAt' | 'totalSec'>, now: number): number {
  if (round.startedAt == null) return round.totalSec;
  return Math.max(0, round.totalSec - Math.floor((now - round.startedAt) / 1000));
}

/** "32:14" */
export function formatClock(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${`${s % 60}`.padStart(2, '0')}`;
}

export const canStart = (round: Pick<MysteryKitchenRound, 'players'>): boolean =>
  round.players.filter((p) => p.status === 'joined').length >= 2;
