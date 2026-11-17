// Health readings and meals against the enplace server. Needs the person's health consent first: every call except
// reading the consent, granting it and erasing answers "forbidden" with `details.consent = "health"` until then.
import type {
  CreateMealRequest,
  CreateReadingRequest,
  DoctorReport,
  HealthConsentState,
  HealthExport,
  HealthReading,
  MealLog,
  MealResponse,
  ReadingKind,
  ReadingsPage,
  ReportRange,
} from '@shared/index';
import { api, ApiError } from '@/lib/api';

/** The terms the person agreed to; shown on the consent screen. */
export const HEALTH_CONSENT_VERSION = '2026-11-01';

export const apiHealthConsent = (): Promise<HealthConsentState> => api().get<HealthConsentState>('/v1/health/consent');
export const apiGrantHealthConsent = (version = HEALTH_CONSENT_VERSION): Promise<HealthConsentState> => api().put<HealthConsentState>('/v1/health/consent', { version });
export const apiWithdrawHealthConsent = (): Promise<HealthConsentState> => api().delete<HealthConsentState>('/v1/health/consent');

/** True for the "agree first" refusal, so a screen can show the consent step instead of an error. */
export const needsHealthConsent = (err: unknown): boolean => err instanceof ApiError && err.status === 403 && err.details?.['consent'] === 'health';

export const apiAddReading = (reading: CreateReadingRequest): Promise<HealthReading> => api().post<HealthReading>('/v1/health/readings', reading);
export const apiDeleteReading = (id: string): Promise<void> => api().delete(`/v1/health/readings/${id}`);
export const apiReadings = (opts: { from?: string; to?: string; kind?: ReadingKind; limit?: number; cursor?: string } = {}): Promise<ReadingsPage> =>
  api().get<ReadingsPage>('/v1/health/readings', { query: opts });

/** Every reading in a range, following pages (capped, so a very long history cannot freeze the screen). */
export async function apiAllReadings(opts: { from?: string; to?: string; kind?: ReadingKind } = {}): Promise<HealthReading[]> {
  const out: HealthReading[] = [];
  let cursor: string | undefined;
  for (let i = 0; i < 10; i++) {
    const page = await apiReadings({ ...opts, limit: 200, cursor });
    out.push(...page.items);
    if (!page.nextCursor) break;
    cursor = page.nextCursor;
  }
  return out;
}

export const apiAddMeal = (meal: CreateMealRequest): Promise<MealLog> => api().post<MealLog>('/v1/health/meals', meal);
export const apiDeleteMeal = (id: string): Promise<void> => api().delete(`/v1/health/meals/${id}`);
export async function apiMeals(opts: { from?: string; to?: string; limit?: number } = {}): Promise<MealLog[]> {
  return (await api().get<{ items: MealLog[] }>('/v1/health/meals', { query: opts })).items;
}
export const apiMealResponse = (id: string): Promise<MealResponse> => api().get<MealResponse>(`/v1/health/meals/${id}/response`);

export const apiDoctorReport = (range: ReportRange = '30d'): Promise<DoctorReport> => api().get<DoctorReport>('/v1/health/report', { query: { range } });
export const apiHealthExport = (): Promise<HealthExport> => api().get<HealthExport>('/v1/health/export');
/** Deletes every reading and meal (allowed even after withdrawing consent). */
export const apiEraseHealthData = (): Promise<{ readings: number; meals: number }> => api().delete<{ readings: number; meals: number }>('/v1/health/data');
