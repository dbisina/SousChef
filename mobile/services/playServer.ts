// Games from the SousChef server, shaped the way the game screens already read them.
import type { DailyDishView, MkRoomView } from '@shared/index';
import { toDateKey } from '@/lib/dailyDish';
import type { DailyDishPuzzle, DailyDishState, DailyDishStreak, MKDifficulty, MKPhase, MysteryKitchenRound } from '@/types/play';

/* ---------------------------------------------------------------- Daily Dish */

/** Today's game as the screens keep it. The hidden clues and the answer arrive only when the server says so. */
export function toDailyState(view: DailyDishView): DailyDishState {
  return { puzzleNumber: view.puzzleNumber, cluesShown: view.cluesShown, guesses: view.guesses, status: view.status };
}

/** The puzzle as far as this player may see it: the clues they have bought, and the answer once the game is over. */
export function toDailyPuzzle(view: DailyDishView): DailyDishPuzzle {
  return { answer: view.answer ?? '', aliases: [], clues: view.clues.map((c) => c ?? '') };
}

export function toDailyStreak(view: DailyDishView, now: Date): DailyDishStreak {
  // The server already worked out whether the streak is still alive; mark it as solved "today" so it reads as live.
  return { current: view.streak.current, best: view.streak.best, lastSolvedDate: view.streak.current > 0 ? toDateKey(now) : '' };
}

/* ---------------------------------------------------------------- Mystery Kitchen */

const DIFFICULTY: Record<MkRoomView['difficulty'], MKDifficulty> = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };
const PHASE: Record<MkRoomView['phase'], MKPhase> = { lobby: 'lobby', cooking: 'cooking', done: 'reveal' };

/** A room as the lobby, round and reveal screens read it. `now` anchors the clock: the server says how many seconds are left. */
export function toRound(view: MkRoomView, meId: string, now: number): MysteryKitchenRound {
  const totalHints = view.hints.length + view.hintsLeft;
  return {
    roomCode: view.code,
    mode: view.mode,
    phase: PHASE[view.phase],
    players: view.players.map((p) => ({
      id: p.user.id,
      name: p.user.displayName,
      avatar: p.user.photoUrl ?? 'chef',
      ...(p.user.id === meId ? { isYou: true } : {}),
      ...(p.user.id === view.host.id ? { isHost: true } : {}),
      status: 'joined' as const,
    })),
    pantryMode: 'everyone-same',
    difficulty: DIFFICULTY[view.difficulty],
    restrictions: [],
    totalSec: view.totalSec,
    ...(view.phase === 'cooking' ? { startedAt: now - (view.totalSec - view.secondsLeft) * 1000 } : {}),
    secret: {
      // The dish stays secret until the end; the hints you have bought come first, locked ones are empty slots.
      name: view.dish ?? '',
      description: '',
      photo: view.dishPhotoUrl ?? '',
      steps: view.steps,
      ingredients: (view.basket ?? []).map((label) => ({ label, ...(view.ingredientPhotos?.[label] ? { photo: view.ingredientPhotos[label] } : {}) })),
      hints: [...view.hints, ...Array.from({ length: view.hintsLeft }, () => '')],
    },
    ...(view.twist ? { twist: { title: 'Twist', text: view.twist } } : {}),
    hintsUnlocked: Math.min(view.hints.length, totalHints),
    submissions: (view.results ?? []).map((r) => ({
      playerId: r.user.id,
      judgeScore: r.judgeScore,
      hintsUsed: r.hintsUsed,
      timeLeftSec: 0,
      score: r.score,
      plate: r.photoUrl ?? 'bowl',
      comment: r.feedback,
    })),
  };
}

/** The screens wait on the lobby before it exists: a stand-in with the code (or nothing) until the server answers. */
export function placeholderRound(roomCode: string): MysteryKitchenRound {
  return {
    roomCode,
    phase: 'lobby',
    players: [],
    pantryMode: 'everyone-same',
    difficulty: 'Medium',
    restrictions: [],
    totalSec: 30 * 60,
    secret: { name: '', description: '', photo: '', ingredients: [], hints: [] },
    hintsUnlocked: 0,
    submissions: [],
  };
}
