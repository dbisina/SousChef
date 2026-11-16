import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from 'node:crypto';
import {
  SOLO_GAMES,
  type SoloAnswerRequest,
  type SoloGameId,
  type SoloGameInfo,
  type SoloItem,
  type SoloLeaderboardEntry,
  type SoloReveal,
  type SoloResult,
  type SoloRound,
} from '@shared';
import type { Db } from '../db';
import { errors } from '../errors';
import { TRIVIA } from './trivia';
import { isPoolGame, type GamePoolService, type PoolGame } from './pool';

const TOKEN_MINUTES = 30;
const TRIVIA_COUNT = 10;
const MATCH_COUNT = 8;
const SORTER_COUNT = 3;
const MIN_STEPS = 4;
const MAX_STEPS = 8;

const INFO: Record<SoloGameId, Omit<SoloGameInfo, 'best' | 'plays'>> = {
  myth: { id: 'myth', name: 'Myth or Fact', tagline: 'Kitchen beliefs: true or not?', how: 'Decide whether each claim is a fact or a myth.' },
  cuisine: { id: 'cuisine', name: 'Name That Cuisine', tagline: 'Where does this dish come from?', how: 'Read the description and pick the cuisine.' },
  odd: { id: 'odd', name: 'Odd One Out', tagline: 'Which ingredient does not belong?', how: 'Spot the ingredient that does not fit the dish.' },
  technique: { id: 'technique', name: 'Technique Match', tagline: 'Name the cooking technique', how: 'Match each description to the technique.' },
  pairing: { id: 'pairing', name: 'Flavour Pairing', tagline: 'What goes best with it?', how: 'Pick the classic partner for each ingredient.' },
  trivia: { id: 'trivia', name: 'Kitchen Trivia', tagline: 'Ten questions on food and technique', how: 'Pick the right answer for each question.' },
  sorter: { id: 'sorter', name: 'Step Sorter', tagline: 'Put real recipe steps back in order', how: 'Tap the steps in the order you would cook them.' },
  match: { id: 'match', name: 'Ingredient Match', tagline: 'Which ingredient is missing?', how: 'Each recipe lost one ingredient. Pick the one that belongs.' },
};

/** What the token carries for each item: how to mark it, and what to show afterwards. */
type Key = { id: string; kind: 'pick'; answer: string; options: string[]; note?: string } | { id: string; kind: 'order'; order: number[]; steps: string[]; note?: string };
interface Payload {
  g: SoloGameId;
  u: string;
  exp: number;
  keys: Key[];
}

const shuffle = <T>(list: readonly T[], random: () => number): T[] => {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.min(i, Math.floor(random() * (i + 1)));
    [out[i], out[j]] = [out[j] as T, out[i] as T];
  }
  return out;
};
const sample = <T>(list: readonly T[], n: number, random: () => number): T[] => shuffle(list, random).slice(0, n);

const isGame = (g: string): g is SoloGameId => (SOLO_GAMES as readonly string[]).includes(g);

/** Kitchen Trivia, Step Sorter and Ingredient Match. Stateless rounds: the answers travel inside a signed, expiring token. */
export class SoloGameService {
  constructor(
    private readonly db: Db,
    private readonly secret: string,
    private readonly now: () => Date = () => new Date(),
    private readonly random: () => number = Math.random,
    /** Where generated questions come from. Without it only the hand-written trivia is available. */
    private readonly pool: GamePoolService | null = null,
  ) {}

  gameId(raw: string): SoloGameId {
    if (!isGame(raw)) throw errors.notFound('That game does not exist');
    return raw;
  }

  async list(userId: string): Promise<SoloGameInfo[]> {
    const rows = await this.db.soloGameScore.findMany({ where: { userId } });
    return SOLO_GAMES.map((id) => {
      const row = rows.find((r) => r.game === id);
      return { ...INFO[id], best: row ? row.best : null, plays: row?.plays ?? 0 };
    });
  }

