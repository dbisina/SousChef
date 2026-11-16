import { ApiError, createApiClient, type TokenStorage } from '@/lib/api';
import type { AuthTokens } from '@shared/index';

const NOW = Date.parse('2026-11-15T12:00:00Z');
const tokens = (name: string, expiresInMs = 15 * 60_000): AuthTokens => ({
  accessToken: `access-${name}`,
  accessTokenExpiresAt: new Date(NOW + expiresInMs).toISOString(),
  refreshToken: `refresh-${name}`,
});

const memoryStorage = (initial: AuthTokens | null = null) => {
  const store = { value: initial, saves: 0 };
  const storage: TokenStorage = {
    load: async () => store.value,
    save: async (t) => {
      store.value = t;
      store.saves++;
    },
  };
  return { store, storage };
};

const json = (status: number, body?: unknown) =>
  ({ ok: status >= 200 && status < 300, status, json: async () => body ?? null }) as Response;

type Handler = (url: URL, init: RequestInit) => Response | Promise<Response>;
function fakeFetch(handler: Handler) {
  const calls: { url: URL; init: RequestInit; auth: string | undefined }[] = [];
  const fn = jest.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = new URL(String(input));
    calls.push({ url, init, auth: (init.headers as Record<string, string> | undefined)?.authorization });
    return handler(url, init);
  });
  return { fn: fn as unknown as typeof fetch, calls };
}

const client = (handler: Handler, saved: AuthTokens | null = tokens('one'), extra: { onSignedOut?: () => void } = {}) => {
  const f = fakeFetch(handler);
  const mem = memoryStorage(saved);
  const api = createApiClient({ baseUrl: 'https://api.test/', storage: mem.storage, fetch: f.fn, now: () => NOW, ...extra });
  return { api, ...f, ...mem };
};

describe('requests', () => {
  it('sends JSON with the saved access token and reads the answer', async () => {
    const c = client(() => json(200, { hello: 'chef' }));
    expect(await c.api.get('/v1/me')).toEqual({ hello: 'chef' });
    expect(c.calls[0]?.auth).toBe('Bearer access-one');
    expect(c.calls[0]?.url.toString()).toBe('https://api.test/v1/me');

    await c.api.post('/v1/recipes', { title: 'Jollof' });
    expect(c.calls[1]?.init.body).toBe('{"title":"Jollof"}');
    expect((c.calls[1]?.init.headers as Record<string, string>)['content-type']).toBe('application/json');
  });

  it('builds the query string, leaving out what is not set', async () => {
    const c = client(() => json(200, {}));
    await c.api.get('/v1/recipes', { query: { q: 'rice & peas', limit: 20, cursor: undefined, flag: false, none: null } });
    expect(c.calls[0]?.url.search).toBe('?q=rice+%26+peas&limit=20&flag=false');
  });

  it('can leave the token out for sign-in and sign-up', async () => {
    const c = client(() => json(200, {}));
    await c.api.post('/v1/auth/login', { email: 'a@b.c' }, { anonymous: true });
    expect(c.calls[0]?.auth).toBeUndefined();
  });

  it('answers nothing for a 204', async () => {
    const c = client(() => json(204));
    expect(await c.api.delete('/v1/me/devices/x')).toBeUndefined();
  });

  it('sends no token when nobody is signed in', async () => {
    const c = client(() => json(200, {}), null);
    await c.api.get('/v1/recipes');
    expect(c.calls[0]?.auth).toBeUndefined();
    expect(await c.api.hasSession()).toBe(false);
  });
});

describe('errors', () => {
  const failure = (c: ReturnType<typeof client>) => c.api.get('/v1/x').then(() => null, (e: unknown) => e as ApiError);

  it('carries the server\'s code, message and field details', async () => {
    const c = client(() => json(400, { error: { code: 'validation_error', message: 'Some fields are not valid', details: { email: 'Bad email' } } }));
    const err = await failure(c);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 400, code: 'validation_error', details: { email: 'Bad email' } });
  });

  it('copes with an answer that is not JSON', async () => {
    const c = client(() => ({ ok: false, status: 502, json: async () => { throw new Error('html'); } }) as unknown as Response);
    expect(await failure(c)).toMatchObject({ status: 502, code: 'internal' });
  });

  it('reports a dropped connection as network, not as a server error', async () => {
    const c = client(() => { throw new TypeError('Network request failed'); });
    expect(await failure(c)).toMatchObject({ status: 0, code: 'network' });
  });

  it('gives up after the timeout', async () => {
    const f = fakeFetch((_url, init) => new Promise<Response>((_res, rej) => init.signal?.addEventListener('abort', () => rej(new Error('aborted')))));
    const api = createApiClient({ baseUrl: 'https://api.test', storage: memoryStorage(null).storage, fetch: f.fn });
    const err = await api.get('/v1/slow', { timeoutMs: 20 }).then(() => null, (e: unknown) => e as ApiError);
    expect(err).toMatchObject({ code: 'timeout' });
  });
});

