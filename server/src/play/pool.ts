import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { AiRouter } from '../ai/router';
import type { Db } from '../db';
import { errors } from '../errors';
import type { MkDifficulty } from '@shared';
import { findWikipediaPhoto, photoShows, store } from '../seed/generate';
import type { Storage } from '../storage/storage';
import { TRIVIA } from './trivia';
import type { MkDish } from './dishes';

/** The games whose questions are written by a model and kept in a pool, so they do not repeat. */
export const POOL_GAMES = ['trivia', 'myth', 'cuisine', 'odd', 'technique', 'pairing'] as const;
export type PoolGame = (typeof POOL_GAMES)[number];
export const isPoolGame = (g: string): g is PoolGame => (POOL_GAMES as readonly string[]).includes(g);

/** What each game asks the model for. `wrong` is how many wrong answers go with the right one. */
const SPEC: Record<PoolGame, { wrong: number; brief: string }> = {
  trivia: { wrong: 3, brief: 'Multiple-choice trivia about cooking: ingredients, kitchen science, techniques, kitchens and food culture around the world. Mix easy and hard.' },
  myth: { wrong: 1, brief: 'Kitchen beliefs to judge. "prompt" is a statement people commonly believe about cooking or food (for example that searing seals in juices). "correct" is "Fact" if the statement is true, or "Myth" if it is false; "wrong" is the other word. "note" explains the truth in one sentence.' },
  cuisine: { wrong: 3, brief: 'Name that cuisine. "prompt" describes a dish by its look, ingredients and how it is eaten WITHOUT naming the dish or the country ("Which cuisine does this come from? A ..."). "correct" is its cuisine or country; "wrong" are three other cuisines or countries that are plausible.' },
  odd: { wrong: 3, brief: 'Spot the odd ingredient. "prompt" names a dish or kind of dish ("Which of these does NOT belong in a classic ...?"). "correct" is the one ingredient that does not belong; "wrong" are three ingredients that do.' },
  technique: { wrong: 3, brief: 'Cooking technique match. "prompt" is a plain description of a technique ("Cooking food gently in a little fat in a covered pan to soften it without browning"). "correct" is its name; "wrong" are three other techniques.' },
  pairing: { wrong: 3, brief: 'Flavour pairing. "prompt" names an ingredient ("Which goes best with fresh basil?"). "correct" is a classic partner; "wrong" are three poor matches that are still foods.' },
};

const SYSTEM = (game: PoolGame, count: number) => `You write questions for a cooking game. ${SPEC[game].brief}
Write ${count} different questions. Rules: every fact must be true and checkable; exactly one answer is right; wrong answers are plausible but clearly wrong to a cook; no trick wording; no offensive content; short ("prompt" under 200 characters, answers under 60); "note" is one sentence on why the answer is right.
"photo" is the exact title of an English Wikipedia article about the dish, ingredient or technique the question is ABOUT, so a real photo can be shown with it (for example "Ratatouille"); it must never be the answer itself or reveal it; use "" when no single food article fits.
Return only JSON: {"items": [{"prompt": string, "correct": string, "wrong": [${Array.from({ length: SPEC[game].wrong }, () => 'string').join(', ')}], "note": string, "photo": string}]}`;

const itemSchema = (wrong: number) =>
  z.object({
    prompt: z.string().trim().min(10).max(240),
    correct: z.string().trim().min(1).max(80),
    wrong: z.array(z.string().trim().min(1).max(80)).length(wrong),
    note: z.string().trim().max(240).default(''),
    photo: z.string().trim().max(80).optional().catch(undefined),
  });

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
export const itemHash = (game: string, prompt: string, correct: string) => createHash('sha1').update(`${game}|${norm(prompt)}|${norm(correct)}`).digest('hex');

export interface PoolItem {
  id: string;
  prompt: string;
  correct: string;
  wrong: string[];
  note: string;
  imageUrl?: string;
}

const shuffle = <T>(list: readonly T[], random: () => number): T[] => {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.min(i, Math.floor(random() * (i + 1)));
    [out[i], out[j]] = [out[j] as T, out[i] as T];
  }
  return out;
};

