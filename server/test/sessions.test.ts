import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { ApiErrorBody, AuthResponse } from '@shared';
import { DAY_MS, bearer, makeApp, register, type TestApp } from './helpers';

let t: TestApp;
beforeAll(async () => {
  t = await makeApp();
});
afterAll(() => t.close());
beforeEach(() => t.reset());

const refresh = (refreshToken: string) =>
  t.app.inject({ method: 'POST', url: '/v1/auth/refresh', payload: { refreshToken } });
const me = (auth: AuthResponse) => t.app.inject({ method: 'GET', url: '/v1/me', headers: bearer(auth) });

describe('refresh', () => {
  it('trades a refresh token for a new pair', async () => {
    const first = await register(t);
    const res = await refresh(first.tokens.refreshToken);
    expect(res.statusCode).toBe(200);
    const second = res.json<AuthResponse>();
    expect(second.user.id).toBe(first.user.id);
    expect(second.tokens.refreshToken).not.toBe(first.tokens.refreshToken);
    expect(second.tokens.accessToken).not.toBe(first.tokens.accessToken);
    expect((await me(second)).statusCode).toBe(200);
  });

  it('keeps the old access token working until it expires', async () => {
    const first = await register(t);
    await refresh(first.tokens.refreshToken);
    expect((await me(first)).statusCode).toBe(200);
  });

  it('can be chained: every new refresh token works once', async () => {
    let auth = await register(t);
    for (let i = 0; i < 4; i++) {
      t.advance(15_000);
      const res = await refresh(auth.tokens.refreshToken);
      expect(res.statusCode).toBe(200);
      auth = res.json<AuthResponse>();
    }
    expect((await me(auth)).statusCode).toBe(200);
  });

  it('treats a refresh token used again at once as a retry: refused, but the sign-in survives', async () => {
    const first = await register(t);
    const second = (await refresh(first.tokens.refreshToken)).json<AuthResponse>();
    const retry = await refresh(first.tokens.refreshToken);
    expect(retry.statusCode).toBe(401);
    expect(retry.json<ApiErrorBody>().error.code).toBe('invalid_token');
    // The newer token was not revoked.
    expect((await refresh(second.tokens.refreshToken)).statusCode).toBe(200);
  });

  it('treats a used refresh token shown again later as theft: the whole sign-in chain is revoked', async () => {
    const first = await register(t);
    const second = (await refresh(first.tokens.refreshToken)).json<AuthResponse>();
    t.advance(60_000);
    const stolen = await refresh(first.tokens.refreshToken);
    expect(stolen.statusCode).toBe(401);
    expect(stolen.json<ApiErrorBody>().error.code).toBe('token_reuse');
    // The honest holder of the newest token is signed out too, and so is every access token of that chain.
    expect((await refresh(second.tokens.refreshToken)).statusCode).toBe(401);
    expect((await me(second)).statusCode).toBe(401);
    expect((await me(first)).statusCode).toBe(401);
  });

  it('only revokes the chain that was stolen, not the same person on another phone', async () => {
    const phone = await register(t, { email: 'multi@example.com' });
    const tablet = (
      await t.app.inject({ method: 'POST', url: '/v1/auth/login', payload: { email: 'multi@example.com', password: 'correct horse battery' } })
    ).json<AuthResponse>();
    const next = (await refresh(phone.tokens.refreshToken)).json<AuthResponse>();
    t.advance(60_000);
    await refresh(phone.tokens.refreshToken); // theft on the phone's chain
    expect((await me(next)).statusCode).toBe(401);
    expect((await me(tablet)).statusCode).toBe(200);
    expect((await refresh(tablet.tokens.refreshToken)).statusCode).toBe(200);
  });

  it('refuses an expired refresh token', async () => {
    const auth = await register(t);
    t.advance(61 * DAY_MS);
    const res = await refresh(auth.tokens.refreshToken);
    expect(res.statusCode).toBe(401);
    expect(res.json<ApiErrorBody>().error.code).toBe('invalid_token');
  });

  it('refuses a token that never existed, and a malformed body', async () => {
    expect((await refresh('x'.repeat(43))).statusCode).toBe(401);
    expect((await refresh('short')).statusCode).toBe(400);
  });

  it('only one of two simultaneous refreshes wins', async () => {
    const auth = await register(t);
    const results = await Promise.all([refresh(auth.tokens.refreshToken), refresh(auth.tokens.refreshToken)]);
    expect(results.map((r) => r.statusCode).sort()).toEqual([200, 401]);
  });

  it('stores only a hash of the refresh token', async () => {
    const auth = await register(t);
    const sessions = await t.db.session.findMany({ where: { userId: auth.user.id } });
    expect(sessions.map((s) => s.tokenHash)).not.toContain(auth.tokens.refreshToken);
    expect(sessions[0]?.tokenHash).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('logout', () => {
  it('ends the sign-in: the access token and the refresh token stop working', async () => {
    const auth = await register(t);
    const res = await t.app.inject({ method: 'POST', url: '/v1/auth/logout', payload: { refreshToken: auth.tokens.refreshToken } });
    expect(res.statusCode).toBe(204);
    expect((await me(auth)).statusCode).toBe(401);
    expect((await refresh(auth.tokens.refreshToken)).statusCode).toBe(401);
  });

  it('ends the whole chain even after the token was refreshed', async () => {
    const first = await register(t);
    const second = (await refresh(first.tokens.refreshToken)).json<AuthResponse>();
    await t.app.inject({ method: 'POST', url: '/v1/auth/logout', payload: { refreshToken: second.tokens.refreshToken } });
    expect((await me(first)).statusCode).toBe(401);
    expect((await me(second)).statusCode).toBe(401);
  });

  it('succeeds for a token it has never seen, so tokens cannot be probed', async () => {
    const res = await t.app.inject({ method: 'POST', url: '/v1/auth/logout', payload: { refreshToken: 'y'.repeat(43) } });
    expect(res.statusCode).toBe(204);
  });

  it('logout everywhere ends every phone, and only this person', async () => {
    const a1 = await register(t, { email: 'a@example.com' });
    const a2 = (
      await t.app.inject({ method: 'POST', url: '/v1/auth/login', payload: { email: 'a@example.com', password: 'correct horse battery' } })
    ).json<AuthResponse>();
    const b = await register(t, { email: 'b@example.com' });
    const res = await t.app.inject({ method: 'POST', url: '/v1/auth/logout-all', headers: bearer(a1) });
    expect(res.statusCode).toBe(204);
    expect((await me(a1)).statusCode).toBe(401);
    expect((await me(a2)).statusCode).toBe(401);
    expect((await refresh(a2.tokens.refreshToken)).statusCode).toBe(401);
    expect((await me(b)).statusCode).toBe(200);
  });

  it('logout everywhere needs a sign-in', async () => {
    const res = await t.app.inject({ method: 'POST', url: '/v1/auth/logout-all' });
    expect(res.statusCode).toBe(401);
  });
});
