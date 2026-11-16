import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { UPLOAD_RULES, type ApiErrorBody, type Upload, type UploadTicket } from '@shared';
import { loadConfig } from '../src/config';
import { S3Storage } from '../src/storage/storage';
import { DAY_MS, makeApp, register, testConfig, type TestApp } from './helpers';
import { call } from './recipeHelpers';

let t: TestApp;
beforeAll(async () => {
  t = await makeApp({ ACCESS_TOKEN_TTL_SECONDS: String(60 * 86400) });
});
afterAll(() => t.close());
beforeEach(() => t.reset());

type Who = Awaited<ReturnType<typeof register>>;
const ask = (who: Who | undefined, overrides: Record<string, unknown> = {}) =>
  call(t, 'POST', '/v1/uploads', who, { purpose: 'recipe_image', contentType: 'image/jpeg', size: 200_000, ...overrides });
const ticketFor = async (who: Who, overrides: Record<string, unknown> = {}) => (await ask(who, overrides)).json<UploadTicket>();
/** The key the file will be stored under, read back from the public address. */
const keyOf = (ticket: UploadTicket) => new URL(ticket.publicUrl).pathname.slice(1);

describe('asking for an upload link', () => {
  it('needs a sign-in', async () => {
    expect((await ask(undefined)).statusCode).toBe(401);
  });

  it('returns a link, the headers to send, and where the file will live', async () => {
    const ama = await register(t);
    const res = await ask(ama);
    expect(res.statusCode).toBe(201);
    const ticket = res.json<UploadTicket>();
    expect(ticket.uploadUrl).toContain(`recipe_image/${ama.user.id}/${ticket.id}.jpg`);
    expect(ticket.headers).toEqual({ 'Content-Type': 'image/jpeg' });
    expect(ticket.publicUrl).toBe(`https://media.test/recipe_image/${ama.user.id}/${ticket.id}.jpg`);
    expect(Date.parse(ticket.expiresAt)).toBeGreaterThan(Date.now());
    expect(await t.db.upload.count({ where: { id: ticket.id, status: 'PENDING' } })).toBe(1);
  });

  it.each([
    ['a type that is not allowed for photos', { contentType: 'application/pdf' }],
    ['a voice note sent as a photo', { contentType: 'audio/mp4' }],
    ['a photo sent as a voice note', { purpose: 'voice', contentType: 'image/png' }],
    ['a photo over the limit', { size: UPLOAD_RULES.recipe_image.maxBytes + 1 }],
    ['an avatar over its smaller limit', { purpose: 'avatar', size: UPLOAD_RULES.avatar.maxBytes + 1 }],
    ['a voice note over its limit', { purpose: 'voice', contentType: 'audio/mp4', size: UPLOAD_RULES.voice.maxBytes + 1 }],
    ['an empty file', { size: 0 }],
    ['an unknown purpose', { purpose: 'wallpaper' }],
  ])('refuses %s', async (_label, overrides) => {
    const ama = await register(t);
    const res = await ask(ama, overrides);
    expect(res.statusCode).toBe(400);
    expect(res.json<ApiErrorBody>().error.code).toBe('validation_error');
  });

  it('accepts a voice note', async () => {
    const ama = await register(t);
    const res = await ask(ama, { purpose: 'voice', contentType: 'audio/mp4', size: 150_000 });
    expect(res.statusCode).toBe(201);
    expect(res.json<UploadTicket>().publicUrl).toMatch(/\/voice\/.+\.m4a$/);
  });

  it('says "not set up" when there is no file store', async () => {
    const bare = await makeApp({}, { storage: null });
    try {
      const ama = await register(bare);
      const res = await bare.app.inject({ method: 'POST', url: '/v1/uploads', headers: { authorization: `Bearer ${ama.tokens.accessToken}` }, payload: { purpose: 'avatar', contentType: 'image/png', size: 1000 } });
      expect(res.statusCode).toBe(501);
      expect(res.json<ApiErrorBody>().error.code).toBe('provider_not_configured');
    } finally {
      await bare.close();
    }
  });
});

