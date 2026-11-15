// Sign-in and account calls against the SousChef server. Used by the auth store when EXPO_PUBLIC_API_URL is set.
import { Timestamp } from '@/lib/firebase';
import type { AuthResponse, Me, UpdateProfileRequest } from '../shared/index';
import { api, ApiError } from '@/lib/api';
import type { User, UserRole } from '@/types';
import { apiUnregisterDevice } from '@/services/devicesApi';

/** The version of the terms and privacy policy the sign-up screen shows. */
export const TERMS_VERSION = '2026-11-01';

/** The server's account, shaped the way the rest of the app already expects a user. */
export function meToUser(me: Me): User {
  const role: UserRole = me.role === 'admin' ? 'admin' : me.isChef ? 'chef' : 'user';
  return {
    id: me.id,
    email: me.email ?? '',
    displayName: me.displayName,
    ...(me.photoUrl ? { photoURL: me.photoUrl } : {}),
    bio: me.bio,
    role,
    isVerifiedChef: me.isVerifiedChef,
    hasPassword: me.providers.includes('password'),
    createdAt: Timestamp.fromDate(new Date(me.createdAt)),
    // Kept on the server in their own tables; the screens that need them ask for them there.
    savedRecipes: [],
    dietaryPreferences: [],
    allergies: [],
    healthConditions: [],
  };
}

/** A sentence a person can read, from whatever went wrong. */
export function friendlyApiError(error: unknown): string {
  if (!(error instanceof ApiError)) return error instanceof Error ? error.message : 'Something went wrong';
  switch (error.code) {
    case 'invalid_credentials':
      return "Hmm, those credentials don't match our records. Try again?";
    case 'email_taken':
      return 'Looks like that email is already registered! Try logging in instead?';
    case 'validation_error':
      return Object.values(error.details ?? {})[0] ?? 'Please check what you typed and try again.';
    case 'rate_limited':
      return 'Woah, slow down! Too many attempts. Please wait a moment and try again.';
    case 'network':
    case 'timeout':
      return 'Connection trouble! Please check your internet and try again.';
    case 'forbidden':
      return error.message;
    default:
      return error.message || 'Something went wrong';
  }
}

export async function apiSignUp(email: string, password: string, displayName: string): Promise<User> {
  const res = await api().post<AuthResponse>('/v1/auth/register', { email, password, displayName, acceptedTermsVersion: TERMS_VERSION }, { anonymous: true });
  await api().setTokens(res.tokens);
  return meToUser(res.user);
}

export async function apiSignIn(email: string, password: string): Promise<User> {
  const res = await api().post<AuthResponse>('/v1/auth/login', { email, password }, { anonymous: true });
  await api().setTokens(res.tokens);
  return meToUser(res.user);
}

/**
 * Signs in (or up) with the ID token Google or Apple gave the app. A first-time Apple sign-in sends the name only once, so
 * pass it along. The server checks the token itself; the phone's word is not enough.
 */
export async function apiSocialSignIn(provider: 'google' | 'apple', idToken: string, displayName?: string): Promise<User> {
  const res = await api().post<AuthResponse>(
    '/v1/auth/social',
    { provider, idToken, ...(displayName ? { displayName } : {}), acceptedTermsVersion: TERMS_VERSION },
    { anonymous: true },
  );
  await api().setTokens(res.tokens);
  return meToUser(res.user);
}

/** On launch: is there a saved sign-in the server still accepts? Null means show the sign-in screen. */
export async function apiRestoreSession(): Promise<User | null> {
  if (!(await api().hasSession())) return null;
  try {
    return meToUser(await api().get<Me>('/v1/me'));
  } catch (err) {
    // A dropped connection must not look like being signed out: keep the sign-in and let the caller retry.
    if (err instanceof ApiError && (err.code === 'network' || err.code === 'timeout')) throw err;
    return null;
  }
}

/** Ends this device's session on the server (best effort) and forgets it here. */
export async function apiSignOut(): Promise<void> {
  await apiUnregisterDevice(); // before the sign-in goes: the request needs it
  const refreshToken = await api().refreshToken();
  try {
    if (refreshToken) await api().post('/v1/auth/logout', { refreshToken }, { anonymous: true });
  } catch {
    // Signing out must always work on the phone, even offline; the session expires on the server by itself.
  } finally {
    await api().clear();
  }
}

export async function apiRequestPasswordReset(email: string): Promise<void> {
  await api().post('/v1/auth/forgot-password', { email }, { anonymous: true });
}

export async function apiUpdateProfile(updates: Partial<User>): Promise<User> {
  const body: UpdateProfileRequest = {
    ...(updates.displayName !== undefined ? { displayName: updates.displayName } : {}),
    ...(updates.bio !== undefined ? { bio: updates.bio } : {}),
    ...(updates.photoURL !== undefined ? { photoUrl: updates.photoURL || null } : {}),
  };
  return meToUser(await api().patch<Me>('/v1/me', body));
}

/** `password` for accounts that have one; accounts that only use Google or Apple confirm with the word DELETE instead. */
export async function apiDeleteAccount(password?: string): Promise<void> {
  await api().request('DELETE', '/v1/me', { body: password ? { password } : { confirm: 'DELETE' } });
  await api().clear();
}
