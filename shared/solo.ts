// Solo games: Kitchen Trivia, Step Sorter and Ingredient Match. The server builds each round, keeps the answers inside a
// signed token, and scores what the phone sends back, so nobody can read the answers out of the app.

export const SOLO_GAMES = ['trivia', 'sorter', 'match'] as const;
export type SoloGameId = (typeof SOLO_GAMES)[number];

export interface SoloGameInfo {
  id: SoloGameId;
  name: string;
  tagline: string;
  /** What the player does, one line. */
  how: string;
  /** Best score (0-100) this person has reached, or null if never played. */
  best: number | null;
  plays: number;
}

/** One thing to answer. Trivia and match have `options` (pick one); sorter has `steps` (put them in order). */
export interface SoloItem {
  id: string;
  prompt: string;
  options?: string[];
  steps?: string[];
}

export interface SoloRound {
  game: SoloGameId;
  /** Hand this back with the answers. It expires after 30 minutes. */
  token: string;
  items: SoloItem[];
}

/** Per item: the index of the chosen option (trivia, match), or the steps in the order the player put them, as indexes into `steps` (sorter). */
export interface SoloAnswerRequest {
  token: string;
  answers: Array<number | number[]>;
}

export interface SoloReveal {
  id: string;
  correct: boolean;
  /** Trivia and match: the right option's text. Sorter: the steps in the right order. */
  answer: string | string[];
  /** One sentence on why, when there is one. */
  note?: string;
}

export interface SoloResult {
  game: SoloGameId;
  /** 0-100. */
  score: number;
  correctCount: number;
  total: number;
  reveal: SoloReveal[];
  best: number;
  newBest: boolean;
  plays: number;
}

export interface SoloLeaderboardEntry {
  rank: number;
  userId: string;
  displayName: string;
  handle: string;
  best: number;
  isYou: boolean;
}