describe('finishing an upload', () => {
  it('marks it ready once the file is there, and is safe to call again', async () => {
    const ama = await register(t);
    const ticket = await ticketFor(ama);
    t.storage.put(keyOf(ticket), 150_000, 'image/jpeg');

    const done = await call(t, 'POST', `/v1/uploads/${ticket.id}/complete`, ama);
    expect(done.statusCode).toBe(200);
    expect(done.json<Upload>()).toEqual({ id: ticket.id, purpose: 'recipe_image', contentType: 'image/jpeg', size: 150_000, url: ticket.publicUrl, status: 'ready' });
    expect((await call(t, 'POST', `/v1/uploads/${ticket.id}/complete`, ama)).json<Upload>().size).toBe(150_000);
    expect(await t.db.upload.count({ where: { status: 'READY' } })).toBe(1);
  });

  it('refuses when the file never arrived, and lets them try again', async () => {
    const ama = await register(t);
    const ticket = await ticketFor(ama);
    const early = await call(t, 'POST', `/v1/uploads/${ticket.id}/complete`, ama);
    expect(early.statusCode).toBe(400);
    t.storage.put(keyOf(ticket), 1000, 'image/jpeg');
    expect((await call(t, 'POST', `/v1/uploads/${ticket.id}/complete`, ama)).statusCode).toBe(200);
  });

  it('throws away a file that is bigger than promised or the wrong type', async () => {
    const ama = await register(t);
    const big = await ticketFor(ama, { size: 1000 });
    t.storage.put(keyOf(big), 5000, 'image/jpeg');
    expect((await call(t, 'POST', `/v1/uploads/${big.id}/complete`, ama)).statusCode).toBe(400);
    expect(t.storage.deleted).toContain(keyOf(big));
    expect(await t.db.upload.count({ where: { id: big.id, status: 'DELETED' } })).toBe(1);

    const wrong = await ticketFor(ama);
    t.storage.put(keyOf(wrong), 1000, 'text/html');
    expect((await call(t, 'POST', `/v1/uploads/${wrong.id}/complete`, ama)).statusCode).toBe(400);
    expect(t.storage.files.has(keyOf(wrong))).toBe(false);
    // A discarded upload cannot be completed afterwards.
    expect((await call(t, 'POST', `/v1/uploads/${wrong.id}/complete`, ama)).statusCode).toBe(404);
  });

  it('ignores a charset on the stored type', async () => {
    const ama = await register(t);
    const ticket = await ticketFor(ama, { purpose: 'voice', contentType: 'audio/mp4', size: 4000 });
    t.storage.put(keyOf(ticket), 4000, 'audio/mp4; codecs=mp4a');
    expect((await call(t, 'POST', `/v1/uploads/${ticket.id}/complete`, ama)).statusCode).toBe(200);
  });

  it('is only for the person who asked for it', async () => {
    const ama = await register(t);
    const kemi = await register(t);
    const ticket = await ticketFor(ama);
    t.storage.put(keyOf(ticket), 1000, 'image/jpeg');
    expect((await call(t, 'POST', `/v1/uploads/${ticket.id}/complete`, kemi)).statusCode).toBe(404);
    expect((await call(t, 'DELETE', `/v1/uploads/${ticket.id}`, kemi)).statusCode).toBe(404);
    expect((await call(t, 'POST', '/v1/uploads/00000000-0000-7000-8000-000000000000/complete', ama)).statusCode).toBe(404);
  });

  it('can be cancelled, which removes the file', async () => {
    const ama = await register(t);
    const ticket = await ticketFor(ama);
    t.storage.put(keyOf(ticket), 1000, 'image/jpeg');
    expect((await call(t, 'DELETE', `/v1/uploads/${ticket.id}`, ama)).statusCode).toBe(204);
    expect(t.storage.files.size).toBe(0);
    expect((await call(t, 'DELETE', `/v1/uploads/${ticket.id}`, ama)).statusCode).toBe(404);
  });
});

describe('limits', () => {
  it('stops a person piling up unfinished uploads, then lets them continue once they finish or wait', async () => {
    const ama = await register(t);
    const tickets: UploadTicket[] = [];
    for (let i = 0; i < 20; i++) tickets.push(await ticketFor(ama));
    const blocked = await ask(ama);
    expect(blocked.statusCode).toBe(409);
    expect(blocked.json<ApiErrorBody>().error.code).toBe('limit_reached');

    const first = tickets[0] as UploadTicket;
    t.storage.put(keyOf(first), 100, 'image/jpeg');
    await call(t, 'POST', `/v1/uploads/${first.id}/complete`, ama);
    expect((await ask(ama)).statusCode).toBe(201);
  });

  it('caps the uploads in a day', async () => {
    const ama = await register(t);
    await t.db.upload.createMany({
      data: Array.from({ length: 200 }, (_, i) => ({ userId: ama.user.id, key: `old/${i}`, purpose: 'recipe_image', contentType: 'image/jpeg', declaredSize: 1, status: 'READY' as const })),
    });
    expect((await ask(ama)).json<ApiErrorBody>().error.code).toBe('limit_reached');
    t.advance(DAY_MS + 60_000); // a day later the old ones no longer count
    expect((await ask(ama)).statusCode).toBe(201);
  });
});

