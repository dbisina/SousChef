import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config';
import { buildAiRouter } from '../src/ai/factory';
import { GeminiPoolProvider, type GeminiPoolSettings } from '../src/ai/geminiPool';
import { AiProviderError, type AiRequest } from '../src/ai/types';
import { makeApp, type TestApp } from './helpers';

const FREE = ['free-key-aaaa', 'free-key-bbbb', 'free-key-cccc'];
const PAID = 'paid-key-zzzz';
const ok = (text = 'hello') => ({ candidates: [{ content: { parts: [{ text }] } }], usageMetadata: { promptTokenCount: 1_000_000, candidatesTokenCount: 100_000 } });
const reply = (status: number, body: unknown) => ({ ok: status < 300, status, json: async () => body, text: async () => JSON.stringify(body) }) as unknown as Response;

/** A fake Gemini: each key can be told to answer with a status. Records which keys were used, in order. */
function fakeGoogle() {
  const used: string[] = [];
  const behaviour = new Map<string, number | 'bad-key' | 'bad-request'>();
  const request = (async (_url: string | URL, init?: RequestInit) => {
    const key = String((init?.headers as Record<string, string>)['x-goog-api-key']);
    used.push(key);
    const b = behaviour.get(key) ?? 200;
    if (b === 'bad-key') return reply(400, { error: { message: 'API key not valid. Please pass a valid API key.' } });
    if (b === 'bad-request') return reply(400, { error: { message: 'Request contains an invalid argument.' } });
    return b === 200 ? reply(200, ok()) : reply(b, { error: { message: `status ${b}` } });
  }) as unknown as typeof fetch;
  return { used, behaviour, request };
}

let now = 0;
const clock = () => now;
const MIN = 60_000;
const req = (extra: Partial<AiRequest> = {}): AiRequest => ({ task: 'substitute', prompt: 'hi', ...extra });
function pool(over: Partial<GeminiPoolSettings> = {}, g = fakeGoogle()) {
  const warnings: unknown[] = [];
  const p = new GeminiPoolProvider({ paidKey: PAID, freeKeys: FREE, model: 'm', spillToPaid: true, paidOnlyTasks: [], ...over }, g.request, { warn: (...a: unknown[]) => void warnings.push(a) }, clock);
  return { p, g, warnings };
}
beforeEach(() => {
  now = 1_000_000;
});

describe('rotating over free keys', () => {
  it('uses each free key in turn and reports the calls as free', async () => {
    const { p, g } = pool();
    const results = [];
    for (let i = 0; i < 6; i++) results.push(await p.complete(req()));
    expect(g.used).toEqual([...FREE, ...FREE]);
    expect(new Set(results.map((r) => r.provider))).toEqual(new Set(['gemini-free']));
  });

  it('lets a rate-limited key rest, carries on with the others, and brings it back after its rest', async () => {
    const { p, g } = pool();
    g.behaviour.set(FREE[0] as string, 429);
    expect((await p.complete(req())).provider).toBe('gemini-free'); // aaaa fails, bbbb answers
    expect(g.used).toEqual([FREE[0], FREE[1]]);
    expect(p.status().map((s) => s.resting)).toEqual([true, false, false]);

    g.used.length = 0;
    await p.complete(req());
    await p.complete(req());
    expect(g.used).not.toContain(FREE[0]); // still resting

    g.behaviour.set(FREE[0] as string, 200);
    now += 61 * MIN / 60; // a minute and a second
    g.used.length = 0;
    for (let i = 0; i < 3; i++) await p.complete(req());
    expect(g.used).toContain(FREE[0]);
    expect(p.status().every((s) => !s.resting)).toBe(true);
  });

  it('rests for longer each time in a row, and starts again after a success', async () => {
    const { p, g } = pool({ freeKeys: [FREE[0] as string], spillToPaid: false });
    g.behaviour.set(FREE[0] as string, 503);
    await expect(p.complete(req())).rejects.toBeInstanceOf(AiProviderError); // rests 1 minute
    now += 61 * 1000;
    await expect(p.complete(req())).rejects.toBeInstanceOf(AiProviderError); // rests 2 minutes
    now += 61 * 1000;
    expect(p.status()[0]?.resting).toBe(true); // 61 seconds is not enough the second time
    now += 61 * 1000;
    g.behaviour.set(FREE[0] as string, 200);
    await p.complete(req()); // success resets
    g.behaviour.set(FREE[0] as string, 503);
    await expect(p.complete(req())).rejects.toBeInstanceOf(AiProviderError);
    now += 61 * 1000;
    expect(p.status()[0]?.resting).toBe(false); // back to a one-minute rest
  });

  it('leaves a refused key out for a day without stopping the others, and never prints a whole key', async () => {
    const { p, g, warnings } = pool();
    g.behaviour.set(FREE[0] as string, 403);
    g.behaviour.set(FREE[1] as string, 'bad-key');
    expect((await p.complete(req())).provider).toBe('gemini-free');
    expect(g.used).toEqual([FREE[0], FREE[1], FREE[2]]);
    expect(p.status().map((s) => s.resting)).toEqual([true, true, false]);
    now += 23 * 60 * MIN;
    expect(p.status().map((s) => s.resting)).toEqual([true, true, false]);
    now += 2 * 60 * MIN;
    expect(p.status().map((s) => s.resting)).toEqual([false, false, false]);
    expect(JSON.stringify(warnings)).not.toContain('free-key');
    expect(JSON.stringify(warnings)).toContain('...aaaa');
  });

  it('does not rest other keys over a bad request: that request is the problem', async () => {
    const { p, g } = pool();
    g.behaviour.set(FREE[0] as string, 'bad-request');
    await expect(p.complete(req())).rejects.toMatchObject({ retryable: false });
    expect(g.used).toEqual([FREE[0]]);
    expect(p.status().every((s) => !s.resting)).toBe(true);
  });
});

