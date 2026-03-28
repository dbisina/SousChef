import { Timestamp } from 'firebase/firestore';

// ── Streak tracking ──
export interface CookingStreak {
  currentStreak: number; // Days in a row
  longestStreak: number;
  lastCookDate: string; // YYYY-MM-DD
  totalDaysCooked: number;
}

// ── XP and levels ──
export interface UserXP {
  totalXP: number;
  level: number;
  xpToNextLevel: number;
  weeklyXP: number;
  weekStartDate: string; // YYYY-MM-DD
}

// XP values for actions
export const XP_VALUES = {
  COOK_RECIPE: 50,
  UPLOAD_RECIPE: 100,
  FIRST_RECIPE_OF_DAY: 25, // Bonus
  IMPORT_RECIPE: 30,
  RATE_RECIPE: 10,
  COMMENT: 10,
  POST_MADE_THIS: 40,
  COMPLETE_MEAL_PLAN_DAY: 75,
  STREAK_BONUS_3: 50, // 3-day streak
  STREAK_BONUS_7: 150, // 7-day streak
  STREAK_BONUS_30: 500, // 30-day streak
  LOG_WEIGHT: 15,
  HIT_CALORIE_TARGET: 30,
  SCAN_PANTRY_ITEM: 5,
  USE_EXPIRING_ITEM: 20,
} as const;

// Level thresholds
export const LEVEL_THRESHOLDS = [
  0,     // Level 1: Sous Chef
  200,   // Level 2: Line Cook
  500,   // Level 3: Station Chef
  1000,  // Level 4: Sauce Chef
  2000,  // Level 5: Pastry Chef
  3500,  // Level 6: Head Chef
  5500,  // Level 7: Executive Chef
  8000,  // Level 8: Master Chef
  12000, // Level 9: Iron Chef
  20000, // Level 10: Culinary Legend
];

export const LEVEL_NAMES = [
  'Sous Chef',
  'Line Cook',
  'Station Chef',
  'Sauce Chef',
  'Pastry Chef',
  'Head Chef',
  'Executive Chef',
  'Master Chef',
  'Iron Chef',
  'Culinary Legend',
];

// ── Achievements / Badges ──
export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string; // Ionicons name
  color: string;
  category: 'cooking' | 'social' | 'health' | 'streak' | 'explorer';
  requirement: number; // e.g., cook 10 recipes
  xpReward: number;
}

export interface UserAchievement {
  achievementId: string;
  unlockedAt: Timestamp;
  progress: number; // Current progress toward requirement
}

export const ACHIEVEMENTS: Achievement[] = [
  // Cooking achievements
  { id: 'first-cook', title: 'First Flame', description: 'Cook your first recipe', icon: 'flame', color: '#F97316', category: 'cooking', requirement: 1, xpReward: 50 },
  { id: 'cook-10', title: 'Getting Warmed Up', description: 'Cook 10 recipes', icon: 'restaurant', color: '#EF4444', category: 'cooking', requirement: 10, xpReward: 200 },
  { id: 'cook-50', title: 'Kitchen Pro', description: 'Cook 50 recipes', icon: 'trophy', color: '#F59E0B', category: 'cooking', requirement: 50, xpReward: 500 },
  { id: 'cook-100', title: 'Century Chef', description: 'Cook 100 recipes', icon: 'medal', color: '#8B5CF6', category: 'cooking', requirement: 100, xpReward: 1000 },

  // Social achievements
  { id: 'first-upload', title: 'Recipe Creator', description: 'Upload your first recipe', icon: 'create', color: '#3B82F6', category: 'social', requirement: 1, xpReward: 100 },
  { id: 'get-10-likes', title: 'Crowd Pleaser', description: 'Get 10 likes on your recipes', icon: 'heart', color: '#EC4899', category: 'social', requirement: 10, xpReward: 200 },
  { id: 'get-50-likes', title: 'Fan Favorite', description: 'Get 50 likes on your recipes', icon: 'star', color: '#F59E0B', category: 'social', requirement: 50, xpReward: 500 },
  { id: 'first-follower', title: 'Influencer', description: 'Get your first follower', icon: 'people', color: '#6366F1', category: 'social', requirement: 1, xpReward: 75 },

  // Streak achievements
  { id: 'streak-3', title: 'On a Roll', description: '3-day cooking streak', icon: 'flame', color: '#F97316', category: 'streak', requirement: 3, xpReward: 50 },
  { id: 'streak-7', title: 'Week Warrior', description: '7-day cooking streak', icon: 'flame', color: '#EF4444', category: 'streak', requirement: 7, xpReward: 150 },
  { id: 'streak-30', title: 'Month of Meals', description: '30-day cooking streak', icon: 'flame', color: '#DC2626', category: 'streak', requirement: 30, xpReward: 500 },

  // Health achievements
  { id: 'first-weight-log', title: 'Journey Begins', description: 'Log your first weight entry', icon: 'scale', color: '#10B981', category: 'health', requirement: 1, xpReward: 25 },
  { id: 'calorie-target-7', title: 'On Track', description: 'Hit calorie target 7 days', icon: 'checkmark-circle', color: '#22C55E', category: 'health', requirement: 7, xpReward: 200 },
  { id: 'zero-waste-week', title: 'Zero Waste Hero', description: 'No food waste for a week', icon: 'leaf', color: '#16A34A', category: 'health', requirement: 1, xpReward: 300 },

  // Explorer achievements
  { id: 'cuisines-5', title: 'World Traveler', description: 'Cook from 5 different cuisines', icon: 'globe', color: '#0EA5E9', category: 'explorer', requirement: 5, xpReward: 200 },
  { id: 'import-5', title: 'Recipe Hunter', description: 'Import 5 recipes from the web', icon: 'link', color: '#6366F1', category: 'explorer', requirement: 5, xpReward: 100 },
  { id: 'scan-cookbook', title: 'Bookworm', description: 'Scan a recipe from a cookbook', icon: 'book', color: '#A855F7', category: 'explorer', requirement: 1, xpReward: 75 },
];

// ── Daily challenges ──
export interface DailyChallenge {
  id: string;
  title: string;
  description: string;
  xpReward: number;
  type: 'cook' | 'import' | 'social' | 'pantry' | 'health';
  requirement: { action: string; count: number };
  expiresAt: string; // YYYY-MM-DD
}

// ── Gamification state on user profile ──
export interface GamificationState {
  streak: CookingStreak;
  xp: UserXP;
  achievements: UserAchievement[];
  dailyChallengeProgress?: Record<string, number>;
}
