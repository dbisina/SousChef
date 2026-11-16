import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { SignJWT, UnsecuredJWT, createLocalJWKSet, exportJWK, generateKeyPair, type JWK } from 'jose';
import type { ApiErrorBody, AuthResponse } from '@shared';
import { JoseIdTokenVerifier } from '../src/auth/idToken';
import { loadConfig } from '../src/config';
import { makeApp, type TestApp } from './helpers';
import { call } from './recipeHelpers';

const PROJECT = 'souschef-test-project';
type PrivateKey = Awaited<ReturnType<typeof generateKeyPair>>['privateKey'];

/** Stands in for Firebase: signs ID tokens the way Firebase does, with a key the verifier is given. */
async function fakeFirebase() {
  const { publicKey, privateKey } = await generateKeyPair('RS256');
  const jwk: JWK = { ...(await exportJWK(publicKey)), kid: 'k1', alg: 'RS256', use: 'sig' };
  const other = await generateKeyPair('RS256');
  const sign = (claims: Record<string, unknown> = {}, opts: { aud?: string; iss?: string; exp?: string | number; key?: PrivateKey } = {}) =>
    new SignJWT({ email: 'ama@example.com', email_verified: true, name: 'Ama Cook', ...claims })
      .setProtectedHeader({ alg: 'RS256', kid: 'k1' })
      .setSubject(typeof claims['sub'] === 'string' ? claims['sub'] : 'firebase-uid-1')
      .setAudience(opts.aud ?? PROJECT)
      .setIssuer(opts.iss ?? `https://securetoken.google.com/${PROJECT}`)
      .setIssuedAt()
      .setExpirationTime(opts.exp ?? '1h')
      .sign(opts.key ?? privateKey);
  return { keys: createLocalJWKSet({ keys: [jwk] }), sign, strangerKey: other.privateKey };
}

describe('checking a Firebase ID token', () => {
  it('accepts a good one and reads the person from it', async () => {
    const f = await fakeFirebase();
    const verifier = new JoseIdTokenVerifier([], [], PROJECT, { firebase: f.keys });
    expect(verifier.isConfigured('firebase')).toBe(true);
    const id = await verifier.verify('firebase', await f.sign({ email: 'Ama@Example.com' }));
    expect(id).toEqual({ provider: 'FIREBASE', providerUserId: 'firebase-uid-1', email: 'ama@example.com', emailVerified: true, name: 'Ama Cook' });
  });

  it('does not trust an email Firebase has not verified', async () => {
    const f = await fakeFirebase();
    const verifier = new JoseIdTokenVerifier([], [], PROJECT, { firebase: f.keys });
    expect((await verifier.verify('firebase', await f.sign({ email_verified: false }))).emailVerified).toBe(false);
    expect((await verifier.verify('firebase', await f.sign({ email: undefined, email_verified: true }))).emailVerified).toBe(false);
  });

  it('rejects another project, another issuer, an expired token, a stranger\'s signature, and an unsigned token', async () => {
    const f = await fakeFirebase();
    const verifier = new JoseIdTokenVerifier([], [], PROJECT, { firebase: f.keys });
    const bad = [
      await f.sign({}, { aud: 'someone-elses-project' }),
      await f.sign({}, { iss: 'https://securetoken.google.com/someone-elses-project' }),
      await f.sign({}, { iss: 'https://accounts.google.com' }),
      await f.sign({}, { exp: Math.floor(Date.now() / 1000) - 3600 }),
      await f.sign({}, { key: f.strangerKey }),
      new UnsecuredJWT({ email: 'ama@example.com', email_verified: true }).setSubject('x').setAudience(PROJECT).setIssuer(`https://securetoken.google.com/${PROJECT}`).setExpirationTime('1h').encode(),
      'not.a.token',
    ];
    for (const token of bad) await expect(verifier.verify('firebase', token)).rejects.toMatchObject({ code: 'provider_rejected' });
  });

  it('rejects a token with no subject', async () => {
    const f = await fakeFirebase();
    const verifier = new JoseIdTokenVerifier([], [], PROJECT, { firebase: f.keys });
    const noSub = await new SignJWT({ email: 'a@b.co' }).setProtectedHeader({ alg: 'RS256', kid: 'k1' }).setAudience(PROJECT).setIssuer(`https://securetoken.google.com/${PROJECT}`).setExpirationTime('1h').sign((await generateKeyPair('RS256')).privateKey);
    await expect(verifier.verify('firebase', noSub)).rejects.toMatchObject({ code: 'provider_rejected' });
  });

  it('is off without a project id, and the other providers are not affected', async () => {
    const off = new JoseIdTokenVerifier(['google-client'], []);
    expect(off.isConfigured('firebase')).toBe(false);
    expect(off.isConfigured('google')).toBe(true);
    await expect(off.verify('firebase', 'x.y.z')).rejects.toMatchObject({ code: 'provider_not_configured' });
  });

  it('is read from FIREBASE_PROJECT_ID', () => {
    const base = { DATABASE_URL: 'postgresql://x', JWT_SECRET: 'x'.repeat(32) };
    expect(loadConfig(base).FIREBASE_PROJECT_ID).toBe('');
    expect(loadConfig({ ...base, FIREBASE_PROJECT_ID: ' souschef-c23d6 ' }).FIREBASE_PROJECT_ID).toBe('souschef-c23d6');
  });
});

