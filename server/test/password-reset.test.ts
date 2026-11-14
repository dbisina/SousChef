import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { ApiErrorBody, AuthResponse } from '@shared';
import { PASSWORD, bearer, makeApp, register, uniqueEmail, type TestApp } from './helpers';

let t: TestApp;
beforeAll(async () => {
  t = await makeApp();
});
afterAll(() => t.close());
beforeEach(() => t.reset());

const forgot = (email: string) => t.app.inject({ method: 'POST', url: '/v1/auth/forgot-password', payload: { email } });
const reset = (token: string, password: string) =>
  t.app.inject({ method: 'POST', url: '/v1/auth/reset-password', payload: { token, password } });
const login = (email: string, password: string) =>
  t.app.inject({ method: 'POST', url: '/v1/auth/login', payload: { email, password } });

describe('forgot password', () => {
  it('sends an email with a link for an account that exists', async () => {
    const email = uniqueEmail();
    await register(t, { email });
    const res = await forgot(email);
    expect(res.statusCode).toBe(202);
    expect(t.mail.resets).toHaveLength(1);
    expect(t.mail.resets[0]?.to).toBe(email);
    expect(t.mail.resets[0]?.resetUrl).toMatch(/^souschef:\/\/reset-password\?token=/);
  });

  it('gives the same answer, and sends nothing, for an address with no account', async () => {
    const known = uniqueEmail();
    await register(t, { email: known });
    const a = await forgot(known);
    const b = await forgot(uniqueEmail());
    expect(b.statusCode).toBe(a.statusCode);
    expect(b.json()).toEqual(a.json());
    expect(t.mail.resets).toHaveLength(1);
  });

  it('stores only a hash of the reset token', async () => {
    const email = uniqueEmail();
    const auth = await register(t, { email });
    await forgot(email);
    const rows = await t.db.passwordReset.findMany({ where: { userId: auth.user.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(rows[0]?.tokenHash).not.toBe(t.mail.lastToken());
  });

  it('a newer request cancels the older link', async () => {
    const email = uniqueEmail();
    await register(t, { email });
    await forgot(email);
    const older = t.mail.lastToken();
    await forgot(email);
    const newer = t.mail.lastToken();
    expect((await reset(older, 'a brand new password')).statusCode).toBe(401);
    expect((await reset(newer, 'a brand new password')).statusCode).toBe(204);
  });
});

describe('reset password', () => {
  it('sets the new password: it works, and the old one does not', async () => {
    const email = uniqueEmail();
    await register(t, { email });
    await forgot(email);
    const res = await reset(t.mail.lastToken(), 'my new password 123');
    expect(res.statusCode).toBe(204);
    expect((await login(email, 'my new password 123')).statusCode).toBe(200);
    expect((await login(email, PASSWORD)).statusCode).toBe(401);
  });

  it('signs out every phone that was signed in', async () => {
    const email = uniqueEmail();
    const auth = await register(t, { email });
    await forgot(email);
    await reset(t.mail.lastToken(), 'my new password 123');
    expect((await t.app.inject({ method: 'GET', url: '/v1/me', headers: bearer(auth) })).statusCode).toBe(401);
    expect(
      (await t.app.inject({ method: 'POST', url: '/v1/auth/refresh', payload: { refreshToken: auth.tokens.refreshToken } })).statusCode,
    ).toBe(401);
  });

  it('marks the email as verified, since the person received the link', async () => {
    const email = uniqueEmail();
    const auth = await register(t, { email });
    expect(auth.user.emailVerified).toBe(false);
    await forgot(email);
    await reset(t.mail.lastToken(), 'my new password 123');
    const signedIn = (await login(email, 'my new password 123')).json<AuthResponse>();
    expect(signedIn.user.emailVerified).toBe(true);
  });

  it('works only once', async () => {
    const email = uniqueEmail();
    await register(t, { email });
    await forgot(email);
    const token = t.mail.lastToken();
    expect((await reset(token, 'my new password 123')).statusCode).toBe(204);
    const again = await reset(token, 'another password 456');
    expect(again.statusCode).toBe(401);
    expect(again.json<ApiErrorBody>().error.code).toBe('invalid_token');
  });

  it('works only once even when used twice at the same moment', async () => {
    const email = uniqueEmail();
    await register(t, { email });
    await forgot(email);
    const token = t.mail.lastToken();
    const results = await Promise.all([reset(token, 'password number one'), reset(token, 'password number two')]);
    expect(results.map((r) => r.statusCode).sort()).toEqual([204, 401]);
  });

  it('expires after the time limit', async () => {
    const email = uniqueEmail();
    await register(t, { email });
    await forgot(email);
    t.advance(31 * 60_000);
    expect((await reset(t.mail.lastToken(), 'my new password 123')).statusCode).toBe(401);
  });

  it('refuses a token that was never issued, and a weak new password', async () => {
    expect((await reset('z'.repeat(43), 'my new password 123')).statusCode).toBe(401);
    const email = uniqueEmail();
    await register(t, { email });
    await forgot(email);
    const weak = await reset(t.mail.lastToken(), 'short');
    expect(weak.statusCode).toBe(400);
    expect(weak.json<ApiErrorBody>().error.details?.['password']).toBeTruthy();
    // A refused weak password must not use up the link.
    expect((await reset(t.mail.lastToken(), 'my new password 123')).statusCode).toBe(204);
  });
});
