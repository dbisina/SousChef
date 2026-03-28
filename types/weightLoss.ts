import { Timestamp } from 'firebase/firestore';

export interface WeightLossGoal {
  id: string;
  userId: string;
  startWeight: number; // lbs or kg
  targetWeight: number;
  currentWeight: number;
  unit: 'lbs' | 'kg';
  dailyCalorieTarget: number;
  dailyCalorieDeficit: number; // e.g. 500 cal deficit
  activityLevel: 'sedentary' | 'light' | 'moderate' | 'active' | 'very-active';
  startDate: Timestamp;
  targetDate?: Timestamp;
  createdAt: Timestamp;
}

export interface WeightLogEntry {
  id: string;
  userId: string;
  weight: number;
  unit: 'lbs' | 'kg';
  date: Timestamp;
  notes?: string;
}

export interface DailyCalorieLog {
  id: string;
  userId: string;
  date: string; // YYYY-MM-DD
  meals: MealCalorieEntry[];
  totalCalories: number;
  targetCalories: number;
  createdAt: Timestamp;
}

export interface MealCalorieEntry {
  id: string;
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  recipeId?: string;
  recipeName?: string;
  calories: number;
  notes?: string;
  timestamp: Timestamp;
}

// Activity level multipliers for TDEE calculation
export const ACTIVITY_MULTIPLIERS = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  'very-active': 1.9,
};