/**
 * The question pool behind the generated games. A model writes batches (checked, de-duplicated, stored); a round draws
 * questions the player has not had yet, so the same ones do not come round again until the pool has run out.
 */
export class GamePoolService {
  constructor(
    private readonly db: Db,
    private readonly ai: AiRouter,
    private readonly now: () => Date = () => new Date(),
    private readonly random: () => number = Math.random,
    /** Top the pool up in the background when a player is running low. Off in tests. */
    private readonly autoRefill = true,
    /** Where question photos are kept. Without it, questions have no picture. */
    private readonly photos: { storage: Storage | null; fetchImpl?: typeof fetch; pauseMs?: number } | null = null,
  ) {}

  /** A verified, licence-checked photo of the article, stored on our own file store; null when there is none. */
  private async photoFor(title: string, cache: Map<string, string | null>): Promise<string | null> {
    const key = title.toLowerCase();
    if (cache.has(key)) return cache.get(key) ?? null;
    let url: string | null = null;
    const photos = this.photos;
    if (photos?.storage) {
      const fetchImpl = photos.fetchImpl ?? fetch;
      try {
        const photo = await findWikipediaPhoto(title, fetchImpl);
        if (photo && (await photoShows(this.ai, title, photo))) {
          url = await store(photos.storage, `game/${createHash('sha1').update(key).digest('hex').slice(0, 20)}.jpg`, photo, fetchImpl);
        }
      } catch {
        url = null; // no photo is fine: the question shows without one
      }
      if (photos.pauseMs) await new Promise((r) => setTimeout(r, photos.pauseMs));
    }
    cache.set(key, url);
    return url;
  }

  /** Adds a batch of new questions. Returns how many were kept. */
  async refill(game: PoolGame, count = 25): Promise<number> {
    const spec = SPEC[game];
    const raw = await this.ai.runJson(
      { task: 'game_content', system: SYSTEM(game, count), prompt: `Write ${count} new questions. Vary the topics; avoid the most obvious ones.`, json: true, maxOutputTokens: 4000, temperature: 0.9 },
      z.object({ items: z.array(z.unknown()).min(1) }),
    );
    const schema = itemSchema(spec.wrong);
    const rows: { game: string; prompt: string; correct: string; wrong: string[]; note: string; hash: string; source: string; photoTitle: string | null; imageUrl: string | null; photoTried: boolean }[] = [];
    const cache = new Map<string, string | null>();
    const seen = new Set<string>();
    for (const candidate of raw.items) {
      const parsed = schema.safeParse(candidate);
      if (!parsed.success) continue;
      const { prompt, correct, wrong, note, photo } = parsed.data;
      const answers = [correct, ...wrong].map(norm);
      if (new Set(answers).size !== answers.length) continue; // an answer repeated, or the right one also listed as wrong
      if (game === 'myth' && !['Fact', 'Myth'].includes(correct)) continue;
      const hash = itemHash(game, prompt, correct);
      if (seen.has(hash)) continue;
      seen.add(hash);
      const photoTitle = photo && photo.length >= 2 && norm(photo) !== norm(correct) ? photo : null; // never a picture of the answer
      const imageUrl = photoTitle ? await this.photoFor(photoTitle, cache) : null;
      rows.push({ game, prompt, correct, wrong, note, hash, source: 'ai', photoTitle, imageUrl, photoTried: photoTitle !== null });
    }
    if (rows.length === 0) throw errors.aiUnavailable('The question writer gave nothing usable');
    const made = await this.db.gamePoolItem.createMany({ data: rows.map((r) => ({ ...r, createdAt: this.now() })), skipDuplicates: true });
    return made.count;
  }

  /** The hand-written trivia the pool starts with, so the first games never wait for the AI. */
  private async seedTrivia(): Promise<void> {
    await this.db.gamePoolItem.createMany({
      data: TRIVIA.map((q) => ({ game: 'trivia', prompt: q.q, correct: q.options[0], wrong: q.options.slice(1), note: q.note, hash: itemHash('trivia', q.q, q.options[0]), source: 'seed', createdAt: this.now() })),
      skipDuplicates: true,
    });
  }

