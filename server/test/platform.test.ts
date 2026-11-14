import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { ApiErrorBody, HealthResponse } from '@shared';
import { loadConfig } from '../src/config';
import { makeApp, uniqueEmail, type TestApp } from './helpers';

describe('health and errors', () => {
  let t: TestApp;
  beforeAll(async () => {
    t = await makeApp();
  });
  afterAll(() => t.close());

  it('says it is alive without touching the database', async () => {
    const res = await t.app.inject({ method: 'GET', url: '/healthz' });
    expect(res.statusCode).toBe(200);
    const body = res.json<HealthResponse>();
    expect(body.status).toBe('ok');
    expect(body.uptime).toBeGreaterThanOrEqual(0);
  });

  it('says it is ready when the database answers', async () => {
    const res = await t.app.inject({ method: 'GET', url: '/readyz' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok' });
  });

  it('answers an unknown address with the standard error body', async () => {
    const res = await t.app.inject({ method: 'GET', url: '/v1/nothing-here' });
    expect(res.statusCode).toBe(404);
    expect(res.json<ApiErrorBody>().error.code).toBe('not_found');
  });

  it('refuses a request body that is too large', async () => {
    const res = await t.app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: 'a@b.co', password: 'x'.repeat(300 * 1024) },
    });
    expect(res.statusCode).toBe(413);
    expect(res.json<ApiErrorBody>().error.code).toBe('validation_error');
  });

  it('sends security headers and does not announce what it runs on', async () => {
    const res = await t.app.inject({ method: 'GET', url: '/healthz' });
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('never puts the password in an error response', async () => {
    const res = await t.app.inject({ method: 'POST', url: '/v1/auth/login', payload: { email: 'nope', password: 'SuperSecret123!' } });
    expect(res.statusCode).toBe(400);
    expect(res.body).not.toContain('SuperSecret123!');
  });
});

describe('rate limiting', () => {
  it('slows sign-in guessing: the eleventh try in a minute is refused', async () => {
    const t = await makeApp({ AUTH_RATE_LIMIT_MAX: '10' });
    try {
      const attempt = () =>
        t.app.inject({ method: 'POST', url: '/v1/auth/login', payload: { email: uniqueEmail(), password: 'guess-guess-guess' } });
      const codes: number[] = [];
      for (let i = 0; i < 12; i++) codes.push((await attempt()).statusCode);
      expect(codes.slice(0, 10).every((c) => c === 401)).toBe(true);
      expect(codes.slice(10)).toEqual([429, 429]);
      const limited = await attempt();
      expect(limited.json<ApiErrorBody>().error.code).toBe('rate_limited');
      expect(limited.headers['retry-after']).toBeDefined();
    } finally {
      await t.close();
    }
  });

  it('limits the whole API per address', async () => {
    const t = await makeApp({ RATE_LIMIT_MAX: '5' });
    try {
      const codes: number[] = [];
      for (let i = 0; i < 7; i++) codes.push((await t.app.inject({ method: 'GET', url: '/healthz' })).statusCode);
      expect(codes).toEqual([200, 200, 200, 200, 200, 429, 429]);
    } finally {
      await t.close();
    }
  });

  it('counts each address on its own when it sits behind Cloudflare', async () => {
    const t = await makeApp({ RATE_LIMIT_MAX: '2', TRUST_PROXY: 'true' });
    try {
      const hit = (ip: string) => t.app.inject({ method: 'GET', url: '/healthz', headers: { 'cf-connecting-ip': ip } });
      expect((await hit('203.0.113.1')).statusCode).toBe(200);
      expect((await hit('203.0.113.1')).statusCode).toBe(200);
      expect((await hit('203.0.113.1')).statusCode).toBe(429);
      expect((await hit('203.0.113.2')).statusCode).toBe(200);
    } finally {
      await t.close();
    }
  });

  it('ignores that header when it is not behind Cloudflare, so it cannot be used to dodge the limit', async () => {
    const t = await makeApp({ RATE_LIMIT_MAX: '2', TRUST_PROXY: 'false' });
    try {
      const hit = (ip: string) => t.app.inject({ method: 'GET', url: '/healthz', headers: { 'cf-connecting-ip': ip } });
      expect((await hit('203.0.113.1')).statusCode).toBe(200);
      expect((await hit('203.0.113.2')).statusCode).toBe(200);
      expect((await hit('203.0.113.3')).statusCode).toBe(429);
    } finally {
      await t.close();
    }
  });
});

describe('configuration', () => {
  const ok = { DATABASE_URL: 'postgresql://x', JWT_SECRET: 'x'.repeat(32) };

  it('fills in defaults', () => {
    const c = loadConfig(ok);
    expect(c).toMatchObject({ NODE_ENV: 'development', PORT: 3000, ACCESS_TOKEN_TTL_SECONDS: 900, REFRESH_TOKEN_TTL_DAYS: 60, TRUST_PROXY: false });
    expect(c.GOOGLE_CLIENT_IDS).toEqual([]);
  });

  it('reads comma separated client ids', () => {
    const c = loadConfig({ ...ok, GOOGLE_CLIENT_IDS: ' a.apps.test , b.apps.test ,', APPLE_CLIENT_IDS: 'com.example.app' });
    expect(c.GOOGLE_CLIENT_IDS).toEqual(['a.apps.test', 'b.apps.test']);
    expect(c.APPLE_CLIENT_IDS).toEqual(['com.example.app']);
  });

  it('refuses a weak or missing secret and says why, in one message', () => {
    expect(() => loadConfig({ DATABASE_URL: 'postgresql://x', JWT_SECRET: 'short' })).toThrow(/JWT_SECRET must be at least 32/);
    expect(() => loadConfig({ JWT_SECRET: 'x'.repeat(32) })).toThrow(/DATABASE_URL/);
    expect(() => loadConfig({})).toThrow(/DATABASE_URL[\s\S]*JWT_SECRET/);
  });

  it('refuses nonsense values', () => {
    expect(() => loadConfig({ ...ok, PORT: 'abc' })).toThrow(/PORT/);
    expect(() => loadConfig({ ...ok, PORT: '70000' })).toThrow(/PORT/);
    expect(() => loadConfig({ ...ok, NODE_ENV: 'staging' })).toThrow(/NODE_ENV/);
    expect(() => loadConfig({ ...ok, TRUST_PROXY: 'yes' })).toThrow(/TRUST_PROXY/);
  });
});
