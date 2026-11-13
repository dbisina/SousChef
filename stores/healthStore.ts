import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  buildDoctorReport,
  glucoseStatus,
  isBp,
  isGlucose,
  isSameLocalDay,
  mealResponseFor,
  timeInRange,
} from '@/lib/health';
import { healthService } from '@/services/healthService';
import type { NewReadingInput } from '@/services/healthService';
import type {
  BloodPressureReading,
  CholesterolReading,
  DoctorReport,
  GlucoseReading,
  GlucoseStatus,
  HealthReading,
  MealLog,
  MealResponse,
  ReportRange,
} from '@/types/health';

/** Numbers only. No advice text, no AI calls. */
interface HealthState {
  readings: HealthReading[];
  meals: MealLog[];

  logReading: (input: NewReadingInput) => HealthReading;
  logMeal: (meal: MealLog) => void;
  removeReading: (id: string) => void;
  /** Rebuild sample data relative to now (keeps everything the user logged). */
  refreshSample: (now?: Date) => void;
}

const isSample = (r: { source?: string; sample?: boolean }) => r.source === 'sample' || r.sample === true;

const sampleSeed = () => healthService.seedSample();

export const useHealthStore = create<HealthState>()(
  persist(
    (set) => {
      const seed = sampleSeed();
      return {
        readings: seed.readings,
        meals: seed.meals,

        logReading: (input) => {
          const reading = healthService.buildReading(input);
          set((s) => ({ readings: [...s.readings, reading] }));
          return reading;
        },
        logMeal: (meal) => set((s) => ({ meals: [...s.meals, meal] })),
        removeReading: (id) => set((s) => ({ readings: s.readings.filter((r) => r.id !== id) })),
        refreshSample: (now = new Date()) => {
          const fresh = healthService.seedSample(now);
          set((s) => ({
            readings: [...fresh.readings, ...s.readings.filter((r) => !isSample(r))],
            meals: [...fresh.meals, ...s.meals.filter((m) => !isSample(m))],
          }));
        },
      };
    },
    {
      name: 'souschef-health-v1',
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
      // Sample history is rebuilt on launch; only user-entered data is stored.
      partialize: (s) => ({
        readings: s.readings.filter((r) => !isSample(r)),
        meals: s.meals.filter((m) => !isSample(m)),
      }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<Pick<HealthState, 'readings' | 'meals'>>;
        return {
          ...current,
          readings: [...current.readings, ...(p.readings ?? [])],
          meals: [...current.meals, ...(p.meals ?? [])],
        };
      },
    },
  ),
);

/* Selectors. They return new arrays: select raw `readings` / `meals` from the
   store and call these inside useMemo, or use zustand's useShallow. */
const byTime = (a: { at: string }, b: { at: string }) => a.at.localeCompare(b.at);

export const glucoseOn = (readings: HealthReading[], day: Date): GlucoseReading[] =>
  readings.filter(isGlucose).filter((r) => isSameLocalDay(r.at, day)).sort(byTime);

export const latestGlucose = (readings: HealthReading[], now: Date = new Date()): GlucoseReading | undefined =>
  readings
    .filter(isGlucose)
    .filter((r) => new Date(r.at).getTime() <= now.getTime())
    .sort(byTime)
    .pop();

export const latestBp = (readings: HealthReading[]): BloodPressureReading | undefined =>
  readings.filter(isBp).sort(byTime).pop();

export const latestLdl = (readings: HealthReading[]): CholesterolReading | undefined =>
  readings.filter((r): r is CholesterolReading => r.kind === 'cholesterol').sort(byTime).pop();

export const readingStatus = (r: GlucoseReading): GlucoseStatus => glucoseStatus(r.mmol, r.timing);

export const mealsOn = (meals: MealLog[], day: Date): MealLog[] =>
  meals.filter((m) => isSameLocalDay(m.at, day)).sort(byTime);

export const timeInRangeToday = (readings: HealthReading[], day: Date = new Date()): number =>
  timeInRange(glucoseOn(readings, day).map((r) => r.mmol));

export const mealResponse = (state: Pick<HealthState, 'readings' | 'meals'>, mealId: string): MealResponse | undefined => {
  const meal = state.meals.find((m) => m.id === mealId);
  return meal ? mealResponseFor(meal, state.readings, state.meals) : undefined;
};

export const doctorReport = (
  state: Pick<HealthState, 'readings' | 'meals'>,
  range: ReportRange,
  now: Date = new Date(),
): DoctorReport => buildDoctorReport(range, state.readings, state.meals, now);
