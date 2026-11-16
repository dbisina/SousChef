import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { SoloGameInfo, SoloLeaderboardEntry, SoloResult, SoloRound } from '@shared';
import { SoloGameService } from '../src/play/solo';
import { makeApp, register, type TestApp } from './helpers';
import { call, createRecipe } from './recipeHelpers';

let t: TestApp;
beforeAll(async () => {
  t = await makeApp();
});
afterAll(() => t.close());
beforeEach(() => t.reset());

type Who = Awaited<ReturnType<typeof register>>;

const steps = ['Wash the rice', 'Fry the onions', 'Add tomatoes', 'Simmer the stew', 'Add the rice', 'Cover and steam', 'Rest for five minutes'];
const food = [
  ['rice', 'tomato', 'onion', 'pepper', 'thyme'],
  ['flour', 'milk', 'egg', 'butter', 'sugar'],
  ['pasta', 'garlic', 'basil', 'parmesan', 'olive oil'],
  ['beef', 'cumin', 'lime', 'tortilla', 'coriander'],
];

async function seedRecipes(who: Who) {
  for (const [i, names] of food.entries()) {
    await createRecipe(t, who, { title: `Dish ${i}`, ingredients: names.map((name) => ({ name, amount: 1, unit: 'piece' })), instructions: steps });
  }
}
const start = async (who: Who, game: string) => call(t, 'POST', `/v1/play/solo/${game}/start`, who);
const answer = (who: Who, game: string, token: string, answers: unknown[]) => call(t, 'POST', `/v1/play/solo/${game}/answer`, who, { token, answers });

