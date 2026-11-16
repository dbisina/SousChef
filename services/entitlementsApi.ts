// The plan the server says the signed-in person has. Used by the subscription store when EXPO_PUBLIC_API_URL is set.
import type { Entitlements } from '../shared/index';
import { api } from '@/lib/api';
import type { SubscriptionTier } from '@/types/subscription';

/** The whole answer: tier, what it includes, when it ends, and whether the access is paid or earned. */
export async function fetchEntitlements(): Promise<Entitlements> {
  return api().get<Entitlements>('/v1/me/entitlements');
}

/** The plan name, or null when the server cannot be reached or nobody is signed in (the store's own answer then stands). */
export async function serverTier(): Promise<SubscriptionTier | null> {
  try {
    return (await fetchEntitlements()).tier;
  } catch {
    return null;
  }
}
