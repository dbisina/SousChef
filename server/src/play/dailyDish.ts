import {
  activeStreak,
  dateKeyOf,
  dayIndex,
  isCorrectGuess,
  MAX_CLUES,
  MAX_GUESSES,
  normalizeGuess,
  puzzleNumberFor,
  scoreSolve,
  updateStreak,
  type AdminDailyPuzzle,
  type DailyDishView,
  type DailyLeaderboardEntry,
  type DailyPuzzleInput,
  type DailyStatus,
  type Streak,
} from '@shared';
import type { Prisma } from '../../generated/prisma/client';
import type { Db } from '../db';
import { errors } from '../errors';
import { authorSelect, toAuthor } from '../recipes/mappers';

const MAX_PUZZLES = 400;
/** A real calendar day written YYYY-MM-DD. ("2026-13-45" and "2026-02-30" are not.) */
const isDateKey = (s: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00.000Z`);
  return !Number.isNaN(d.getTime()) && dateKeyOf(d) === s;
};

type PuzzleRow = Prisma.DailyPuzzleGetPayload<object>;
type GameRow = Prisma.DailyDishGameGetPayload<object>;

/** Daily Dish: one dish a day, guessed from clues. The server holds the answers and keeps the score, so nobody can peek or cheat. */
export class DailyDishService {
  constructor(
    private readonly db: Db,
    private readonly now: () => Date = () => new Date(),
  ) {}

  /**
   * The day a request is about. Players near the date line may send their own date; it is used if it is within a day of
   * the server's, and ignored otherwise (so nobody can play tomorrow's puzzle or an old one).
   */
  resolveDate(requested?: string): string {
    const today = dateKeyOf(this.now());
    if (requested && isDateKey(requested) && Math.abs(dayIndex(requested) - dayIndex(today)) <= 1) return requested;
    return today;
  }

  /** Today's game for this person, started if they have not played yet. */
  async view(userId: string, requestedDate?: string): Promise<DailyDishView> {
    const date = this.resolveDate(requestedDate);
    const puzzle = await this.puzzleFor(date);
    await this.db.dailyDishGame.createMany({ data: [{ userId, dateKey: date, startedAt: this.now() }], skipDuplicates: true });
    const game = await this.db.dailyDishGame.findUniqueOrThrow({ where: { userId_dateKey: { userId, dateKey: date } } });
    return this.render(userId, date, puzzle, game);
  }

  /** Shows the next clue (costing score at the end). */
  async clue(userId: string, requestedDate?: string): Promise<DailyDishView> {
    const date = this.resolveDate(requestedDate);
    const puzzle = await this.puzzleFor(date);
    const game = await this.locked(userId, date, async (tx, g) => {
      if (g.status !== 'playing' || g.cluesShown >= Math.min(MAX_CLUES, puzzle.clues.length)) return g;
      return tx.dailyDishGame.update({ where: { userId_dateKey: { userId, dateKey: date } }, data: { cluesShown: { increment: 1 } } });
    });
    return this.render(userId, date, puzzle, game);
  }

  /** Makes a guess. A right one ends the game with a score; the sixth wrong one ends it with none. */
  async guess(userId: string, guess: string, requestedDate?: string): Promise<DailyDishView> {
    if (!normalizeGuess(guess)) throw errors.validation({ guess: 'Type a dish name' });
    const date = this.resolveDate(requestedDate);
    const puzzle = await this.puzzleFor(date);
    const game = await this.locked(userId, date, async (tx, g) => {
      if (g.status !== 'playing') return g; // the game is over: a late guess changes nothing
      const guesses = [...g.guesses, guess.trim().slice(0, 100)];
      const solved = isCorrectGuess(puzzle.answer, puzzle.aliases, guess);
      const failed = !solved && guesses.length >= MAX_GUESSES;
      const status: DailyStatus = solved ? 'solved' : failed ? 'failed' : 'playing';
      const updated = await tx.dailyDishGame.update({
        where: { userId_dateKey: { userId, dateKey: date } },
        data: {
          guesses,
          status,
          ...(status !== 'playing' ? { score: scoreSolve({ solved, cluesShown: g.cluesShown, guessCount: guesses.length }), finishedAt: this.now() } : {}),
        },
      });
      if (status !== 'playing') await this.recordStreak(tx, userId, date, solved);
      return updated;
    });
    return this.render(userId, date, puzzle, game);
  }

  /** Who among the people you follow (and you) solved today, best score first. */
  async leaderboard(userId: string, requestedDate?: string): Promise<DailyLeaderboardEntry[]> {
    const date = this.resolveDate(requestedDate);
    const rows = await this.db.dailyDishGame.findMany({
      where: {
        dateKey: date,
        status: 'solved',
        OR: [{ userId }, { user: { followers: { some: { followerId: userId } } } }],
        user: { NOT: { OR: [{ blocking: { some: { blockedId: userId } } }, { blockedBy: { some: { blockerId: userId } } }] } },
      },
      include: { user: { select: authorSelect } },
      orderBy: [{ score: 'desc' }, { cluesShown: 'asc' }, { finishedAt: 'asc' }],
      take: 50,
    });
    return rows.map((r) => ({ user: toAuthor(r.user), score: r.score, cluesShown: r.cluesShown, guesses: r.guesses.length }));
  }

  /* ------------------------------------------------------------------ staff */

  async setPuzzles(puzzles: DailyPuzzleInput[]): Promise<AdminDailyPuzzle[]> {
    if (puzzles.length === 0 || puzzles.length > MAX_PUZZLES) throw errors.validation({ puzzles: `Give between 1 and ${MAX_PUZZLES} puzzles` });
    await this.db.$transaction([
      this.db.dailyPuzzle.deleteMany(),
      this.db.dailyPuzzle.createMany({
        data: puzzles.map((p, i) => ({ position: i + 1, answer: p.answer, aliases: p.aliases ?? [], clues: p.clues, photoUrl: p.photoUrl ?? null })),
      }),
    ]);
    return this.listPuzzles();
  }

  async listPuzzles(): Promise<AdminDailyPuzzle[]> {
    const rows = await this.db.dailyPuzzle.findMany({ orderBy: { position: 'asc' } });
    return rows.map((r) => ({ position: r.position, answer: r.answer, aliases: r.aliases, clues: r.clues, ...(r.photoUrl ? { photoUrl: r.photoUrl } : {}) }));
  }

  /* ------------------------------------------------------------------ helpers */

  /** The puzzle for a day: the rotation repeats, so any date has one. */
  private async puzzleFor(date: string): Promise<PuzzleRow> {
    const total = await this.db.dailyPuzzle.count();
    if (total === 0) throw errors.notFound('There is no puzzle today');
    const index = (((puzzleNumberFor(date) - 1) % total) + total) % total;
    const [row] = await this.db.dailyPuzzle.findMany({ orderBy: { position: 'asc' }, skip: index, take: 1 });
    return row as PuzzleRow;
  }

  /** Runs a change on the person's game for the day with the row locked, so two guesses at once are applied one after the other. */
  private async locked(userId: string, date: string, change: (tx: Prisma.TransactionClient, game: GameRow) => Promise<GameRow>): Promise<GameRow> {
    return this.db.$transaction(async (tx) => {
      await tx.dailyDishGame.createMany({ data: [{ userId, dateKey: date, startedAt: this.now() }], skipDuplicates: true });
      await tx.$queryRaw`SELECT 1 FROM "DailyDishGame" WHERE "userId" = ${userId}::uuid AND "dateKey" = ${date} FOR UPDATE`;
      const game = await tx.dailyDishGame.findUniqueOrThrow({ where: { userId_dateKey: { userId, dateKey: date } } });
      return change(tx, game);
    });
  }

  private async recordStreak(tx: Prisma.TransactionClient, userId: string, date: string, solved: boolean): Promise<void> {
    const row = await tx.dailyDishStreak.findUnique({ where: { userId } });
    const before: Streak = row ?? { current: 0, best: 0, lastSolvedDate: '' };
    const after = updateStreak(before, date, solved);
    await tx.dailyDishStreak.upsert({ where: { userId }, create: { userId, ...after }, update: after });
  }

  private async render(userId: string, date: string, puzzle: PuzzleRow, game: GameRow): Promise<DailyDishView> {
    const streakRow = await this.db.dailyDishStreak.findUnique({ where: { userId } });
    const over = game.status !== 'playing';
    return {
      date,
      puzzleNumber: puzzleNumberFor(date),
      status: game.status as DailyStatus,
      clues: Array.from({ length: MAX_CLUES }, (_, i) => (i < game.cluesShown && i < puzzle.clues.length ? (puzzle.clues[i] as string) : null)),
      cluesShown: game.cluesShown,
      cluesTotal: Math.min(MAX_CLUES, puzzle.clues.length),
      guesses: game.guesses,
      maxGuesses: MAX_GUESSES,
      score: game.score,
      answer: over ? puzzle.answer : null,
      photoUrl: over ? puzzle.photoUrl : null,
      streak: { current: activeStreak(streakRow ?? { current: 0, best: 0, lastSolvedDate: '' }, date), best: streakRow?.best ?? 0 },
    };
  }
}
