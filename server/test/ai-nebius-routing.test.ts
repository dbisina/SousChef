import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config';
import { buildAiRouter, providersFromConfig, routesFor } from '../src/ai/factory';
import { makeApp, type TestApp } from './helpers';

const base = { DATABASE_URL: 'postgresql://x', JWT_SECRET: 'x'.repeat(32) };
const cfg = (env: Record<string, string> = {}) => loadConfig({ ...base, ...env });
const reply = (body: unknown, status = 200) => ({ ok: status < 300, status, json: async () => body, text: async () => JSON.stringify(body) }) as unknown as Response;
const chat = (text: string) => reply({ choices: [{ message: { content: text } }], usage: { prompt_tokens: 1_000_000, completion_tokens: 100_000 } });
const geminiOk = reply({ candidates: [{ content: { parts: [{ text: '{"from":"gemini"}' }] } }], usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 10 } });
const png = { base64: 'aGVsbG8=', mimeType: 'image/png' };

/** A stand-in for every provider's address: records the call, answers for whichever model was asked. */
function fakeNet() {
  const calls: { url: string; model?: string; auth?: string; hasImage: boolean }[] = [];
  const failing = new Set<string>();
  const request = (async (url: string | URL, init?: RequestInit) => {
    const u = String(url);
    const body = typeof init?.body === 'string' ? (JSON.parse(init.body) as { model?: string; messages?: { content: unknown }[] }) : {};
    const hasImage = JSON.stringify(body).includes('image_url') || JSON.stringify(body).includes('inlineData');
    calls.push({ url: u, ...(body.model ? { model: body.model } : {}), auth: (init?.headers as Record<string, string> | undefined)?.authorization, hasImage });
    if (u.includes('generativelanguage')) return geminiOk;
    if (failing.has(body.model ?? '')) return reply({ error: { message: 'down' } }, 503);
    return chat(`{"from":"${body.model ?? 'unknown'}"}`);
  }) as unknown as typeof fetch;
  return { calls, failing, request };
}

describe('which providers do which jobs', () => {
  it('sets up the Nebius text, vision and second vision models by default when there is a key', () => {
    const names = providersFromConfig(cfg({ AI_NEBIUS_API_KEY: 'k' })).map((p) => p.name);
    expect(names).toEqual(['nebius', 'nebius-vision', 'nebius-vision-2']);
    expect(providersFromConfig(cfg()).map((p) => p.name)).toEqual([]); // no key, nothing
  });

  it('sends photo jobs to the Nebius vision models first, and to Gemini after, until the order is changed', () => {
    const routes = routesFor(cfg({ AI_GEMINI_API_KEY: 'g', AI_NEBIUS_API_KEY: 'k' }));
    expect(routes.judge_plate).toEqual(['nebius-vision', 'nebius-vision-2', 'gemini']);
    expect(routes.extract_recipe_from_frames).toEqual(['nebius-vision', 'nebius-vision-2', 'gemini']);
    expect(routes.moderate).toEqual(['nebius', 'nebius-vision', 'nebius-vision-2', 'deepseek', 'gemini']);
    // once Gemini is funded: one setting flips it
    expect(routesFor(cfg({ AI_VISION_FIRST: 'gemini,nebius-vision' })).judge_plate).toEqual(['gemini', 'nebius-vision']);
    // text work is unchanged
    expect(routes.meal_plan).toEqual(['deepseek', 'gemini', 'nebius']);
  });

  it('puts a dedicated endpoint first for text work when there is one', () => {
    const routes = routesFor(cfg({ AI_NEBIUS_DEDICATED_MODEL: 'routing-key-1' }));
    expect(routes.meal_plan[0]).toBe('nebius-dedicated');
    expect(routes.moderate[0]).toBe('nebius-dedicated');
    expect(routes.judge_plate).not.toContain('nebius-dedicated'); // text only unless it is told it can see
  });
});

describe('calling Nebius', () => {
  let t: TestApp;
  beforeAll(async () => {
    t = await makeApp();
  });
  afterAll(() => t.close());
  beforeEach(() => t.reset());

  const router = (env: Record<string, string>, net = fakeNet()) => ({ net, router: buildAiRouter(cfg({ AI_NEBIUS_API_KEY: 'nebius-key', ...env }), t.db, { warn: () => undefined }, () => new Date(), net.request) });

  it('reads a photo with the vision model, over the OpenAI-style address with the Nebius key', async () => {
    const { router: r, net } = router({});
    const out = await r.run({ task: 'judge_plate', prompt: 'look', images: [png], json: true });
    expect(out.provider).toBe('nebius-vision');
    expect(out.text).toContain('MiniMaxAI/MiniMax-M3.1-Flash');
    expect(net.calls[0]).toMatchObject({ url: 'https://api.tokenfactory.nebius.com/v1/chat/completions', auth: 'Bearer nebius-key', hasImage: true });
  });

  it('falls to the second vision model when the first is down, and to Gemini after both', async () => {
    const { router: r, net } = router({ AI_GEMINI_API_KEY: 'g' });
    net.failing.add('MiniMaxAI/MiniMax-M3.1-Flash');
    expect((await r.run({ task: 'judge_plate', prompt: 'x', images: [png] })).provider).toBe('nebius-vision-2');
    net.failing.add('deepseek-ai/DeepSeek-V4.1-Flash-1017');
    expect((await r.run({ task: 'judge_plate', prompt: 'x', images: [png] })).provider).toBe('gemini');
  });

  it('keeps private photos (a receipt) on the providers that are allowed to see them', async () => {
    const { router: r } = router({ AI_DEEPSEEK_API_KEY: 'd' });
    expect((await r.run({ task: 'extract_recipe_from_frames', prompt: 'receipt', images: [png], private: true })).provider).toBe('nebius-vision');
    const strict = router({ AI_DEEPSEEK_API_KEY: 'd', AI_PRIVATE_PROVIDERS: 'gemini' }).router;
    await expect(strict.run({ task: 'extract_recipe_from_frames', prompt: 'receipt', images: [png], private: true })).rejects.toMatchObject({ code: 'ai_unavailable' });
  });

  it('records Nebius calls at the vision model\'s price', async () => {
    const { router: r } = router({});
    await r.run({ task: 'judge_plate', prompt: 'x', images: [png] });
    const row = await t.db.aiUsage.findFirstOrThrow({ where: { provider: 'nebius-vision' } });
    expect(row.costMicros).toBe(Math.round(0.15 * 1_000_000 + 0.1 * 600_000)); // 1M in at 0.15 + 100k out at 0.6 = $0.21
  });

  it('calls a dedicated endpoint with its routing key and its region\'s address, using the same key', async () => {
    const { router: r, net } = router({ AI_NEBIUS_DEDICATED_MODEL: 'dedicated-routing-key', AI_NEBIUS_DEDICATED_BASE_URL: 'https://api.tokenfactory.us-central1.nebius.com/v1' });
    const out = await r.run({ task: 'meal_plan', prompt: 'x', json: true });
    expect(out.provider).toBe('nebius-dedicated');
    expect(net.calls[0]).toMatchObject({ url: 'https://api.tokenfactory.us-central1.nebius.com/v1/chat/completions', model: 'dedicated-routing-key', auth: 'Bearer nebius-key' });
    // and when the endpoint is still starting (404) the ordinary models answer
    net.failing.add('dedicated-routing-key');
    expect((await r.run({ task: 'meal_plan', prompt: 'x', json: true })).provider).not.toBe('nebius-dedicated');
  });
});
