import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { SoloGameInfo, SoloResult, SoloRound } from '@shared';
import { AiProviderError } from '../src/ai/types';
import { AiRouter } from '../src/ai/router';
import { routerSettings } from '../src/ai/factory';
import { GamePoolService, itemHash } from '../src/play/pool';
import { FakeAiProvider } from './aiHelpers';
import { makeApp, register, testConfig, type TestApp } from './helpers';
import { call } from './recipeHelpers';

let t: TestApp;
beforeAll(async () => {
  t = await makeApp();
});
afterAll(() => t.close());
beforeEach(() => t.reset());

let serial = 0;
/** n different good questions for a game with `wrong` wrong answers each. */
const batch = (n: number, wrong = 3, prefix = 'Q') =>
  JSON.stringify({
    items: Array.from({ length: n }, (_, i) => {
      const k = ++serial;
      return { prompt: `${prefix} ${k}: what is the right thing to do in step ${i}?`, correct: `right ${k}`, wrong: Array.from({ length: wrong }, (_x, w) => `wrong ${k}-${w}`), note: `Because ${k}.` };
    }),
  });

function pool(handler: (system: string) => string, autoRefill = false) {
  const provider = new FakeAiProvider('deepseek');
  provider.handler = (r) => handler(r.system ?? '');
  const config = testConfig();
  const settings = routerSettings(config, [provider]);
  const ai = new AiRouter(t.db, { ...settings, routes: { ...settings.routes, game_content: ['deepseek'] } }, { warn: () => undefined });
  return { service: new GamePoolService(t.db, ai, undefined, undefined, autoRefill), provider };
}

describe('writing questions into the pool', () => {
  it('keeps good questions and drops unusable or repeated ones', async () => {
    const good = JSON.parse(batch(2)) as { items: object[] };
    const items = [
      ...good.items,
      good.items[0], // the same question again
      { prompt: 'Short?', correct: 'a', wrong: ['b', 'c', 'd'] }, // too short a prompt
      { prompt: 'This one has only two wrong answers listed here', correct: 'a', wrong: ['b', 'c'] },
      { prompt: 'This one lists the right answer among the wrong ones', correct: 'Salt', wrong: ['salt', 'pepper', 'sugar'] },
      'not even an object',
    ];
    const { service } = pool(() => JSON.stringify({ items }));
    expect(await service.refill('trivia')).toBe(2);
    expect(await t.db.gamePoolItem.count({ where: { game: 'trivia' } })).toBe(2);
    expect(await service.refill('trivia')).toBe(0); // all of them are already in the pool
  });

  it('asks myth-or-fact questions for Fact or Myth answers only', async () => {
    const items = [
      { prompt: 'Searing meat seals in its juices before you roast it.', correct: 'Myth', wrong: ['Fact'], note: 'Searing browns, it does not seal.' },
      { prompt: 'Salt raises the boiling point of water a little.', correct: 'Fact', wrong: ['Myth'], note: 'But very little.' },
      { prompt: 'This answer is not one of the two allowed words.', correct: 'Maybe', wrong: ['Fact'], note: '' },
    ];
    const { service } = pool(() => JSON.stringify({ items }));
    expect(await service.refill('myth')).toBe(2);
  });

  it('fails plainly when the writer gives nothing usable', async () => {
    const { service } = pool(() => JSON.stringify({ items: [{ nonsense: true }] }));
    await expect(service.refill('pairing')).rejects.toMatchObject({ status: 503 });
  });
});

describe('drawing a round', () => {
  it('gives questions the player has not had, and does not repeat until the pool runs out', async () => {
    const me = await register(t);
    const { service, provider } = pool(() => batch(25));
    const first = await service.draw(me.user.id, 'trivia', 10); // empty pool: the hand-written trivia is seeded first, no AI call
    expect(first).toHaveLength(10);
    expect(provider.calls).toHaveLength(0);
    const second = await service.draw(me.user.id, 'trivia', 10);
    expect(new Set([...first, ...second].map((q) => q.id)).size).toBe(20);
    expect(await t.db.gamePoolSeen.count({ where: { userId: me.user.id } })).toBe(20);
  });

  it('asks for new questions when the player has had nearly all there are', async () => {
    const me = await register(t);
    const { service, provider } = pool(() => batch(25, 3, 'New'));
    for (let i = 0; i < 5; i++) await service.draw(me.user.id, 'trivia', 10); // all 50 hand-written ones
    const next = await service.draw(me.user.id, 'trivia', 10);
    expect(provider.calls).toHaveLength(1);
    expect(next.every((q) => q.prompt.startsWith('New'))).toBe(true);
  });

  it('falls back to the questions had longest ago when no new ones can be written', async () => {
    const me = await register(t);
    const { service, provider } = pool(() => batch(25));
    for (let i = 0; i < 5; i++) await service.draw(me.user.id, 'trivia', 10);
    provider.failWith = new AiProviderError('down', false, 500);
    const again = await service.draw(me.user.id, 'trivia', 10);
    expect(again).toHaveLength(10);
  });

  it('is empty-handed, plainly, for a generated game with no questions and no writer', async () => {
    const me = await register(t);
    const { service, provider } = pool(() => '{}');
    provider.failWith = new AiProviderError('down', false, 500);
    await expect(service.draw(me.user.id, 'cuisine', 10)).rejects.toMatchObject({ status: 409 });
  });

  it('keeps one stored question per wording', () => {
    expect(itemHash('trivia', 'What is Roux?', 'Fat and flour')).toBe(itemHash('trivia', 'what is roux', 'fat and flour!'));
    expect(itemHash('trivia', 'What is Roux?', 'Fat and flour')).not.toBe(itemHash('myth', 'What is Roux?', 'Fat and flour'));
  });
});

describe('the generated games through the API', () => {
  it('lists every game and plays a generated one start to finish', async () => {
    const me = await register(t);
    const list = (await call(t, 'GET', '/v1/play/solo', me)).json<{ items: SoloGameInfo[] }>().items;
    expect(list.map((g) => g.id)).toEqual(['trivia', 'myth', 'cuisine', 'odd', 'technique', 'pairing', 'sorter', 'match']);
    t.ai.deepseek.handler = (r) => {
      const wrong = /exactly|"wrong": \[string\]/.test(r.system ?? '') && /Fact|Myth/.test(r.system ?? '') ? 1 : 3;
      return batch(25, wrong, 'Cuisine');
    };
    const start = await call(t, 'POST', '/v1/play/solo/cuisine/start', me);
    expect(start.statusCode).toBe(200);
    const round = start.json<SoloRound>();
    expect(round.items).toHaveLength(10);
    expect(round.items.every((i) => i.options?.length === 4)).toBe(true);
    expect(JSON.stringify(round)).not.toMatch(/"answer"|"correct"/);
    const res = await call(t, 'POST', '/v1/play/solo/cuisine/answer', me, { token: round.token, answers: round.items.map(() => 0) });
    expect(res.statusCode).toBe(200);
    expect(res.json<SoloResult>().total).toBe(10);
  });

  it('plays trivia from the hand-written questions when the AI is off', async () => {
    const me = await register(t);
    const round = (await call(t, 'POST', '/v1/play/solo/trivia/start', me)).json<SoloRound>();
    expect(round.items).toHaveLength(10);
  });
});