describe('the funded key', () => {
  it('takes over when every free key is resting, if allowed', async () => {
    const { p, g } = pool();
    for (const k of FREE) g.behaviour.set(k, 429);
    const r = await p.complete(req());
    expect(r.provider).toBe('gemini');
    expect(g.used.at(-1)).toBe(PAID);
    g.used.length = 0;
    await p.complete(req()); // all three still resting: straight to the funded key
    expect(g.used).toEqual([PAID]);
  });

  it('is not used for ordinary requests when spilling is off: the request fails so another provider can answer', async () => {
    const { p, g } = pool({ spillToPaid: false });
    for (const k of FREE) g.behaviour.set(k, 429);
    await expect(p.complete(req())).rejects.toMatchObject({ retryable: true });
    expect(g.used).not.toContain(PAID);
  });

  it('is the only key for private requests, video, and tasks listed as paid-only', async () => {
    const { p, g } = pool({ paidOnlyTasks: ['moderate'] });
    await p.complete(req({ private: true }));
    await p.complete(req({ videoUrl: 'https://www.youtube.com/watch?v=abc' }));
    await p.complete(req({ task: 'moderate' }));
    expect(g.used).toEqual([PAID, PAID, PAID]);
    expect(p.allowsPrivate).toBe(true);
  });

  it('is what a single-key setup keeps using, exactly as before', async () => {
    const { p, g } = pool({ freeKeys: [] });
    const r = await p.complete(req());
    expect(r.provider).toBe('gemini');
    expect(g.used).toEqual([PAID]);
  });

  it('with no funded key: free keys serve ordinary requests, but private and video requests are declined, never sent to a free key', async () => {
    const { p, g } = pool({ paidKey: '' });
    expect(p.allowsPrivate).toBe(false);
    expect(p.supports(req())).toBe(true);
    expect(p.supports(req({ private: true }))).toBe(false);
    expect(p.supports(req({ videoUrl: 'https://youtu.be/abc' }))).toBe(false);
    await expect(p.complete(req({ private: true }))).rejects.toBeInstanceOf(AiProviderError);
    expect(g.used).toEqual([]);
  });
});

