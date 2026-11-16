import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config';
import { makeApp, type TestApp } from './helpers';

let dir: string;
let outside: string;
let on: TestApp;
let off: TestApp;

beforeAll(async () => {
  const sandbox = mkdtempSync(path.join(tmpdir(), 'admin-site-'));
  dir = path.join(sandbox, 'dist');
  outside = path.join(sandbox, 'secret.txt');
  mkdirSync(path.join(dir, 'assets'), { recursive: true });
  writeFileSync(path.join(dir, 'index.html'), '<!doctype html><title>SousChef staff</title><div id="root"></div>');
  writeFileSync(path.join(dir, 'assets', 'index-abc123.js'), 'console.log("hi")');
  writeFileSync(path.join(dir, 'assets', 'index-abc123.css'), 'body{margin:0}');
  writeFileSync(path.join(dir, 'favicon.svg'), '<svg xmlns="http://www.w3.org/2000/svg"/>');
  writeFileSync(outside, 'do not serve me');
  on = await makeApp({ ADMIN_DIR: dir });
  off = await makeApp();
});
afterAll(async () => {
  await on.close();
  await off.close();
  rmSync(path.dirname(dir), { recursive: true, force: true });
});

const get = (t: TestApp, url: string) => t.app.inject({ method: 'GET', url });

describe('the staff dashboard served by the API', () => {
  it('serves the page at /admin/ and sends /admin to /admin/', async () => {
    const page = await get(on, '/admin/');
    expect(page.statusCode).toBe(200);
    expect(page.headers['content-type']).toContain('text/html');
    expect(page.body).toContain('SousChef staff');
    const bare = await get(on, '/admin');
    expect(bare.statusCode).toBe(301);
    expect(bare.headers['location']).toBe('/admin/');
  });

  it('never lets the page be cached, locks it down, and keeps it out of search engines', async () => {
    const page = await get(on, '/admin/');
    expect(page.headers['cache-control']).toBe('no-store');
    expect(page.headers['x-frame-options']).toBe('DENY');
    expect(page.headers['x-robots-tag']).toBe('noindex');
    expect(page.headers['x-content-type-options']).toBe('nosniff');
    expect(String(page.headers['content-security-policy'])).toContain("frame-ancestors 'none'");
    expect(String(page.headers['content-security-policy'])).toContain("connect-src 'self'");
  });

  it('serves the built scripts and styles, cached for a year because their names change with their content', async () => {
    const js = await get(on, '/admin/assets/index-abc123.js');
    expect(js.statusCode).toBe(200);
    expect(js.headers['content-type']).toContain('text/javascript');
    expect(js.headers['cache-control']).toBe('public, max-age=31536000, immutable');
    expect(js.body).toBe('console.log("hi")');
    expect((await get(on, '/admin/assets/index-abc123.css')).headers['content-type']).toContain('text/css');
    expect((await get(on, '/admin/favicon.svg')).headers['content-type']).toBe('image/svg+xml');
  });

  it('gives the page for an address the browser handles itself, and a plain 404 for a missing file', async () => {
    const route = await get(on, '/admin/reports');
    expect(route.statusCode).toBe(200);
    expect(route.body).toContain('SousChef staff');
    const missing = await get(on, '/admin/assets/gone-1.js');
    expect(missing.statusCode).toBe(404);
    expect(missing.body).not.toContain('SousChef staff');
  });

  it('cannot be tricked into reading anything outside its folder', async () => {
    const tries = ['/admin/../secret.txt', '/admin/%2e%2e/secret.txt', '/admin/..%2fsecret.txt', '/admin/assets/../../secret.txt', '/admin/%2e%2e%2f%2e%2e%2fetc/passwd', '/admin/..\\secret.txt', '/admin/a%00.html'];
    for (const url of tries) {
      const res = await get(on, url);
      expect(res.body, url).not.toContain('do not serve me');
      expect([200, 400, 404], url).toContain(res.statusCode);
      if (res.statusCode === 200) expect(res.body, url).toContain('SousChef staff'); // only the app shell, never the file
    }
    expect((await get(on, '/admin/%2e%2e/secret.txt')).statusCode).toBe(404);
  });

  it('leaves the API alone', async () => {
    expect((await get(on, '/healthz')).statusCode).toBe(200);
    const stats = await get(on, '/v1/admin/stats');
    expect(stats.statusCode).toBe(401); // still the API's own answer, not the dashboard
  });

  it('is off unless ADMIN_DIR is set', async () => {
    expect((await get(off, '/admin/')).statusCode).toBe(404);
    expect(loadConfig({ DATABASE_URL: 'postgresql://x', JWT_SECRET: 'x'.repeat(32) }).ADMIN_DIR).toBe('');
  });

  it('says so plainly when the dashboard has not been built', async () => {
    const empty = await makeApp({ ADMIN_DIR: path.join(path.dirname(dir), 'nothing-here') });
    try {
      const res = await get(empty, '/admin/');
      expect(res.statusCode).toBe(404);
      expect(res.body).toContain('has not been built');
    } finally {
      await empty.close();
    }
  });
});
