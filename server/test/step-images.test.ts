import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MkRoomView, StepImageResponse } from '@shared';
import { AiProviderError } from '../src/ai/types';
import type { ImageGenerator } from '../src/ai/imageGen';
import { geminiImageGenerator } from '../src/ai/imageGen';
import { stepImageHash, stepImagePrompt } from '../src/play/stepImages';
import { makeApp, register, type TestApp } from './helpers';
import { call } from './recipeHelpers';

const DAY_MS = 86_400_000;
const made: string[] = [];
let generator: ImageGenerator;
let t: TestApp;

beforeAll(async () => {
  t = await makeApp({ STEP_IMAGE_DAILY_CAP: '2' }, { imageGenerator: (p) => generator(p), stepImageFetch: (async () => ({ ok: true })) as unknown as typeof fetch });
});
afterAll(() => t.close());
beforeEach(async () => {
  await t.reset();
  made.length = 0;
  generator = async (prompt) => {
    made.push(prompt);
    return { bytes: Buffer.alloc(5000, 1), mime: 'image/png' };
  };
});

type Who = Awaited<ReturnType<typeof register>>;
const pro = (who: Who) => t.db.subscription.create({ data: { userId: who.user.id, tier: 'premium', status: 'ACTIVE', expiresAt: new Date(Date.now() + 30 * DAY_MS), lastEventAt: new Date() } });

/** A game that has started, with these cooking steps. */
async function cooking(who: Who, steps: string[]): Promise<string> {
  const room = (await call(t, 'POST', '/v1/play/rooms', who, { mode: 'solo' })).json<MkRoomView>();
  await call(t, 'POST', `/v1/play/rooms/${room.code}/start`, who, {});
  await t.db.gameRoom.updateMany({ where: { code: room.code }, data: { steps, basket: ['onion', 'garlic'] } });
  return room.code;
}
const image = (who: Who | undefined, code: string, n: number) => call(t, 'GET', `/v1/play/rooms/${code}/steps/${n}/image`, who);

describe('step pictures', () => {
  it('are for paid plans only, and a free account is told to upgrade without anything being made', async () => {
    const ama = await register(t);
    const code = await cooking(ama, ['Cut the onion into quarters on a board']);
    const res = await image(ama, code, 0);
    expect(res.statusCode).toBe(403);
    expect(res.json<{ error: { code: string } }>().error.code).toBe('upgrade_required');
    expect(made).toEqual([]);
    expect((await image(undefined, code, 0)).statusCode).toBe(401);
  });

  it('make one picture for a paid account, keep it, and reuse it for the same step in any game', async () => {
    const ama = await register(t);
    const kemi = await register(t);
    await pro(ama);
    await pro(kemi);
    const step = 'Cut the onion into quarters on a board';
    const first = await image(ama, await cooking(ama, [step]), 0);
    expect(first.statusCode).toBe(200);
    expect(first.json<StepImageResponse>().url).toContain('step/');
    expect(made).toHaveLength(1);
    expect(made[0]).toContain(step);
    // someone else's game with the same step costs nothing
    const again = await image(kemi, await cooking(kemi, [step]), 0);
    expect(again.json<StepImageResponse>().url).toBe(first.json<StepImageResponse>().url);
    expect(made).toHaveLength(1);
  });

  it('stop at the daily cap for new pictures, but keep serving ones already made', async () => {
    const ama = await register(t);
    await pro(ama);
    const code = await cooking(ama, ['Step one is chopping', 'Step two is frying', 'Step three is plating']);
    expect((await image(ama, code, 0)).statusCode).toBe(200);
    expect((await image(ama, code, 1)).statusCode).toBe(200);
    const third = await image(ama, code, 2);
    expect(third.statusCode).toBe(409);
    expect((await image(ama, code, 0)).statusCode).toBe(200); // already made: still free
    expect(made).toHaveLength(2);
  });

  it('say pictures are resting, not an error, when the image service is down or out of quota', async () => {
    const ama = await register(t);
    await pro(ama);
    generator = async () => {
      throw new AiProviderError('quota', false, 429);
    };
    const code = await cooking(ama, ['Whisk the eggs until pale']);
    const res = await image(ama, code, 0);
    expect(res.statusCode).toBe(503);
    expect(await t.db.stepImage.count()).toBe(0);
    expect(await t.db.stepImageUse.count()).toBe(0); // a failed try does not use up the cap
  });

  it('only work for a player in that game, for a step that exists', async () => {
    const ama = await register(t);
    const bola = await register(t);
    await pro(ama);
    await pro(bola);
    const code = await cooking(ama, ['Only step']);
    expect((await image(bola, code, 0)).statusCode).toBe(404); // not in the game
    expect((await image(ama, code, 5)).statusCode).toBe(404); // no such step
  });
});

describe('the prompt and the image service', () => {
  it('asks for the same picture for the same step however it is written', () => {
    expect(stepImageHash('Cut the onion!')).toBe(stepImageHash('  cut the ONION '));
    expect(stepImagePrompt('Cut the onion', ['onion', 'garlic'])).toContain('No text');
  });

  it('reads the picture out of Gemini\'s answer, and fails clearly on quota or an empty answer', async () => {
    const ok = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/png', data: Buffer.alloc(4000, 2).toString('base64') } }] } }] }) }));
    const out = await geminiImageGenerator('k', 'model', ok as unknown as typeof fetch)('a prompt');
    expect(out.mime).toBe('image/png');
    expect(out.bytes.byteLength).toBe(4000);
    const quota = vi.fn(async () => ({ ok: false, status: 429, json: async () => ({}) }));
    await expect(geminiImageGenerator('k', 'model', quota as unknown as typeof fetch)('p')).rejects.toMatchObject({ status: 429 });
    const empty = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: 'sorry' }] } }] }) }));
    await expect(geminiImageGenerator('k', 'model', empty as unknown as typeof fetch)('p')).rejects.toThrow('no picture');
  });
});
