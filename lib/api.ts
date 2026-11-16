// The one place the app talks to the SousChef server. Everything else (stores, services) calls this, never `fetch`.
//
//  - Turned on by EXPO_PUBLIC_API_URL. Without it the app keeps using Firebase, so nothing changes until the server is live.
//  - Keeps the sign-in tokens in secure storage and refreshes the short-lived one by itself. Many requests that notice
//    the token ran out at the same moment share ONE refresh (a refresh token works only once, so two would sign the person out).
//  - Errors come back as `ApiError` with the server's machine-readable `code`, so screens switch on codes, not on text.
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ApiErrorBody, AuthResponse, AuthTokens, ErrorCode } from '../shared/index';

/** A failure from the server (`code` from the server) or from getting there (`network`, `timeout`). */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode | 'network' | 'timeout',
    message: string,
    readonly details?: Record<string, string>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Where the tokens are kept between launches. */
export interface TokenStorage {
  load(): Promise<AuthTokens | null>;
  save(tokens: AuthTokens | null): Promise<void>;
}

const KEY = 'souschef.tokens.v1';

/** Secure storage on a phone (Keychain / Keystore); plain async storage on the web, which has nothing safer. */
export function defaultTokenStorage(): TokenStorage {
  type SecureStore = { getItemAsync(k: string): Promise<string | null>; setItemAsync(k: string, v: string): Promise<void>; deleteItemAsync(k: string): Promise<void> };
  let secure: SecureStore | null = null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('expo-secure-store') as SecureStore & { isAvailableAsync?: () => Promise<boolean> };
    secure = typeof mod.getItemAsync === 'function' ? mod : null;
  } catch {
    secure = null;
  }
  return {
    async load() {
      try {
        const raw = secure ? await secure.getItemAsync(KEY) : await AsyncStorage.getItem(KEY);
        return raw ? (JSON.parse(raw) as AuthTokens) : null;
      } catch {
        return null; // unreadable storage means signed out, not a crash
      }
    },
    async save(tokens) {
      try {
        if (!tokens) {
          if (secure) await secure.deleteItemAsync(KEY);
          else await AsyncStorage.removeItem(KEY);
          return;
        }
        const raw = JSON.stringify(tokens);
        if (secure) await secure.setItemAsync(KEY, raw);
        else await AsyncStorage.setItem(KEY, raw);
      } catch {
        // If it cannot be saved the person simply signs in again next launch.
      }
    },
  };
}

export interface RequestOptions {
  query?: Record<string, string | number | boolean | undefined | null>;
  body?: unknown;
  /** Skip the Authorization header (sign-in and sign-up). Default: send it when signed in. */
  anonymous?: boolean;
  /** Milliseconds before giving up. */
  timeoutMs?: number;
  signal?: AbortSignal;
}

export interface ApiClientOptions {
  baseUrl: string;
  storage?: TokenStorage;
  fetch?: typeof fetch;
  /** Called when the server no longer accepts the saved sign-in (the refresh failed), so the app can show the sign-in screen. */
  onSignedOut?: () => void;
  now?: () => number;
}

/** Refresh a little before the access token actually runs out, so a request does not leave with one that dies on the way. */
const REFRESH_MARGIN_MS = 30_000;
const DEFAULT_TIMEOUT_MS = 20_000;

