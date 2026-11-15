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
import { apiEnabled } from '@/lib/api';
import { currentUserId } from '@/lib/session';
import { uploadFile } from '@/lib/upload';
import {
  apiBuyHint,
  apiCreateRoom,
  apiDailyClue,
  apiDailyDish,
  apiDailyGuess,
  apiJoinRoom,
  apiLeaveRoom,
  apiRoom,
  apiStartRoom,
  apiSubmitPlate,
} from '@/services/playApi';
import { placeholderRound, toDailyPuzzle, toDailyState, toDailyStreak, toRound } from '@/services/playServer';
import type { DailyDishView, MkRoomView } from '../shared/index';
import type { DailyDishPuzzle, DailyDishState, DailyDishStreak, MysteryKitchenRound } from '@/types/play';

interface PlayState {
  daily: DailyDishState | null;
  streak: DailyDishStreak;
  round: MysteryKitchenRound | null;

  /** Ensure a game exists for today's puzzle. Safe to call on every mount. */
  startDaily: (now?: Date) => DailyDishState;
  revealNextClue: () => void;
  guessDaily: (text: string, now?: Date) => DailyDishState | null;

  /** Server mode: today's puzzle as the server shows it (clues bought so far; the answer only once it is over). */
  serverDaily: DailyDishView | null;
  /** Server mode: why the last game request failed, for the screen to show. */
  playError: string | null;
  /** Server mode: fetches today's game. */
  loadDaily: (now?: Date) => Promise<void>;
  /** Server mode: asks the server how a room stands (called when it announces a change). */
  refreshRound: (code: string) => Promise<void>;
  hostRound: () => MysteryKitchenRound;
  joinRound: (code: string) => MysteryKitchenRound;
  startRound: (now?: number) => void;
  /** Unlock the next hint. Each costs 10 points. Returns the hint text or null. */
  useHint: () => string | null;
  /** In server mode the plate needs a photo from the phone (`photoUri`). */
  submitPlate: (now?: number, photoUri?: string) => void;
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
      streak: apiEnabled() ? { current: 0, best: 0, lastSolvedDate: '' } : seedStreak(),
      round: null,
      serverDaily: null,
      playError: null,

      loadDaily: async (now = new Date()) => {
        try {
          const view = await apiDailyDish(now);
          set({ serverDaily: view, daily: toDailyState(view), streak: toDailyStreak(view, now), playError: null });
        } catch (err) {
          set({ playError: err instanceof Error ? err.message : 'Could not load today\'s puzzle' });
        }
      },
      refreshRound: async (code) => {
        const meId = currentUserId();
        if (!meId || get().round?.roomCode !== code) return;
        try {
          set({ round: toRound(await apiRoom(code), meId, Date.now()) });
        } catch {
          // A room that is gone (closed, or too old): leave the game screen.
          set({ round: null });
        }
      },

