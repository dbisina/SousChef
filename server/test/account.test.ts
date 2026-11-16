import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { ApiErrorBody, AuthResponse, Me } from '@shared';
import { PASSWORD, bearer, makeApp, register, type TestApp } from './helpers';

let t: TestApp;
beforeAll(async () => {
  t = await makeApp();
});
afterAll(() => t.close());
beforeEach(() => t.reset());

const patch = (auth: AuthResponse, payload: object) =>
  t.app.inject({ method: 'PATCH', url: '/v1/me', headers: bearer(auth), payload });

describe('profile', () => {
  it('changes name, bio, username and chef switch', async () => {
    const auth = await register(t);
    const res = await patch(auth, { displayName: ' Ama O. ', bio: 'Jollof first.', handle: 'ama_cooks', isChef: true });
    expect(res.statusCode).toBe(200);
    const me = res.json<Me>();
    expect(me).toMatchObject({ displayName: 'Ama O.', bio: 'Jollof first.', handle: 'ama_cooks', isChef: true });
    expect(me.isVerifiedChef).toBe(false);
  });

  it('cannot give itself the verified badge or the admin role', async () => {
    const auth = await register(t);
    const res = await patch(auth, { isVerifiedChef: true, verifiedChefAt: '2026-01-01T00:00:00Z', role: 'admin' });
    expect(res.statusCode).toBe(200);
    const me = res.json<Me>();
    expect(me.isVerifiedChef).toBe(false);
    expect(me.role).toBe('user');
    const row = await t.db.user.findUniqueOrThrow({ where: { id: auth.user.id } });
    expect(row.verifiedChefAt).toBeNull();
    expect(row.role).toBe('USER');
  });

  it('refuses a username somebody else has', async () => {
    const a = await register(t, { displayName: 'First Person' });
    const b = await register(t, { displayName: 'Second Person' });
    const res = await patch(b, { handle: a.user.handle });
    expect(res.statusCode).toBe(409);
    expect(res.json<ApiErrorBody>().error.code).toBe('handle_taken');
  });

  it('lets a person keep their own username when saving', async () => {
    const auth = await register(t);
    expect((await patch(auth, { handle: auth.user.handle, bio: 'same handle' })).statusCode).toBe(200);
  });

  it.each([
    ['capital letters', { handle: 'Ama_Cooks' }, 'handle'],
    ['a space', { handle: 'ama cooks' }, 'handle'],
    ['too short', { handle: 'ab' }, 'handle'],
    ['too long', { handle: 'a'.repeat(21) }, 'handle'],
    ['a bio over 280 characters', { bio: 'x'.repeat(281) }, 'bio'],
    ['an empty name', { displayName: '  ' }, 'displayName'],
    ['a photo link that is not https', { photoUrl: 'http://example.com/a.jpg' }, 'photoUrl'],
    ['a photo that is not a link', { photoUrl: 'javascript:alert(1)' }, 'photoUrl'],
    ['a banner link that is not https', { bannerUrl: 'http://example.com/b.jpg' }, 'bannerUrl'],
  ])('rejects %s', async (_label, bad, field) => {
    const auth = await register(t);
    const res = await patch(auth, bad);
    expect(res.statusCode).toBe(400);
    expect(res.json<ApiErrorBody>().error.details?.[field]).toBeTruthy();
  });

  it('accepts an https photo and can remove it again', async () => {
    const auth = await register(t);
    expect((await patch(auth, { photoUrl: 'https://cdn.example.com/a.jpg' })).json<Me>().photoUrl).toBe('https://cdn.example.com/a.jpg');
    expect((await patch(auth, { photoUrl: null })).json<Me>().photoUrl).toBeNull();
  });

  it('sets, replaces and removes a profile banner, and shows it on the public profile', async () => {
    const auth = await register(t);
    expect((await patch(auth, {})).json<Me>().bannerUrl).toBeNull();
    expect((await patch(auth, { bannerUrl: 'https://cdn.example.com/b1.jpg' })).json<Me>().bannerUrl).toBe('https://cdn.example.com/b1.jpg');
    expect((await patch(auth, { bannerUrl: 'https://cdn.example.com/b2.jpg', bio: 'hi' })).json<Me>().bannerUrl).toBe('https://cdn.example.com/b2.jpg');
    const profile = await t.app.inject({ method: 'GET', url: `/v1/users/${auth.user.id}`, headers: bearer(auth) });
    expect(profile.json<{ bannerUrl: string | null }>().bannerUrl).toBe('https://cdn.example.com/b2.jpg');
    expect((await patch(auth, { bannerUrl: null })).json<Me>().bannerUrl).toBeNull();
  });

  it('needs a sign-in', async () => {
    expect((await t.app.inject({ method: 'PATCH', url: '/v1/me', payload: { bio: 'x' } })).statusCode).toBe(401);
  });
});