describe('cleaning up', () => {
  it('sweeps uploads that were never finished, but not recent or finished ones', async () => {
    const ama = await register(t);
    const stale = await ticketFor(ama);
    const done = await ticketFor(ama);
    t.storage.put(keyOf(done), 100, 'image/jpeg');
    await call(t, 'POST', `/v1/uploads/${done.id}/complete`, ama);
    t.advance(2 * DAY_MS);
    const fresh = await ticketFor(ama);

    const swept = await (await buildSweeper()).sweepExpired();
    expect(swept).toBe(1);
    expect(t.storage.deleted).toEqual([keyOf(stale)]);
    expect(await t.db.upload.count({ where: { id: stale.id, status: 'DELETED' } })).toBe(1);
    expect(await t.db.upload.count({ where: { id: { in: [done.id, fresh.id] } , status: { not: 'DELETED' } } })).toBe(2);
  });

  it('removes a deleted account\'s files, and carries on if one cannot be removed', async () => {
    const ama = await register(t);
    const [a, b, c] = [await ticketFor(ama), await ticketFor(ama), await ticketFor(ama)] as [UploadTicket, UploadTicket, UploadTicket];
    for (const x of [a, b, c]) t.storage.put(keyOf(x), 100, 'image/jpeg');
    await call(t, 'POST', `/v1/uploads/${a.id}/complete`, ama);
    t.storage.failDelete.add(keyOf(b));

    const res = await call(t, 'DELETE', '/v1/me', ama, { password: 'correct horse battery' });
    expect(res.statusCode).toBe(204);
    expect(t.storage.deleted.sort()).toEqual([keyOf(a), keyOf(c)].sort());
    expect(await t.db.upload.count()).toBe(0);
  });

  /** The service the running app uses, to call the sweep the way the job runner will. */
  async function buildSweeper() {
    const { buildApp } = await import('../src/app');
    const built = await buildApp({ config: testConfig(), db: t.db, storage: t.storage, now: () => new Date(Date.now() + 2 * DAY_MS) });
    await built.app.ready();
    return built.uploads;
  }
});

describe('the S3 / R2 store', () => {
  const settings = { endpoint: 'https://acct.r2.cloudflarestorage.com', bucket: 'souschef-media', accessKeyId: 'AKID', secretAccessKey: 'secret', region: 'auto', publicUrl: 'https://media.souschef.app' };
  const fixedNow = () => new Date('2026-11-15T12:00:00Z');

  it('makes a presigned upload link that names the bucket and key and signs the content type', async () => {
    const store = new S3Storage(settings, fixedNow);
    const { url, headers } = await store.presignUpload({ key: 'avatar/u1/a b.png', contentType: 'image/png', expiresSeconds: 600 });
    const parsed = new URL(url);
    expect(parsed.origin + parsed.pathname).toBe('https://acct.r2.cloudflarestorage.com/souschef-media/avatar/u1/a%20b.png');
    expect(parsed.searchParams.get('X-Amz-Expires')).toBe('600');
    expect(parsed.searchParams.get('X-Amz-SignedHeaders')).toBe('content-type;host');
    expect(headers).toEqual({ 'Content-Type': 'image/png' });
    expect(url).not.toContain('secret');
  });

  it('asks the store about a file with a signed HEAD, and reads its size and type', async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const fake = (async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response(null, { status: 200, headers: { 'content-length': '1234', 'content-type': 'image/png' } });
    }) as unknown as typeof fetch;
    const store = new S3Storage(settings, fixedNow, fake);
    expect(await store.head('avatar/u1/a.png')).toEqual({ size: 1234, contentType: 'image/png' });
    expect(calls[0]?.url).toBe('https://acct.r2.cloudflarestorage.com/souschef-media/avatar/u1/a.png');
    expect(calls[0]?.init.method).toBe('HEAD');
    expect((calls[0]?.init.headers as Record<string, string>)['Authorization']).toMatch(/^AWS4-HMAC-SHA256 Credential=AKID\//);
  });

  it('treats a missing file as null, a missing file on delete as fine, and other failures as errors', async () => {
    const respond = (status: number) => (async () => new Response(null, { status })) as unknown as typeof fetch;
    expect(await new S3Storage(settings, fixedNow, respond(404)).head('k')).toBeNull();
    await expect(new S3Storage(settings, fixedNow, respond(404)).delete('k')).resolves.toBeUndefined();
    await expect(new S3Storage(settings, fixedNow, respond(204)).delete('k')).resolves.toBeUndefined();
    await expect(new S3Storage(settings, fixedNow, respond(500)).head('k')).rejects.toThrow(/500/);
    await expect(new S3Storage(settings, fixedNow, respond(403)).delete('k')).rejects.toThrow(/403/);
  });

  it('builds the public address with each part of the key encoded', () => {
    expect(new S3Storage(settings).publicUrl('recipe_image/u 1/a+b.jpg')).toBe('https://media.souschef.app/recipe_image/u%201/a%2Bb.jpg');
  });
});

describe('configuration', () => {
  const base = { NODE_ENV: 'test', DATABASE_URL: 'postgresql://x/y', JWT_SECRET: 'a'.repeat(40) };
  it('wants all the storage settings or none', () => {
    expect(() => loadConfig(base)).not.toThrow();
    expect(() => loadConfig({ ...base, S3_BUCKET: 'only-this' })).toThrow(/Set all of S3_ENDPOINT/);
    expect(() =>
      loadConfig({ ...base, S3_ENDPOINT: 'https://e', S3_BUCKET: 'b', S3_ACCESS_KEY_ID: 'k', S3_SECRET_ACCESS_KEY: 's', STORAGE_PUBLIC_URL: 'https://m' }),
    ).not.toThrow();
  });
});
