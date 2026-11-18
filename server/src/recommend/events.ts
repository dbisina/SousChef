import type { FeedEventInput, FeedPreferences, RecordFeedEventsResponse } from '@shared';
import type { Db } from '../db';

/** Most events one person may have recorded in a day: far above real use, there to stop a stuck loop filling the table. */
export const MAX_EVENTS_PER_DAY = 3000;
const DAY_MS = 86_400_000;
/** A view longer than this was a phone left on a table, not a person reading. */
const MAX_DWELL_MS = 10 * 60_000;

/**
 * The record of what each person does with the feed. It is the raw material for the taste profile, kept only while the person
 * allows it (a switch in their settings turns it off) and deleted after 30 days or with the account.
 */
export class FeedEventService {
  constructor(
    private readonly db: Db,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async preferences(userId: string): Promise<FeedPreferences> {
    const u = await this.db.user.findUnique({ where: { id: userId }, select: { feedPersonalised: true } });
    return { personalised: u?.feedPersonalised ?? true };
  }

  /**
   * Turning it off also forgets what was recorded: the person asked for the feed to stop learning from them. "Not interested"
   * choices stay, because those are instructions about what to leave out, not observations.
   */
  async setPersonalised(userId: string, personalised: boolean): Promise<FeedPreferences> {
    await this.db.user.update({ where: { id: userId }, data: { feedPersonalised: personalised } });
    if (!personalised) await this.db.feedEvent.deleteMany({ where: { userId, kind: { not: 'hide' } } });
    return { personalised };
  }

  /**
   * Keeps the events that are about something real, with the author and recipe filled in from the post. An impression of the
   * same post twice in one batch counts once. Nothing is kept when the person has personalisation off or is over the day's cap.
   */
  async record(userId: string, events: FeedEventInput[]): Promise<RecordFeedEventsResponse> {
    if (events.length === 0) return { accepted: 0 };
    const user = await this.db.user.findUnique({ where: { id: userId }, select: { feedPersonalised: true } });
    if (!user) return { accepted: 0 };
    // With personalisation off only "not interested" is kept (it is an instruction); nothing else is observed.
    if (!user.feedPersonalised) events = events.filter((e) => e.kind === 'hide');
    if (events.length === 0) return { accepted: 0 };

    const since = new Date(this.now().getTime() - DAY_MS);
    const today = await this.db.feedEvent.count({ where: { userId, createdAt: { gte: since } } });
    const room = Math.max(0, MAX_EVENTS_PER_DAY - today);
    if (room === 0) return { accepted: 0 };

    const postIds = [...new Set(events.map((e) => e.postId).filter((x): x is string => !!x))];
    const recipeIds = [...new Set(events.map((e) => e.recipeId).filter((x): x is string => !!x))];
    const [posts, recipes] = await Promise.all([
      postIds.length > 0 ? this.db.post.findMany({ where: { id: { in: postIds }, status: 'PUBLISHED' }, select: { id: true, authorId: true, recipeId: true } }) : [],
      recipeIds.length > 0 ? this.db.recipe.findMany({ where: { id: { in: recipeIds }, status: 'PUBLISHED' }, select: { id: true, authorId: true } }) : [],
    ]);
    const postById = new Map(posts.map((p) => [p.id, p]));
    const recipeById = new Map(recipes.map((r) => [r.id, r]));

    const seenImpression = new Set<string>();
    const startedAt = this.now().getTime();
    const rows: { userId: string; kind: string; postId: string | null; recipeId: string | null; authorId: string | null; dwellMs: number | null; createdAt: Date }[] = [];
    for (const e of events) {
      if (rows.length >= room) break;
      const post = e.postId ? postById.get(e.postId) : undefined;
      const recipe = e.recipeId ? recipeById.get(e.recipeId) : undefined;
      if (!post && !recipe) continue; // about nothing real
      if (e.kind === 'impression' && post) {
        if (seenImpression.has(post.id)) continue;
        seenImpression.add(post.id);
      }
      const dwell = e.kind === 'view' && typeof e.dwellMs === 'number' ? Math.min(Math.max(0, Math.round(e.dwellMs)), MAX_DWELL_MS) : null;
      rows.push({
        userId,
        kind: e.kind,
        postId: post?.id ?? null,
        recipeId: post?.recipeId ?? recipe?.id ?? null,
        authorId: post?.authorId ?? recipe?.authorId ?? null,
        dwellMs: dwell,
        createdAt: new Date(startedAt + rows.length), // one millisecond apart, so a batch keeps its order
      });
    }
    if (rows.length > 0) await this.db.feedEvent.createMany({ data: rows });
    return { accepted: rows.length };
  }
}
