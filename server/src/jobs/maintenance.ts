import type { Db } from '../db';

const DAY_MS = 86_400_000;

export interface PurgeCounts {
  sessions: number;
  passwordResets: number;
  webhookEvents: number;
  importCache: number;
  aiUsage: number;
}

/** Clears out old rows nobody needs, so tables stay small and the database stays cheap. */
export class Maintenance {
  constructor(
    private readonly db: Db,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async purge(): Promise<PurgeCounts> {
    const ago = (days: number) => new Date(this.now().getTime() - days * DAY_MS);
    const [sessions, passwordResets, webhookEvents, importCache, aiUsage] = await Promise.all([
      // Expired a week ago, or ended (signed out, rotated or revoked) a month ago. Newer ones are kept for reuse detection.
      this.db.session.deleteMany({ where: { OR: [{ expiresAt: { lt: ago(7) } }, { revokedAt: { lt: ago(30) } }, { rotatedAt: { lt: ago(30) } }] } }),
      this.db.passwordReset.deleteMany({ where: { OR: [{ expiresAt: { lt: ago(1) } }, { usedAt: { lt: ago(7) } }] } }),
      // The payment provider retries for days; after a month a repeat is not coming.
      this.db.webhookEvent.deleteMany({ where: { receivedAt: { lt: ago(30) } } }),
      // A recipe nobody asked for in three months can be read again if it is wanted.
      this.db.importCache.deleteMany({ where: { lastUsedAt: { lt: ago(90) } } }),
      // Spending history is kept for 13 months for the budget and for comparing with last year.
      this.db.aiUsage.deleteMany({ where: { createdAt: { lt: ago(400) } } }),
    ]);
    return { sessions: sessions.count, passwordResets: passwordResets.count, webhookEvents: webhookEvents.count, importCache: importCache.count, aiUsage: aiUsage.count };
  }
}
