import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { ApiErrorBody, AuthResponse } from '@shared';
import { PASSWORD, makeApp, register, uniqueEmail, type TestApp } from './helpers';

let t: TestApp;
beforeAll(async () => {
  t = await makeApp();
});
afterAll(() => t.close());
beforeEach(() => t.reset());

const social = (payload: object) => t.app.inject({ method: 'POST', url: '/v1/auth/social', payload });
const TOKEN = 'a'.repeat(40);
const terms = { acceptedTermsVersion: '2026-11-01' };

describe('sign in with Google or Apple', () => {
  it('creates an account the first time, from what the provider says', async () => {
    t.verifier.allow(TOKEN, { provider: 'GOOGLE', providerUserId: 'g-1', email: 'ama@gmail.test', emailVerified: true, name: 'Ama Okafor' });
    const res = await social({ provider: 'google', idToken: TOKEN, ...terms });
    expect(res.statusCode).toBe(200);
    const body = res.json<AuthResponse>();
    expect(body.user.email).toBe('ama@gmail.test');
    expect(body.user.emailVerified).toBe(true);
    expect(body.user.displayName).toBe('Ama Okafor');
    expect(body.user.providers).toEqual(['google']);
    expect(body.tokens.refreshToken).toBeTruthy();
    const consents = await t.db.consent.count({ where: { userId: body.user.id } });
    expect(consents).toBe(2);
  });

  it('asks a new person to accept the terms first', async () => {
    t.verifier.allow(TOKEN, { provider: 'GOOGLE', providerUserId: 'g-2', email: 'new@gmail.test', emailVerified: true });
    const res = await social({ provider: 'google', idToken: TOKEN });
    expect(res.statusCode).toBe(409);
    expect(res.json<ApiErrorBody>().error.code).toBe('terms_required');
    expect(await t.db.user.count()).toBe(0);
  });

  it('signs the same person into the same account next time, without asking for terms again', async () => {
    t.verifier.allow(TOKEN, { provider: 'APPLE', providerUserId: 'apple-1', email: 'x@privaterelay.test', emailVerified: true });
    const first = (await social({ provider: 'apple', idToken: TOKEN, displayName: 'Kemi A', ...terms })).json<AuthResponse>();
    const second = await social({ provider: 'apple', idToken: TOKEN });
    expect(second.statusCode).toBe(200);
    expect(second.json<AuthResponse>().user.id).toBe(first.user.id);
    expect(await t.db.user.count()).toBe(1);
  });

  it('uses the name the app passes for Apple, which sends it only once', async () => {
    t.verifier.allow(TOKEN, { provider: 'APPLE', providerUserId: 'apple-2', email: 'k@privaterelay.test', emailVerified: true });
    const res = (await social({ provider: 'apple', idToken: TOKEN, displayName: 'Kemi Adeyemi', ...terms })).json<AuthResponse>();
    expect(res.user.displayName).toBe('Kemi Adeyemi');
  });

  it('works for an account with no email at all', async () => {
    t.verifier.allow(TOKEN, { provider: 'APPLE', providerUserId: 'apple-3' });
    const res = await social({ provider: 'apple', idToken: TOKEN, ...terms });
    expect(res.statusCode).toBe(200);
    const body = res.json<AuthResponse>();
    expect(body.user.email).toBeNull();
    expect(body.user.displayName).toBe('Chef');
  });

  it('adds Google to an existing email account when the provider vouches for the same email', async () => {
    const email = uniqueEmail();
    const existing = await register(t, { email });
    t.verifier.allow(TOKEN, { provider: 'GOOGLE', providerUserId: 'g-3', email, emailVerified: true });
    const res = await social({ provider: 'google', idToken: TOKEN });
    expect(res.statusCode).toBe(200);
    const body = res.json<AuthResponse>();
    expect(body.user.id).toBe(existing.user.id);
    expect(body.user.providers).toEqual(['password', 'google']);
    expect(await t.db.user.count()).toBe(1);
    // And the password still works.
    expect((await t.app.inject({ method: 'POST', url: '/v1/auth/login', payload: { email, password: PASSWORD } })).statusCode).toBe(200);
  });

  it('does NOT join an existing account when the provider has not verified that email (account takeover guard)', async () => {
    const email = uniqueEmail();
    await register(t, { email });
    t.verifier.allow(TOKEN, { provider: 'GOOGLE', providerUserId: 'g-evil', email, emailVerified: false });
    const res = await social({ provider: 'google', idToken: TOKEN, ...terms });
    expect(res.statusCode).toBe(409);
    expect(res.json<ApiErrorBody>().error.code).toBe('email_taken');
    expect(await t.db.authIdentity.count()).toBe(0);
  });

  it('refuses a token the provider does not vouch for', async () => {
    const res = await social({ provider: 'google', idToken: 'b'.repeat(40), ...terms });
    expect(res.statusCode).toBe(401);
    expect(res.json<ApiErrorBody>().error.code).toBe('provider_rejected');
  });

  it('says so plainly when a provider is not set up', async () => {
    t.verifier.configured = false;
    const res = await social({ provider: 'google', idToken: TOKEN, ...terms });
    t.verifier.configured = true;
    expect(res.statusCode).toBe(501);
    expect(res.json<ApiErrorBody>().error.code).toBe('provider_not_configured');
  });

  it('refuses an unknown provider name and a missing token', async () => {
    expect((await social({ provider: 'facebook', idToken: TOKEN })).statusCode).toBe(400);
    expect((await social({ provider: 'google' })).statusCode).toBe(400);
  });
});
