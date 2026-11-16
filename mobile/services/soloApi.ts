// The solo games (Kitchen Trivia, Step Sorter, Ingredient Match) against the SousChef server. The server builds each round
// and scores it; the phone only shows what it is told.
import type { SoloAnswerRequest, SoloGameId, SoloGameInfo, SoloLeaderboardEntry, SoloResult, SoloRound } from '@shared/index';
import { api } from '@/lib/api';

export const apiSoloGames = async (): Promise<SoloGameInfo[]> => (await api().get<{ items: SoloGameInfo[] }>('/v1/play/solo')).items;
export const apiSoloStart = (game: SoloGameId): Promise<SoloRound> => api().post<SoloRound>(`/v1/play/solo/${game}/start`);
export const apiSoloAnswer = (game: SoloGameId, request: SoloAnswerRequest): Promise<SoloResult> => api().post<SoloResult>(`/v1/play/solo/${game}/answer`, request);
export const apiSoloLeaderboard = async (game: SoloGameId): Promise<SoloLeaderboardEntry[]> =>
  (await api().get<{ items: SoloLeaderboardEntry[] }>(`/v1/play/solo/${game}/leaderboard`)).items;