  /** `count` questions for a round: ones this player has not had first, then the longest ago. They are marked as had. */
  async draw(userId: string, game: PoolGame, count: number): Promise<PoolItem[]> {
    if (game === 'trivia' && (await this.db.gamePoolItem.count({ where: { game } })) === 0) await this.seedTrivia();
    const had = await this.db.gamePoolSeen.findMany({ where: { userId, item: { game } }, select: { itemId: true, at: true }, orderBy: { at: 'asc' } });
    let fresh = await this.db.gamePoolItem.findMany({ where: { game, id: { notIn: had.map((h) => h.itemId) } }, take: 300 });

    if (fresh.length < count) {
      // Not enough new ones: ask the writer for more now, so the round is new. If it cannot, fall back to old ones.
      try {
        await this.refill(game);
        fresh = await this.db.gamePoolItem.findMany({ where: { game, id: { notIn: had.map((h) => h.itemId) } }, take: 300 });
      } catch {
        // the fallback below covers it
      }
    }
    let picked = shuffle(fresh, this.random).slice(0, count);
    if (picked.length < count) {
      const oldest = had.map((h) => h.itemId).slice(0, count - picked.length);
      const again = oldest.length ? await this.db.gamePoolItem.findMany({ where: { id: { in: oldest } } }) : [];
      picked = [...picked, ...shuffle(again, this.random)];
    }
    if (picked.length === 0) throw errors.conflict('This game is getting new questions. Try again in a minute');

    const now = this.now();
    await this.db.$transaction(
      picked.map((p) => this.db.gamePoolSeen.upsert({ where: { userId_itemId: { userId, itemId: p.id } }, create: { userId, itemId: p.id, at: now }, update: { at: now } })),
    );
    if (this.autoRefill && fresh.length - picked.length < 40) void this.refill(game).catch(() => undefined);
    return picked.map((p) => ({ id: p.id, prompt: p.prompt, correct: p.correct, wrong: p.wrong, note: p.note, ...(p.imageUrl ? { imageUrl: p.imageUrl } : {}) }));
  }

  /**
   * Secret dishes for Mystery Kitchen, written by the model: a name, how hard it is to guess, a basket of ingredients and three
   * hints getting warmer. Stored in the same pool (game "mk"): prompt = the dish, correct = the difficulty, wrong = the basket,
   * note = the three hints on separate lines.
   */
  async refillDishes(count = 15): Promise<number> {
    const raw = await this.ai.runJson(
      {
        task: 'game_content',
        system: `You write secret dishes for a cooking party game. Players get only a basket of ingredients and must cook something that fits it; the dish is revealed at the end. Write ${count} different dishes from around the world.
Return only JSON: {"dishes": [{"name": string, "difficulty": "easy"|"medium"|"hard", "basket": [5 to 8 plain ingredient names], "hints": [three hints, each warmer than the last, none containing the dish name]}]}. Easy = familiar everyday dishes; hard = techniques or dishes that need thought. Every ingredient must really belong in the dish.`,
        prompt: `Write ${count} new dishes with a spread of difficulties.`,
        json: true,
        maxOutputTokens: 4000,
        temperature: 0.9,
      },
      z.object({ dishes: z.array(z.unknown()).min(1) }),
    );
    const schema = z.object({
      name: z.string().trim().min(3).max(60),
      difficulty: z.enum(['easy', 'medium', 'hard']),
      basket: z.array(z.string().trim().min(2).max(40)).min(5).max(8),
      hints: z.array(z.string().trim().min(8).max(160)).length(3),
    });
    const rows = [];
    for (const candidate of raw.dishes) {
      const p = schema.safeParse(candidate);
      if (!p.success) continue;
      const { name, difficulty, basket, hints } = p.data;
      if (hints.some((h) => h.toLowerCase().includes(name.toLowerCase()))) continue;
      rows.push({ game: 'mk', prompt: name, correct: difficulty, wrong: basket, note: hints.join('\n'), hash: itemHash('mk', name, difficulty), source: 'ai', createdAt: this.now() });
    }
    if (rows.length === 0) throw errors.aiUnavailable('The dish writer gave nothing usable');
    return (await this.db.gamePoolItem.createMany({ data: rows, skipDuplicates: true })).count;
  }