describe('settings', () => {
  const base = { DATABASE_URL: 'postgresql://x', JWT_SECRET: 'x'.repeat(32) };
  it('reads the pool settings with safe defaults', () => {
    const c = loadConfig({ ...base, AI_GEMINI_API_KEY: PAID, AI_GEMINI_FREE_KEYS: ' a1 , b2 ,c3' });
    expect(c.AI_GEMINI_FREE_KEYS).toEqual(['a1', 'b2', 'c3']);
    expect(c.AI_GEMINI_SPILL_TO_PAID).toBe(true);
    expect(c.AI_GEMINI_PAID_ONLY_TASKS).toEqual([]);
    expect(c.AI_PRIVATE_PROVIDERS).toEqual(['gemini']);
    expect(loadConfig(base).AI_GEMINI_FREE_KEYS).toEqual([]);
  });

  it('stops the server starting on a mistake in the key list', () => {
    expect(() => loadConfig({ ...base, AI_GEMINI_FREE_KEYS: 'a,a' })).toThrow(/listed twice/);
    expect(() => loadConfig({ ...base, AI_GEMINI_API_KEY: 'same', AI_GEMINI_FREE_KEYS: 'same,other' })).toThrow(/must not also be listed/);
    expect(() => loadConfig({ ...base, AI_GEMINI_FREE_KEYS: Array.from({ length: 21 }, (_, i) => `k${i}`).join(',') })).toThrow(/At most 20/);
  });
});

describe('through the router: cost and privacy', () => {
  let t: TestApp;
  beforeAll(async () => {
    t = await makeApp();
  });
  afterAll(() => t.close());
  beforeEach(() => t.reset());

  const router = (env: Record<string, string>, g = fakeGoogle()) => ({
    g,
    router: buildAiRouter(loadConfig({ DATABASE_URL: 'postgresql://x', JWT_SECRET: 'x'.repeat(32), AI_DEEPSEEK_API_KEY: 'deepseek-key', ...env }), t.db, { warn: () => undefined }, () => new Date(), (async (url: string | URL, init?: RequestInit) => {
      if (String(url).includes('deepseek')) return reply(200, { choices: [{ message: { content: 'deepseek answer' } }], usage: { prompt_tokens: 10, completion_tokens: 10 } });
      return g.request(url, init);
    }) as unknown as typeof fetch),
  });

  it('records free calls at zero cost and funded calls at the configured price', async () => {
    const { router: r } = router({ AI_GEMINI_API_KEY: PAID, AI_GEMINI_FREE_KEYS: FREE.join(',') });
    await r.run({ task: 'scale_recipe', prompt: 'x' }); // free key
    await r.run({ task: 'scale_recipe', prompt: 'x', private: true }); // funded key
    const rows = await t.db.aiUsage.findMany({ where: { task: 'scale_recipe' }, orderBy: { createdAt: 'asc' } });
    expect(rows.map((x) => x.provider)).toEqual(['gemini-free', 'gemini']);
    expect(rows[0]?.costMicros).toBe(0);
    expect(rows[1]?.costMicros).toBeGreaterThan(0);
    expect(await r.spentThisMonth()).toBeCloseTo((rows[1]?.costMicros ?? 0) / 1_000_000, 6);
  });

  it('keeps private requests away from DeepSeek and from free keys: with no funded key they get no AI answer at all', async () => {
    const { router: r, g } = router({ AI_GEMINI_FREE_KEYS: FREE.join(',') });
    expect(r.canServe({ task: 'meal_plan', prompt: 'x' })).toBe(true);
    expect(r.canServe({ task: 'meal_plan', prompt: 'x', private: true })).toBe(false);
    await expect(r.run({ task: 'meal_plan', prompt: 'x', private: true })).rejects.toMatchObject({ code: 'ai_unavailable' });
    expect(g.used).toEqual([]);
  });

  it('with a funded key, private requests skip DeepSeek (which is first in the route) and use Gemini', async () => {
    const { router: r, g } = router({ AI_GEMINI_API_KEY: PAID, AI_GEMINI_FREE_KEYS: FREE.join(',') });
    const plain = await r.run({ task: 'meal_plan', prompt: 'x' });
    expect(plain.provider).toBe('deepseek');
    const secret = await r.run({ task: 'meal_plan', prompt: 'x', private: true });
    expect(secret.provider).toBe('gemini');
    expect(g.used).toEqual([PAID]);
  });
});
