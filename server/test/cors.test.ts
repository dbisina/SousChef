import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { makeApp, type TestApp } from './helpers';

const WEB = 'http://localhost:8081';
let on: TestApp;
let off: TestApp;

beforeAll(async () => {
  on = await makeApp({ CORS_ORIGINS: `${WEB},https://app.example.com` });
  off = await makeApp();
});
afterAll(async () => {
  await on.close();
  await off.close();
});

describe('CORS allow-list', () => {
  it('answers a preflight from an allowed origin', async () => {
    const res = await on.app.inject({
      method: 'OPTIONS',
      url: '/v1/health',
      headers: { origin: WEB, 'access-control-request-method': 'POST' },
    });
    expect(res.statusCode).toBe(204);
    expect(res.headers['access-control-allow-origin']).toBe(WEB);
    expect(res.headers['access-control-allow-headers']).toContain('authorization');
    expect(res.headers['access-control-allow-credentials']).toBeUndefined();
  });

  it('adds the header to a normal response from an allowed origin', async () => {
    const res = await on.app.inject({ method: 'GET', url: '/v1/health', headers: { origin: WEB } });
    expect(res.headers['access-control-allow-origin']).toBe(WEB);
    expect(res.headers.vary).toContain('Origin');
  });

  it('gives an unlisted origin nothing', async () => {
    const res = await on.app.inject({ method: 'GET', url: '/v1/health', headers: { origin: 'https://evil.example' } });
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('is off when CORS_ORIGINS is unset', async () => {
    const res = await off.app.inject({ method: 'GET', url: '/v1/health', headers: { origin: WEB } });
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });
});
