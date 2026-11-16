import { useState } from 'react';
import type { AdminReport, Page as Paged, ReportAction, ReportStatus } from '@shared';
import { ago } from '../format';
import { ApiError } from '../api';
import { useLoad } from '../useLoad';
import { ConfirmButton, Empty, Loading, Page, useApi } from '../ui';

const STATUSES: ReportStatus[] = ['open', 'actioned', 'dismissed'];

export function Reports() {
  const api = useApi();
  const [status, setStatus] = useState<ReportStatus>('open');
  const [message, setMessage] = useState('');
  const list = useLoad(() => api.get<Paged<AdminReport>>(`/v1/admin/reports?status=${status}&limit=50`), [status]);

  const act = async (id: string, action: ReportAction) => {
    setMessage('');
    try {
      await api.post(`/v1/admin/reports/${id}/action`, { action });
      list.reload();
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : 'That did not work.');
    }
  };

  const suspend = async (userId: string) => {
    const reason = window.prompt('Why is this person being suspended? (shown in the record, at least 3 characters)');
    if (!reason || reason.trim().length < 3) return;
    try {
      await api.post(`/v1/admin/users/${userId}/suspend`, { reason: reason.trim() });
      setMessage('Suspended. Their sessions have ended and their posts are paused.');
      list.reload();
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : 'That did not work.');
    }
  };

  return (
    <Page
      title="Reports"
      actions={
        <select value={status} onChange={(e) => setStatus(e.target.value as ReportStatus)} aria-label="Show reports that are">
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      }
    >
      {message ? <p role="status">{message}</p> : null}
      <Loading state={list}>
        {(page) =>
          page.items.length === 0 ? (
            <Empty>Nothing {status} right now.</Empty>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>What</th>
                  <th>Why</th>
                  <th>Reports</th>
                  <th>When</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {page.items.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <strong>{r.targetType}</strong> {r.target ? r.target.summary : <em>gone</em>}
                      {r.target?.hidden ? <span className="tag"> hidden</span> : null}
                      {r.auto ? <span className="tag"> automatic check</span> : null}
                    </td>
                    <td>
                      {r.reason}
                      {r.details ? <div className="muted">{r.details}</div> : null}
                    </td>
                    <td>{r.reportCount}</td>
                    <td>{ago(r.createdAt)}</td>
                    <td className="row">
                      {r.status === 'open' ? (
                        <>
                          <ConfirmButton label="Hide" confirm="Hide this from everyone and close the reports?" onConfirm={() => act(r.id, 'hide')} />
                          <ConfirmButton label="Restore" confirm="Put this back and close the reports?" onConfirm={() => act(r.id, 'restore')} />
                          <ConfirmButton label="Dismiss" confirm="Close the reports without changing anything?" onConfirm={() => act(r.id, 'dismiss')} />
                        </>
                      ) : (
                        <span className="muted">{r.resolution ?? r.status}</span>
                      )}
                      {r.target?.authorId ? (
                        <button className="danger" onClick={() => void suspend(r.target?.authorId as string)}>
                          Suspend author
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        }
      </Loading>
    </Page>
  );
}
