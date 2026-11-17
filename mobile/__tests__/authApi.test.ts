// The auth store against a pretend server: the same screens, with accounts living on the enplace server.
const mockMemory = new Map<string, string>();
jest.mock('expo-secure-store', () => ({
  getItemAsync: async (k: string) => mockMemory.get(k) ?? null,
  setItemAsync: async (k: string, v: string) => void mockMemory.set(k, v),
  deleteItemAsync: async (k: string) => void mockMemory.delete(k),
}));
// Firebase must stay untouched in server mode; a stand-in proves it (and keeps the real one from starting up in tests).
const mockFirebaseTouched = jest.fn();
// lib/utils reaches for Firestore types at import time; the real package is not needed to run these tests.
jest.mock('firebase/firestore', () => ({ Timestamp: { now: () => ({}), fromDate: (d: Date) => ({ toDate: () => d }) } }));
jest.mock('@/lib/firebase', () => {
  const touch = () => mockFirebaseTouched();
  return {
    auth: {},
    db: {},
    createUserWithEmailAndPassword: touch,
    signInWithEmailAndPassword: touch,
    signOut: touch,
    updateProfile: touch,
    sendPasswordResetEmail: touch,
    deleteUser: touch,
    doc: touch,
    setDoc: touch,
    getDoc: touch,
    deleteDoc: touch,
    Timestamp: { now: () => ({}), fromDate: (d: Date) => ({ toDate: () => d }) },
  };
});

import { ApiError, apiEnabled, resetApiForTests } from '@/lib/api';
import { friendlyApiError, meToUser } from '@/services/authApi';
import { useAuthStore } from '@/stores/authStore';
import type { Me } from '@shared/index';

const me = (over: Partial<Me> = {}): Me => ({
  id: '0190f0f0-0000-7000-8000-000000000001',
  handle: 'ama',
  displayName: 'Ama Okafor',
  bannerUrl: null,
  bio: 'Cook',
  photoUrl: null,
  isChef: false,
  isVerifiedChef: false,
  kind: 'person',
  email: 'ama@example.com',
  emailVerified: false,
  role: 'user',
  providers: ['password'],
  createdAt: '2026-11-01T10:00:00.000Z',
  ...over,
});
const tokens = { accessToken: 'a1', accessTokenExpiresAt: new Date(Date.now() + 900_000).toISOString(), refreshToken: 'r1' };
const reply = (status: number, body?: unknown) => ({ ok: status < 300, status, json: async () => body ?? null }) as Response;

let server: jest.Mock;
const calls = () => server.mock.calls.map(([url, init]) => `${(init as RequestInit).method} ${new URL(String(url)).pathname}`);

beforeEach(() => {
  mockMemory.clear();
  mockFirebaseTouched.mockClear();
  process.env.EXPO_PUBLIC_API_URL = 'https://api.test';
  resetApiForTests();
  useAuthStore.setState({ user: null, isLoading: false, isInitialized: false, error: null, isGuest: false });
  server = jest.fn();
  global.fetch = server as unknown as typeof fetch;
});
afterAll(() => {
  delete process.env.EXPO_PUBLIC_API_URL;
});

describe('turning the server on', () => {
  it('is off without an address, so the app keeps using Firebase', () => {
    delete process.env.EXPO_PUBLIC_API_URL;
    expect(apiEnabled()).toBe(false);
    process.env.EXPO_PUBLIC_API_URL = ' https://api.test ';
    expect(apiEnabled()).toBe(true);
  });
});

