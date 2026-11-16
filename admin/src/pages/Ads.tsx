import { useState } from 'react';
import type { AdInquiry, AdInquiryStatus, AdminAd, AdStatus, Page as Paged } from '@shared';
import { ago, int } from '../format';
import { ApiError } from '../api';
import { useLoad } from '../useLoad';
import { Card, ConfirmButton, Empty, Loading, Page, useApi } from '../ui';

const INQUIRY_STATUSES: AdInquiryStatus[] = ['new', 'contacted', 'active', 'declined'];

export function Ads() {
  const api = useApi();
  const [message, setMessage] = useState('');
  const ads = useLoad(() => api.get<{ items: AdminAd[] }>('/v1/admin/ads'));
  const inquiries = useLoad(() => api.get<Paged<AdInquiry>>('/v1/admin/ad-inquiries?limit=50'));

  const run = async (work: () => Promise<unknown>, reload: () => void) => {
    setMessage('');
    try {
      await work();
      reload();
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : 'That did not work.');
    }
  };
  const setStatus = (ad: AdminAd, status: AdStatus) => run(() => api.patch(`/v1/admin/ads/${ad.id}`, { status }), ads.reload);

  return (
    <Page title="Ads">
      {message ? <p role="alert" className="error">{message}</p> : null}
      <Card title="Sponsored cards">
        <Loading state={ads}>
          {({ items }) =>
            items.length === 0 ? (
              <Empty>No ads yet.</Empty>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Ad</th>
                    <th>Status</th>
                    <th>Where</th>
                    <th>Seen / tapped</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((ad) => (
                    <tr key={ad.id}>
                      <td>
                        <strong>{ad.title}</strong>
                        <div className="muted">{ad.advertiserName}</div>
                      </td>
                      <td>
                        {ad.status}
                        {ad.expired ? <span className="tag warn"> ended</span> : null}
                      </td>
                      <td>{ad.placements.join(', ')}</td>
                      <td>
                        {int(ad.metrics.impressions)} / {int(ad.metrics.clicks)}
                      </td>
                      <td className="row">
                        {ad.status === 'active' ? (
                          <ConfirmButton label="Pause" confirm={`Pause "${ad.title}"?`} onConfirm={() => setStatus(ad, 'paused')} />
                        ) : (
                          <ConfirmButton label="Activate" confirm={`Show "${ad.title}" to people?`} onConfirm={() => setStatus(ad, 'active')} />
                        )}
                        <ConfirmButton danger label="Delete" confirm={`Delete "${ad.title}" for good?`} onConfirm={() => run(() => api.del(`/v1/admin/ads/${ad.id}`), ads.reload)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          }
        </Loading>
      </Card>
      <Card title="Advertising enquiries">
        <Loading state={inquiries}>
          {(page) =>
            page.items.length === 0 ? (
              <Empty>No enquiries.</Empty>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Who</th>
                    <th>Message</th>
                    <th>Budget</th>
                    <th>Sent</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {page.items.map((q) => (
                    <tr key={q.id}>
                      <td>
                        {q.name}
                        <div className="muted">
                          {q.company} - <a href={`mailto:${q.email}`}>{q.email}</a>
                        </div>
                      </td>
                      <td>{q.message}</td>
                      <td>{q.budget}</td>
                      <td>{ago(q.submittedAt)}</td>
                      <td>
                        <select value={q.status} aria-label={`Status of the enquiry from ${q.company}`} onChange={(e) => void run(() => api.patch(`/v1/admin/ad-inquiries/${q.id}`, { status: e.target.value }), inquiries.reload)}>
                          {INQUIRY_STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          }
        </Loading>
      </Card>
    </Page>
  );
}
