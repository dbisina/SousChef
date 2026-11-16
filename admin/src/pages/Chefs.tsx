import { useState } from 'react';
import type { AdminChefVerification, Page as Paged } from '@shared';
import { ago } from '../format';
import { ApiError } from '../api';
import { useLoad } from '../useLoad';
import { ConfirmButton, Empty, Loading, Page, useApi } from '../ui';

type Status = AdminChefVerification['status'];
const STATUSES: Status[] = ['pending', 'approved', 'rejected', 'revoked'];

export function Chefs() {
  const api = useApi();
  const [status, setStatus] = useState<Status>('pending');
  const [message, setMessage] = useState('');
  const list = useLoad(() => api.get<Paged<AdminChefVerification>>(`/v1/admin/chef-verifications?status=${status}&limit=50`), [status]);

  const run = async (work: () => Promise<unknown>, done: string) => {
    setMessage('');
    try {
      await work();
      setMessage(done);
      list.reload();
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : 'That did not work.');
    }
  };

  const reject = (id: string) => {
    const reason = window.prompt('Why not? This is shown to the person (at least 3 characters).');
    if (!reason || reason.trim().length < 3) return;
    void run(() => api.post(`/v1/admin/chef-verifications/${id}/reject`, { reason: reason.trim() }), 'Rejected.');
  };

  return (
    <Page
      title="Chef verification"
      actions={
        <select value={status} onChange={(e) => setStatus(e.target.value as Status)} aria-label="Show requests that are">
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
            <Empty>No {status} requests.</Empty>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Person</th>
                  <th>Their note</th>
                  <th>Portfolio</th>
                  <th>Sent</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {page.items.map((c) => (
                  <tr key={c.id}>
                    <td>{c.user.displayName}</td>
                    <td>
                      {c.note}
                      {c.rejectionReason ? <div className="muted">Rejected: {c.rejectionReason}</div> : null}
                    </td>
                    <td>
                      {c.portfolioUrl ? (
                        <a href={c.portfolioUrl} target="_blank" rel="noopener noreferrer nofollow">
                          open
                        </a>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td>{ago(c.submittedAt)}</td>
                    <td className="row">
                      {c.status === 'pending' ? (
                        <>
                          <ConfirmButton label="Approve" confirm={`Give ${c.user.displayName} the verified-chef badge?`} onConfirm={() => run(() => api.post(`/v1/admin/chef-verifications/${c.id}/approve`), 'Approved.')} />
                          <button onClick={() => reject(c.id)}>Reject</button>
                        </>
                      ) : null}
                      {c.status === 'approved' ? (
                        <ConfirmButton danger label="Revoke badge" confirm={`Take the badge away from ${c.user.displayName}?`} onConfirm={() => run(() => api.post(`/v1/admin/users/${c.user.id}/chef/revoke`), 'Badge revoked.')} />
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