      startDaily: (now = new Date()) => {
        const number = puzzleNumberFor(now);
        const cur = get().daily;
        if (apiEnabled()) {
          if (!get().serverDaily) void get().loadDaily(now);
          return cur ?? newGame(number);
        }
        if (cur && cur.puzzleNumber === number) return cur;
        const fresh = newGame(number);
        set({ daily: fresh });
        return fresh;
      },
      revealNextClue: () => {
        const d = get().daily;
        if (apiEnabled()) {
          apiDailyClue()
            .then((view) => set({ serverDaily: view, daily: toDailyState(view) }))
            .catch((err) => set({ playError: err instanceof Error ? err.message : 'Could not show the next clue' }));
          return;
        }
        if (d) set({ daily: nextClue(d) });
      },
      guessDaily: (text, now = new Date()) => {
        if (apiEnabled()) {
          const d = get().daily ?? newGame(puzzleNumberFor(now));
          if (d.status !== 'playing' || !text.trim()) return d;
          // The guess shows at once; the server says whether it was right.
          const pending = { ...d, guesses: [...d.guesses, text.trim()] };
          set({ daily: pending });
          apiDailyGuess(text, now)
            .then((view) => set({ serverDaily: view, daily: toDailyState(view), streak: toDailyStreak(view, now) }))
            .catch(() => set({ daily: d }));
          return pending;
        }
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
        if (apiEnabled()) {
          const stand = placeholderRound('');
          set({ round: stand, playError: null });
          apiCreateRoom({ mode: 'group' })
            .then((view) => set({ round: toRound(view, currentUserId() ?? '', Date.now()) }))
            .catch((err) => set({ playError: err instanceof Error ? err.message : 'Could not start a room' }));
          return stand;
        }
        const round = playService.createRound();
        set({ round });
        return round;
      },
      joinRound: (code) => {
        if (apiEnabled()) {
          const stand = placeholderRound(code.trim());
          set({ round: stand, playError: null });
          apiJoinRoom(code.trim())
            .then((view) => set({ round: toRound(view, currentUserId() ?? '', Date.now()) }))
            .catch((err) => set({ playError: err instanceof Error ? err.message : 'Could not join that room' }));
          return stand;
        }
        const round = playService.joinRound(code.trim());
        set({ round });
        return round;
      },
      startRound: (now = Date.now()) => {
        const r = get().round;
        if (apiEnabled()) {
          if (r?.roomCode) {
            apiStartRoom(r.roomCode)
              .then((view) => set({ round: toRound(view, currentUserId() ?? '', Date.now()) }))
              .catch((err) => set({ playError: err instanceof Error ? err.message : 'Could not start the round' }));
          }
          return;
        }
        if (!r || !canStart(r)) return;
        set({ round: { ...r, phase: 'cooking', startedAt: now, hintsUnlocked: 0, submissions: [] } });
      },
      useHint: () => {
        const r = get().round;
        if (apiEnabled()) {
          // The server owns the hints and the cost; the new hint arrives in the room.
          if (r?.roomCode && r.phase === 'cooking') {
            apiBuyHint(r.roomCode)
              .then((view) => set({ round: toRound(view, currentUserId() ?? '', Date.now()) }))
              .catch(() => undefined);
          }
          return null;
        }
        if (!r || r.phase !== 'cooking' || r.hintsUnlocked >= r.secret.hints.length) return null;
        const hint = r.secret.hints[r.hintsUnlocked];
        set({ round: { ...r, hintsUnlocked: r.hintsUnlocked + 1 } });
        return hint;
      },
      submitPlate: (now = Date.now(), photoUri) => {
        const r = get().round;
        if (!r || r.phase !== 'cooking') return;
        if (apiEnabled()) {
          // Needs a photo of the plate; the server's judge scores it and ends the round when everyone is in.
          if (!photoUri) return;
          uploadFile(photoUri, 'made_post')
            .then((file) => apiSubmitPlate(r.roomCode, { uploadId: file.id }))
            .then((view) => set({ round: toRound(view, currentUserId() ?? '', Date.now()) }))
            .catch((err) => set({ playError: err instanceof Error ? err.message : 'Could not hand in the plate' }));
          return;
        }
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
      leaveRound: () => {
        const r = get().round;
        if (apiEnabled() && r?.roomCode && r.phase === 'lobby') apiLeaveRoom(r.roomCode).catch(() => undefined);
        set({ round: null, playError: null });
      },
    }),
    {
      name: apiEnabled() ? 'souschef-play-server-v1' : 'souschef-play-v1',
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
      // With the server on, the server keeps the games; nothing is stored on the phone.
      partialize: (s) => (apiEnabled() ? {} : { daily: s.daily, streak: s.streak }),
    },
  ),
);

/* Selectors */
export const selectDailyPuzzle = (s: PlayState, now: Date = new Date()): DailyDishPuzzle =>
  s.serverDaily ? toDailyPuzzle(s.serverDaily) : puzzleForNumber(s.daily?.puzzleNumber ?? puzzleNumberFor(now), playService.getDailyPuzzles());
export const selectDailyStreak = (s: PlayState, now: Date = new Date()): number =>
  activeStreak(s.streak, toDateKey(now));
export const selectDailyScore = (s: PlayState): number => (s.serverDaily ? s.serverDaily.score : s.daily ? scoreSolve(s.daily) : 0);
export const selectHintPenalty = (s: PlayState): number => hintPenalty(s.round?.hintsUnlocked ?? 0);
