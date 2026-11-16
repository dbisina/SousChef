import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  activeStreak,
  EMPTY_STREAK,
  isCorrectGuess,
  normalizeGuess,
  puzzleNumberFor,
  scoreSolve,
  updateStreak,
  type AdminDailyPuzzle,
  type DailyDishView,
  type DailyLeaderboardEntry,
} from '@shared';
import { DAY_MS, makeApp, register, type TestApp } from './helpers';
import { call, makeAdmin } from './recipeHelpers';

let t: TestApp;
beforeAll(async () => {
  t = await makeApp({ ACCESS_TOKEN_TTL_SECONDS: String(120 * 86400) });
});
afterAll(() => t.close());
beforeEach(() => t.reset());

type Who = Awaited<ReturnType<typeof register>>;

const jollof = { answer: 'Jollof Rice', aliases: ['Party Jollof'], clues: ['A one-pot grain dish', 'Red from tomatoes and peppers', 'Smoky from the pot bottom', 'Served at weddings', 'Tomato stew plus rice', 'A West African classic'], photoUrl: 'https://img.example.com/jollof.jpg' };
const egusi = { answer: 'Egusi Soup', aliases: [], clues: ['Thick and green flecked', 'Made with ground seeds'] };
const suya = { answer: 'Suya', aliases: [], clues: ['Street food', 'Grilled on skewers', 'Rubbed with peanut spice'] };

async function setPuzzles(puzzles: object[] = [jollof]) {
  const admin = await makeAdmin(t);
  const res = await call(t, 'PUT', '/v1/admin/daily-puzzles', admin, { puzzles });
  if (res.statusCode !== 200) throw new Error(`set puzzles failed: ${res.statusCode} ${res.body}`);
  return admin;
}
const today = async (who: Who, query = '') => (await call(t, 'GET', `/v1/play/daily${query}`, who)).json<DailyDishView>();
const guess = async (who: Who, g: string, date?: string) => (await call(t, 'POST', '/v1/play/daily/guess', who, { guess: g, ...(date ? { date } : {}) })).json<DailyDishView>();
const clue = async (who: Who, date?: string) => (await call(t, 'POST', '/v1/play/daily/clue', who, date ? { date } : {})).json<DailyDishView>();
const serverDay = (offsetDays = 0) => new Date(Date.now() + offsetDays * DAY_MS).toISOString().slice(0, 10);

describe('the rules', () => {
  it('treats guesses alike whatever the case, accents, punctuation or spacing', () => {
    expect(normalizeGuess('  Jóllof   Rice!! ')).toBe('jollof rice');
    expect(normalizeGuess('???')).toBe('');
    expect(isCorrectGuess('Jollof Rice', ['Party Jollof'], 'JOLLOF rice')).toBe(true);
    expect(isCorrectGuess('Jollof Rice', ['Party Jollof'], 'party  jollof')).toBe(true);
    expect(isCorrectGuess('Jollof Rice', ['Party Jollof'], 'fried rice')).toBe(false);
    expect(isCorrectGuess('Jollof Rice', [], '')).toBe(false);
  });

  // These numbers are the app's own formula (lib/dailyDish.ts): 100, minus 15 per extra clue, minus 5 per wrong guess, at least 10.
  it.each([
    [{ solved: true, cluesShown: 1, guessCount: 1 }, 100],
    [{ solved: true, cluesShown: 3, guessCount: 2 }, 65],
    [{ solved: true, cluesShown: 2, guessCount: 4 }, 70],
    [{ solved: true, cluesShown: 6, guessCount: 6 }, 10],
    [{ solved: false, cluesShown: 1, guessCount: 1 }, 0],
  ])('scores %j as %i', (input, expected) => {
    expect(scoreSolve(input)).toBe(expected);
  });

  it('counts days from the first puzzle', () => {
    expect(puzzleNumberFor('2026-01-06')).toBe(1);
    expect(puzzleNumberFor('2026-01-07')).toBe(2);
    expect(puzzleNumberFor('2026-02-06')).toBe(32);
  });

  it('keeps a streak across consecutive days, ends it on a miss, and lets it lapse', () => {
    let s = updateStreak(EMPTY_STREAK, '2026-11-10', true);
    expect(s).toEqual({ current: 1, best: 1, lastSolvedDate: '2026-11-10' });
    s = updateStreak(s, '2026-11-11', true);
    expect(s).toEqual({ current: 2, best: 2, lastSolvedDate: '2026-11-11' });
    expect(updateStreak(s, '2026-11-11', true)).toBe(s); // a second solve the same day changes nothing
    expect(updateStreak(s, '2026-11-13', true)).toEqual({ current: 1, best: 2, lastSolvedDate: '2026-11-13' }); // a gap starts again
    expect(updateStreak(s, '2026-11-12', false)).toEqual({ current: 0, best: 2, lastSolvedDate: '2026-11-11' }); // a failed game
    expect(activeStreak(s, '2026-11-12')).toBe(2); // still alive the next day
    expect(activeStreak(s, '2026-11-13')).toBe(0); // lapsed
    expect(activeStreak(EMPTY_STREAK, '2026-11-13')).toBe(0);
  });
});

