import type { DailyDishPuzzle, Game, MKSubmission, MysteryKitchenRound } from '@/types/play';

/** The games live on the enplace server (daily puzzle, rooms, judging, scores). This stays as the shape the store expects. */
export interface PlayService {
  getGames(): { games: Game[]; total: number };
  getDailyPuzzles(): DailyDishPuzzle[];
  createRound(random?: () => number): MysteryKitchenRound;
  joinRound(code: string): MysteryKitchenRound;
  judge(round: MysteryKitchenRound): MKSubmission[];
}

export const MK_TOTAL_SEC = 45 * 60;

const needsServer = (): never => {
  throw new Error('Games need a connection to enplace');
};

export const localPlayService: PlayService = {
  getGames: () => ({ games: [], total: 0 }),
  getDailyPuzzles: () => [],
  createRound: needsServer,
  joinRound: needsServer,
  judge: needsServer,
};

export const playService: PlayService = localPlayService;
