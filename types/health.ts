import type { NutritionRatings } from './order';

export type GlucoseTiming = 'fasting' | 'before-meal' | '1h-after' | '2h-after' | 'bedtime';
export type ReadingSource = 'manual' | 'apple-health' | 'sample';

interface ReadingBase {
  id: string;
  /** ISO timestamp */
  at: string;
  source: ReadingSource;
  mealId?: string;
}
export interface GlucoseReading extends ReadingBase {
  kind: 'glucose';
  /** mmol/L */
  mmol: number;
  timing: GlucoseTiming;
}
export interface BloodPressureReading extends ReadingBase {
  kind: 'bp';
  systolic: number;
  diastolic: number;
}
export interface CholesterolReading extends ReadingBase {
  kind: 'cholesterol';
  /** LDL, mmol/L */
  ldl: number;
}
export type HealthReading = GlucoseReading | BloodPressureReading | CholesterolReading;

export type MealType = 'Breakfast' | 'Lunch' | 'Dinner' | 'Snack';

export interface MealLog {
  id: string;
  title: string;
  mealType: MealType;
  at: string;
  carbsG: number;
  portionLabel: string;
  /** Group used to compare similar meals, e.g. "Rice bowls". */
  group: string;
  /** Portion variant within a group, e.g. "1 cup of rice". */
  variant?: string;
  ratings?: NutritionRatings;
  fromOrderId?: string;
  sample?: boolean;
}

export type GlucoseStatus = 'low' | 'in-range' | 'high';

export interface SimilarMeals {
  label: string;
  meals: number;
  avgRise: number;
}

export interface MealResponse {
  meal: MealLog;
  before?: GlucoseReading;
  after?: GlucoseReading;
  /** mmol/L change, one decimal. */
  rise?: number;
  similar: SimilarMeals[];
}

export type ReportRange = '2w' | '30d' | '90d';

export interface DoctorReport {
  range: ReportRange;
  from: string;
  to: string;
  condition: string;
  avgGlucose: number;
  timeInRangePct: number;
  avgBp: { systolic: number; diastolic: number } | null;
  glucoseReadings: number;
  mealsLogged: number;
  /** Meal group with the highest average rise, if known. */
  highestRiseGroup: string | null;
}

export type HealthPeriod = 'today' | 'week' | 'month';
