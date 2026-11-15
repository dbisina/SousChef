import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Maintenance } from '../src/jobs/maintenance';
import { JobRunner, lockKey, type Job } from '../src/jobs/runner';
import { DAY_MS, makeApp, register, type TestApp } from './helpers';
import { call, makeAdmin } from './recipeHelpers';
import { makePost } from './socialHelpers';

let t: TestApp;
beforeAll(async () => {
  t = await makeApp({ ACCESS_TOKEN_TTL_SECONDS: String(60 * 86400) });
});
afterAll(() => t.close());
beforeEach(() => t.reset());

const quiet = { info: () => undefined, warn: () => undefined, error: () => undefined };
const clock = (start = Date.parse('2026-11-15T00:00:00Z')) => {
  let ms = start;
  return { now: () => new Date(ms), advance: (by: number) => void (ms += by) };
};
const counting = (name: string, everyMs: number, result?: string): Job & { runs: number } => {
  const job = { name, everyMs, runs: 0, run: async () => (job.runs++, result) };
  return job;
};

describe('the job runner', () => {
  it('runs a job when its time comes, then waits its interval', async () => {
    const c = clock();
    const a = counting('a', 60_000);
    const runner = new JobRunner(t.db, [a], quiet, c.now);
    expect(await runner.runDue()).toEqual([]); // not yet: the first run is a few seconds after start
    c.advance(10_000);
    expect(await runner.runDue()).toEqual([{ name: 'a', status: 'ran' }]);
    c.advance(30_000);
    expect(await runner.runDue()).toEqual([]);
    c.advance(31_000);
    await runner.runDue();
    expect(a.runs).toBe(2);
  });

  it('spreads first runs so they do not all start together', async () => {
    const c = clock();
    const jobs = ['a', 'b', 'c'].map((n) => counting(n, 60_000));
    const runner = new JobRunner(t.db, jobs, quiet, c.now);
    c.advance(5_000);
    expect((await runner.runDue()).map((r) => r.name)).toEqual(['a']);
    c.advance(4_000);
    expect((await runner.runDue()).map((r) => r.name)).toEqual(['b', 'c']);
  });

  it('keeps going when one job fails, and tries it again at its next time', async () => {
    const c = clock();
    let calls = 0;
    const bad: Job = { name: 'bad', everyMs: 60_000, run: async () => { calls++; throw new Error('boom'); } };
    const good = counting('good', 60_000);
    const runner = new JobRunner(t.db, [bad, good], quiet, c.now);
    c.advance(20_000);
    const results = await runner.runDue();
    expect(results).toEqual([{ name: 'bad', status: 'failed', detail: 'boom' }, { name: 'good', status: 'ran' }]);
    c.advance(61_000);
    await runner.runDue();
    expect(calls).toBe(2);
    expect(good.runs).toBe(2);
  });

  it('skips a job another server is already running', async () => {
    const job = counting('shared', 60_000);
    const runner = new JobRunner(t.db, [job], quiet);
    await t.db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockKey('shared')})`; // "the other server"
      expect(await runner.runNow('shared')).toEqual({ name: 'shared', status: 'skipped' });
    });
    expect(job.runs).toBe(0);
    expect(await runner.runNow('shared')).toMatchObject({ status: 'ran' }); // the lock is gone with the other server's work
    expect(job.runs).toBe(1);
  });

  it('gives different jobs different locks', () => {
    expect(lockKey('a')).not.toBe(lockKey('b'));
    expect(lockKey('a')).toBe(lockKey('a'));
  });

  it('reports what a job did', async () => {
    const runner = new JobRunner(t.db, [counting('x', 1000, 'removed 3 things')], quiet);
    expect(await runner.runNow('x')).toEqual({ name: 'x', status: 'ran', detail: 'removed 3 things' });
    await expect(runner.runNow('nope')).rejects.toThrow(/no job/);
  });

  it('runs on its own timer once started, and stops cleanly', async () => {
    const c = clock();
    const job = counting('tick', 1_000);
    const runner = new JobRunner(t.db, [job], quiet, c.now);
    runner.start(10);
    c.advance(10_000);
    for (let i = 0; i < 100 && job.runs === 0; i++) await new Promise((r) => setTimeout(r, 20));
    expect(job.runs).toBeGreaterThanOrEqual(1);
    await runner.stop();
    const after = job.runs;
    c.advance(60_000);
    await new Promise((r) => setTimeout(r, 60));
    expect(job.runs).toBe(after);
  });
});

describe('the real jobs', () => {
  it('are all there', () => {
    expect(t.jobs.names).toEqual(['games', 'moderation', 'invites', 'stories', 'uploads', 'maintenance']);
  });

  it('each run cleanly on an empty server', async () => {
    for (const name of t.jobs.names) expect(await t.jobs.runNow(name), name).toMatchObject({ status: 'ran' });
  });

  it('checks new posts in the background when the AI is on', async () => {
    const ama = await register(t);
    const post = await makePost(t, ama, { title: 'WIN FREE MONEY' });
    for (const p of t.ai.all) p.handler = () => JSON.stringify({ flagged: true, category: 'spam', confidence: 0.99, reason: 'Scam' });
    expect(await t.jobs.runNow('moderation')).toMatchObject({ status: 'ran', detail: expect.stringContaining('hidden=1') });
    expect((await t.db.post.findUniqueOrThrow({ where: { id: post.id } })).status).toBe('HIDDEN');
  });

  it('finishes games whose clock ran out', async () => {
    const ama = await register(t);
    const room = (await call(t, 'POST', '/v1/play/rooms', ama, { mode: 'solo', difficulty: 'easy' })).json<{ code: string }>();
    await call(t, 'POST', `/v1/play/rooms/${room.code}/start`, ama);
    t.advance(3600 * 1000);
    expect(await t.jobs.runNow('games')).toMatchObject({ detail: expect.stringContaining('finished=1') });
    expect((await call(t, 'GET', `/v1/play/rooms/${room.code}`, ama)).json().phase).toBe('done');
  });

  it('has an admin who is not needed to run them', async () => {
    await makeAdmin(t);
    expect(await t.jobs.runNow('maintenance')).toMatchObject({ status: 'ran' });
  });
});

describe('clearing out old data', () => {
  it('removes what has expired and keeps what is recent', async () => {
    const ama = await register(t);
    const ben = await register(t);
    const now = new Date();
    const ago = (days: number) => new Date(now.getTime() - days * DAY_MS);

    // sessions: ben's own login is fresh; add one expired long ago, one signed out long ago, one signed out yesterday
    const base = { userId: ben.user.id, familyId: ama.user.id, expiresAt: new Date(now.getTime() + DAY_MS) };
    await t.db.session.createMany({
      data: [
        { ...base, tokenHash: 'old-expired', expiresAt: ago(8) },
        { ...base, tokenHash: 'old-revoked', revokedAt: ago(31) },
        { ...base, tokenHash: 'recent-revoked', revokedAt: ago(1) },
      ],
    });
    await t.db.passwordReset.createMany({
      data: [
        { userId: ben.user.id, tokenHash: 'r-old', expiresAt: ago(2) },
        { userId: ben.user.id, tokenHash: 'r-live', expiresAt: new Date(now.getTime() + DAY_MS) },
      ],
    });
    await t.db.webhookEvent.createMany({ data: [{ id: 'old', type: 't', receivedAt: ago(31) }, { id: 'new', type: 't', receivedAt: ago(1) }] });
    await t.db.importCache.createMany({
      data: [
        { key: 'web:old', sourceUrl: 'https://a.example', platform: 'website', recipe: {}, confidence: 1, lastUsedAt: ago(91) },
        { key: 'web:new', sourceUrl: 'https://b.example', platform: 'website', recipe: {}, confidence: 1, lastUsedAt: ago(1) },
      ],
    });

    const counts = await new Maintenance(t.db).purge();
    expect(counts).toEqual({ sessions: 2, passwordResets: 1, webhookEvents: 1, importCache: 1, aiUsage: 0, aiInsights: 0 });
    const hashes = (await t.db.session.findMany({ select: { tokenHash: true } })).map((s) => s.tokenHash);
    expect(hashes).toContain('recent-revoked');
    expect(hashes).not.toContain('old-expired');
    expect(await t.db.passwordReset.count()).toBe(1);
    expect((await t.db.webhookEvent.findMany()).map((w) => w.id)).toEqual(['new']);
    expect((await t.db.importCache.findMany()).map((c) => c.key)).toEqual(['web:new']);
    expect((await call(t, 'GET', '/v1/me', ama)).statusCode).toBe(200); // live logins are untouched
  });

  it('keeps spending history for over a year', async () => {
    await t.db.aiUsage.createMany({
      data: [
        { task: 'moderate', provider: 'x', model: 'x', inputTokens: 1, outputTokens: 1, costMicros: 1, createdAt: new Date(Date.now() - 401 * DAY_MS) },
        { task: 'moderate', provider: 'x', model: 'x', inputTokens: 1, outputTokens: 1, costMicros: 1, createdAt: new Date(Date.now() - 300 * DAY_MS) },
      ],
    });
    expect((await new Maintenance(t.db).purge()).aiUsage).toBe(1);
    expect(await t.db.aiUsage.count()).toBe(1);
  });
});
