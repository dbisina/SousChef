import type { PhotoRef } from './social';

export interface Game {
  id: string;
  name: string;
  tagline: string;
  photo: PhotoRef;
  featured?: boolean;
  minPlayers?: number;
  maxPlayers?: number;
}

export interface MKPlayer {
  id: string;
  name: string;
  avatar: PhotoRef;
  isYou?: boolean;
  isHost?: boolean;
  guest?: boolean;
  status: 'joined' | 'joining';
}

export type MKPhase = 'lobby' | 'cooking' | 'reveal';
export type MKPantryMode = 'everyone-same' | 'different';
export type MKDifficulty = 'Easy' | 'Medium' | 'Hard';

export interface MKIngredient {
  label: string;
  photo?: PhotoRef;
}

export interface MKDishSecret {
  name: string;
  description: string;
  photo: PhotoRef;
  ingredients: MKIngredient[];
  hints: string[];
}

export interface MKTwist {
  title: string;
  text: string;
}

export interface MKSubmission {
  playerId: string;
  judgeScore: number;
  hintsUsed: number;
  timeLeftSec: number;
  score: number;
  plate: PhotoRef;
  comment: string;
}

export interface MysteryKitchenRound {
  roomCode: string;
  phase: MKPhase;
  players: MKPlayer[];
  pantryMode: MKPantryMode;
  difficulty: MKDifficulty;
  restrictions: string[];
  totalSec: number;
  /** Epoch ms when cooking started. */
  startedAt?: number;
  secret: MKDishSecret;
  twist?: MKTwist;
  hintsUnlocked: number;
  submissions: MKSubmission[];
}

export interface DailyDishPuzzle {
  /** Answer, display case. */
  answer: string;
  aliases: string[];
  /** Ingredient clues, revealed in order. */
  clues: string[];
}

export interface DailyDishState {
  puzzleNumber: number;
  cluesShown: number;
  guesses: string[];
  status: 'playing' | 'solved' | 'failed';
}

export interface DailyDishStreak {
  current: number;
  best: number;
  lastSolvedDate: string;
}
