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

import { buildGoogleBrowserUrl, parseGoogleReturn } from '@/services/socialAuthService';

describe('Android Google sign-in through the relay', () => {
  it('builds Google\'s address with the web client, the relay and the id-token response', () => {
    const url = buildGoogleBrowserUrl({ clientId: 'web.apps.googleusercontent.com', relayUrl: 'https://api.test/auth/google-relay', nonce: 'n1', state: 's1' });
    expect(url.startsWith('https://accounts.google.com/o/oauth2/v2/auth?')).toBe(true);
    expect(url).toContain('client_id=web.apps.googleusercontent.com');
    expect(url).toContain('redirect_uri=https%3A%2F%2Fapi.test%2Fauth%2Fgoogle-relay');
    expect(url).toContain('response_type=id_token');
    expect(url).toContain('scope=openid%20email%20profile');
    expect(url).toContain('nonce=n1');
    expect(url).toContain('state=s1');
  });

  it('reads the token the relay hands back', () => {
    expect(parseGoogleReturn('enplace://google-auth#id_token=abc.def&state=s1', 's1')).toEqual({ idToken: 'abc.def', accessToken: null, error: null });
  });

  it('refuses a result whose state does not match', () => {
    const r = parseGoogleReturn('enplace://google-auth#id_token=abc&state=other', 's1');
    expect(r.idToken).toBeNull();
    expect(r.error).toBeTruthy();
  });

  it('passes Google\'s error text along', () => {
    expect(parseGoogleReturn('enplace://google-auth?error=access_denied', 's1').error).toBe('access_denied');
  });

  it('says so when no token came back', () => {
    expect(parseGoogleReturn('enplace://google-auth#state=s1', 's1').error).toBeTruthy();
  });
});