describe('keeping the sign-in alive', () => {
  const refreshAnswer = (name: string) => json(200, { user: {}, tokens: tokens(name) });

  it('refreshes ahead of time when the token is about to run out, then uses the new one', async () => {
    const c = client((url) => (url.pathname === '/v1/auth/refresh' ? refreshAnswer('two') : json(200, {})), tokens('one', 10_000));
    await c.api.get('/v1/me');
    expect(c.calls.map((x) => x.url.pathname)).toEqual(['/v1/auth/refresh', '/v1/me']);
    expect(JSON.parse(String(c.calls[0]?.init.body))).toEqual({ refreshToken: 'refresh-one' });
    expect(c.calls[1]?.auth).toBe('Bearer access-two');
    expect(c.store.value?.refreshToken).toBe('refresh-two'); // saved for the next launch
  });

  it('shares ONE refresh between requests that find the token expired at the same moment', async () => {
    let refreshes = 0;
    const c = client(async (url) => {
      if (url.pathname === '/v1/auth/refresh') {
        refreshes++;
        await new Promise((r) => setTimeout(r, 15));
        return refreshAnswer('two');
      }
      return json(200, {});
    }, tokens('one', -1000));
    await Promise.all([1, 2, 3, 4, 5].map((i) => c.api.get(`/v1/thing/${i}`)));
    expect(refreshes).toBe(1);
    const sent = c.calls.filter((x) => x.url.pathname.startsWith('/v1/thing'));
    expect(sent).toHaveLength(5);
    expect(new Set(sent.map((x) => x.auth))).toEqual(new Set(['Bearer access-two']));
  });

  it('refreshes and retries once when the server turns a token down', async () => {
    let first = true;
    const c = client((url) => {
      if (url.pathname === '/v1/auth/refresh') return refreshAnswer('two');
      if (first) { first = false; return json(401, { error: { code: 'unauthorized', message: 'Sign in to continue' } }); }
      return json(200, { ok: true });
    });
    expect(await c.api.get('/v1/me')).toEqual({ ok: true });
    expect(c.calls.map((x) => x.url.pathname)).toEqual(['/v1/me', '/v1/auth/refresh', '/v1/me']);
  });

  it('does not loop when the retry is refused too', async () => {
    const c = client((url) => (url.pathname === '/v1/auth/refresh' ? refreshAnswer('two') : json(401, { error: { code: 'unauthorized', message: 'No' } })));
    await expect(c.api.get('/v1/me')).rejects.toMatchObject({ status: 401, code: 'unauthorized' });
    expect(c.calls.filter((x) => x.url.pathname === '/v1/me')).toHaveLength(2);
  });

  it('signs the person out when the server rejects the refresh token, and says so once', async () => {
    const onSignedOut = jest.fn();
    const c = client(
      (url) => (url.pathname === '/v1/auth/refresh' ? json(401, { error: { code: 'token_reuse', message: 'Sign in again' } }) : json(401, { error: { code: 'unauthorized', message: 'No' } })),
      tokens('one', -1000),
      { onSignedOut },
    );
    await expect(Promise.all([c.api.get('/v1/a'), c.api.get('/v1/b')].map((p) => p.catch((e: unknown) => e)))).resolves.toHaveLength(2);
    expect(onSignedOut).toHaveBeenCalledTimes(1);
    expect(c.store.value).toBeNull();
    expect(await c.api.hasSession()).toBe(false);
  });

  it('stays signed in when the refresh fails only because the connection dropped', async () => {
    const onSignedOut = jest.fn();
    const c = client((url) => { if (url.pathname === '/v1/auth/refresh') throw new TypeError('offline'); return json(200, {}); }, tokens('one', -1000), { onSignedOut });
    await expect(c.api.get('/v1/me')).rejects.toMatchObject({ code: 'network' });
    expect(onSignedOut).not.toHaveBeenCalled();
    expect(c.store.value?.refreshToken).toBe('refresh-one');
  });

  it('keeps tokens between launches and forgets them on clear', async () => {
    const mem = memoryStorage(null);
    const f = fakeFetch(() => json(200, {}));
    const first = createApiClient({ baseUrl: 'https://api.test', storage: mem.storage, fetch: f.fn, now: () => NOW });
    await first.setTokens(tokens('one'));
    const second = createApiClient({ baseUrl: 'https://api.test', storage: mem.storage, fetch: f.fn, now: () => NOW });
    expect(await second.hasSession()).toBe(true);
    expect(await second.refreshToken()).toBe('refresh-one');
    await second.clear();
    expect(mem.store.value).toBeNull();
    expect(await second.hasSession()).toBe(false);
  });
});
