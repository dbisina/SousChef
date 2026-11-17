import type { Db } from '../db';
import { addScaled, cosine, normalize, recipeFeatures, topTraits, type Vec } from './features';

const DAY_MS = 86_400_000;
/** A person's likes fade: what they did three weeks ago counts half as much as what they did today. */
const HALF_LIFE_DAYS = 21;
const LOOKBACK_DAYS = 90;
/** The profile is rebuilt when it is older than this, the next time the feed is asked for. */
const STALE_MS = 30 * 60_000;
const PROFILE_TRAITS = 80;
const RECENT = 200;
const ITEM_TTL_MS = 10 * 60_000;

/** How much each thing someone does says about what they like. Hides count against; the rest count for. */
export const SIGNAL_WEIGHT = {
  recipeLike: 1,
  recipeSave: 2,
  postLike: 1,
  postSave: 2,
  cooked: 3,
  share: 1.5,
  open: 0.5,
  view: 0.5,
  cookStart: 1.5,
  hide: -2.5,
  /** A rating of 4 or 5 is a vote for; 1 or 2 a vote against. */
  rating: (stars: number): number => (stars >= 4 ? stars - 3 : stars <= 2 ? -(3 - stars) * 0.5 : 0),
} as const;

export interface RecipeInfo {
  vec: Vec;
  cuisine: string;
}

export interface Taste {
  /** What this person likes (and, with negative parts, does not). Empty until they have done anything. */
  vector: Vec;
  /** How many signals it was built from. */
  signals: number;
}

const decay = (at: Date, now: Date): number => 0.5 ** (Math.max(0, now.getTime() - at.getTime()) / DAY_MS / HALF_LIFE_DAYS);

/**
 * What the feed knows about each person's taste: a short list of traits (cuisines, ingredients, how long a dish takes, diets)
 * built from what they like, save, cook, rate and hide, fading with time. It also says which posts they have already been shown
 * and ignored, and which authors they pushed away. Nothing is built for someone who turned personalisation off.
 */
export class TasteService {
  private readonly items = new Map<string, { info: RecipeInfo; at: number }>();

  constructor(
    private readonly db: Db,
    private readonly now: () => Date = () => new Date(),
  ) {}

  /** The traits of each recipe (cached for ten minutes: a recipe rarely changes). Recipes that are gone are left out. */
  async recipes(ids: string[]): Promise<Map<string, RecipeInfo>> {
    const out = new Map<string, RecipeInfo>();
    const now = this.now().getTime();
    const missing: string[] = [];
    for (const id of new Set(ids)) {
      const hit = this.items.get(id);
      if (hit && now - hit.at < ITEM_TTL_MS) out.set(id, hit.info);
      else missing.push(id);
    }
    if (missing.length > 0) {
      const rows = await this.db.recipe.findMany({
        where: { id: { in: missing }, status: 'PUBLISHED' },
        select: { id: true, cuisine: true, category: true, difficulty: true, prepTime: true, cookTime: true, dietaryFlags: true, tags: true, ingredientNames: true },
      });
      for (const r of rows) {
        const info: RecipeInfo = { vec: recipeFeatures(r), cuisine: r.cuisine };
        this.items.set(r.id, { info, at: now });
        out.set(r.id, info);
      }
      if (this.items.size > 5000) this.items.clear();
    }
    return out;
  }

  private catalogCache: { at: number; mark: string; items: Map<string, RecipeInfo> } | null = null;

