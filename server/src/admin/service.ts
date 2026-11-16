import type { AdminStats, AiKeysReport, AiUsageReport, AiUsageRow } from '@shared';
import type { AiRouter } from '../ai/router';
import type { Db } from '../db';

const DAY_MS = 86_400_000;
const usd = (micros: number | bigint | null | undefined): number => Math.round(Number(micros ?? 0)) / 1_000_000;

/** Read-only numbers for the staff dashboard. Nothing here changes data or shows a secret. */
export class AdminService {
  constructor(
    private readonly db: Db,
    private readonly ai: AiRouter,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async stats(): Promise<AdminStats> {
    const week = new Date(this.now().getTime() - 7 * DAY_MS);
    const [people, newPeople, suspended, posts, reports, chefs] = await Promise.all([
      this.db.user.count({ where: { kind: 'PERSON' } }),
      this.db.user.count({ where: { kind: 'PERSON', createdAt: { gte: week } } }),
      this.db.user.count({ where: { kind: 'PERSON', suspendedAt: { not: null } } }),
      this.db.post.count({ where: { createdAt: { gte: week } } }),
      this.db.report.count({ where: { status: 'OPEN' } }),
      this.db.chefVerification.count({ where: { status: 'pending' } }),
    ]);
    return { people, newPeopleLast7Days: newPeople, suspendedPeople: suspended, postsLast7Days: posts, openReports: reports, pendingChefVerifications: chefs };
  }

  async aiUsage(days: number): Promise<AiUsageReport> {
    const now = this.now();
    const since = new Date(now.getTime() - days * DAY_MS);
    const group = async (by: 'provider' | 'task'): Promise<AiUsageRow[]> => {
      const rows = await this.db.aiUsage.groupBy({
        by: [by],
        where: { createdAt: { gte: since } },
        _count: { _all: true },
        _sum: { inputTokens: true, outputTokens: true, costMicros: true },
      });
      return rows
        .map((r) => ({ name: r[by], calls: r._count._all, inputTokens: r._sum.inputTokens ?? 0, outputTokens: r._sum.outputTokens ?? 0, costUsd: usd(r._sum.costMicros) }))
        .sort((a, b) => b.costUsd - a.costUsd || b.calls - a.calls || a.name.localeCompare(b.name));
    };
    const [byProvider, byTask, perDay, spent] = await Promise.all([
      group('provider'),
      group('task'),
      this.db.$queryRaw<{ d: string; calls: number; micros: bigint }[]>`
        SELECT to_char("createdAt" AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS d, count(*)::int AS calls, COALESCE(sum("costMicros"), 0)::bigint AS micros
        FROM "AiUsage" WHERE "createdAt" >= ${since} GROUP BY 1 ORDER BY 1`,
      this.ai.spentThisMonth(),
    ]);
    return {
      days,
      since: since.toISOString(),
      budgetUsd: this.ai.monthlyBudgetUsd,
      spentThisMonthUsd: Math.round(spent * 10_000) / 10_000,
      byProvider,
      byTask,
      byDay: perDay.map((r) => ({ date: r.d, calls: Number(r.calls), costUsd: usd(r.micros) })),
    };
  }

  aiKeys(): AiKeysReport {
    return { providers: this.ai.providerStatus(), privateProviders: this.ai.privateProviders };
  }
}
