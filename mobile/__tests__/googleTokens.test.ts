jest.mock('expo-apple-authentication', () => ({}));
jest.mock('expo-auth-session/providers/google', () => ({ useAuthRequest: jest.fn(), useIdTokenAuthRequest: jest.fn() }));
jest.mock('expo-web-browser', () => ({ maybeCompleteAuthSession: jest.fn() }));
jest.mock('expo-crypto', () => ({}));
jest.mock('@/lib/firebase', () => ({}));
jest.mock('@/lib/api', () => ({ apiEnabled: () => true }));
jest.mock('@/services/authApi', () => ({
  apiSocialSignIn: jest.fn(),
  authViaFirebase: () => true,
  firebaseSocialSignIn: jest.fn(),
  friendlyApiError: () => '',
}));

import { googleTokensFrom } from '@/services/socialAuthService';

describe('googleTokensFrom', () => {
  it('reads the tokens the id-token flow puts in params (iPhone)', () => {
    expect(googleTokensFrom({ params: { id_token: 'id1', access_token: 'at1' } })).toEqual({ idToken: 'id1', accessToken: 'at1' });
  });

  it('reads the tokens the code flow puts on authentication (Android)', () => {
    expect(googleTokensFrom({ params: { code: 'abc' }, authentication: { idToken: 'id2', accessToken: 'at2' } })).toEqual({
      idToken: 'id2',
      accessToken: 'at2',
    });
  });

  it('gives nulls when Google sent no token', () => {
    expect(googleTokensFrom({ params: {} })).toEqual({ idToken: null, accessToken: null });
    expect(googleTokensFrom({})).toEqual({ idToken: null, accessToken: null });
  });
});
