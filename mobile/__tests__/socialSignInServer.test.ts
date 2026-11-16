// Google and Apple sign-in through the server: the phone gets the provider's token, the server checks it.
const mockMemory = new Map<string, string>();
jest.mock('expo-secure-store', () => ({
  getItemAsync: async (k: string) => mockMemory.get(k) ?? null,
  setItemAsync: async (k: string, v: string) => void mockMemory.set(k, v),
  deleteItemAsync: async (k: string) => void mockMemory.delete(k),
}));
const mockFirebaseTouched = jest.fn();
jest.mock('firebase/firestore', () => ({ Timestamp: { now: () => ({}), fromDate: (d: Date) => ({ toDate: () => d }) } }));
jest.mock('@/lib/firebase', () => {
  const touch = () => mockFirebaseTouched();
  return {
    auth: {}, db: {}, signInWithCredential: touch, GoogleAuthProvider: { credential: touch }, OAuthProvider: function () { return { credential: touch }; }, doc: touch, getDoc: touch, setDoc: touch,
    Timestamp: { now: () => ({}), fromDate: (d: Date) => ({ toDate: () => d }) },
  };
});
jest.mock('expo-apple-authentication', () => ({ isAvailableAsync: jest.fn(), signInAsync: jest.fn(), AppleAuthenticationScope: { FULL_NAME: 0, EMAIL: 1 } }));
jest.mock('expo-auth-session/providers/google', () => ({ useIdTokenAuthRequest: jest.fn() }));
jest.mock('expo-web-browser', () => ({ maybeCompleteAuthSession: jest.fn() }));
jest.mock('expo-crypto', () => ({ digestStringAsync: async () => 'hashed', CryptoDigestAlgorithm: { SHA256: 'SHA256' }, getRandomBytes: () => new Uint8Array(32) }));

import { resetApiForTests } from '@/lib/api';
import { signInWithApple, signInWithGoogle } from '@/services/socialAuthService';
import * as mockApple from 'expo-apple-authentication';

const me = { id: 'u1', handle: 'ama', displayName: 'Ama Okafor', bio: '', photoUrl: null, isChef: false, isVerifiedChef: false, kind: 'person', email: 'a@x.test', emailVerified: true, role: 'user', providers: ['google'], createdAt: '2026-11-01T00:00:00.000Z' };
const tokens = { accessToken: 'a1', accessTokenExpiresAt: new Date(Date.now() + 900_000).toISOString(), refreshToken: 'r1' };
const reply = (status: number, body?: unknown) => ({ ok: status < 300, status, json: async () => body ?? null }) as Response;
let server: jest.Mock;
const sentBody = () => JSON.parse(String((server.mock.calls[0][1] as RequestInit).body));

beforeEach(() => {
  mockMemory.clear();
  mockFirebaseTouched.mockClear();
  process.env.EXPO_PUBLIC_API_URL = 'https://api.test';
  resetApiForTests();
  server = jest.fn();
  global.fetch = server as unknown as typeof fetch;
});
afterAll(() => {
  delete process.env.EXPO_PUBLIC_API_URL;
});

describe('Google', () => {
  it('sends the ID token to the server and keeps the sign-in', async () => {
    server.mockResolvedValueOnce(reply(200, { user: me, tokens }));
    const res = await signInWithGoogle('google-id-token', 'access');
    expect(res).toMatchObject({ success: true, user: { id: 'u1', displayName: 'Ama Okafor' } });
    expect(new URL(String(server.mock.calls[0][0])).pathname).toBe('/v1/auth/social');
    expect(sentBody()).toEqual({ provider: 'google', idToken: 'google-id-token', acceptedTermsVersion: '2026-11-01' });
    expect(mockMemory.get('souschef.tokens.v1')).toContain('"refreshToken":"r1"');
    expect(mockFirebaseTouched).not.toHaveBeenCalled();
  });

  it('says what went wrong when the server refuses the token', async () => {
    server.mockResolvedValueOnce(reply(401, { error: { code: 'provider_rejected', message: 'That sign-in could not be verified' } }));
    expect(await signInWithGoogle('bad', null)).toEqual({ success: false, error: 'That sign-in could not be verified' });
    expect(mockMemory.size).toBe(0);
  });

  it('needs an ID token', async () => {
    expect(await signInWithGoogle(null, null)).toMatchObject({ success: false });
    expect(server).not.toHaveBeenCalled();
  });
});

describe('Apple', () => {
  it('passes along the name Apple only gives the first time', async () => {
    (mockApple.isAvailableAsync as jest.Mock).mockResolvedValue(true);
    (mockApple.signInAsync as jest.Mock).mockResolvedValue({ identityToken: 'apple-id-token', fullName: { givenName: 'Ama', familyName: 'Okafor' }, email: 'a@x.test' });
    server.mockResolvedValueOnce(reply(200, { user: { ...me, providers: ['apple'] }, tokens }));
    const res = await signInWithApple();
    expect(res.success).toBe(true);
    expect(sentBody()).toEqual({ provider: 'apple', idToken: 'apple-id-token', displayName: 'Ama Okafor', acceptedTermsVersion: '2026-11-01' });
    expect(mockFirebaseTouched).not.toHaveBeenCalled();
  });

  it('leaves the name out when Apple sends none, and treats cancelling as cancelling', async () => {
    (mockApple.isAvailableAsync as jest.Mock).mockResolvedValue(true);
    (mockApple.signInAsync as jest.Mock).mockResolvedValue({ identityToken: 'tok', fullName: null, email: null });
    server.mockResolvedValueOnce(reply(200, { user: me, tokens }));
    await signInWithApple();
    expect(sentBody()).not.toHaveProperty('displayName');

    (mockApple.signInAsync as jest.Mock).mockRejectedValue(Object.assign(new Error('x'), { code: 'ERR_REQUEST_CANCELED' }));
    expect(await signInWithApple()).toEqual({ success: false, error: 'cancelled' });
  });
});