  async start(userId: string, game: SoloGameId): Promise<SoloRound> {
    const built = isPoolGame(game) ? await this.fromPool(userId, game) : game === 'sorter' ? await this.sorter() : await this.match();
    const token = this.sign({ g: game, u: userId, exp: this.now().getTime() + TOKEN_MINUTES * 60_000, keys: built.keys });
    return { game, token, items: built.items };
  }

  async answer(userId: string, game: SoloGameId, request: SoloAnswerRequest): Promise<SoloResult> {
    const payload = this.verify(request.token);
    if (!payload || payload.g !== game || payload.u !== userId) throw errors.validation({ token: 'This round is not valid. Start a new one' });
    if (payload.exp < this.now().getTime()) throw errors.validation({ token: 'This round ran out of time. Start a new one' });
    if (request.answers.length !== payload.keys.length) throw errors.validation({ answers: 'Answer every item' });

    let points = 0;
    let correctCount = 0;
    const reveal: SoloReveal[] = payload.keys.map((key, i) => {
      const given = request.answers[i];
      if (key.kind === 'pick') {
        const ok = typeof given === 'number' && key.options[given] === key.answer;
        if (ok) {
          points += 1;
          correctCount += 1;
        }
        return { id: key.id, correct: ok, answer: key.answer, ...(key.note ? { note: key.note } : {}) };
      }
      const order = Array.isArray(given) ? given : [];
      const valid = order.length === key.order.length && new Set(order).size === order.length && order.every((n) => Number.isInteger(n) && n >= 0 && n < key.order.length);
      const right = valid ? key.order.filter((n, pos) => order[pos] === n).length : 0;
      points += right / key.order.length;
      const ok = valid && right === key.order.length;
      if (ok) correctCount += 1;
      return { id: key.id, correct: ok, answer: key.order.map((n) => key.steps[n] as string), ...(key.note ? { note: key.note } : {}) };
    });

    const score = Math.round((points / payload.keys.length) * 100);
    const now = this.now();
    const row = await this.db.soloGameScore.upsert({
      where: { userId_game: { userId, game } },
      create: { userId, game, best: score, last: score, plays: 1, updatedAt: now },
      update: { last: score, plays: { increment: 1 }, updatedAt: now },
    });
    let best = row.best;
    let newBest = false;
    if (score > row.best) {
      best = score;
      newBest = row.plays > 1; // the first play is not a "new best", it is the first
      await this.db.soloGameScore.update({ where: { userId_game: { userId, game } }, data: { best: score } });
    }
    return { game, score, correctCount, total: payload.keys.length, reveal, best, newBest, plays: row.plays };
  }

  async leaderboard(userId: string, game: SoloGameId): Promise<SoloLeaderboardEntry[]> {
    const rows = await this.db.soloGameScore.findMany({
      where: { game, best: { gt: 0 } },
      orderBy: [{ best: 'desc' }, { updatedAt: 'asc' }],
      take: 20,
      include: { user: { select: { id: true, displayName: true, handle: true } } },
    });
    return rows.map((r, i) => ({ rank: i + 1, userId: r.userId, displayName: r.user.displayName, handle: r.user.handle, best: r.best, isYou: r.userId === userId }));
  }

  /* ---------------------------------------------------------------- building rounds */

  /** Pick-one games from the question pool: new questions first, so rounds do not repeat. */
  private async fromPool(userId: string, game: PoolGame): Promise<{ items: SoloItem[]; keys: Key[] }> {
    if (!this.pool) {
      if (game !== 'trivia') throw errors.conflict('This game is not ready yet');
      return this.staticTrivia();
    }
    const keys: Key[] = [];
    const items: SoloItem[] = [];
    for (const q of await this.pool.draw(userId, game, TRIVIA_COUNT)) {
      const options = game === 'myth' ? [...[q.correct, ...q.wrong]].sort() : shuffle([q.correct, ...q.wrong], this.random);
      items.push({ id: q.id, prompt: q.prompt, options, ...(q.imageUrl ? { imageUrl: q.imageUrl } : {}) });
      keys.push({ id: q.id, kind: 'pick', answer: q.correct, options, ...(q.note ? { note: q.note } : {}) });
    }
    return { items, keys };
  }

