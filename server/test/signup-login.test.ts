import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { SignJWT } from 'jose';
import type { ApiErrorBody, AuthResponse, Me } from '@shared';
import { PASSWORD, bearer, makeApp, register, uniqueEmail, type TestApp } from './helpers';

let t: TestApp;
beforeAll(async () => {
  t = await makeApp();
});
afterAll(() => t.close());
beforeEach(() => t.reset());

const post = (url: string, payload: unknown) => t.app.inject({ method: 'POST', url, payload: payload as object });

describe('register', () => {
  it('creates an account and signs it in', async () => {
    const email = uniqueEmail();
    const res = await post('/v1/auth/register', {
      email: `  ${email.toUpperCase()} `,
      password: PASSWORD,
      displayName: 'Ama Okafor',
      acceptedTermsVersion: '2026-11-01',
    });
    expect(res.statusCode).toBe(201);
    const body = res.json<AuthResponse>();
    expect(body.user.email).toBe(email);
    expect(body.user.handle).toBe('ama_okafor');
    expect(body.user.displayName).toBe('Ama Okafor');
    expect(body.user.providers).toEqual(['password']);
    expect(body.user.isChef).toBe(false);
    expect(body.user.isVerifiedChef).toBe(false);
    expect(body.user.role).toBe('user');
    expect(body.tokens.accessToken.split('.')).toHaveLength(3);
    expect(body.tokens.refreshToken.length).toBeGreaterThan(30);
    expect(new Date(body.tokens.accessTokenExpiresAt).getTime()).toBeGreaterThan(Date.now());
  });

  it('never returns the password or its hash, and stores only a hash', async () => {
    const auth = await register(t);
    expect(JSON.stringify(auth)).not.toContain(PASSWORD);
    expect(JSON.stringify(auth)).not.toContain('argon2');
    const row = await t.db.user.findUniqueOrThrow({ where: { id: auth.user.id } });
    expect(row.passwordHash).toMatch(/^\$argon2id\$/);
    expect(row.passwordHash).not.toContain(PASSWORD);
  });

  it('records that the terms and privacy policy were accepted, with the version', async () => {
    const auth = await register(t);
    const consents = await t.db.consent.findMany({ where: { userId: auth.user.id }, orderBy: { kind: 'asc' } });
    expect(consents.map((c) => [c.kind, c.version, c.withdrawnAt])).toEqual([
      ['TERMS', '2026-11-01', null],
      ['PRIVACY', '2026-11-01', null],
    ]);
  });

  it('refuses a second account with the same email, whatever the letter case', async () => {
    const email = uniqueEmail();
    await register(t, { email });
    const res = await post('/v1/auth/register', {
      email: email.toUpperCase(),
      password: PASSWORD,
      displayName: 'Someone Else',
      acceptedTermsVersion: '2026-11-01',
    });
    expect(res.statusCode).toBe(409);
    expect(res.json<ApiErrorBody>().error.code).toBe('email_taken');
  });

  it('gives two people with the same name different usernames', async () => {
    const a = await register(t, { displayName: 'Ama Okafor' });
    const b = await register(t, { displayName: 'Ama Okafor' });
    expect(a.user.handle).toBe('ama_okafor');
    expect(b.user.handle).not.toBe(a.user.handle);
    expect(b.user.handle).toMatch(/^ama_okafor_\d{4}$/);
  });

  it('makes a username from a name with accents, symbols or very few letters', async () => {
    expect((await register(t, { displayName: 'Chloé Müller-Ñ!' })).user.handle).toBe('chloe_muller_n');
    expect((await register(t, { displayName: 'Jo' })).user.handle).toBe('jochef');
    expect((await register(t, { displayName: '!!!' })).user.handle).toBe('chef');
  });

  it.each([
    ['not an email', { email: 'nope' }, 'email'],
    ['a short password', { password: 'short' }, 'password'],
    ['no name', { displayName: '   ' }, 'displayName'],
    ['no terms version', { acceptedTermsVersion: '' }, 'acceptedTermsVersion'],
  ])('rejects %s with a message for that field', async (_label, bad, field) => {
    const res = await post('/v1/auth/register', {
      email: uniqueEmail(),
      password: PASSWORD,
      displayName: 'Ama',
      acceptedTermsVersion: '2026-11-01',
      ...bad,
    });
    expect(res.statusCode).toBe(400);
    const body = res.json<ApiErrorBody>();
    expect(body.error.code).toBe('validation_error');
    expect(body.error.details?.[field]).toBeTruthy();
  });

  it('rejects a body that is not JSON', async () => {
    const res = await t.app.inject({
      method: 'POST',
      url: '/v1/auth/register',
      headers: { 'content-type': 'application/json' },
      payload: '{not json',
    });
    expect(res.statusCode).toBe(400);
    expect(res.json<ApiErrorBody>().error.code).toBe('validation_error');
  });
});