describe('playing a day', () => {
  it('needs a sign-in, and a puzzle to exist', async () => {
    const ama = await register(t);
    expect((await call(t, 'GET', '/v1/play/daily')).statusCode).toBe(401);
    expect((await call(t, 'GET', '/v1/play/daily', ama)).statusCode).toBe(404);
    expect((await call(t, 'POST', '/v1/play/daily/guess', ama, { guess: 'x' })).statusCode).toBe(404);
  });

  it('starts with only the first clue, and never shows the answer or the other clues', async () => {
    await setPuzzles();
    const ama = await register(t);
    const view = await today(ama);
    expect(view).toMatchObject({ status: 'playing', cluesShown: 1, cluesTotal: 6, guesses: [], maxGuesses: 6, score: 0, answer: null, photoUrl: null, streak: { current: 0, best: 0 } });
    expect(view.clues).toEqual(['A one-pot grain dish', null, null, null, null, null]);
    expect(view.date).toBe(serverDay());
    expect(JSON.stringify(view)).not.toContain('Jollof'); // not even in the puzzle number's neighbourhood
    expect(JSON.stringify(view)).not.toContain('Party');
  });

  it('shows the next clue each time, up to the number the puzzle has', async () => {
    await setPuzzles([egusi]);
    const ama = await register(t);
    expect((await clue(ama)).clues).toEqual(['Thick and green flecked', 'Made with ground seeds', null, null, null, null]);
    expect((await clue(ama)).cluesShown).toBe(2);
    expect((await clue(ama)).cluesShown).toBe(2); // that was the last one
    expect((await today(ama)).cluesTotal).toBe(2);
  });

  it('records a wrong guess and keeps playing', async () => {
    await setPuzzles();
    const ama = await register(t);
    const view = await guess(ama, 'Fried rice');
    expect(view).toMatchObject({ status: 'playing', guesses: ['Fried rice'], answer: null });
  });

  it('ends on a right guess, ignoring case and accents and accepting other names, and reveals the answer', async () => {
    await setPuzzles();
    const [ama, kemi] = [await register(t), await register(t)] as [Who, Who];
    await clue(ama);
    await clue(ama); // 3 clues seen
    await guess(ama, 'Egusi');
    const solved = await guess(ama, '  JÓLLOF rice ');
    expect(solved).toMatchObject({ status: 'solved', answer: 'Jollof Rice', photoUrl: 'https://img.example.com/jollof.jpg', cluesShown: 3, score: 100 - 30 - 5, guesses: ['Egusi', 'JÓLLOF rice'] });
    expect((await guess(kemi, 'party jollof')).status).toBe('solved'); // an alias
  });

  it('ends on the sixth wrong guess with no score, and ignores anything after', async () => {
    await setPuzzles();
    const ama = await register(t);
    let view = await today(ama);
    for (let i = 1; i <= 6; i++) view = await guess(ama, `wrong ${i}`);
    expect(view).toMatchObject({ status: 'failed', score: 0, answer: 'Jollof Rice', guesses: expect.arrayContaining(['wrong 6']) });
    const later = await guess(ama, 'Jollof Rice');
    expect(later.status).toBe('failed');
    expect(later.guesses).toHaveLength(6);
    expect((await clue(ama)).status).toBe('failed');
  });

  it('refuses a guess with nothing in it', async () => {
    await setPuzzles();
    const ama = await register(t);
    for (const bad of ['', '   ', '???']) expect((await call(t, 'POST', '/v1/play/daily/guess', ama, { guess: bad })).statusCode).toBe(400);
    expect((await today(ama)).guesses).toEqual([]);
  });

  it('applies guesses arriving together one after the other, never recording more than six', async () => {
    await setPuzzles();
    const ama = await register(t);
    const results = await Promise.all(Array.from({ length: 9 }, (_, i) => guess(ama, `wrong ${i}`)));
    expect(results.every((r) => r.maxGuesses === 6)).toBe(true);
    const final = await today(ama);
    expect(final.status).toBe('failed');
    expect(final.guesses).toHaveLength(6);
  });

  it('gives each person their own game', async () => {
    await setPuzzles();
    const [ama, kemi] = [await register(t), await register(t)] as [Who, Who];
    await guess(ama, 'wrong');
    expect((await today(kemi)).guesses).toEqual([]);
  });
});

