// Games against the SousChef server: Daily Dish and Mystery Kitchen. The server keeps the answers, the clock and the
// scores, so the phone only shows what it is told. Used by the games screens when EXPO_PUBLIC_API_URL is set.
import type {
  CreateRoomRequest,
  DailyDishView,
  DailyLeaderboardEntry,
  MkRoomView,
  StepImageResponse,
  SubmitPlateRequest,
} from '@shared/index';
import { api } from '@/lib/api';

/** The day starts at midnight where the player is: send their date, and the server accepts it if it is within a day of its own. */
const localDate = (now = new Date()): string => {
  const p = (n: number) => `${n}`.padStart(2, '0');
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
};

/* ---------------------------------------------------------------- Daily Dish */

export const apiDailyDish = (now?: Date): Promise<DailyDishView> => api().get<DailyDishView>('/v1/play/daily', { query: { date: localDate(now) } });
export const apiDailyClue = (now?: Date): Promise<DailyDishView> => api().post<DailyDishView>('/v1/play/daily/clue', { date: localDate(now) });
export const apiDailyGuess = (guess: string, now?: Date): Promise<DailyDishView> => api().post<DailyDishView>('/v1/play/daily/guess', { guess, date: localDate(now) });
export async function apiDailyLeaderboard(now?: Date): Promise<DailyLeaderboardEntry[]> {
  return (await api().get<{ items: DailyLeaderboardEntry[] }>('/v1/play/daily/leaderboard', { query: { date: localDate(now) } })).items;
}

/* ---------------------------------------------------------------- Mystery Kitchen */

export const apiCreateRoom = (request: CreateRoomRequest): Promise<MkRoomView> => api().post<MkRoomView>('/v1/play/rooms', request);
export const apiJoinRoom = (code: string): Promise<MkRoomView> => api().post<MkRoomView>('/v1/play/rooms/join', { code });
export const apiRoom = (code: string): Promise<MkRoomView> => api().get<MkRoomView>(`/v1/play/rooms/${code}`);
export const apiStartRoom = (code: string): Promise<MkRoomView> => api().post<MkRoomView>(`/v1/play/rooms/${code}/start`);
export const apiLeaveRoom = (code: string): Promise<void> => api().post<unknown>(`/v1/play/rooms/${code}/leave`).then(() => undefined);
export const apiBuyHint = (code: string): Promise<MkRoomView> => api().post<MkRoomView>(`/v1/play/rooms/${code}/hint`);

/** Hands in the plate photo (a finished upload, see lib/upload.ts). The judge's score arrives in the room view. */
export const apiSubmitPlate = (code: string, request: SubmitPlateRequest): Promise<MkRoomView> =>
  api().post<MkRoomView>(`/v1/play/rooms/${code}/plate`, request, { timeoutMs: 60_000 });

/** A picture of one cooking step (paid plans only; 403 `upgrade_required` otherwise, 503 when pictures are resting). */
export const apiStepImage = (code: string, index: number): Promise<StepImageResponse> =>
  api().get<StepImageResponse>(`/v1/play/rooms/${code}/steps/${index}/image`, { timeoutMs: 80_000 });
