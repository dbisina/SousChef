import { describe, expect, it, vi } from 'vitest';
import type { AuthResponse, AuthTokens } from '@shared';
import { AdminApi, ApiError, NotStaffError, type TokenStore } from './api';

const tokens = (n: number): AuthTokens => ({ accessToken: `a${n}`, accessTokenExpiresAt: '2030-01-01T00:00:00Z', refreshToken: `r${n}` });
const auth = (role: 'admin' | 'user', n = 1): AuthResponse => ({ user: { id: 'u1', role, displayName: 'Ade' } as AuthResponse['user'], tokens: tokens(n) });
const json = (status: number, body?: unknown) => ({ status, ok: status < 300, json: async () => body ?? null }) as unknown as Response;

function memoryStore(initial: AuthTokens | null = null): TokenStore & { value: AuthTokens | null } {
  const s = { value: initial, load: () => s.value, save: (t: AuthTokens | null) => void (s.value = t) };
  return s;
}

describe('signing in', () => {
  it('lets staff in and keeps the tokens in the store', async () => {
    const store = memoryStore();
    const request = vi.fn(async () => json(200, auth('admin')));
    const api = new AdminApi(store, request as unknown as typeof fetch);
    const me = await api.login('a@b.co', 'pw');
    expect(me.displayName).toBe('Ade');
    expect(api.signedIn).toBe(true);
    expect(store.value?.accessToken).toBe('a1');
    expect(request).toHaveBeenCalledWith('/v1/auth/login', expect.objectContaining({ method: 'POST', body: JSON.stringify({ email: 'a@b.co', password: 'pw' }) }));
  });

  it('refuses an ordinary account and signs its new session straight back out', async () => {
    const store = memoryStore();
    const calls: string[] = [];
    const request = vi.fn(async (url: string) => {
      calls.push(url);
      return url.endsWith('/login') ? json(200, auth('user')) : json(204);
    });
    const api = new AdminApi(store, request as unknown as typeof fetch);
    await expect(api.login('a@b.co', 'pw')).rejects.toBeInstanceOf(NotStaffError);
    expect(api.signedIn).toBe(false);
    expect(store.value).toBeNull();
    expect(calls).toEqual(['/v1/auth/login', '/v1/auth/logout']);
  });

  it('turns the server\'s error into an ApiError with its code', async () => {
    const request = async () => json(401, { error: { code: 'invalid_credentials', message: 'Wrong' } });
    const api = new AdminApi(memoryStore(), request as unknown as typeof fetch);
    await expect(api.login('a@b.co', 'x')).rejects.toMatchObject({ status: 401, code: 'invalid_credentials', message: 'Wrong' });
  });

  it('reports a network failure plainly', async () => {
    const api = new AdminApi(memoryStore(), (async () => Promise.reject(new Error('down'))) as unknown as typeof fetch);
    await expect(api.login('a@b.co', 'x')).rejects.toMatchObject({ code: 'network' });
  });
});

describe('requests', () => {
  it('sends the access token, and refuses to call without one', async () => {
    const request = vi.fn(async () => json(200, { ok: true }));
    const signedIn = new AdminApi(memoryStore(tokens(1)), request as unknown as typeof fetch);
    await signedIn.get('/v1/admin/stats');
    expect(request).toHaveBeenCalledWith('/v1/admin/stats', { method: 'GET', headers: { authorization: 'Bearer a1' } });
    await expect(new AdminApi(memoryStore(), request as unknown as typeof fetch).get('/x')).rejects.toBeInstanceOf(ApiError);
  });

  it('refreshes an expired token once and repeats the request', async () => {
    const store = memoryStore(tokens(1));
    const seen: string[] = [];
    const request = vi.fn(async (url: string, init: RequestInit) => {
      const bearer = (init.headers as Record<string, string>).authorization;
      seen.push(`${url} ${bearer ?? '-'}`);
      if (url === '/v1/auth/refresh') return json(200, auth('admin', 2));
      return bearer === 'Bearer a2' ? json(200, { n: 1 }) : json(401, { error: { code: 'unauthorized', message: 'old' } });
    });
    const api = new AdminApi(store, request as unknown as typeof fetch);
    expect(await api.get('/v1/admin/stats')).toEqual({ n: 1 });
    expect(store.value?.refreshToken).toBe('r2');
    expect(seen).toEqual(['/v1/admin/stats Bearer a1', '/v1/auth/refresh -', '/v1/admin/stats Bearer a2']);
  });

  it('shares ONE refresh between requests that fail at the same moment', async () => {
    const store = memoryStore(tokens(1));
    let refreshes = 0;
    const request = vi.fn(async (url: string, init: RequestInit) => {
      if (url === '/v1/auth/refresh') {
        refreshes++;
        return json(200, auth('admin', 2));
      }
      return (init.headers as Record<string, string>).authorization === 'Bearer a2' ? json(200, {}) : json(401, { error: { code: 'unauthorized', message: 'old' } });
    });
    const api = new AdminApi(store, request as unknown as typeof fetch);
    await Promise.all([api.get('/a'), api.get('/b'), api.get('/c')]);
    expect(refreshes).toBe(1);
  });

  it('signs out when the refresh fails or comes back for a non-staff account', async () => {
    for (const refreshAnswer of [json(401, { error: { code: 'invalid_token', message: 'x' } }), json(200, auth('user', 2))]) {
      const store = memoryStore(tokens(1));
      const onSignedOut = vi.fn();
      const request = async (url: string) => (url === '/v1/auth/refresh' ? refreshAnswer : json(401, { error: { code: 'unauthorized', message: 'old' } }));
      const api = new AdminApi(store, request as unknown as typeof fetch, onSignedOut);
      await expect(api.get('/v1/admin/stats')).rejects.toMatchObject({ status: 401 });
      expect(api.signedIn).toBe(false);
      expect(store.value).toBeNull();
      expect(onSignedOut).toHaveBeenCalledTimes(1);
    }
  });

  it('handles an empty 204 answer and signs out on request', async () => {
    const store = memoryStore(tokens(1));
    const request = vi.fn(async () => json(204));
    const api = new AdminApi(store, request as unknown as typeof fetch);
    await expect(api.post('/v1/admin/users/x/unsuspend')).resolves.toBeUndefined();
    await api.logout();
    expect(store.value).toBeNull();
    expect(request).toHaveBeenLastCalledWith('/v1/auth/logout', expect.objectContaining({ body: JSON.stringify({ refreshToken: 'r1' }) }));
  });
});