describe('which day it is', () => {
  it('uses the player\'s own date when it is within a day of the server\'s, and the server\'s otherwise', async () => {
    await setPuzzles();
    const ama = await register(t);
    expect((await today(ama, `?date=${serverDay(1)}`)).date).toBe(serverDay(1)); // already tomorrow where they are
    expect((await today(ama, `?date=${serverDay(-1)}`)).date).toBe(serverDay(-1));
    expect((await today(ama, `?date=${serverDay(5)}`)).date).toBe(serverDay()); // too far: ignored
    expect((await today(ama, `?date=${serverDay(-30)}`)).date).toBe(serverDay());
    for (const junk of ['yesterday', '2026-13-45', '2026-02-30', '99999']) expect((await today(ama, `?date=${junk}`)).date).toBe(serverDay());
  });

  it('keeps a separate game for each day, and a new puzzle each day from the rotation', async () => {
    await setPuzzles([jollof, egusi, suya]);
    const ama = await register(t);
    const answers: (string | null)[] = [];
    for (let day = 0; day < 4; day++) {
      const view = await today(ama);
      answers.push((await guess(ama, 'zzz wrong')).answer); // answer stays hidden while playing
      // Finish the game to see which dish it was.
      let v = view;
      for (let i = 0; i < 6; i++) v = await guess(ama, `nope ${i}`);
      answers[day] = v.answer;
      t.advance(DAY_MS);
    }
    expect(answers[0]).not.toBe(answers[1]);
    expect(answers[1]).not.toBe(answers[2]);
    expect(answers[3]).toBe(answers[0]); // the rotation of three comes round again
    expect(new Set(answers).size).toBe(3);
  });
});

describe('streaks', () => {
  it('grows with each day solved, keeps the best, resets on a failed day, and lapses when a day is missed', async () => {
    await setPuzzles([jollof]);
    const ama = await register(t);
    const solve = async () => guess(ama, 'jollof rice');

    expect((await solve()).streak).toEqual({ current: 1, best: 1 });
    t.advance(DAY_MS);
    expect((await solve()).streak).toEqual({ current: 2, best: 2 });
    t.advance(DAY_MS);
    let view = await today(ama);
    for (let i = 0; i < 6; i++) view = await guess(ama, `nope ${i}`); // a failed day
    expect(view.streak).toEqual({ current: 0, best: 2 });
    t.advance(DAY_MS);
    expect((await solve()).streak).toEqual({ current: 1, best: 2 });
    t.advance(2 * DAY_MS); // a day missed
    expect((await today(ama)).streak).toEqual({ current: 0, best: 2 });
    expect((await solve()).streak).toEqual({ current: 1, best: 2 });
  });
});

