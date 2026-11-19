// Asking for the verified-chef badge. Used when EXPO_PUBLIC_API_URL is set.
import type { ChefVerificationRequest, ChefVerificationView } from '@shared/index';
import { api } from '@/lib/api';

/** Where the person's own request stands: none, pending, approved, rejected (with the reason) or revoked. */
export const apiChefVerification = (): Promise<ChefVerificationView> => api().get<ChefVerificationView>('/v1/chef/verification');

/** Sends a request for the badge. The server refuses a second one while the first is still waiting. */
export const apiRequestChefVerification = (body: ChefVerificationRequest): Promise<ChefVerificationView> =>
  api().post<ChefVerificationView>('/v1/chef/verification', body);
