import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  activeStreak,
  newGame,
  nextClue,
  puzzleForNumber,
  puzzleNumberFor,
  scoreSolve,
  submitGuess,
  toDateKey,
  updateStreak,
} from '@/lib/dailyDish';
import { canStart, hintPenalty, secondsLeft } from '@/lib/mysteryKitchen';
import { SAMPLE_STREAK } from '@/data/sample/play';
import { playService } from '@/services/playService';
import type { DailyDishPuzzle, DailyDishState, DailyDishStreak, MysteryKitchenRound } from '@/types/play';

interface PlayState {
  daily: DailyDishState | null;
  streak: DailyDishStreak;
  round: MysteryKitchenRound | null;

  /** Ensure a game exists for today's puzzle. Safe to call on every mount. */
  startDaily: (now?: Date) => DailyDishState;
  revealNextClue: () => void;
  guessDaily: (text: string, now?: Date) => DailyDishState | null;

  hostRound: () => MysteryKitchenRound;
  joinRound: (code: string) => MysteryKitchenRound;
  startRound: (now?: number) => void;
  /** Unlock the next hint. Each costs 10 points. Returns the hint text or null. */
  useHint: () => string | null;
  submitPlate: (now?: number) => void;
  leaveRound: () => void;
}

const seedStreak = (): DailyDishStreak => ({
  current: SAMPLE_STREAK.current,
  best: SAMPLE_STREAK.best,
  // Yesterday, so the sample streak is live today.
  lastSolvedDate: toDateKey(new Date(Date.now() - 86_400_000)),
});

export const usePlayStore = create<PlayState>()(
  persist(
    (set, get) => ({
      daily: null,
      streak: seedStreak(),
      round: null,

      startDaily: (now = new Date()) => {
        const number = puzzleNumberFor(now);
        const cur = get().daily;
        if (cur && cur.puzzleNumber === number) return cur;
        const fresh = newGame(number);
        set({ daily: fresh });
        return fresh;
      },
      revealNextClue: () => {
        const d = get().daily;
        if (d) set({ daily: nextClue(d) });
      },
      guessDaily: (text, now = new Date()) => {
        const d = get().startDaily(now);
        const puzzle = puzzleForNumber(d.puzzleNumber, playService.getDailyPuzzles());
        const next = submitGuess(puzzle, d, text);
        if (next === d) return d;
        const finished = next.status !== 'playing';
        set((s) => ({
          daily: next,
          streak: finished ? updateStreak(s.streak, toDateKey(now), next.status === 'solved') : s.streak,
        }));
        return next;
      },

      hostRound: () => {
        const round = playService.createRound();
        set({ round });
        return round;
      },
      joinRound: (code) => {
        const round = playService.joinRound(code.trim());
        set({ round });
        return round;
      },
      startRound: (now = Date.now()) => {
        const r = get().round;
        if (!r || !canStart(r)) return;
        set({ round: { ...r, phase: 'cooking', startedAt: now, hintsUnlocked: 0, submissions: [] } });
      },
      useHint: () => {
        const r = get().round;
        if (!r || r.phase !== 'cooking' || r.hintsUnlocked >= r.secret.hints.length) return null;
        const hint = r.secret.hints[r.hintsUnlocked];
        set({ round: { ...r, hintsUnlocked: r.hintsUnlocked + 1 } });
        return hint;
      },
      submitPlate: (now = Date.now()) => {
        const r = get().round;
        if (!r || r.phase !== 'cooking') return;
        const timeLeftSec = secondsLeft(r, now);
        const judged = playService.judge({
          ...r,
          submissions: [
            {
              playerId: 'p-you',
              judgeScore: 78,
              hintsUsed: r.hintsUnlocked,
              timeLeftSec,
              score: 0,
              plate: 'salmon',
              comment: 'Good crust. Plating could be cleaner.',
            },
          ],
        });
        set({ round: { ...r, phase: 'reveal', submissions: judged } });
      },
      leaveRound: () => set({ round: null }),
    }),
    {
      name: 'souschef-play-v1',
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
      partialize: (s) => ({ daily: s.daily, streak: s.streak }),
    },
  ),
);

/* Selectors */
export const selectDailyPuzzle = (s: PlayState, now: Date = new Date()): DailyDishPuzzle =>
  puzzleForNumber(s.daily?.puzzleNumber ?? puzzleNumberFor(now), playService.getDailyPuzzles());
export const selectDailyStreak = (s: PlayState, now: Date = new Date()): number =>
  activeStreak(s.streak, toDateKey(now));
export const selectDailyScore = (s: PlayState): number => (s.daily ? scoreSolve(s.daily) : 0);
export const selectHintPenalty = (s: PlayState): number => hintPenalty(s.round?.hintsUnlocked ?? 0);
