import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { DEFAULT_ROUTES, providersFromConfig, routerSettings } from '../src/ai/factory';
import { GeminiProvider, OpenAiCompatibleProvider } from '../src/ai/providers';
import { AiRouter, extractJson } from '../src/ai/router';
import { AiProviderError, type AiRequest } from '../src/ai/types';
import { createDb } from '../src/db';
import { DAY_MS, testConfig } from './helpers';
import { makeFakeAi, type FakeAi } from './aiHelpers';

/** A fetch that records the request and answers with canned JSON. */
function fakeFetch(status: number, body: unknown) {
  const calls: { url: string; init: RequestInit & { body: string } }[] = [];
  const fn = (async (url: string, init: RequestInit) => {
    calls.push({ url, init: init as RequestInit & { body: string } });
    return new Response(typeof body === 'string' ? body : JSON.stringify(body), { status });
  }) as unknown as typeof fetch;
  return { fn, calls, sent: () => JSON.parse(calls[0]?.init.body ?? '{}') as Record<string, unknown> };
}
const ask = (overrides: Partial<AiRequest> = {}): AiRequest => ({ task: 'extract_recipe', prompt: 'hello', ...overrides });

describe('Gemini', () => {
  const settings = { apiKey: 'KEY', model: 'gemini-x' };
  const answer = { candidates: [{ content: { parts: [{ text: 'Hi ' }, { text: 'there' }] } }], usageMetadata: { promptTokenCount: 12, candidatesTokenCount: 3 } };

  it('sends the prompt, system text, images and a YouTube link in the shape the API expects, with the key in a header', async () => {
    const f = fakeFetch(200, answer);
    const result = await new GeminiProvider(settings, f.fn).complete(
      ask({ system: 'Be brief', json: true, maxOutputTokens: 500, temperature: 0.2, images: [{ base64: 'AAAA', mimeType: 'image/jpeg' }], videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' }),
    );
    expect(f.calls[0]?.url).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-x:generateContent');
    expect((f.calls[0]?.init.headers as Record<string, string>)['x-goog-api-key']).toBe('KEY');
    expect(f.calls[0]?.url).not.toContain('KEY');
    expect(f.sent()).toEqual({
      systemInstruction: { parts: [{ text: 'Be brief' }] },
      contents: [{ role: 'user', parts: [{ text: 'hello' }, { inlineData: { mimeType: 'image/jpeg', data: 'AAAA' } }, { fileData: { fileUri: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' } }] }],
      generationConfig: { responseMimeType: 'application/json', maxOutputTokens: 500, temperature: 0.2 },
    });
    expect(result).toEqual({ text: 'Hi there', inputTokens: 12, outputTokens: 3, provider: 'gemini', model: 'gemini-x' });
  });

  it('sends only what was asked for', async () => {
    const f = fakeFetch(200, answer);
    await new GeminiProvider(settings, f.fn).complete(ask());
    expect(f.sent()).toEqual({ contents: [{ role: 'user', parts: [{ text: 'hello' }] }], generationConfig: {} });
  });

  it('only takes YouTube links and inline images', () => {
    const p = new GeminiProvider(settings);
    expect(p.supports(ask({ videoUrl: 'https://youtu.be/dQw4w9WgXcQ' }))).toBe(true);
    expect(p.supports(ask({ videoUrl: 'https://www.tiktok.com/@a/video/1' }))).toBe(false);
    expect(p.supports(ask({ videoUrl: 'https://youtube.com.evil.test/watch' }))).toBe(false);
    expect(p.supports(ask({ images: [{ base64: 'AAAA', mimeType: 'image/png' }] }))).toBe(true);
    expect(p.supports(ask({ images: [{ url: 'https://x/y.png', mimeType: 'image/png' }] }))).toBe(false);
  });

  it.each([
    [429, true],
    [500, true],
    [503, true],
    [400, false],
    [403, false],
  ])('treats a %s answer as retryable=%s', async (status, canRetry) => {
    const f = fakeFetch(status, 'nope');
    await expect(new GeminiProvider(settings, f.fn).complete(ask())).rejects.toMatchObject({ retryable: canRetry, status });
  });

  it('treats a blocked request as final, an empty answer and a network failure as retryable', async () => {
    await expect(new GeminiProvider(settings, fakeFetch(200, { promptFeedback: { blockReason: 'SAFETY' } }).fn).complete(ask())).rejects.toMatchObject({ retryable: false });
    await expect(new GeminiProvider(settings, fakeFetch(200, { candidates: [{ finishReason: 'STOP' }] }).fn).complete(ask())).rejects.toMatchObject({ retryable: true });
    const down = (async () => {
      throw new Error('ECONNRESET');
    }) as unknown as typeof fetch;
    await expect(new GeminiProvider(settings, down).complete(ask())).rejects.toMatchObject({ retryable: true });
    await expect(new GeminiProvider(settings, fakeFetch(200, 'not json').fn).complete(ask())).rejects.toBeInstanceOf(AiProviderError);
  });
});

describe('OpenAI-style services (DeepSeek, Nebius)', () => {
  const settings = { apiKey: 'KEY', baseUrl: 'https://api.example.com/v1/', model: 'chat-x', images: false };
  const answer = { choices: [{ message: { content: 'Hello!' } }], usage: { prompt_tokens: 20, completion_tokens: 5 } };

  it('posts chat messages with a bearer key and asks for JSON when told to', async () => {
    const f = fakeFetch(200, answer);
    const result = await new OpenAiCompatibleProvider('deepseek', settings, f.fn).complete(ask({ system: 'Be brief', json: true, maxOutputTokens: 300, temperature: 0 }));
    expect(f.calls[0]?.url).toBe('https://api.example.com/v1/chat/completions');
    expect((f.calls[0]?.init.headers as Record<string, string>)['authorization']).toBe('Bearer KEY');
    expect(f.sent()).toEqual({
      model: 'chat-x',
      messages: [{ role: 'system', content: 'Be brief' }, { role: 'user', content: 'hello' }],
      response_format: { type: 'json_object' },
      max_tokens: 300,
      temperature: 0,
    });
    expect(result).toEqual({ text: 'Hello!', inputTokens: 20, outputTokens: 5, provider: 'deepseek', model: 'chat-x' });
  });

  it('sends pictures as image parts when the model can see them, and says it cannot when it cannot', async () => {
    const f = fakeFetch(200, answer);
    const sighted = new OpenAiCompatibleProvider('nebius', { ...settings, images: true }, f.fn);
    await sighted.complete(ask({ images: [{ base64: 'AAAA', mimeType: 'image/png' }, { url: 'https://x/y.jpg', mimeType: 'image/jpeg' }] }));
    expect((f.sent()['messages'] as { content: unknown }[])[0]?.content).toEqual([
      { type: 'text', text: 'hello' },
      { type: 'image_url', image_url: { url: 'data:image/png;base64,AAAA' } },
      { type: 'image_url', image_url: { url: 'https://x/y.jpg' } },
    ]);
    const blind = new OpenAiCompatibleProvider('deepseek', settings);
    expect(blind.supports(ask({ images: [{ base64: 'AAAA', mimeType: 'image/png' }] }))).toBe(false);
    expect(blind.supports(ask())).toBe(true);
    expect(sighted.supports(ask({ videoUrl: 'https://youtu.be/dQw4w9WgXcQ' }))).toBe(false);
  });

  it('classifies failures like the other service does', async () => {
    await expect(new OpenAiCompatibleProvider('d', settings, fakeFetch(429, 'slow down').fn).complete(ask())).rejects.toMatchObject({ retryable: true });
    await expect(new OpenAiCompatibleProvider('d', settings, fakeFetch(401, 'bad key').fn).complete(ask())).rejects.toMatchObject({ retryable: false });
    await expect(new OpenAiCompatibleProvider('d', settings, fakeFetch(200, { choices: [{ message: { content: '' } }] }).fn).complete(ask())).rejects.toMatchObject({ retryable: true });
  });
});

describe('reading JSON out of a reply', () => {
  it('handles plain JSON, code fences, and talk around the JSON', () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 });
    expect(extractJson('```json\n{"a":[1,2]}\n```')).toEqual({ a: [1, 2] });
    expect(extractJson('```\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(extractJson('Sure! Here it is: {"a":{"b":2}} Hope that helps.')).toEqual({ a: { b: 2 } });
    expect(extractJson('[1,2,3]')).toEqual([1, 2, 3]);
    expect(() => extractJson('no json here')).toThrow();
    expect(() => extractJson('{broken')).toThrow();
  });
});

describe('the router', () => {
  const db = createDb(testConfig().DATABASE_URL, 4);
  let ai: FakeAi;
  let offset = 0;
  const now = () => new Date(Date.now() + offset);
  const log = { warn: () => undefined };
  const prices = { gemini: { inPerMillion: 1, outPerMillion: 10 }, deepseek: { inPerMillion: 0.5, outPerMillion: 1 }, nebius: { inPerMillion: 0.2, outPerMillion: 0.6 } };
  const router = (budget = 5, providers = ai.all) => new AiRouter(db, { providers, routes: DEFAULT_ROUTES, prices, monthlyBudgetUsd: budget }, log, now);

  beforeAll(() => {
    ai = makeFakeAi();
  });
  afterAll(() => db.$disconnect());
  beforeEach(async () => {
    ai.reset();
    offset = 0;
    await db.aiUsage.deleteMany();
  });

  it('uses the first service on the route and records what the call cost', async () => {
    ai.deepseek.handler = () => 'done';
    const result = await router().run(ask(), {});
    expect(result.provider).toBe('deepseek');
    expect(ai.gemini.calls).toHaveLength(0);
    const [row] = await db.aiUsage.findMany();
    // 1000 input tokens at $0.50/M + 500 output at $1/M = $0.001
    expect(row).toMatchObject({ task: 'extract_recipe', provider: 'deepseek', model: 'deepseek-test', inputTokens: 1000, outputTokens: 500, costMicros: 1000 });
  });

  it('moves to the next service when one is down or busy, and stops at an answer the request cannot get', async () => {
    ai.deepseek.failWith = new AiProviderError('busy', true, 503);
    expect((await router().run(ask())).provider).toBe('gemini');
    ai.gemini.failWith = new AiProviderError('busy', true, 429);
    expect((await router().run(ask())).provider).toBe('nebius');
    ai.nebius.failWith = new AiProviderError('busy', true, 500);
    await expect(router().run(ask())).rejects.toMatchObject({ status: 503, code: 'ai_unavailable' });

    ai.reset();
    await db.aiUsage.deleteMany(); // forget the two successful calls above
    ai.deepseek.failWith = new AiProviderError('bad request', false, 400);
    await expect(router().run(ask())).rejects.toMatchObject({ status: 503, code: 'ai_unavailable' });
    expect(ai.gemini.calls).toHaveLength(0); // a request that is wrong is not tried elsewhere
    expect(await db.aiUsage.count()).toBe(0); // and failures cost nothing
  });

  it('sends pictures only to a service that can see them', async () => {
    const images = [{ base64: 'AAAA', mimeType: 'image/jpeg' }];
    const result = await router().run(ask({ task: 'extract_recipe', images }));
    expect(result.provider).toBe('gemini');
    expect(ai.deepseek.calls).toHaveLength(0);
  });

  it('says so when nothing is set up for the job', async () => {
    const none = router(5, []);
    expect(none.available('extract_recipe')).toBe(false);
    await expect(none.run(ask())).rejects.toMatchObject({ code: 'ai_unavailable', message: expect.stringContaining('not set up') });
    expect(router().available('judge_plate')).toBe(true);
    expect(router(5, [ai.deepseek]).available('judge_plate')).toBe(false); // only Gemini judges plates
  });

  it('stops everything once the month\'s budget is spent, and starts again next month', async () => {
    const r = router(0.002);
    await r.run(ask()); // $0.001
    await r.run(ask()); // $0.002 total, at the limit
    expect(await r.spentThisMonth()).toBeCloseTo(0.002, 6);
    await expect(r.run(ask())).rejects.toMatchObject({ code: 'ai_unavailable', message: expect.stringContaining('next month') });
    expect(ai.deepseek.calls).toHaveLength(2);
    offset = 32 * DAY_MS;
    await expect(r.run(ask())).resolves.toMatchObject({ provider: 'deepseek' });
  });

  it('limits one person\'s calls a day, counted per kind of help, and not another person\'s', async () => {
    const [a, b] = await Promise.all([
      db.user.create({ data: { displayName: 'A', handle: 'ai_user_a' } }),
      db.user.create({ data: { displayName: 'B', handle: 'ai_user_b' } }),
    ]);
    try {
      const r = router();
      const run = (userId: string, key?: string) => r.run(ask(), { userId, dailyLimit: { perDay: 2, ...(key ? { key } : {}) } });
      await run(a.id);
      await run(a.id);
      await expect(run(a.id)).rejects.toMatchObject({ status: 409, code: 'limit_reached' });
      await expect(run(b.id)).resolves.toBeTruthy(); // B has their own count
      await expect(r.run({ ...ask({ task: 'substitute' }) }, { userId: a.id, dailyLimit: { perDay: 2 } })).resolves.toBeTruthy(); // another kind of help
      offset = DAY_MS + 1000;
      await expect(run(a.id)).resolves.toBeTruthy(); // a new day
    } finally {
      await db.user.deleteMany({ where: { id: { in: [a.id, b.id] } } });
    }
  });

  it('runs JSON requests, asking once more for a reply that does not fit', async () => {
    const schema = z.object({ title: z.string(), servings: z.number() });
    let calls = 0;
    ai.deepseek.handler = () => (++calls === 1 ? 'Sorry, here you go: {"title": 5}' : '```json\n{"title":"Jollof","servings":4}\n```');
    await expect(router().runJson(ask(), schema)).resolves.toEqual({ title: 'Jollof', servings: 4 });
    expect(calls).toBe(2);
    expect(ai.deepseek.calls[0]?.json).toBe(true);
    expect(ai.deepseek.calls[1]?.prompt).toContain('not valid');

    ai.deepseek.handler = () => 'never JSON';
    await expect(router().runJson(ask(), schema)).rejects.toMatchObject({ code: 'ai_unavailable', message: expect.stringContaining('could not be used') });
  });
});

describe('setting the services up from configuration', () => {
  it('builds only the services whose keys are set, and a Nebius model only when it is named', () => {
    expect(providersFromConfig(testConfig()).map((p) => p.name)).toEqual([]);
    const withKeys = testConfig({ AI_GEMINI_API_KEY: 'g', AI_DEEPSEEK_API_KEY: 'd', AI_NEBIUS_API_KEY: 'n' });
    expect(providersFromConfig(withKeys).map((p) => p.name)).toEqual(['gemini', 'deepseek', 'nebius', 'nebius-vision', 'nebius-vision-2']);
    const full = testConfig({ AI_GEMINI_API_KEY: 'g', AI_NEBIUS_API_KEY: 'n', AI_NEBIUS_MODEL: 'some/model', AI_NEBIUS_VISION_MODEL: '', AI_NEBIUS_VISION_MODEL_2: '' });
    expect(providersFromConfig(full).map((p) => `${p.name}:${p.model}`)).toEqual(['gemini:gemini-2.5-flash', 'nebius:some/model']);
  });

  it('carries the budget and prices into the router, with cautious defaults', () => {
    const settings = routerSettings(testConfig({ AI_MONTHLY_BUDGET_USD: '7.5', AI_PRICE_GEMINI_IN: '0.1' }), []);
    expect(settings.monthlyBudgetUsd).toBe(7.5);
    expect(settings.prices['gemini']).toEqual({ inPerMillion: 0.1, outPerMillion: 2.5 });
    expect(routerSettings(testConfig(), []).monthlyBudgetUsd).toBe(5);
  });
});
