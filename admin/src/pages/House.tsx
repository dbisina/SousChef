import { useState } from 'react';
import type { AdminDailyPuzzle, HouseAccount, HouseSwitchResult } from '@shared';
import { ago, int } from '../format';
import { ApiError } from '../api';
import { useLoad } from '../useLoad';
import { Card, ConfirmButton, Empty, Loading, Page, useApi } from '../ui';

/** Official enplace accounts (clearly labelled in the app) and their kill switch, plus the daily puzzle list. */
export function House() {
  const api = useApi();
  const [message, setMessage] = useState('');
  const accounts = useLoad(() => api.get<{ items: HouseAccount[] }>('/v1/admin/house-accounts'));
  const puzzles = useLoad(() => api.get<{ items: AdminDailyPuzzle[] }>('/v1/admin/daily-puzzles'));

  const flip = async (on: boolean) => {
    setMessage('');
    try {
      const res = await api.post<HouseSwitchResult>(`/v1/admin/house/${on ? 'on' : 'off'}`);
      setMessage(`${on ? 'Shown again' : 'Hidden'}: ${int(res.posts)} official posts.`);
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : 'That did not work.');
    }
  };

  return (
    <Page
      title="Official accounts and puzzles"
      actions={
        <>
          <ConfirmButton danger label="Hide all official posts" confirm="Take every official enplace post out of sight now?" onConfirm={() => flip(false)} />
          <ConfirmButton label="Show them again" confirm="Put every official enplace post back?" onConfirm={() => flip(true)} />
        </>
      }
    >
      {message ? <p role="status">{message}</p> : null}
      <Card title="Official accounts">
        <Loading state={accounts}>
          {({ items }) =>
            items.length === 0 ? (
              <Empty>No official accounts yet.</Empty>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Account</th>
                    <th>Posts</th>
                    <th>Since</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((a) => (
                    <tr key={a.user.id}>
                      <td>
                        {a.user.displayName}
                        <div className="muted">{a.bio}</div>
                      </td>
                      <td>{int(a.postCount)}</td>
                      <td>{ago(a.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          }
        </Loading>
      </Card>
      <Card title="Daily Dish puzzles">
        <Loading state={puzzles}>
          {({ items }) =>
            items.length === 0 ? (
              <Empty>No puzzles are set; the game uses the built-in list.</Empty>
            ) : (
              <>
                <p className="muted">{int(items.length)} puzzles, played in this order. Editing the whole list is done through the API for now, because saving replaces every puzzle at once.</p>
                <ol start={items[0]?.position ?? 1}>
                  {items.slice(0, 40).map((p) => (
                    <li key={p.position}>
                      {p.answer} <span className="muted">({p.clues.length} clues)</span>
                    </li>
                  ))}
                </ol>
              </>
            )
          }
        </Loading>
      </Card>
    </Page>
  );
}
