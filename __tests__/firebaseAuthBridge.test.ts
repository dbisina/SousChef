// With EXPO_PUBLIC_AUTH_VIA=firebase people sign in with Firebase and the server trades the Firebase token for its own.
jest.mock('expo-secure-store', () => ({ getItemAsync: async () => null, setItemAsync: async () => undefined, deleteItemAsync: async () => undefined }));
const mockFb = {
  getIdToken: jest.fn(async (_force?: boolean) => 'firebase-id-token'),
  signInWithEmailAndPassword: jest.fn(),
  createUserWithEmailAndPassword: jest.fn(),
  updateProfile: jest.fn<Promise<unknown>, unknown[]>(async () => undefined),
  sendPasswordResetEmail: jest.fn<Promise<unknown>, unknown[]>(async () => undefined),
  signInWithCredential: jest.fn(),
  signOut: jest.fn<Promise<unknown>, unknown[]>(async () => undefined),
  deleteUser: jest.fn<Promise<unknown>, unknown[]>(async () => undefined),
  auth: { currentUser: { uid: 'u1' } as { uid: string } | null },
};
// lib/utils (friendly error wording) reads Timestamp from Firestore, which is not plain JavaScript for Jest.
jest.mock('firebase/firestore', () => ({ Timestamp: { now: () => ({}), fromDate: (d: Date) => ({ toDate: () => d }) } }));
jest.mock('@/lib/firebase', () => ({
  Timestamp: { now: () => ({}), fromDate: (d: Date) => ({ toDate: () => d }) },
  get auth() {
    return mockFb.auth;
  },
  signInWithEmailAndPassword: (...a: unknown[]) => mockFb.signInWithEmailAndPassword(...a),
  createUserWithEmailAndPassword: (...a: unknown[]) => mockFb.createUserWithEmailAndPassword(...a),
  updateProfile: (...a: unknown[]) => mockFb.updateProfile(...a),
  sendPasswordResetEmail: (...a: unknown[]) => mockFb.sendPasswordResetEmail(...a),
  signInWithCredential: (...a: unknown[]) => mockFb.signInWithCredential(...a),
  signOut: (...a: unknown[]) => mockFb.signOut(...a),
  deleteUser: (...a: unknown[]) => mockFb.deleteUser(...a),
}));

import { api, resetApiForTests } from '@/lib/api';
import { apiDeleteAccount, apiRequestPasswordReset, apiSignIn, apiSignOut, apiSignUp, authViaFirebase, firebaseSocialSignIn, friendlyApiError } from '@/services/authApi';

const reply = (status: number, body?: unknown) => ({ ok: status < 300, status, json: async () => body ?? null }) as unknown as Response;
const tokens = { accessToken: 'a1', accessTokenExpiresAt: new Date(Date.now() + 900_000).toISOString(), refreshToken: 'r1' };
const me = { id: 'srv-1', email: 'ama@example.com', displayName: 'Ama', bio: '', isChef: false, isVerifiedChef: false, role: 'user', providers: ['firebase'], createdAt: '2026-11-15T00:00:00Z' };
const sent: { path: string; body?: Record<string, unknown> }[] = [];

beforeEach(async () => {
  Object.values(mockFb).forEach((f) => typeof f === 'function' && (f as jest.Mock).mockClear());
  mockFb.auth.currentUser = { uid: 'u1' };
  mockFb.signInWithEmailAndPassword.mockResolvedValue({ user: { getIdToken: mockFb.getIdToken } });
  mockFb.createUserWithEmailAndPassword.mockResolvedValue({ user: { getIdToken: mockFb.getIdToken } });
  mockFb.signInWithCredential.mockResolvedValue({ user: { getIdToken: mockFb.getIdToken } });
  sent.length = 0;
  process.env.EXPO_PUBLIC_API_URL = 'https://api.test';
  process.env.EXPO_PUBLIC_AUTH_VIA = 'firebase';
  resetApiForTests();
  global.fetch = jest.fn(async (input: string | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    sent.push({ path: `${init?.method ?? 'GET'} ${url.pathname}`, ...(typeof init?.body === 'string' ? { body: JSON.parse(init.body) as Record<string, unknown> } : {}) });
    if (url.pathname === '/v1/auth/social') return reply(200, { user: me, tokens });
    if (url.pathname === '/v1/auth/logout' || url.pathname === '/v1/me') return reply(204);
    return reply(404, { error: { code: 'not_found', message: 'no route' } });
  }) as unknown as typeof fetch;
});
afterAll(() => {
  delete process.env.EXPO_PUBLIC_API_URL;
  delete process.env.EXPO_PUBLIC_AUTH_VIA;
});