describe('signing in with Firebase through the server', () => {
  let t: TestApp;
  beforeAll(async () => {
    t = await makeApp();
  });
  afterAll(() => t.close());
  beforeEach(() => t.reset());

  const exchange = (token: string, extra: object = {}) => call(t, 'POST', '/v1/auth/social', undefined, { provider: 'firebase', idToken: token.padEnd(24, 'x'), ...extra });
  const code = (res: { json: () => unknown }) => (res.json() as ApiErrorBody).error.code;
  const allow = (token: string, identity: object) => t.verifier.allow(token.padEnd(24, 'x'), { provider: 'FIREBASE', ...(identity as { providerUserId: string }) });

  it('makes an account on the first sign-in (with the terms) and the same one afterwards', async () => {
    allow('tok-1', { providerUserId: 'uid-1', email: 'ama@example.com', emailVerified: true, name: 'Ama Cook' });
    const first = await exchange('tok-1', { acceptedTermsVersion: '2026-11-01' });
    expect(first.statusCode).toBe(200);
    const created = first.json<AuthResponse>();
    expect(created.user).toMatchObject({ displayName: 'Ama Cook', email: 'ama@example.com', providers: ['firebase'] });
    expect(created.tokens.refreshToken).toBeTruthy();

    const again = (await exchange('tok-1')).json<AuthResponse>(); // no terms needed the second time
    expect(again.user.id).toBe(created.user.id);
    expect(await t.db.user.count()).toBe(1);
    expect(await t.db.authIdentity.count({ where: { provider: 'FIREBASE' } })).toBe(1);
  });

  it('asks for the terms before making a brand-new account', async () => {
    allow('tok-2', { providerUserId: 'uid-2', email: 'ben@example.com', emailVerified: true });
    const res = await exchange('tok-2');
    expect(res.statusCode).toBe(409);
    expect(code(res)).toBe('terms_required');
    expect(await t.db.user.count()).toBe(0);
  });

  it('links to an account that already has the same verified email', async () => {
    const reg = await call(t, 'POST', '/v1/auth/register', undefined, { email: 'ama@example.com', password: 'Correct-horse-9', displayName: 'Ama', acceptedTermsVersion: '2026-11-01' });
    const existing = reg.json<AuthResponse>();
    allow('tok-3', { providerUserId: 'uid-3', email: 'ama@example.com', emailVerified: true });
    const linked = (await exchange('tok-3')).json<AuthResponse>();
    expect(linked.user.id).toBe(existing.user.id);
    expect(linked.user.providers).toEqual(expect.arrayContaining(['password', 'firebase']));
    expect(await t.db.user.count()).toBe(1);
  });

  it('does not link on an email Firebase has not verified: that is how accounts get taken over', async () => {
    await call(t, 'POST', '/v1/auth/register', undefined, { email: 'ama@example.com', password: 'Correct-horse-9', displayName: 'Ama', acceptedTermsVersion: '2026-11-01' });
    allow('tok-4', { providerUserId: 'uid-4', email: 'ama@example.com', emailVerified: false });
    const res = await exchange('tok-4', { acceptedTermsVersion: '2026-11-01' });
    expect(res.statusCode).toBe(409);
    expect(code(res)).toBe('email_taken');
    expect(await t.db.authIdentity.count({ where: { provider: 'FIREBASE' } })).toBe(0);
  });

  it('lets someone with an unverified email in Firebase make a new account when nobody else has that email', async () => {
    allow('tok-5', { providerUserId: 'uid-5', email: 'chi@example.com', emailVerified: false, name: 'Chi' });
    const res = await exchange('tok-5', { acceptedTermsVersion: '2026-11-01' });
    expect(res.statusCode).toBe(200);
    expect(res.json<AuthResponse>().user.emailVerified).toBe(false);
  });

  it('refuses a token the server cannot verify, and says so plainly when Firebase is off', async () => {
    expect(code(await exchange('never-allowed', { acceptedTermsVersion: '2026-11-01' }))).toBe('provider_rejected');
    t.verifier.configured = false;
    const off = await exchange('tok-1', { acceptedTermsVersion: '2026-11-01' });
    expect(off.statusCode).toBe(501);
    expect(code(off)).toBe('provider_not_configured');
    t.verifier.configured = true;
  });

  it('keeps the server session going on its own (refresh) once Firebase has been traded in', async () => {
    allow('tok-6', { providerUserId: 'uid-6', email: 'dee@example.com', emailVerified: true });
    const first = (await exchange('tok-6', { acceptedTermsVersion: '2026-11-01' })).json<AuthResponse>();
    const refreshed = await call(t, 'POST', '/v1/auth/refresh', undefined, { refreshToken: first.tokens.refreshToken });
    expect(refreshed.statusCode).toBe(200);
    expect(refreshed.json<AuthResponse>().user.id).toBe(first.user.id);
  });
});