  private staticTrivia(): { items: SoloItem[]; keys: Key[] } {
    const keys: Key[] = [];
    const items: SoloItem[] = [];
    for (const q of sample(TRIVIA, TRIVIA_COUNT, this.random)) {
      const options = shuffle(q.options, this.random);
      const id = randomUUID();
      items.push({ id, prompt: q.q, options });
      keys.push({ id, kind: 'pick', answer: q.options[0], options, note: q.note });
    }
    return { items, keys };
  }

  private async recipes(): Promise<Array<{ id: string; title: string; ingredientNames: string[]; instructions: unknown }>> {
    return this.db.recipe.findMany({
      where: { status: 'PUBLISHED' },
      select: { id: true, title: true, ingredientNames: true, instructions: true },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  private async sorter(): Promise<{ items: SoloItem[]; keys: Key[] }> {
    const usable = (await this.recipes())
      .map((r) => ({ ...r, steps: (Array.isArray(r.instructions) ? r.instructions : []).filter((s): s is string => typeof s === 'string' && s.trim().length > 0) }))
      .filter((r) => r.steps.length >= MIN_STEPS);
    if (usable.length === 0) throw errors.conflict('There are no recipes to play with yet');
    const items: SoloItem[] = [];
    const keys: Key[] = [];
    for (const r of sample(usable, Math.min(SORTER_COUNT, usable.length), this.random)) {
      const steps = r.steps.slice(0, MAX_STEPS).map((s) => s.trim());
      const shown = shuffle(steps.map((text, original) => ({ text, original })), this.random);
      // order[p] = the index in `shown` of the step that belongs at position p
      const order = steps.map((_, p) => shown.findIndex((s) => s.original === p));
      const id = randomUUID();
      items.push({ id, prompt: `Put the steps of ${r.title} in order`, steps: shown.map((s) => s.text) });
      keys.push({ id, kind: 'order', order, steps: shown.map((s) => s.text) });
    }
    return { items, keys };
  }

  private async match(): Promise<{ items: SoloItem[]; keys: Key[] }> {
    const usable = (await this.recipes()).filter((r) => r.ingredientNames.length >= 4);
    if (usable.length < 2) throw errors.conflict('There are not enough recipes to play with yet');
    const everything = [...new Set(usable.flatMap((r) => r.ingredientNames))];
    const items: SoloItem[] = [];
    const keys: Key[] = [];
    for (const r of sample(usable, Math.min(MATCH_COUNT, usable.length), this.random)) {
      const names = r.ingredientNames.slice(0, 12);
      const missing = names[Math.min(names.length - 1, Math.floor(this.random() * names.length))] as string;
      const shownList = names.filter((n) => n !== missing);
      const wrong = sample(everything.filter((n) => !r.ingredientNames.includes(n)), 3, this.random);
      if (wrong.length < 3) continue;
      const options = shuffle([missing, ...wrong], this.random);
      const id = randomUUID();
      items.push({ id, prompt: `${r.title} has: ${shownList.join(', ')}. Which ingredient is missing?`, options });
      keys.push({ id, kind: 'pick', answer: missing, options, note: `${r.title} uses ${missing}.` });
    }
    if (items.length === 0) throw errors.conflict('There are not enough recipes to play with yet');
    return { items, keys };
  }

  /* ---------------------------------------------------------------- the token */

  /** Encrypted and authenticated (AES-256-GCM), so the phone can neither read the answers nor change them. */
  private key(): Buffer {
    return createHash('sha256').update(`solo.${this.secret}`).digest();
  }

  private sign(payload: Payload): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key(), iv);
    const body = Buffer.concat([cipher.update(JSON.stringify(payload), 'utf8'), cipher.final()]);
    return Buffer.concat([iv, cipher.getAuthTag(), body]).toString('base64url');
  }

  private verify(token: string): Payload | null {
    try {
      const raw = Buffer.from(token, 'base64url');
      if (raw.length < 29) return null;
      const decipher = createDecipheriv('aes-256-gcm', this.key(), raw.subarray(0, 12));
      decipher.setAuthTag(raw.subarray(12, 28));
      const json = Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString('utf8');
      return JSON.parse(json) as Payload;
    } catch {
      return null;
    }
  }
}