describe('solo games', () => {
  it('lists the games with no scores yet', async () => {
    const me = await register(t);
    const res = await call(t, 'GET', '/v1/play/solo', me);
    expect(res.statusCode).toBe(200);
    const items = res.json<{ items: SoloGameInfo[] }>().items;
    expect(items.map((g) => g.id)).toEqual(['trivia', 'myth', 'cuisine', 'odd', 'technique', 'pairing', 'sorter', 'match']);
    expect(items.every((g) => g.best === null && g.plays === 0)).toBe(true);
  });

  it('needs a sign-in and a known game', async () => {
    const me = await register(t);
    expect((await call(t, 'GET', '/v1/play/solo')).statusCode).toBe(401);
    expect((await start(me, 'chess')).statusCode).toBe(404);
  });

  it('trivia: ten questions, answers kept out of the round, scored on the server', async () => {
    const me = await register(t);
    const round = (await start(me, 'trivia')).json<SoloRound>();
    expect(round.items).toHaveLength(10);
    expect(JSON.stringify(round)).not.toMatch(/"answer"|"note"/);
    expect(round.items.every((i) => i.options?.length === 4)).toBe(true);
    const res = await answer(me, 'trivia', round.token, round.items.map(() => 0));
    expect(res.statusCode).toBe(200);
    const result = res.json<SoloResult>();
    expect(result.total).toBe(10);
    expect(result.score).toBe(result.correctCount * 10);
    expect(result.reveal).toHaveLength(10);
    expect(result.reveal.every((r) => typeof r.answer === 'string' && r.note)).toBe(true);
    expect(result.plays).toBe(1);
    expect(result.best).toBe(result.score);
  });

  it('a perfect trivia round scores 100 and counts as a new best only after the first play', async () => {
    const me = await register(t);
    const svc = new SoloGameService(t.db, 'x'.repeat(32));
    // Build a round with the service itself so the test can read the key it holds.
    const round = await svc.start(me.user.id, 'trivia');
    const key = (svc as unknown as { verify(token: string): { keys: Array<{ options: string[]; answer: string }> } }).verify(round.token);
    const picks = key.keys.map((k) => k.options.indexOf(k.answer));
    const first = await svc.answer(me.user.id, 'trivia', { token: round.token, answers: picks });
    expect(first.score).toBe(100);
    expect(first.newBest).toBe(false);
    expect(first.correctCount).toBe(10);
  });

  it('rejects a changed, foreign, expired or short round', async () => {
    const me = await register(t);
    const other = await register(t);
    const round = (await start(me, 'trivia')).json<SoloRound>();
    const flipped = `${round.token.slice(0, -2)}${round.token.endsWith('A') ? 'B' : 'A'}A`;
    expect((await answer(me, 'trivia', flipped, round.items.map(() => 0))).statusCode).toBe(400);
    expect((await answer(other, 'trivia', round.token, round.items.map(() => 0))).statusCode).toBe(400);
    expect((await answer(me, 'sorter', round.token, round.items.map(() => 0))).statusCode).toBe(400);
    expect((await answer(me, 'trivia', round.token, [0, 1])).statusCode).toBe(400);
    let clock = Date.now();
    const svc = new SoloGameService(t.db, 'y'.repeat(32), () => new Date(clock));
    const r2 = await svc.start(me.user.id, 'trivia');
    clock += 31 * 60_000;
    await expect(svc.answer(me.user.id, 'trivia', { token: r2.token, answers: r2.items.map(() => 0) })).rejects.toMatchObject({ status: 400 });
  });

  it('step sorter: shuffles real recipe steps, scores positions, reveals the right order', async () => {
    const me = await register(t);
    await seedRecipes(me);
    const round = (await start(me, 'sorter')).json<SoloRound>();
    expect(round.items.length).toBeGreaterThan(0);
    const item = round.items[0];
    expect(new Set(item?.steps)).toEqual(new Set(steps));
    const res = await answer(me, 'sorter', round.token, round.items.map((i) => (i.steps ?? []).map((_, n) => n)));
    const result = res.json<SoloResult>();
    expect(result.reveal[0]?.answer).toEqual(steps);
    // Giving the right order back (from the reveal) scores full marks on a fresh service round.
    const svc = new SoloGameService(t.db, 'z'.repeat(32));
    const r = await svc.start(me.user.id, 'sorter');
    const key = (svc as unknown as { verify(token: string): { keys: Array<{ order: number[] }> } }).verify(r.token);
    const done = await svc.answer(me.user.id, 'sorter', { token: r.token, answers: key.keys.map((k) => k.order) });
    expect(done.score).toBe(100);
    expect(done.correctCount).toBe(r.items.length);
    // A duplicated index is not an ordering.
    const bad = await svc.answer(me.user.id, 'sorter', { token: r.token, answers: r.items.map((i) => (i.steps ?? []).map(() => 0)) });
    expect(bad.score).toBe(0);
  });

  it('ingredient match: the missing ingredient is among four options and is not in the shown list', async () => {
    const me = await register(t);
    await seedRecipes(me);
    const round = (await start(me, 'match')).json<SoloRound>();
    expect(round.items.length).toBeGreaterThan(0);
    for (const item of round.items) expect(item.options).toHaveLength(4);
    const result = (await answer(me, 'match', round.token, round.items.map(() => 0))).json<SoloResult>();
    for (const r of result.reveal) {
      const item = round.items.find((i) => i.id === r.id);
      expect(item?.prompt.toLowerCase()).not.toContain(`, ${String(r.answer)},`);
      expect(item?.options).toContain(r.answer);
    }
  });

  it('says plainly when there are no recipes yet', async () => {
    const me = await register(t);
    expect((await start(me, 'sorter')).statusCode).toBe(409);
    expect((await start(me, 'match')).statusCode).toBe(409);
  });

  it('keeps the best score, counts plays and ranks people', async () => {
    const a = await register(t, { displayName: 'Ada' });
    const b = await register(t, { displayName: 'Bayo' });
    const svc = new SoloGameService(t.db, 'q'.repeat(32));
    const play = async (who: Who, perfect: boolean) => {
      const r = await svc.start(who.user.id, 'trivia');
      const key = (svc as unknown as { verify(token: string): { keys: Array<{ options: string[]; answer: string }> } }).verify(r.token);
      const answers = key.keys.map((k) => (perfect ? k.options.indexOf(k.answer) : k.options.findIndex((o) => o !== k.answer)));
      return svc.answer(who.user.id, 'trivia', { token: r.token, answers });
    };
    await play(a, false);
    const best = await play(a, true);
    const lower = await play(a, false);
    expect(best.score).toBe(100);
    expect(lower.best).toBe(100);
    expect(lower.plays).toBe(3);
    await play(b, true);
    const board = (await call(t, 'GET', '/v1/play/solo/trivia/leaderboard', a)).json<{ items: SoloLeaderboardEntry[] }>().items;
    expect(board).toHaveLength(2);
    expect(board.map((e) => e.best)).toEqual([100, 100]);
    expect(board.filter((e) => e.isYou)).toHaveLength(1);
    const list = (await call(t, 'GET', '/v1/play/solo', a)).json<{ items: SoloGameInfo[] }>().items;
    expect(list[0]).toMatchObject({ id: 'trivia', best: 100, plays: 3 });
  });
});