describe('login', () => {
  it('signs in with the right password, whatever the email letter case', async () => {
    const email = uniqueEmail();
    await register(t, { email });
    const res = await post('/v1/auth/login', { email: email.toUpperCase(), password: PASSWORD, device: { name: 'iPhone 15' } });
    expect(res.statusCode).toBe(200);
    const body = res.json<AuthResponse>();
    expect(body.user.email).toBe(email);
    const sessions = await t.db.session.findMany({ where: { userId: body.user.id }, orderBy: { createdAt: 'asc' } });
    expect(sessions).toHaveLength(2);
    expect(sessions[1]?.deviceName).toBe('iPhone 15');
  });

  it('says the same thing for a wrong password and for an email with no account', async () => {
    const email = uniqueEmail();
    await register(t, { email });
    const wrong = await post('/v1/auth/login', { email, password: 'not the password' });
    const unknown = await post('/v1/auth/login', { email: uniqueEmail(), password: PASSWORD });
    expect(wrong.statusCode).toBe(401);
    expect(unknown.statusCode).toBe(401);
    expect(wrong.json()).toEqual(unknown.json());
    expect(wrong.json<ApiErrorBody>().error.code).toBe('invalid_credentials');
  });

  it('does not let an account without a password sign in with an empty or guessed one', async () => {
    const social = await t.db.user.create({ data: { email: 'social@example.com', displayName: 'S', handle: 'social_user' } });
    const res = await post('/v1/auth/login', { email: social.email, password: 'anything at all' });
    expect(res.statusCode).toBe(401);
  });
});

describe('who am I', () => {
  it('returns the account for a valid token', async () => {
    const auth = await register(t);
    const res = await t.app.inject({ method: 'GET', url: '/v1/me', headers: bearer(auth) });
    expect(res.statusCode).toBe(200);
    expect(res.json<Me>().id).toBe(auth.user.id);
  });

  it.each([
    ['no token', {}],
    ['a token that is not a token', { authorization: 'Bearer nonsense' }],
    ['the wrong scheme', { authorization: 'Basic abc' }],
    ['a token signed with another secret', 'forged'],
  ] as const)('refuses %s', async (_label, spec) => {
    // Built here, not pasted in, so no token-shaped string sits in the repo.
    const headers =
      spec === 'forged'
        ? {
            authorization: `Bearer ${await new SignJWT({ sid: 'y', role: 'admin' })
              .setProtectedHeader({ alg: 'HS256' })
              .setSubject('x')
              .sign(new TextEncoder().encode('a-different-secret-that-is-at-least-32-chars'))}`,
          }
        : spec;
    const res = await t.app.inject({ method: 'GET', url: '/v1/me', headers });
    expect(res.statusCode).toBe(401);
    expect(res.json<ApiErrorBody>().error.code).toBe('unauthorized');
  });

  it('refuses an access token after it has expired', async () => {
    const auth = await register(t);
    t.advance(16 * 60_000);
    const res = await t.app.inject({ method: 'GET', url: '/v1/me', headers: bearer(auth) });
    expect(res.statusCode).toBe(401);
  });
});
