import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  CookingStreak,
  UserXP,
  UserAchievement,
  XP_VALUES,
  LEVEL_THRESHOLDS,
  LEVEL_NAMES,
  ACHIEVEMENTS,
  GamificationState,
} from '@/types/gamification';

interface GamificationStore extends GamificationState {
  // Actions
  addXP: (amount: number, reason: string) => { leveledUp: boolean; newLevel?: number; newLevelName?: string };
  recordCook: () => { streakBonus: number; xpEarned: number; achievementsUnlocked: string[] };
  recordAction: (action: keyof typeof XP_VALUES) => { xpEarned: number; achievementsUnlocked: string[] };
  checkAchievement: (achievementId: string, progress: number) => boolean;
  getLevel: () => { level: number; name: string; xp: number; xpToNext: number; progress: number };
  getStreak: () => CookingStreak;
  resetWeeklyXP: () => void;
}

const today = () => new Date().toISOString().split('T')[0];

const DEFAULT_STREAK: CookingStreak = {
  currentStreak: 0,
  longestStreak: 0,
  lastCookDate: '',
  totalDaysCooked: 0,
};

const DEFAULT_XP: UserXP = {
  totalXP: 0,
  level: 1,
  xpToNextLevel: LEVEL_THRESHOLDS[1],
  weeklyXP: 0,
  weekStartDate: today(),
};

function calculateLevel(xp: number): { level: number; xpToNext: number } {
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (xp >= LEVEL_THRESHOLDS[i]) {
      const nextThreshold = LEVEL_THRESHOLDS[i + 1] || LEVEL_THRESHOLDS[i] + 5000;
      return { level: i + 1, xpToNext: nextThreshold - xp };
    }
  }
  return { level: 1, xpToNext: LEVEL_THRESHOLDS[1] };
}

export const useGamificationStore = create<GamificationStore>()(
  persist(
    (set, get) => ({
      streak: DEFAULT_STREAK,
      xp: DEFAULT_XP,
      achievements: [],
      dailyChallengeProgress: {},

      addXP: (amount, _reason) => {
        const { xp } = get();
        const newTotal = xp.totalXP + amount;
        const { level: newLevel, xpToNext } = calculateLevel(newTotal);
        const leveledUp = newLevel > xp.level;

        set({
          xp: {
            ...xp,
            totalXP: newTotal,
            level: newLevel,
            xpToNextLevel: xpToNext,
            weeklyXP: xp.weeklyXP + amount,
          },
        });

        return {
          leveledUp,
          newLevel: leveledUp ? newLevel : undefined,
          newLevelName: leveledUp ? LEVEL_NAMES[newLevel - 1] : undefined,
        };
      },

      recordCook: () => {
        const { streak, addXP, checkAchievement } = get();
        const todayStr = today();
        let xpEarned = XP_VALUES.COOK_RECIPE;
        let streakBonus = 0;
        const achievementsUnlocked: string[] = [];

        // Update streak
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];

        let newStreak = streak.currentStreak;
        const isFirstToday = streak.lastCookDate !== todayStr;

        if (isFirstToday) {
          if (streak.lastCookDate === yesterdayStr) {
            // Consecutive day
            newStreak = streak.currentStreak + 1;
          } else if (streak.lastCookDate === todayStr) {
            // Already cooked today
            newStreak = streak.currentStreak;
          } else {
            // Streak broken
            newStreak = 1;
          }

          xpEarned += XP_VALUES.FIRST_RECIPE_OF_DAY;

          // Streak bonuses
          if (newStreak === 3) { streakBonus = XP_VALUES.STREAK_BONUS_3; }
          if (newStreak === 7) { streakBonus = XP_VALUES.STREAK_BONUS_7; }
          if (newStreak === 30) { streakBonus = XP_VALUES.STREAK_BONUS_30; }
          xpEarned += streakBonus;
        }

        set({
          streak: {
            currentStreak: newStreak,
            longestStreak: Math.max(streak.longestStreak, newStreak),
            lastCookDate: todayStr,
            totalDaysCooked: isFirstToday ? streak.totalDaysCooked + 1 : streak.totalDaysCooked,
          },
        });

        addXP(xpEarned, 'cook_recipe');

        // Check cooking achievements
        const totalCooked = get().streak.totalDaysCooked;
        if (checkAchievement('first-cook', totalCooked)) achievementsUnlocked.push('first-cook');
        if (checkAchievement('cook-10', totalCooked)) achievementsUnlocked.push('cook-10');
        if (checkAchievement('cook-50', totalCooked)) achievementsUnlocked.push('cook-50');
        if (checkAchievement('cook-100', totalCooked)) achievementsUnlocked.push('cook-100');

        // Check streak achievements
        if (checkAchievement('streak-3', newStreak)) achievementsUnlocked.push('streak-3');
        if (checkAchievement('streak-7', newStreak)) achievementsUnlocked.push('streak-7');
        if (checkAchievement('streak-30', newStreak)) achievementsUnlocked.push('streak-30');

        return { streakBonus, xpEarned, achievementsUnlocked };
      },

      recordAction: (action) => {
        const { addXP } = get();
        const xpEarned = XP_VALUES[action];
        addXP(xpEarned, action);
        return { xpEarned, achievementsUnlocked: [] };
      },

      checkAchievement: (achievementId, progress) => {
        const { achievements } = get();
        const already = achievements.find((a) => a.achievementId === achievementId);
        if (already) return false;

        const achievement = ACHIEVEMENTS.find((a) => a.id === achievementId);
        if (!achievement || progress < achievement.requirement) return false;

        // Unlock!
        set({
          achievements: [
            ...achievements,
            {
              achievementId,
              unlockedAt: { toMillis: () => Date.now() } as any,
              progress,
            },
          ],
        });

        return true;
      },

      getLevel: () => {
        const { xp } = get();
        const currentThreshold = LEVEL_THRESHOLDS[xp.level - 1] || 0;
        const nextThreshold = LEVEL_THRESHOLDS[xp.level] || currentThreshold + 5000;
        const xpInLevel = xp.totalXP - currentThreshold;
        const xpNeeded = nextThreshold - currentThreshold;

        return {
          level: xp.level,
          name: LEVEL_NAMES[xp.level - 1] || 'Chef',
          xp: xp.totalXP,
          xpToNext: xp.xpToNextLevel,
          progress: xpNeeded > 0 ? xpInLevel / xpNeeded : 1,
        };
      },

      getStreak: () => get().streak,

      resetWeeklyXP: () => {
        set((state) => ({
          xp: { ...state.xp, weeklyXP: 0, weekStartDate: today() },
        }));
      },
    }),
    {
      name: 'souschef-gamification',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
