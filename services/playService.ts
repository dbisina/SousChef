import { DAILY_PUZZLES, GAMES, GAMES_TOTAL, MK_PLAYERS, MK_SAMPLE_RESULT, MK_SECRET, MK_TWIST } from '@/data/sample/play';
import { generateRoomCode, scorePlate } from '@/lib/mysteryKitchen';
import type { DailyDishPuzzle, Game, MKSubmission, MysteryKitchenRound } from '@/types/play';

export interface PlayService {
  getGames(): { games: Game[]; total: number };
  getDailyPuzzles(): DailyDishPuzzle[];
  /** New Mystery Kitchen lobby with the host plus sample friends joining. */
  createRound(random?: () => number): MysteryKitchenRound;
  /** Lobby for a friend's room code. Local preview: same sample players. */
  joinRound(code: string): MysteryKitchenRound;
  /** Sample judged results for every player, scored with hint penalties. */
  judge(round: MysteryKitchenRound): MKSubmission[];
}

export const MK_TOTAL_SEC = 45 * 60;

const baseRound = (roomCode: string): MysteryKitchenRound => ({
  roomCode,
  phase: 'lobby',
  players: MK_PLAYERS.map((p) => ({ ...p })),
  pantryMode: 'everyone-same',
  difficulty: 'Medium',
  restrictions: ['No peanuts'],
  totalSec: MK_TOTAL_SEC,
  secret: MK_SECRET,
  twist: MK_TWIST,
  hintsUnlocked: 0,
  submissions: [],
});

export const localPlayService: PlayService = {
  getGames: () => ({ games: GAMES, total: GAMES_TOTAL }),
  getDailyPuzzles: () => DAILY_PUZZLES,
  createRound: (random) => baseRound(generateRoomCode(random)),
  joinRound(code) {
    const round = baseRound(code);
    return {
      ...round,
      players: round.players.map((p) => ({ ...p, isHost: p.id === 'p-dayo', isYou: p.id === 'p-tolu', guest: false, status: 'joined' as const })),
    };
  },
  judge(round) {
    return MK_SAMPLE_RESULT.map((r) => {
      const mine = round.submissions.find((s) => s.playerId === r.playerId);
      const input = {
        judgeScore: mine?.judgeScore ?? r.judgeScore,
        hintsUsed: mine?.hintsUsed ?? r.hintsUsed,
        timeLeftSec: mine?.timeLeftSec ?? r.timeLeftSec,
        totalSec: round.totalSec,
      };
      return {
        playerId: r.playerId,
        ...input,
        score: scorePlate(input),
        plate: mine?.plate ?? r.plate,
        comment: mine?.comment ?? r.comment,
      };
    });
  },
};

export const playService: PlayService = localPlayService;
