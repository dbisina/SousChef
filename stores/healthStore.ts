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
import { apiEnabled } from '@/lib/api';
import {
  apiAddMeal,
  apiAddReading,
  apiAllReadings,
  apiDeleteReading,
  apiEraseHealthData,
  apiGrantHealthConsent,
  apiHealthConsent,
  apiMeals,
  apiWithdrawHealthConsent,
  needsHealthConsent,
} from '@/services/healthApi';
import type { CreateReadingRequest } from '../shared/index';
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

/** Server mode: has the person agreed to the health terms? 'unknown' until the server has been asked. */
export type HealthConsent = 'unknown' | 'granted' | 'needed';

/** The server stores meals under its own ids, and readings may point at a meal that is still being saved. */
const mealSaves = new Map<string, Promise<string>>();

/** Numbers only. No advice text, no AI calls. */
interface HealthState {
  readings: HealthReading[];
  meals: MealLog[];
  /** Server mode only. */
  consent: HealthConsent;
  /** Server mode: asks about consent and, if given, loads every reading and meal. */
  loadFromServer: () => Promise<void>;
  grantConsent: () => Promise<void>;
  /** Stops the app (and the server) showing or taking health data. The saved data stays until it is erased. */
  withdrawConsent: () => Promise<void>;
  /** Deletes every reading and meal, here and on the server. */
  eraseAll: () => Promise<void>;
  /** Server mode: forget everything on this phone (sign-out). */
  clearLocal: () => void;

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
    (set, get) => {
      const seed = apiEnabled() ? { readings: [], meals: [] } : sampleSeed();
      return {
        readings: seed.readings,
        meals: seed.meals,
        consent: 'unknown' as HealthConsent,

        loadFromServer: async () => {
          if (!apiEnabled()) return;
          try {
            const state = await apiHealthConsent();
            if (!state.granted) {
              set({ consent: 'needed', readings: [], meals: [] });
              return;
            }
            const [readings, meals] = await Promise.all([apiAllReadings(), apiMeals({ limit: 200 })]);
            set({ consent: 'granted', readings: readings as HealthReading[], meals });
          } catch (err) {
            if (needsHealthConsent(err)) set({ consent: 'needed', readings: [], meals: [] });
            // Offline: what is on the phone stays.
          }
        },
        grantConsent: async () => {
          await apiGrantHealthConsent();
          await get().loadFromServer();
        },
        withdrawConsent: async () => {
          await apiWithdrawHealthConsent();
          set({ consent: 'needed', readings: [], meals: [] });
        },
        eraseAll: async () => {
          await apiEraseHealthData();
          set({ readings: [], meals: [] });
        },
        clearLocal: () => set({ consent: 'unknown', readings: [], meals: [] }),

        logReading: (input) => {
          const reading = healthService.buildReading(input);
          set((s) => ({ readings: [...s.readings, reading] }));
          if (apiEnabled()) {
            // Shown at once; the server's copy (with its own id) replaces it, or it is taken back if it is refused.
            const localMeal = input.kind === 'glucose' ? input.mealId : undefined;
            Promise.resolve(localMeal ? (mealSaves.get(localMeal) ?? Promise.resolve(localMeal)) : undefined)
              .then((mealId) => apiAddReading({ ...(input.kind === 'glucose' ? { kind: 'glucose', mmol: input.mmol, timing: input.timing, ...(mealId ? { mealId } : {}) } : input.kind === 'bp' ? { kind: 'bp', systolic: input.systolic, diastolic: input.diastolic } : { kind: 'cholesterol', ldl: input.ldl }), at: reading.at, source: reading.source } as CreateReadingRequest))
              .then((saved) => set((s) => ({ readings: s.readings.map((r) => (r.id === reading.id ? (saved as HealthReading) : r)) })))
              .catch((err) => {
                set((s) => ({ readings: s.readings.filter((r) => r.id !== reading.id), ...(needsHealthConsent(err) ? { consent: 'needed' as HealthConsent } : {}) }));
              });
          }
          return reading;
        },
        logMeal: (meal) => {
          set((s) => ({ meals: [...s.meals, meal] }));
          if (apiEnabled()) {
            const saving = apiAddMeal({ title: meal.title, mealType: meal.mealType, at: meal.at, carbsG: meal.carbsG, portionLabel: meal.portionLabel, group: meal.group, ...(meal.variant ? { variant: meal.variant } : {}) })
              .then((saved) => {
                set((s) => ({ meals: s.meals.map((m) => (m.id === meal.id ? { ...m, id: saved.id } : m)), readings: s.readings.map((r) => (r.mealId === meal.id ? { ...r, mealId: saved.id } : r)) }));
                return saved.id;
              })
              .catch((err) => {
                set((s) => ({ meals: s.meals.filter((m) => m.id !== meal.id), ...(needsHealthConsent(err) ? { consent: 'needed' as HealthConsent } : {}) }));
                throw err;
              });
            mealSaves.set(meal.id, saving);
            saving.catch(() => undefined).finally(() => mealSaves.delete(meal.id));
          }
        },
        removeReading: (id) => {
          const gone = get().readings.find((r) => r.id === id);
          set((s) => ({ readings: s.readings.filter((r) => r.id !== id) }));
          if (apiEnabled() && gone) {
            apiDeleteReading(id).catch(() => set((s) => ({ readings: [...s.readings, gone] }))); // put it back if the server kept it
          }
        },
        refreshSample: (now = new Date()) => {
          if (apiEnabled()) return; // real data only
          const fresh = healthService.seedSample(now);
          set((s) => ({
            readings: [...fresh.readings, ...s.readings.filter((r) => !isSample(r))],
            meals: [...fresh.meals, ...s.meals.filter((m) => !isSample(m))],
          }));
        },
      };
    },
    {
      name: apiEnabled() ? 'souschef-health-server-v1' : 'souschef-health-v1',
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
      // Sample history is rebuilt on launch; only user-entered data is stored.
      // With the server on, health data is never written to the phone's storage: it lives encrypted on the server.
      partialize: (s) =>
        apiEnabled()
          ? {}
          : {
              readings: s.readings.filter((r) => !isSample(r)),
              meals: s.meals.filter((m) => !isSample(m)),
            },
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
