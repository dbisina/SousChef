// The one place the dashboard talks to the SousChef server. Everything else calls this, never `fetch`.
//  - Only staff may sign in: an ordinary account is signed straight back out.
//  - Tokens live in sessionStorage (gone when the tab closes), never in localStorage.
//  - Many requests that notice the token ran out at once share ONE refresh (a refresh token works only once).
import type { ApiErrorBody, AuthResponse, AuthTokens, Me } from '@shared';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** The account signed in fine but is not staff. */
export class NotStaffError extends Error {
  constructor() {
    super('This account is not staff.');
    this.name = 'NotStaffError';
  }
}

export interface TokenStore {
  load(): AuthTokens | null;
  save(tokens: AuthTokens | null): void;
}

const KEY = 'souschef.admin.tokens.v1';

export const sessionTokenStore: TokenStore = {
  load() {
    try {
      const raw = sessionStorage.getItem(KEY);
      return raw ? (JSON.parse(raw) as AuthTokens) : null;
    } catch {
      return null;
    }
  },
  save(tokens) {
    try {
      if (tokens) sessionStorage.setItem(KEY, JSON.stringify(tokens));
      else sessionStorage.removeItem(KEY);
    } catch {
      // Storage can be blocked; the session then lasts until the page is reloaded.
    }
  },
};

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export class AdminApi {
  private tokens: AuthTokens | null;
  private refreshing: Promise<boolean> | null = null;

  constructor(
    private readonly store: TokenStore = sessionTokenStore,
    private readonly request: typeof fetch = (...args) => fetch(...args),
    private readonly onSignedOut: () => void = () => undefined,
    private readonly base = '',
  ) {
    this.tokens = store.load();
  }

  get signedIn(): boolean {
    return this.tokens !== null;
  }

  async login(email: string, password: string): Promise<Me> {
    const res = await this.raw<AuthResponse>('POST', '/v1/auth/login', { email, password }, null);
    if (res.user.role !== 'admin') {
      // Do not leave a session behind for an account that has no business here.
      await this.raw('POST', '/v1/auth/logout', { refreshToken: res.tokens.refreshToken }, res.tokens).catch(() => undefined);
      throw new NotStaffError();
    }
    this.set(res.tokens);
    return res.user;
  }

  async logout(): Promise<void> {
    const tokens = this.tokens;
    this.set(null);
    if (tokens) await this.raw('POST', '/v1/auth/logout', { refreshToken: tokens.refreshToken }, tokens).catch(() => undefined);
  }

  get<T>(path: string): Promise<T> {
    return this.send<T>('GET', path);
  }
  post<T = void>(path: string, body?: unknown): Promise<T> {
    return this.send<T>('POST', path, body ?? {});
  }
  patch<T>(path: string, body: unknown): Promise<T> {
    return this.send<T>('PATCH', path, body);
  }
  put<T>(path: string, body: unknown): Promise<T> {
    return this.send<T>('PUT', path, body);
  }
  del(path: string): Promise<void> {
    return this.send<void>('DELETE', path);
  }

  /* ---- internals ---- */

  private set(tokens: AuthTokens | null): void {
    this.tokens = tokens;
    this.store.save(tokens);
  }

  private async send<T>(method: Method, path: string, body?: unknown, retry = true): Promise<T> {
    if (!this.tokens) throw new ApiError(401, 'unauthorized', 'Please sign in.');
    try {
      return await this.raw<T>(method, path, body, this.tokens);
    } catch (err) {
      if (retry && err instanceof ApiError && err.status === 401) {
        if (await this.refresh()) return this.send<T>(method, path, body, false);
        this.set(null);
        this.onSignedOut();
      }
      throw err;
    }
  }

  private refresh(): Promise<boolean> {
    if (!this.refreshing) {
      const current = this.tokens;
      this.refreshing = (async () => {
        if (!current) return false;
        try {
          const res = await this.raw<AuthResponse>('POST', '/v1/auth/refresh', { refreshToken: current.refreshToken }, null);
          if (res.user.role !== 'admin') return false;
          this.set(res.tokens);
          return true;
        } catch {
          return false;
        } finally {
          this.refreshing = null;
        }
      })();
    }
    return this.refreshing;
  }

  private async raw<T>(method: Method, path: string, body: unknown, tokens: AuthTokens | null): Promise<T> {
    let res: Response;
    try {
      res = await this.request(`${this.base}${path}`, {
        method,
        headers: { ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...(tokens ? { authorization: `Bearer ${tokens.accessToken}` } : {}) },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      });
    } catch {
      throw new ApiError(0, 'network', 'Could not reach the server.');
    }
    if (res.status === 204) return undefined as T;
    const data: unknown = await res.json().catch(() => null);
    if (!res.ok) {
      const e = (data as ApiErrorBody | null)?.error;
      throw new ApiError(res.status, e?.code ?? 'internal', e?.message ?? `The server answered ${res.status}.`);
    }
    return data as T;
  }
}