  /** A random generated dish of this difficulty, or null when there are none (the built-in list is used then). */
  async randomDish(difficulty: MkDifficulty): Promise<MkDish | null> {
    const count = await this.db.gamePoolItem.count({ where: { game: 'mk', correct: difficulty } });
    if (count === 0) {
      if (this.autoRefill) void this.refillDishes().catch(() => undefined);
      return null;
    }
    const row = await this.db.gamePoolItem.findFirst({ where: { game: 'mk', correct: difficulty }, skip: Math.floor(this.random() * count), orderBy: { id: 'asc' } });
    const hints = (row?.note ?? '').split('\n');
    if (!row || hints.length !== 3) return null;
    return { name: row.prompt, difficulty, basket: row.wrong, hints: hints as [string, string, string] };
  }

  /**
   * Gives questions that have no picture one: the model names the Wikipedia article each question is about, and a real photo
   * from it is stored. Each question is only tried once. Returns how many got a photo.
   */
  async backfillPhotos(limit = 30): Promise<number> {
    if (!this.photos?.storage) return 0;
    const todo = await this.db.gamePoolItem.findMany({ where: { photoTried: false, imageUrl: null, game: { in: [...POOL_GAMES] } }, take: limit, orderBy: { createdAt: 'asc' } });
    if (todo.length === 0) return 0;
    let titles: Record<string, string> = {};
    const needAsk = todo.filter((t) => !t.photoTitle);
    if (needAsk.length > 0) {
      try {
        const raw = await this.ai.runJson(
          {
            task: 'game_content',
            system: 'For each numbered cooking question, give the exact title of an English Wikipedia article about the dish, ingredient or technique the question is ABOUT, so a real photo can be shown with it. Never the answer itself. Use "" when no single food article fits. Return only JSON: {"photos": {"1": "Title", "2": ""}}',
            prompt: needAsk.map((t, i) => `${i + 1}. ${t.prompt} (answer: ${t.correct})`).join('\n'),
            json: true,
            maxOutputTokens: 1500,
            temperature: 0,
          },
          z.object({ photos: z.record(z.string(), z.string()) }),
        );
        titles = Object.fromEntries(needAsk.map((t, i) => [t.id, (raw.photos[String(i + 1)] ?? '').trim()]));
      } catch {
        return 0; // try again next time
      }
    }
    const cache = new Map<string, string | null>();
    let added = 0;
    for (const item of todo) {
      const title = item.photoTitle ?? titles[item.id] ?? '';
      const ok = title.length >= 2 && norm(title) !== norm(item.correct);
      const imageUrl = ok ? await this.photoFor(title, cache) : null;
      await this.db.gamePoolItem.update({ where: { id: item.id }, data: { photoTried: true, photoTitle: ok ? title : null, imageUrl } });
      if (imageUrl) added += 1;
    }
    return added;
  }

  /** Keeps every generated game stocked (the background job). */
  async topUp(minimum = 80): Promise<Record<string, number>> {
    const out: Record<string, number> = {};
    for (const game of POOL_GAMES) {
      const have = await this.db.gamePoolItem.count({ where: { game } });
      if (have >= minimum) continue;
      try {
        out[game] = await this.refill(game);
      } catch {
        out[game] = 0;
      }
    }
    if ((await this.db.gamePoolItem.count({ where: { game: 'mk' } })) < 40) {
      try {
        out['mk'] = await this.refillDishes();
      } catch {
        out['mk'] = 0;
      }
    }
    try {
      out['photos'] = await this.backfillPhotos();
    } catch {
      out['photos'] = 0;
    }
    return out;
  }
}