  /**
   * The traits of the recipes worth recommending (the best-liked and the newest, up to 800). Kept for ten minutes, and rebuilt
   * sooner whenever a recipe is added, changed or removed (one cheap count tells).
   */
  async catalog(): Promise<Map<string, RecipeInfo>> {
    const now = this.now().getTime();
    const seen = await this.db.recipe.aggregate({ where: { status: 'PUBLISHED' }, _count: { _all: true }, _max: { updatedAt: true } });
    const mark = `${seen._count._all}:${seen._max.updatedAt?.toISOString() ?? ''}`;
    if (this.catalogCache && this.catalogCache.mark === mark && now - this.catalogCache.at < ITEM_TTL_MS) return this.catalogCache.items;
    const select = { id: true, cuisine: true, category: true, difficulty: true, prepTime: true, cookTime: true, dietaryFlags: true, tags: true, ingredientNames: true } as const;
    const [popular, newest] = await Promise.all([
      this.db.recipe.findMany({ where: { status: 'PUBLISHED' }, orderBy: [{ likeCount: 'desc' }, { id: 'desc' }], take: 500, select }),
      this.db.recipe.findMany({ where: { status: 'PUBLISHED' }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 300, select }),
    ]);
    const items = new Map<string, RecipeInfo>();
    for (const r of [...popular, ...newest]) if (!items.has(r.id)) items.set(r.id, { vec: recipeFeatures(r), cuisine: r.cuisine });
    this.catalogCache = { at: now, mark, items };
    return items;
  }

  /** The person's taste, rebuilt first when it is missing or stale. Null when they have personalisation off. */
  async taste(userId: string): Promise<Taste | null> {
    const user = await this.db.user.findUnique({ where: { id: userId }, select: { feedPersonalised: true } });
    if (!user?.feedPersonalised) return null;
    const saved = await this.db.tasteProfile.findUnique({ where: { userId } });
    if (saved && this.now().getTime() - saved.updatedAt.getTime() < STALE_MS) return { vector: saved.vector as Vec, signals: saved.signals };
    return this.refresh(userId);
  }

  /** Builds the profile from everything the person has done in the last 90 days and stores it. */
  async refresh(userId: string): Promise<Taste> {
    const now = this.now();
    const since = new Date(now.getTime() - LOOKBACK_DAYS * DAY_MS);
    const recent = { orderBy: { createdAt: 'desc' as const }, take: RECENT };
    const [recipeLikes, recipeSaves, ratings, postLikes, postSaves, made, madePosts, events] = await Promise.all([
      this.db.recipeLike.findMany({ where: { userId, createdAt: { gte: since } }, select: { recipeId: true, createdAt: true }, ...recent }),
      this.db.recipeSave.findMany({ where: { userId, createdAt: { gte: since } }, select: { recipeId: true, createdAt: true }, ...recent }),
      this.db.recipeRating.findMany({ where: { userId, updatedAt: { gte: since } }, select: { recipeId: true, rating: true, updatedAt: true }, orderBy: { updatedAt: 'desc' }, take: RECENT }),
      this.db.postLike.findMany({ where: { userId, createdAt: { gte: since }, post: { recipeId: { not: null } } }, select: { createdAt: true, post: { select: { recipeId: true } } }, ...recent }),
      this.db.postSave.findMany({ where: { userId, createdAt: { gte: since }, post: { recipeId: { not: null } } }, select: { createdAt: true, post: { select: { recipeId: true } } }, ...recent }),
      this.db.recipeMadePost.findMany({ where: { authorId: userId, createdAt: { gte: since } }, select: { recipeId: true, createdAt: true }, ...recent }),
      this.db.post.findMany({ where: { authorId: userId, recipeId: { not: null }, kind: 'made-this', createdAt: { gte: since } }, select: { recipeId: true, createdAt: true }, ...recent }),
      this.db.feedEvent.findMany({ where: { userId, createdAt: { gte: since }, recipeId: { not: null }, kind: { not: 'impression' } }, select: { kind: true, recipeId: true, dwellMs: true, createdAt: true }, orderBy: { createdAt: 'desc' }, take: 500 }),
    ]);

    const signals: { recipeId: string; weight: number; at: Date }[] = [];
    for (const r of recipeLikes) signals.push({ recipeId: r.recipeId, weight: SIGNAL_WEIGHT.recipeLike, at: r.createdAt });
    for (const r of recipeSaves) signals.push({ recipeId: r.recipeId, weight: SIGNAL_WEIGHT.recipeSave, at: r.createdAt });
    for (const r of ratings) {
      const w = SIGNAL_WEIGHT.rating(r.rating);
      if (w !== 0) signals.push({ recipeId: r.recipeId, weight: w, at: r.updatedAt });
    }
    for (const p of postLikes) if (p.post.recipeId) signals.push({ recipeId: p.post.recipeId, weight: SIGNAL_WEIGHT.postLike, at: p.createdAt });
    for (const p of postSaves) if (p.post.recipeId) signals.push({ recipeId: p.post.recipeId, weight: SIGNAL_WEIGHT.postSave, at: p.createdAt });
    for (const m of made) signals.push({ recipeId: m.recipeId, weight: SIGNAL_WEIGHT.cooked, at: m.createdAt });
    for (const m of madePosts) if (m.recipeId) signals.push({ recipeId: m.recipeId, weight: SIGNAL_WEIGHT.cooked, at: m.createdAt });
    for (const e of events) {
      if (!e.recipeId) continue;
      const weight =
        e.kind === 'like' ? SIGNAL_WEIGHT.postLike
        : e.kind === 'save' ? SIGNAL_WEIGHT.postSave
        : e.kind === 'share' ? SIGNAL_WEIGHT.share
        : e.kind === 'open' ? SIGNAL_WEIGHT.open
        : e.kind === 'cook_start' ? SIGNAL_WEIGHT.cookStart
        : e.kind === 'cook_finish' ? SIGNAL_WEIGHT.cooked
        : e.kind === 'hide' ? SIGNAL_WEIGHT.hide
        : e.kind === 'view' && (e.dwellMs ?? 0) >= 3000 ? SIGNAL_WEIGHT.view
        : 0;
      if (weight !== 0) signals.push({ recipeId: e.recipeId, weight, at: e.createdAt });
    }

    const infos = await this.recipes(signals.map((s) => s.recipeId));
    const sum: Vec = {};
    let used = 0;
    for (const s of signals) {
      const info = infos.get(s.recipeId);
      if (!info) continue;
      addScaled(sum, info.vec, s.weight * decay(s.at, now));
      used++;
    }
    const vector = used === 0 ? {} : topTraits(normalize(sum), PROFILE_TRAITS);
    await this.db.tasteProfile.upsert({
      where: { userId },
      create: { userId, vector, signals: used, updatedAt: now },
      update: { vector, signals: used, updatedAt: now },
    });
    return { vector, signals: used };
  }

