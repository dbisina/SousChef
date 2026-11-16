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

describe('Mystery Kitchen dishes from the pool', () => {
  const dish = (name: string, difficulty = 'easy', hints?: string[]) => ({
    name,
    difficulty,
    basket: ['rice', 'onion', 'garlic', 'tomato', 'thyme'],
    hints: hints ?? ['Cooked in one pot', 'Popular at parties', 'Red and smoky'],
  });

  it('keeps good dishes, drops ones that name themselves in a hint, and hands one out by difficulty', async () => {
    const { service } = pool(() =>
      JSON.stringify({ dishes: [dish('Jollof Rice'), dish('Ratatouille', 'hard', ['Ratatouille is French', 'b'.repeat(10), 'c'.repeat(10)]), { name: 'x' }, dish('Pilau', 'medium')] }),
    );
    expect(await service.refillDishes()).toBe(2);
    const easy = await service.randomDish('easy');
    expect(easy).toMatchObject({ name: 'Jollof Rice', difficulty: 'easy', basket: ['rice', 'onion', 'garlic', 'tomato', 'thyme'] });
    expect(easy?.hints).toHaveLength(3);
    expect(await service.randomDish('hard')).toBeNull(); // none of that difficulty: the built-in list is used
  });

  const steps = ['Heat the oil in a heavy pot over medium heat for two minutes', 'Soften the onion and garlic until golden, about six minutes', 'Stir in the tomato and thyme and cook until it darkens', 'Add the rice and stir for a minute so every grain is coated', 'Pour in water, cover and simmer on low until the rice is tender', 'Rest the pot off the heat for ten minutes, then fluff and serve'];

  it('keeps the cooking steps the model writes with a dish, and drops steps that name it', async () => {
    const { service } = pool(() => JSON.stringify({ dishes: [{ ...dish('Jollof Rice'), steps }, { ...dish('Pilau', 'medium'), steps: [...steps.slice(0, 4), 'Add stock to the pilau pot and simmer', 'Serve the pilau hot with a side salad'] }] }));
    expect(await service.refillDishes()).toBe(2);
    const jollof = await service.randomDish('easy');
    expect(jollof?.steps).toEqual(steps);
    const pilau = await service.randomDish('medium');
    expect(pilau?.steps).toEqual([]); // two steps named the dish, leaving too few to use
  });

  it('writes steps for a dish that has none, keeps them on its pool row, and never keeps a step that names the dish', async () => {
    const { service } = pool((system) => (system.includes('write the cooking steps') ? JSON.stringify({ steps: [...steps, 'Finish the Jollof Rice with butter'] }) : JSON.stringify({ dishes: [dish('Jollof Rice')] })));
    await service.refillDishes();
    const bare = await service.randomDish('easy');
    expect(bare?.steps).toEqual([]);
    const done = await service.completeDish(bare as NonNullable<typeof bare>);
    expect(done.steps).toEqual(steps);
    const kept = await t.db.gamePoolItem.findFirst({ where: { game: 'mk' } });
    expect(kept?.steps).toEqual(steps);
    // the next game gets them straight away
    expect((await service.randomDish('easy'))?.steps).toEqual(steps);
  });

  it('leaves a dish as it was when the steps cannot be written', async () => {
    const { service } = pool(() => 'not json');
    const out = await service.completeDish({ name: 'Plain Rice', difficulty: 'easy', basket: ['rice', 'water', 'salt', 'oil', 'pot'], hints: ['a', 'b', 'c'] });
    expect(out).toMatchObject({ name: 'Plain Rice', steps: [] });
  });
});
