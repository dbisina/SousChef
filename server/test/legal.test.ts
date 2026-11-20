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

// Android Google sign-in comes back to this page, which passes the result on to the app.
describe('Google sign-in relay', () => {
  it('serves the page with its script as a separate file (no inline script)', async () => {
    const page = await t.app.inject({ method: 'GET', url: '/auth/google-relay' });
    expect(page.statusCode).toBe(200);
    expect(page.headers['content-type']).toContain('text/html');
    expect(page.body).toContain('<script src="/auth/google-relay.js"></script>');
    expect(page.body).not.toMatch(/<script>[^<]/);
  });

  it('serves a script that forwards the query and the # part to the app', async () => {
    const js = await t.app.inject({ method: 'GET', url: '/auth/google-relay.js' });
    expect(js.statusCode).toBe(200);
    expect(js.headers['content-type']).toContain('javascript');
    expect(js.body).toContain("enplace://google-auth'+location.search+location.hash");
  });
});
