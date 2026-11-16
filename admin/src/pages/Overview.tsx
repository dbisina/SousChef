import type { AdminStats, AiUsageReport } from '@shared';
import { int, percent, usd } from '../format';
import { useLoad } from '../useLoad';
import { Card, Loading, Page, Stat, useApi } from '../ui';

export function Overview() {
  const api = useApi();
  const stats = useLoad(() => api.get<AdminStats>('/v1/admin/stats'));
  const usage = useLoad(() => api.get<AiUsageReport>('/v1/admin/ai/usage?days=30'));

  return (
    <Page title="Overview">
      <Loading state={stats}>
        {(s) => (
          <div className="stats">
            <Stat label="People" value={int(s.people)} />
            <Stat label="New this week" value={int(s.newPeopleLast7Days)} />
            <Stat label="Posts this week" value={int(s.postsLast7Days)} />
            <Stat label="Open reports" value={int(s.openReports)} tone={s.openReports > 0 ? 'warn' : undefined} />
            <Stat label="Chef requests waiting" value={int(s.pendingChefVerifications)} tone={s.pendingChefVerifications > 0 ? 'warn' : undefined} />
            <Stat label="Suspended" value={int(s.suspendedPeople)} />
          </div>
        )}
      </Loading>
      <Card title="AI spend this month">
        <Loading state={usage}>
          {(u) => (
            <>
              <p>
                {usd(u.spentThisMonthUsd)} of {usd(u.budgetUsd)} ({percent(u.spentThisMonthUsd, u.budgetUsd)}%)
              </p>
              <progress max={100} value={percent(u.spentThisMonthUsd, u.budgetUsd)} aria-label="Share of the monthly AI budget spent" />
              <p className="muted">When the budget is spent, AI features pause until next month.</p>
            </>
          )}
        </Loading>
      </Card>
    </Page>
  );
}