  /** How close a dish is to this taste, 0 (nothing in common, or nothing known yet) to 1. Only a match counts, never a mismatch. */
  match(taste: Taste | null, item: RecipeInfo | undefined): number {
    if (!taste || !item || taste.signals === 0) return 0;
    return Math.max(0, cosine(taste.vector, item.vec));
  }

  /**
   * For the posts about to be ranked: how many times each was shown to this person without them reacting (it sinks a little each
   * time), and how much they have pushed each author away ("not interested" on two of their posts is the most).
   */
  async fatigue(userId: string, postIds: string[], authorIds: string[]): Promise<{ seen: Map<string, number>; avoid: Map<string, number> }> {
    const since = new Date(this.now().getTime() - 30 * DAY_MS);
    const [rows, hides] = await Promise.all([
      postIds.length > 0 ? this.db.feedEvent.groupBy({ by: ['postId', 'kind'], where: { userId, postId: { in: postIds }, createdAt: { gte: since } }, _count: { _all: true } }) : [],
      authorIds.length > 0 ? this.db.feedEvent.groupBy({ by: ['authorId'], where: { userId, kind: 'hide', authorId: { in: authorIds }, createdAt: { gte: since } }, _count: { _all: true } }) : [],
    ]);
    const shown = new Map<string, number>();
    const reacted = new Set<string>();
    for (const r of rows) {
      if (!r.postId) continue;
      if (r.kind === 'impression') shown.set(r.postId, r._count._all);
      else reacted.add(r.postId);
    }
    const seen = new Map<string, number>();
    for (const [id, n] of shown) if (!reacted.has(id)) seen.set(id, n);
    const avoid = new Map<string, number>();
    for (const h of hides) if (h.authorId) avoid.set(h.authorId, Math.min(1, h._count._all / 2));
    return { seen, avoid };
  }
}