describe('delete account', () => {
  it('needs the right password', async () => {
    const auth = await register(t);
    const wrong = await t.app.inject({ method: 'DELETE', url: '/v1/me', headers: bearer(auth), payload: { password: 'not it' } });
    expect(wrong.statusCode).toBe(401);
    const none = await t.app.inject({ method: 'DELETE', url: '/v1/me', headers: bearer(auth), payload: {} });
    expect(none.statusCode).toBe(401);
    expect(await t.db.user.count()).toBe(1);
  });

  it('removes the account and everything attached to it, and signs it out', async () => {
    const auth = await register(t);
    await t.app.inject({
      method: 'PUT',
      url: '/v1/me/devices',
      headers: bearer(auth),
      payload: { pushToken: 'ExponentPushToken[aaaaaaaaaaaaaaaa]', platform: 'ios' },
    });
    await t.app.inject({ method: 'POST', url: '/v1/auth/forgot-password', payload: { email: auth.user.email } });
    const res = await t.app.inject({ method: 'DELETE', url: '/v1/me', headers: bearer(auth), payload: { password: PASSWORD } });
    expect(res.statusCode).toBe(204);
    expect(await t.db.user.count()).toBe(0);
    expect(await t.db.session.count()).toBe(0);
    expect(await t.db.device.count()).toBe(0);
    expect(await t.db.consent.count()).toBe(0);
    expect(await t.db.passwordReset.count()).toBe(0);
    expect((await t.app.inject({ method: 'GET', url: '/v1/me', headers: bearer(auth) })).statusCode).toBe(401);
  });

  it('leaves other people alone', async () => {
    const a = await register(t);
    const b = await register(t);
    await t.app.inject({ method: 'DELETE', url: '/v1/me', headers: bearer(a), payload: { password: PASSWORD } });
    expect((await t.app.inject({ method: 'GET', url: '/v1/me', headers: bearer(b) })).statusCode).toBe(200);
  });

  it('frees the email so it can sign up again', async () => {
    const auth = await register(t, { email: 'again@example.com' });
    await t.app.inject({ method: 'DELETE', url: '/v1/me', headers: bearer(auth), payload: { password: PASSWORD } });
    await register(t, { email: 'again@example.com' });
  });

  it('asks a Google or Apple only account to type DELETE, since it has no password', async () => {
    t.verifier.allow('c'.repeat(40), { provider: 'GOOGLE', providerUserId: 'g-del', email: 'del@gmail.test', emailVerified: true });
    const auth = (
      await t.app.inject({
        method: 'POST',
        url: '/v1/auth/social',
        payload: { provider: 'google', idToken: 'c'.repeat(40), acceptedTermsVersion: '2026-11-01' },
      })
    ).json<AuthResponse>();
    const without = await t.app.inject({ method: 'DELETE', url: '/v1/me', headers: bearer(auth), payload: {} });
    expect(without.statusCode).toBe(400);
    const done = await t.app.inject({ method: 'DELETE', url: '/v1/me', headers: bearer(auth), payload: { confirm: 'DELETE' } });
    expect(done.statusCode).toBe(204);
    expect(await t.db.user.count()).toBe(0);
  });
});

describe('push devices', () => {
  const put = (auth: AuthResponse, pushToken: string) =>
    t.app.inject({ method: 'PUT', url: '/v1/me/devices', headers: bearer(auth), payload: { pushToken, platform: 'android', appVersion: '1.2.0' } });

  it('registers a phone, and registering the same phone again does not duplicate it', async () => {
    const auth = await register(t);
    expect((await put(auth, 'ExponentPushToken[aaaaaaaaaaaaaaaa]')).statusCode).toBe(204);
    expect((await put(auth, 'ExponentPushToken[aaaaaaaaaaaaaaaa]')).statusCode).toBe(204);
    expect(await t.db.device.count({ where: { userId: auth.user.id } })).toBe(1);
  });

  it('moves a phone to whoever signs in on it now', async () => {
    const a = await register(t);
    const b = await register(t);
    await put(a, 'ExponentPushToken[shared-phone-token]');
    await put(b, 'ExponentPushToken[shared-phone-token]');
    expect(await t.db.device.count({ where: { userId: a.user.id } })).toBe(0);
    expect(await t.db.device.count({ where: { userId: b.user.id } })).toBe(1);
  });

  it('keeps only the ten most recent phones per person', async () => {
    const auth = await register(t);
    for (let i = 0; i < 12; i++) {
      t.advance(1000);
      await put(auth, `ExponentPushToken[device-number-${i}]`);
    }
    const tokens = (await t.db.device.findMany({ where: { userId: auth.user.id } })).map((d) => d.pushToken);
    expect(tokens).toHaveLength(10);
    expect(tokens).not.toContain('ExponentPushToken[device-number-0]');
    expect(tokens).toContain('ExponentPushToken[device-number-11]');
  });

  it('removes a phone, but only your own', async () => {
    const a = await register(t);
    const b = await register(t);
    await put(a, 'ExponentPushToken[owned-by-a-phone]');
    await t.app.inject({ method: 'DELETE', url: `/v1/me/devices/${encodeURIComponent('ExponentPushToken[owned-by-a-phone]')}`, headers: bearer(b) });
    expect(await t.db.device.count()).toBe(1);
    await t.app.inject({ method: 'DELETE', url: `/v1/me/devices/${encodeURIComponent('ExponentPushToken[owned-by-a-phone]')}`, headers: bearer(a) });
    expect(await t.db.device.count()).toBe(0);
  });

  it('refuses a bad platform or a missing token, and needs a sign-in', async () => {
    const auth = await register(t);
    const bad = await t.app.inject({ method: 'PUT', url: '/v1/me/devices', headers: bearer(auth), payload: { pushToken: 'ExponentPushToken[aaaaaaaaaaaaaaaa]', platform: 'windows' } });
    expect(bad.statusCode).toBe(400);
    expect((await t.app.inject({ method: 'PUT', url: '/v1/me/devices', payload: { pushToken: 'ExponentPushToken[aaaaaaaaaaaaaaaa]', platform: 'ios' } })).statusCode).toBe(401);
  });
});
