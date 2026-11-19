import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { makeApp, type TestApp } from './helpers';

let t: TestApp;
beforeAll(async () => {
  t = await makeApp();
});
afterAll(async () => {
  await t.close();
});

// The stores ask for public web addresses for the privacy policy, the terms and how to delete an account.
describe('public legal pages', () => {
  it.each([
    ['/privacy', 'Privacy policy'],
    ['/terms', 'Terms of use'],
    ['/delete-account', 'Delete your enplace account'],
  ])('%s is public HTML', async (url, title) => {
    const res = await t.app.inject({ method: 'GET', url });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/html');
    expect(res.body).toContain(title);
    expect(res.body).not.toContain('<script');
  });
});