describe('the server\'s account as the app\'s user', () => {
  it('maps the roles and badge the screens already use', () => {
    expect(meToUser(me()).role).toBe('user');
    expect(meToUser(me({ isChef: true })).role).toBe('chef');
    expect(meToUser(me({ isChef: true, role: 'admin' })).role).toBe('admin');
    expect(meToUser(me({ isVerifiedChef: true })).isVerifiedChef).toBe(true);
    expect(meToUser(me({ email: null })).email).toBe('');
    expect(meToUser(me({ photoUrl: 'https://m.test/a.jpg' })).photoURL).toBe('https://m.test/a.jpg');
    expect(meToUser(me()).createdAt.toDate().toISOString()).toBe('2026-11-01T10:00:00.000Z');
  });

  it('turns server errors into sentences', () => {
    expect(friendlyApiError(new ApiError(401, 'invalid_credentials', 'x'))).toContain("don't match");
    expect(friendlyApiError(new ApiError(409, 'email_taken', 'x'))).toContain('already registered');
    expect(friendlyApiError(new ApiError(400, 'validation_error', 'x', { password: 'Use at least 10 characters' }))).toBe('Use at least 10 characters');
    expect(friendlyApiError(new ApiError(0, 'network', 'x'))).toContain('Connection trouble');
    expect(friendlyApiError(new ApiError(429, 'rate_limited', 'x'))).toContain('slow down');
    expect(friendlyApiError(new Error('plain'))).toBe('plain');
  });
});

describe('signing up, in and out', () => {
  it('signs up, keeps the tokens, and never touches Firebase', async () => {
    server.mockResolvedValueOnce(reply(201, { user: me(), tokens }));
    await useAuthStore.getState().signUp('ama@example.com', 'correct horse battery', 'Ama Okafor');
    const s = useAuthStore.getState();
    expect(s.user).toMatchObject({ id: me().id, displayName: 'Ama Okafor', role: 'user' });
    expect(s.isLoading).toBe(false);
    expect(calls()).toEqual(['POST /v1/auth/register']);
    expect(JSON.parse(String((server.mock.calls[0][1] as RequestInit).body))).toMatchObject({ email: 'ama@example.com', acceptedTermsVersion: '2026-11-01' });
    expect((server.mock.calls[0][1] as RequestInit).headers).not.toHaveProperty('authorization');
    expect(mockMemory.get('souschef.tokens.v1')).toContain('"refreshToken":"r1"');
    expect(mockFirebaseTouched).not.toHaveBeenCalled();
  });

  it('shows a friendly message when sign-in fails, and signs in on the next try', async () => {
    server.mockResolvedValueOnce(reply(401, { error: { code: 'invalid_credentials', message: 'Email or password is not right' } }));
    await expect(useAuthStore.getState().signIn('ama@example.com', 'wrong')).rejects.toBeInstanceOf(ApiError);
    expect(useAuthStore.getState()).toMatchObject({ user: null, isLoading: false });
    expect(useAuthStore.getState().error).toContain("don't match");

    server.mockResolvedValueOnce(reply(200, { user: me(), tokens }));
    await useAuthStore.getState().signIn('ama@example.com', 'right password');
    expect(useAuthStore.getState()).toMatchObject({ error: null, user: { displayName: 'Ama Okafor' } });
  });

  it('signs out even with no connection, and forgets the tokens', async () => {
    server.mockResolvedValueOnce(reply(200, { user: me(), tokens }));
    await useAuthStore.getState().signIn('ama@example.com', 'right password');
    server.mockRejectedValueOnce(new TypeError('offline'));
    await useAuthStore.getState().signOut();
    expect(useAuthStore.getState().user).toBeNull();
    expect(mockMemory.has('souschef.tokens.v1')).toBe(false);
    expect(calls().at(-1)).toBe('POST /v1/auth/logout');
  });

  it('asks the server for a password reset email', async () => {
    server.mockResolvedValueOnce(reply(204));
    await useAuthStore.getState().resetPassword('ama@example.com');
    expect(calls()).toEqual(['POST /v1/auth/forgot-password']);
    expect(useAuthStore.getState().isLoading).toBe(false);
  });
});