describe('the leaderboard', () => {
  it('lists you and the people you follow who solved today, best first, and no one else', async () => {
    await setPuzzles();
    const [me, friend, fan, stranger, idle] = [await register(t, { displayName: 'Me' }), await register(t, { displayName: 'Friend' }), await register(t, { displayName: 'Fan' }), await register(t, { displayName: 'Stranger' }), await register(t, { displayName: 'Idle' })] as [Who, Who, Who, Who, Who];
    for (const f of [friend, idle]) await call(t, 'PUT', `/v1/users/${f.user.id}/follow`, me);
    await call(t, 'PUT', `/v1/users/${me.user.id}/follow`, fan); // follows me, but I do not follow them

    await guess(me, 'wrong');
    await guess(me, 'jollof rice'); // 100 - 5
    await guess(friend, 'jollof rice'); // 100
    await guess(fan, 'jollof rice');
    await guess(stranger, 'jollof rice');
    await guess(idle, 'wrong'); // played but not solved

    const board = (await call(t, 'GET', '/v1/play/daily/leaderboard', me)).json<{ items: DailyLeaderboardEntry[] }>().items;
    expect(board.map((e) => [e.user.displayName, e.score])).toEqual([['Friend', 100], ['Me', 95]]);
    expect(board[1]).toMatchObject({ cluesShown: 1, guesses: 2 });

    await call(t, 'PUT', `/v1/me/blocks/${friend.user.id}`, me);
    expect((await call(t, 'GET', '/v1/play/daily/leaderboard', me)).json<{ items: unknown[] }>().items).toHaveLength(1);
  });
});

describe('the puzzle list (staff)', () => {
  it('is for staff only', async () => {
    const ama = await register(t);
    expect((await call(t, 'GET', '/v1/admin/daily-puzzles', ama)).statusCode).toBe(403);
    expect((await call(t, 'PUT', '/v1/admin/daily-puzzles', ama, { puzzles: [jollof] })).statusCode).toBe(403);
    expect((await call(t, 'PUT', '/v1/admin/daily-puzzles', undefined, { puzzles: [jollof] })).statusCode).toBe(401);
  });

  it('replaces the whole rotation in the order given, and shows the answers to staff', async () => {
    const admin = await setPuzzles([jollof, egusi]);
    const listed = (await call(t, 'GET', '/v1/admin/daily-puzzles', admin)).json<{ items: AdminDailyPuzzle[] }>().items;
    expect(listed.map((p) => [p.position, p.answer])).toEqual([[1, 'Jollof Rice'], [2, 'Egusi Soup']]);
    expect(listed[0]?.aliases).toEqual(['Party Jollof']);
    const replaced = (await call(t, 'PUT', '/v1/admin/daily-puzzles', admin, { puzzles: [suya] })).json<{ items: AdminDailyPuzzle[] }>().items;
    expect(replaced.map((p) => p.answer)).toEqual(['Suya']);
  });

  it.each([
    ['no puzzles', { puzzles: [] }],
    ['no clues', { puzzles: [{ answer: 'Suya', clues: [] }] }],
    ['seven clues', { puzzles: [{ answer: 'Suya', clues: ['1', '2', '3', '4', '5', '6', '7'] }] }],
    ['a bad photo address', { puzzles: [{ answer: 'Suya', clues: ['a'], photoUrl: 'javascript:alert(1)' }] }],
    ['a blank answer', { puzzles: [{ answer: ' ', clues: ['a'] }] }],
  ])('refuses %s', async (_label, body) => {
    const admin = await makeAdmin(t);
    expect((await call(t, 'PUT', '/v1/admin/daily-puzzles', admin, body)).statusCode).toBe(400);
  });
});

describe('deleting an account', () => {
  it('removes the person\'s games and streak', async () => {
    await setPuzzles();
    const ama = await register(t);
    await guess(ama, 'jollof rice');
    expect((await call(t, 'DELETE', '/v1/me', ama, { password: 'correct horse battery' })).statusCode).toBe(204);
    expect(await t.db.dailyDishGame.count()).toBe(0);
    expect(await t.db.dailyDishStreak.count()).toBe(0);
  });
});
