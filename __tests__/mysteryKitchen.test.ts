import {
  HINT_COST,
  canStart,
  formatClock,
  generateRoomCode,
  hintPenalty,
  rankSubmissions,
  scorePlate,
  secondsLeft,
  timeBonus,
} from '@/lib/mysteryKitchen';
import { playService } from '@/services/playService';

describe('Mystery Kitchen scoring', () => {
  it('each hint costs 10 points', () => {
    expect(HINT_COST).toBe(10);
    expect(hintPenalty(0)).toBe(0);
    expect(hintPenalty(3)).toBe(30);
  });
  it('scores judge score minus hints plus time bonus, clamped 0..100', () => {
    const base = { judgeScore: 86, timeLeftSec: 0, totalSec: 2700 };
    expect(scorePlate({ ...base, hintsUsed: 0 })).toBe(86);
    expect(scorePlate({ ...base, hintsUsed: 1 })).toBe(76);
    expect(scorePlate({ ...base, hintsUsed: 2 })).toBe(66);
    expect(scorePlate({ judgeScore: 98, hintsUsed: 0, timeLeftSec: 2700, totalSec: 2700 })).toBe(100);
    expect(scorePlate({ judgeScore: 5, hintsUsed: 3, timeLeftSec: 0, totalSec: 2700 })).toBe(0);
  });
  it('time bonus is 0..5', () => {
    expect(timeBonus(0, 100)).toBe(0);
    expect(timeBonus(50, 100)).toBe(3);
    expect(timeBonus(500, 100)).toBe(5);
    expect(timeBonus(10, 0)).toBe(0);
  });
  it('ranks highest first, stable on ties', () => {
    const mk = (playerId: string, score: number) => ({
      playerId,
      score,
      judgeScore: score,
      hintsUsed: 0,
      timeLeftSec: 0,
      plate: 'bowl' as const,
      comment: '',
    });
    expect(
      rankSubmissions([mk('a', 68), mk('b', 86), mk('c', 74), mk('d', 74)]).map((s) => s.playerId),
    ).toEqual(['b', 'c', 'd', 'a']);
  });
  it('room code is 4 digits', () => {
    expect(generateRoomCode(() => 0)).toBe('1000');
    expect(generateRoomCode(() => 0.9999)).toBe('9999');
  });
  it('clock and countdown', () => {
    expect(formatClock(32 * 60 + 14)).toBe('32:14');
    expect(secondsLeft({ startedAt: 1000, totalSec: 100 }, 11_000)).toBe(90);
    expect(secondsLeft({ startedAt: undefined, totalSec: 100 }, 11_000)).toBe(100);
  });
  it('lobby needs two joined players; judge applies the hint penalty', () => {
    const round = playService.createRound(() => 0.5);
    expect(canStart(round)).toBe(true);
    const judged = playService.judge({ ...round, submissions: [] });
    const ama = judged.find((s) => s.playerId === 'p-ama')!;
    expect(ama.score).toBe(ama.judgeScore - 10);
  });
});
