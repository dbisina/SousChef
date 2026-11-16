import { useState } from 'react';
import type { AiKeysReport, AiUsageReport, AiUsageRow } from '@shared';
import { int, usd } from '../format';
import { useLoad } from '../useLoad';
import { Card, Loading, Page, Stat, useApi } from '../ui';

function UsageTable({ rows, label }: { rows: AiUsageRow[]; label: string }) {
  return (
    <table>
      <thead>
        <tr>
          <th>{label}</th>
          <th>Calls</th>
          <th>Tokens in / out</th>
          <th>Est. cost</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.name}>
            <td>{r.name}</td>
            <td>{int(r.calls)}</td>
            <td>
              {int(r.inputTokens)} / {int(r.outputTokens)}
            </td>
            <td>{usd(r.costUsd)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function Ai() {
  const api = useApi();
  const [days, setDays] = useState(30);
  const usage = useLoad(() => api.get<AiUsageReport>(`/v1/admin/ai/usage?days=${days}`), [days]);
  const keys = useLoad(() => api.get<AiKeysReport>('/v1/admin/ai/keys'));

  return (
    <Page
      title="AI usage and keys"
      actions={
        <select value={days} onChange={(e) => setDays(Number(e.target.value))} aria-label="Time window">
          {[7, 30, 90].map((d) => (
            <option key={d} value={d}>
              Last {d} days
            </option>
          ))}
        </select>
      }
    >
      <Loading state={usage}>
        {(u) => (
          <>
            <div className="stats">
              <Stat label="Spent this month" value={usd(u.spentThisMonthUsd)} />
              <Stat label="Monthly budget" value={usd(u.budgetUsd)} />
              <Stat label={`Calls (${u.days} days)`} value={int(u.byProvider.reduce((n, r) => n + r.calls, 0))} />
            </div>
            <Card title="By provider">
              <p className="muted">gemini-free calls cost nothing; only funded usage counts toward the budget.</p>
              <UsageTable rows={u.byProvider} label="Provider" />
            </Card>
            <Card title="By task">
              <UsageTable rows={u.byTask} label="Task" />
            </Card>
            <Card title="By day">
              <table>
                <thead>
                  <tr>
                    <th>Day (UTC)</th>
                    <th>Calls</th>
                    <th>Est. cost</th>
                  </tr>
                </thead>
                <tbody>
                  {u.byDay.map((d) => (
                    <tr key={d.date}>
                      <td>{d.date}</td>
                      <td>{int(d.calls)}</td>
                      <td>{usd(d.costUsd)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </>
        )}
      </Loading>
      <Card title="Providers and keys">
        <Loading state={keys}>
          {(k) => (
            <>
              <p className="muted">Private requests (health numbers, private chats, receipts) may only go to: {k.privateProviders.join(', ') || 'nobody'}.</p>
              <ul>
                {k.providers.map((p) => (
                  <li key={p.name}>
                    <strong>{p.name}</strong> <span className="muted">{p.model}</span>
                    {p.details ? (
                      <div>
                        Funded key: {p.details.funded ? 'set' : 'not set'}. Free keys: {p.details.freeKeys.length}
                        {p.details.freeKeys.length > 0 ? (
                          <ul>
                            {p.details.freeKeys.map((f) => (
                              <li key={f.key}>
                                {f.key} {f.resting ? <span className="tag warn">resting</span> : <span className="tag ok">ready</span>}
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
              <button onClick={keys.reload}>Refresh</button>
            </>
          )}
        </Loading>
      </Card>
    </Page>
  );
}