describe('signing in through Firebase', () => {
  it('is only on when asked for', () => {
    expect(authViaFirebase()).toBe(true);
    delete process.env.EXPO_PUBLIC_AUTH_VIA;
    expect(authViaFirebase()).toBe(false);
  });

  it('signs in with Firebase, then trades the Firebase token for the server\'s and keeps the server session', async () => {
    const user = await apiSignIn('ama@example.com', 'pw-123456');
    expect(mockFb.signInWithEmailAndPassword).toHaveBeenCalledWith(mockFb.auth, 'ama@example.com', 'pw-123456');
    expect(sent).toEqual([{ path: 'POST /v1/auth/social', body: { provider: 'firebase', idToken: 'firebase-id-token', acceptedTermsVersion: '2026-11-01' } }]);
    expect(user).toMatchObject({ id: 'srv-1', displayName: 'Ama' });
    expect(await api().hasSession()).toBe(true);
  });

  it('never sends the password to the server', async () => {
    await apiSignIn('ama@example.com', 'pw-123456');
    expect(JSON.stringify(sent)).not.toContain('pw-123456');
  });

  it('signs up with Firebase, saves the name, and trades a fresh token that carries it', async () => {
    await apiSignUp('ama@example.com', 'pw-123456', 'Ama Cook');
    expect(mockFb.createUserWithEmailAndPassword).toHaveBeenCalledWith(mockFb.auth, 'ama@example.com', 'pw-123456');
    expect(mockFb.updateProfile).toHaveBeenCalledWith(expect.anything(), { displayName: 'Ama Cook' });
    expect(mockFb.getIdToken).toHaveBeenCalledWith(true);
    expect(sent[0]?.body).toMatchObject({ provider: 'firebase', displayName: 'Ama Cook' });
  });

  it('trades the token after a Google or Apple credential too', async () => {
    const user = await firebaseSocialSignIn({ providerId: 'apple.com' } as never, 'Ama Cook');
    expect(mockFb.signInWithCredential).toHaveBeenCalledWith(mockFb.auth, { providerId: 'apple.com' });
    expect(sent[0]?.body).toMatchObject({ provider: 'firebase', idToken: 'firebase-id-token', displayName: 'Ama Cook' });
    expect(user.id).toBe('srv-1');
  });

  it('lets Firebase send the password reset email', async () => {
    await apiRequestPasswordReset('ama@example.com');
    expect(mockFb.sendPasswordResetEmail).toHaveBeenCalledWith(mockFb.auth, 'ama@example.com');
    expect(sent).toEqual([]);
  });

  it('signing out ends the server session and the Firebase sign-in', async () => {
    await apiSignIn('ama@example.com', 'pw-123456');
    sent.length = 0;
    await apiSignOut();
    expect(sent.map((s) => s.path)).toContain('POST /v1/auth/logout');
    expect(mockFb.signOut).toHaveBeenCalledTimes(1);
    expect(await api().hasSession()).toBe(false);
  });

  it('deleting the account removes the server account, then the Firebase one, even if Firebase refuses', async () => {
    await apiSignIn('ama@example.com', 'pw-123456');
    mockFb.deleteUser.mockRejectedValueOnce(new Error('auth/requires-recent-login'));
    await expect(apiDeleteAccount('pw-123456')).resolves.toBeUndefined();
    expect(sent.map((s) => s.path)).toContain('DELETE /v1/me');
    expect(mockFb.deleteUser).toHaveBeenCalledWith({ uid: 'u1' });
  });

  it('gives Firebase\'s own errors friendly words, and leaves server errors as they were', () => {
    expect(friendlyApiError({ code: 'auth/invalid-email' })).toMatch(/email/i);
    expect(friendlyApiError(new Error('plain'))).toBe('plain');
  });

  it('passes a Firebase sign-in failure up without calling the server', async () => {
    mockFb.signInWithEmailAndPassword.mockRejectedValueOnce(Object.assign(new Error('bad'), { code: 'auth/invalid-credential' }));
    await expect(apiSignIn('ama@example.com', 'wrong')).rejects.toMatchObject({ code: 'auth/invalid-credential' });
    expect(sent).toEqual([]);
  });
});

describe('without the Firebase setting', () => {
  it('uses the server\'s own accounts, as before', async () => {
    delete process.env.EXPO_PUBLIC_AUTH_VIA;
    global.fetch = jest.fn(async () => reply(200, { user: me, tokens })) as unknown as typeof fetch;
    await apiSignIn('ama@example.com', 'pw-123456');
    expect(mockFb.signInWithEmailAndPassword).not.toHaveBeenCalled();
  });
});