export function createApiClient(options: ApiClientOptions) {
  const base = options.baseUrl.replace(/\/$/, '');
  const storage = options.storage ?? defaultTokenStorage();
  const doFetch = options.fetch ?? ((...args: Parameters<typeof fetch>) => fetch(...args));
  const now = options.now ?? Date.now;

  let tokens: AuthTokens | null = null;
  let loaded: Promise<void> | null = null;
  let refreshing: Promise<AuthTokens | null> | null = null;

  const ensureLoaded = () => (loaded ??= storage.load().then((t) => void (tokens ??= t)));

  async function setTokens(next: AuthTokens | null): Promise<void> {
    tokens = next;
    loaded = Promise.resolve();
    await storage.save(next);
  }

  /** One refresh at a time, whoever asks. */
  function refresh(): Promise<AuthTokens | null> {
    refreshing ??= (async () => {
      const current = tokens;
      if (!current) return null;
      try {
        const res = await send('POST', '/v1/auth/refresh', { body: { refreshToken: current.refreshToken }, anonymous: true }, false);
        const next = (res as AuthResponse).tokens;
        await setTokens(next);
        return next;
      } catch (err) {
        // The server said no (expired, reused, account suspended): the sign-in is over. A dropped connection is not a "no".
        if (err instanceof ApiError && err.status >= 400 && err.status < 500) {
          await setTokens(null);
          options.onSignedOut?.();
          return null;
        }
        throw err;
      } finally {
        refreshing = null;
      }
    })();
    return refreshing;
  }

  async function send(method: string, path: string, opts: RequestOptions, canRetry: boolean): Promise<unknown> {
    await ensureLoaded();
    let active = opts.anonymous ? null : tokens;
    if (active && Date.parse(active.accessTokenExpiresAt) - now() < REFRESH_MARGIN_MS) active = await refresh();

    const url = new URL(base + path);
    for (const [k, v] of Object.entries(opts.query ?? {})) if (v !== undefined && v !== null) url.searchParams.set(k, String(v));

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);
    opts.signal?.addEventListener('abort', () => controller.abort(), { once: true });
    let res: Response;
    try {
      res = await doFetch(url.toString(), {
        method,
        headers: { ...(opts.body !== undefined ? { 'content-type': 'application/json' } : {}), accept: 'application/json', ...(active ? { authorization: `Bearer ${active.accessToken}` } : {}) },
        ...(opts.body !== undefined ? { body: JSON.stringify(opts.body) } : {}),
        signal: controller.signal,
      });
    } catch {
      const timedOut = controller.signal.aborted && !opts.signal?.aborted;
      throw new ApiError(0, timedOut ? 'timeout' : 'network', timedOut ? 'The server took too long to answer' : 'Could not reach the server');
    } finally {
      clearTimeout(timer);
    }

    if (res.status === 401 && active && canRetry && path !== '/v1/auth/refresh') {
      // The token was refused (revoked or clock drift). Try once with a fresh one.
      const fresh = await refresh();
      if (fresh) return send(method, path, opts, false);
    }
    if (res.status === 204) return undefined;
    let data: unknown = null;
    try {
      data = await res.json();
    } catch {
      // not JSON
    }
    if (!res.ok) {
      const body = (data as Partial<ApiErrorBody> | null)?.error;
      throw new ApiError(res.status, body?.code ?? 'internal', body?.message ?? 'Something went wrong', body?.details);
    }
    return data;
  }

  const request = <T>(method: string, path: string, opts: RequestOptions = {}) => send(method, path, opts, true) as Promise<T>;

  return {
    request,
    get: <T>(path: string, opts?: Omit<RequestOptions, 'body'>) => request<T>('GET', path, opts),
    post: <T>(path: string, body?: unknown, opts?: RequestOptions) => request<T>('POST', path, { ...opts, body: body ?? {} }),
    put: <T>(path: string, body?: unknown, opts?: RequestOptions) => request<T>('PUT', path, { ...opts, body: body ?? {} }),
    patch: <T>(path: string, body?: unknown, opts?: RequestOptions) => request<T>('PATCH', path, { ...opts, body: body ?? {} }),
    delete: <T = void>(path: string, opts?: RequestOptions) => request<T>('DELETE', path, opts),
    /** Saves the tokens from a sign-in or sign-up. */
    setTokens,
    /** Is anybody signed in on this device? (Reads the saved tokens once.) */
    async hasSession(): Promise<boolean> {
      await ensureLoaded();
      return tokens !== null;
    },
    /** Forget the sign-in on this device (after signing out or deleting the account). */
    async clear(): Promise<void> {
      await setTokens(null);
    },
    /** A current access token (refreshed first if it is about to run out), or null when signed out. For the live connection. */
    async accessToken(): Promise<string | null> {
      await ensureLoaded();
      if (!tokens) return null;
      if (Date.parse(tokens.accessTokenExpiresAt) - now() < REFRESH_MARGIN_MS) return (await refresh())?.accessToken ?? null;
      return tokens.accessToken;
    },
    /** The saved refresh token, for telling the server to end this session on sign-out. */
    async refreshToken(): Promise<string | null> {
      await ensureLoaded();
      return tokens?.refreshToken ?? null;
    },
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;

/** The server address, or '' when the app should keep using Firebase. */
export const apiUrl = (): string => (process.env.EXPO_PUBLIC_API_URL ?? '').trim();
export const apiEnabled = (): boolean => apiUrl() !== '';

let shared: ApiClient | null = null;
let signedOutListener: (() => void) | null = null;

/** Called by the auth store, to learn when the server ends the sign-in on its own. */
export function onApiSignedOut(listener: (() => void) | null): void {
  signedOutListener = listener;
}

/** The app-wide client. Created on first use so merely importing this file costs nothing. */
export function api(): ApiClient {
  if (!apiEnabled()) throw new Error('EXPO_PUBLIC_API_URL is not set');
  return (shared ??= createApiClient({ baseUrl: apiUrl(), onSignedOut: () => signedOutListener?.() }));
}

/** For tests. */
export function resetApiForTests(): void {
  shared = null;
  signedOutListener = null;
}