describe('coming back to the app', () => {
  it('restores the saved sign-in', async () => {
    mockMemory.set('souschef.tokens.v1', JSON.stringify(tokens));
    server.mockResolvedValueOnce(reply(200, me({ displayName: 'Ama Back' })));
    await useAuthStore.getState().restoreSession();
    expect(useAuthStore.getState()).toMatchObject({ isInitialized: true, user: { displayName: 'Ama Back' } });
    expect((server.mock.calls[0][1] as RequestInit).headers).toMatchObject({ authorization: 'Bearer a1' });
  });

  it('shows the sign-in screen when nothing is saved, without calling the server', async () => {
    await useAuthStore.getState().restoreSession();
    expect(useAuthStore.getState()).toMatchObject({ isInitialized: true, user: null });
    expect(server).not.toHaveBeenCalled();
  });

  it('keeps the person signed in when the phone is offline at launch', async () => {
    mockMemory.set('souschef.tokens.v1', JSON.stringify(tokens));
    server.mockRejectedValue(new TypeError('offline'));
    await useAuthStore.getState().restoreSession();
    expect(useAuthStore.getState().isInitialized).toBe(true);
    expect(mockMemory.has('souschef.tokens.v1')).toBe(true);
  });

  it('does the work once even when many screens ask', async () => {
    mockMemory.set('souschef.tokens.v1', JSON.stringify(tokens));
    server.mockResolvedValue(reply(200, me()));
    await Promise.all([useAuthStore.getState().restoreSession(), useAuthStore.getState().restoreSession()]);
    expect(server).toHaveBeenCalledTimes(1);
  });
});

describe('the profile and the account', () => {
  beforeEach(async () => {
    server.mockResolvedValueOnce(reply(200, { user: me(), tokens }));
    await useAuthStore.getState().signIn('ama@example.com', 'right password');
    server.mockClear();
  });

  it('saves profile changes on the server and keeps the lists the server does not send yet', async () => {
    useAuthStore.setState({ user: { ...useAuthStore.getState().user!, savedRecipes: ['r1', 'r2'] } });
    server.mockResolvedValueOnce(reply(200, me({ displayName: 'Ama O.', bio: 'New bio' })));
    await useAuthStore.getState().updateUserProfile({ displayName: 'Ama O.', bio: 'New bio' });
    expect(calls()).toEqual(['PATCH /v1/me']);
    expect(JSON.parse(String((server.mock.calls[0][1] as RequestInit).body))).toEqual({ displayName: 'Ama O.', bio: 'New bio' });
    expect(useAuthStore.getState().user).toMatchObject({ displayName: 'Ama O.', bio: 'New bio', savedRecipes: ['r1', 'r2'] });
  });

  it('deletes the account with the password, or the word DELETE for social accounts', async () => {
    server.mockResolvedValueOnce(reply(204));
    await useAuthStore.getState().deleteAccount('correct horse battery');
    expect(JSON.parse(String((server.mock.calls[0][1] as RequestInit).body))).toEqual({ password: 'correct horse battery' });
    expect(useAuthStore.getState().user).toBeNull();
    expect(mockMemory.has('souschef.tokens.v1')).toBe(false);

    server.mockResolvedValueOnce(reply(200, { user: me(), tokens }));
    await useAuthStore.getState().signIn('ama@example.com', 'x');
    server.mockClear();
    server.mockResolvedValueOnce(reply(204));
    await useAuthStore.getState().deleteAccount();
    expect(JSON.parse(String((server.mock.calls[0][1] as RequestInit).body))).toEqual({ confirm: 'DELETE' });
  });

  it('keeps the account when deleting fails, and says why', async () => {
    server.mockResolvedValueOnce(reply(400, { error: { code: 'validation_error', message: 'x', details: { password: 'That password is not right' } } }));
    await expect(useAuthStore.getState().deleteAccount('nope')).rejects.toBeInstanceOf(ApiError);
    expect(useAuthStore.getState().user).not.toBeNull();
    expect(useAuthStore.getState().error).toBe('That password is not right');
  });
});
