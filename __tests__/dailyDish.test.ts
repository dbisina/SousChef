import {
  MAX_GUESSES,
  activeStreak,
  clueSlots,
  newGame,
  nextClue,
  puzzleNumberFor,
  scoreSolve,
  submitGuess,
  updateStreak,
} from '@/lib/dailyDish';
import { DAILY_PUZZLES } from '@/data/sample/play';

const puzzle = DAILY_PUZZLES[0]; // Ramen

describe('Daily Dish', () => {
  it('numbers puzzles from the epoch (13 Nov 2026 is #312)', () => {
    expect(puzzleNumberFor(new Date(2026, 10, 13))).toBe(312);
    expect(puzzleNumberFor(new Date(2026, 0, 6))).toBe(1);
  });
  it('reveals clues one at a time up to 6', () => {
    let s = newGame(1);
    expect(clueSlots(puzzle, s).filter(Boolean)).toHaveLength(1);
    for (let i = 0; i < 10; i++) s = nextClue(s);
    expect(s.cluesShown).toBe(6);
    expect(clueSlots(puzzle, s)).toEqual(puzzle.clues);
  });
  it('accepts answer, alias, case and spacing variations', () => {
    expect(submitGuess(puzzle, newGame(1), 'RAMEN').status).toBe('solved');
    expect(submitGuess(puzzle, newGame(1), '  egg ramen ').status).toBe('solved');
  });
  it('keeps playing on a wrong guess and fails after max guesses', () => {
    let s = newGame(1);
    s = submitGuess(puzzle, s, 'Pho');
    expect(s.status).toBe('playing');
    expect(s.guesses).toEqual(['Pho']);
    for (let i = 1; i < MAX_GUESSES; i++) s = submitGuess(puzzle, s, `wrong${i}`);
    expect(s.status).toBe('failed');
  });
  it('ignores blank guesses and finished games', () => {
    const s = newGame(1);
    expect(submitGuess(puzzle, s, '  ')).toBe(s);
    const done = submitGuess(puzzle, s, 'ramen');
    expect(submitGuess(puzzle, done, 'pho')).toBe(done);
  });
  it('scores fewer clues higher', () => {
    const quick = submitGuess(puzzle, newGame(1), 'ramen');
    let slow = nextClue(nextClue(newGame(1)));
    slow = submitGuess(puzzle, submitGuess(puzzle, slow, 'pho'), 'ramen');
    expect(scoreSolve(quick)).toBe(100);
    expect(scoreSolve(slow)).toBe(65);
    expect(scoreSolve(newGame(1))).toBe(0);
  });
  it('streak: consecutive days increment, gaps reset, same day is idempotent, fail resets', () => {
    let st = { current: 9, best: 9, lastSolvedDate: '2026-11-12' };
    st = updateStreak(st, '2026-11-13', true);
    expect(st).toEqual({ current: 10, best: 10, lastSolvedDate: '2026-11-13' });
    expect(updateStreak(st, '2026-11-13', true)).toBe(st);
    expect(updateStreak(st, '2026-11-15', true).current).toBe(1);
    expect(updateStreak(st, '2026-11-14', false).current).toBe(0);
    expect(updateStreak({ current: 0, best: 0, lastSolvedDate: '' }, '2026-11-13', true).current).toBe(1);
  });
  it('active streak lapses after a missed day', () => {
    const st = { current: 9, best: 9, lastSolvedDate: '2026-11-12' };
    expect(activeStreak(st, '2026-11-13')).toBe(9);
    expect(activeStreak(st, '2026-11-14')).toBe(0);
  });
});
