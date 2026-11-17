import type { BecauseYouCooked, RecipeSummary } from '@shared';
import type { Db } from '../db';
import { authorSelect, toSummary } from '../recipes/mappers';
import { cosine } from './features';
import type { TasteService } from './taste';

/** A dish this much alike (0 to 1) or less is not "like this". */
const MIN_ALIKE = 0.2;
const withAuthor = { author: { select: authorSelect } } as const;

/** Recipes that are like a given recipe, and the "because you cooked ..." row built on the one a person made last. */
export class SimilarService {
  constructor(
    private readonly db: Db,
    private readonly taste: TasteService,
  ) {}

  /** The published recipes most like this one (never itself), most alike first. */
  async similar(recipeId: string, limit: number, exclude: ReadonlySet<string> = new Set()): Promise<RecipeSummary[]> {
    const base = (await this.taste.recipes([recipeId])).get(recipeId);
    if (!base) return [];
    const scored: { id: string; score: number }[] = [];
    for (const [id, info] of await this.taste.catalog()) {
      if (id === recipeId || exclude.has(id)) continue;
      const score = cosine(base.vec, info.vec);
      if (score > MIN_ALIKE) scored.push({ id, score });
    }
    scored.sort((a, b) => b.score - a.score || (a.id < b.id ? -1 : 1));
    const top = scored.slice(0, limit).map((s) => s.id);
    if (top.length === 0) return [];
    const rows = await this.db.recipe.findMany({ where: { id: { in: top }, status: 'PUBLISHED' }, include: withAuthor });
    const byId = new Map(rows.map((r) => [r.id, r]));
    return top.flatMap((id) => {
      const row = byId.get(id);
      return row ? [toSummary(row)] : [];
    });
  }

  /**
   * Recipes like the one this person cooked (or, failing that, saved) most recently, leaving out what they wrote themselves and
   * what they have already saved. Nothing when they have turned personalisation off or have not cooked or saved anything yet.
   */
  async becauseYouCooked(userId: string, limit: number): Promise<BecauseYouCooked> {
    const none: BecauseYouCooked = { basedOn: null, items: [] };
    const user = await this.db.user.findUnique({ where: { id: userId }, select: { feedPersonalised: true } });
    if (!user?.feedPersonalised) return none;

    const [finished, madePost, madeThis, saved] = await Promise.all([
      this.db.feedEvent.findFirst({ where: { userId, kind: 'cook_finish', recipeId: { not: null } }, orderBy: { createdAt: 'desc' }, select: { recipeId: true, createdAt: true } }),
      this.db.recipeMadePost.findFirst({ where: { authorId: userId }, orderBy: { createdAt: 'desc' }, select: { recipeId: true, createdAt: true } }),
      this.db.post.findFirst({ where: { authorId: userId, kind: 'made-this', recipeId: { not: null } }, orderBy: { createdAt: 'desc' }, select: { recipeId: true, createdAt: true } }),
      this.db.recipeSave.findFirst({ where: { userId }, orderBy: { createdAt: 'desc' }, select: { recipeId: true, createdAt: true } }),
    ]);
    // What they cooked beats what they only saved, however recent the save.
    const cooked = [finished, madePost, madeThis].filter((c): c is { recipeId: string; createdAt: Date } => !!c?.recipeId).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
    const anchor = cooked ?? saved;
    if (!anchor) return none;

    const base = await this.db.recipe.findFirst({ where: { id: anchor.recipeId, status: 'PUBLISHED' }, select: { id: true, title: true } });
    if (!base) return none;
    const [mine, theirs] = await Promise.all([
      this.db.recipeSave.findMany({ where: { userId }, select: { recipeId: true } }),
      this.db.recipe.findMany({ where: { authorId: userId }, select: { id: true } }),
    ]);
    const exclude = new Set([...mine.map((m) => m.recipeId), ...theirs.map((t) => t.id)]);
    const items = await this.similar(base.id, limit, exclude);
    return { basedOn: { id: base.id, title: base.title }, items };
  }
}
