import { useState, type FormEvent } from 'react';
import {
  PROMO_LENGTHS,
  type CreatePromoCodeRequest,
  type CreateSaleRequest,
  type GrantPlanRequest,
  type PromoCodeAdmin,
  type PromoGrantAdmin,
  type PromoTier,
  type SaleView,
} from '@shared';
import { ApiError } from '../api';
import { int } from '../format';
import { useLoad } from '../useLoad';
import { Card, ConfirmButton, Empty, Loading, Page, useApi } from '../ui';

const day = (iso: string): string => new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
const lengthLabel = (days: number): string => PROMO_LENGTHS.find((l) => l.days === days)?.label ?? `${int(days)} days`;
/** An <input type="datetime-local"> value for "now plus this many days". */
const inDays = (n: number): string => new Date(Date.now() + n * 86_400_000 - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
const asIso = (local: string): string => new Date(local).toISOString();

function LengthSelect({ value, onChange }: { value: number; onChange: (days: number) => void }) {
  return (
    <select aria-label="Length" value={value} onChange={(e) => onChange(Number(e.target.value))}>
      {PROMO_LENGTHS.map((l) => (
        <option key={l.days} value={l.days}>
          {l.label}
        </option>
      ))}
    </select>
  );
}

function TierSelect({ value, onChange, any }: { value: PromoTier | ''; onChange: (tier: PromoTier | '') => void; any?: boolean }) {
  return (
    <select aria-label="Plan" value={value} onChange={(e) => onChange(e.target.value as PromoTier | '')}>
      {any ? <option value="">Both plans</option> : null}
      <option value="premium">Premium</option>
      <option value="pro">Pro</option>
    </select>
  );
}

/** Staff tools for promotions: give a plan to one person, make general codes, announce a sale. */
export function Promos() {
  const api = useApi();
  const [message, setMessage] = useState('');
  const [fresh, setFresh] = useState<PromoCodeAdmin | null>(null);
  const grants = useLoad(() => api.get<{ items: PromoGrantAdmin[] }>('/v1/admin/promo-grants'));
  const codes = useLoad(() => api.get<{ items: PromoCodeAdmin[] }>('/v1/admin/promo-codes'));
  const sales = useLoad(() => api.get<{ items: SaleView[] }>('/v1/admin/sales'));

  const run = async (work: () => Promise<unknown>, reload: () => void, done = '') => {
    setMessage('');
    try {
      await work();
      reload();
      if (done) setMessage(done);
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : 'That did not work.');
    }
  };

  // Give a plan
  const [email, setEmail] = useState('');
  const [grantTier, setGrantTier] = useState<PromoTier>('premium');
  const [grantDays, setGrantDays] = useState(30);
  const [grantNote, setGrantNote] = useState('');
  const give = (e: FormEvent) => {
    e.preventDefault();
    const body: GrantPlanRequest = { email, tier: grantTier, days: grantDays, ...(grantNote ? { note: grantNote } : {}) };
    void run(() => api.post('/v1/admin/promos/grant', body), grants.reload, `Gave ${grantTier} for ${lengthLabel(grantDays)} to ${email}.`).then(() => setEmail(''));
  };

  // Codes
  const [codeTier, setCodeTier] = useState<PromoTier>('premium');
  const [codeDays, setCodeDays] = useState(30);
  const [maxUses, setMaxUses] = useState(50);
  const [codeEnds, setCodeEnds] = useState('');
  const [codeNote, setCodeNote] = useState('');
  const makeCode = (e: FormEvent) => {
    e.preventDefault();
    const body: CreatePromoCodeRequest = { tier: codeTier, days: codeDays, maxUses, ...(codeEnds ? { expiresAt: asIso(codeEnds) } : {}), ...(codeNote ? { note: codeNote } : {}) };
    void run(async () => setFresh(await api.post<PromoCodeAdmin>('/v1/admin/promo-codes', body)), codes.reload);
  };

  // Sales
  const [saleTier, setSaleTier] = useState<PromoTier | ''>('');
  const [percent, setPercent] = useState(30);
  const [label, setLabel] = useState('');
  const [starts, setStarts] = useState(inDays(0));
  const [ends, setEnds] = useState(inDays(7));
  const makeSale = (e: FormEvent) => {
    e.preventDefault();
    const body: CreateSaleRequest = { percentOff: percent, label, startsAt: asIso(starts), endsAt: asIso(ends), ...(saleTier ? { tier: saleTier } : {}) };
    void run(() => api.post('/v1/admin/sales', body), sales.reload, 'Sale saved.').then(() => setLabel(''));
  };

  return (
    <Page title="Plans, codes and sales">
      {message ? <p role="status">{message}</p> : null}

      <Card title="Give a plan to someone">
        <p className="muted">Finds the account by email and gives the plan for the time you choose. Two grants stack: the second starts when the first ends.</p>
        <form className="row" onSubmit={give}>
          <input type="email" required placeholder="their email" aria-label="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <TierSelect value={grantTier} onChange={(t) => t && setGrantTier(t)} />
          <LengthSelect value={grantDays} onChange={setGrantDays} />
          <input placeholder="note (why)" aria-label="Note" value={grantNote} onChange={(e) => setGrantNote(e.target.value)} />
          <button type="submit">Give plan</button>
        </form>
        <Loading state={grants}>
          {({ items }) =>
            items.length === 0 ? (
              <Empty>Nobody has free time from staff or codes right now.</Empty>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Person</th>
                    <th>Plan</th>
                    <th>Until</th>
                    <th>From</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {items.map((g) => (
                    <tr key={g.id}>
                      <td>
                        {g.email ?? g.handle}
                        {g.note ? <div className="muted">{g.note}</div> : null}
                      </td>
                      <td>{g.tier}</td>
                      <td>{day(g.endsAt)}</td>
                      <td>{g.key.startsWith('code:') ? 'a code' : 'staff'}</td>
                      <td>
                        <ConfirmButton danger label="Take back" confirm={`Take this plan back from ${g.email ?? g.handle}?`} onConfirm={() => run(() => api.del(`/v1/admin/promo-grants/${g.id}`), grants.reload)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          }
        </Loading>
      </Card>

      <Card title="General codes">
        <p className="muted">People type these on Android or the website. On iPhone Apple does not allow our own codes: use Apple offer codes there (made in App Store Connect).</p>
        <form className="row" onSubmit={makeCode}>
          <TierSelect value={codeTier} onChange={(t) => t && setCodeTier(t)} />
          <LengthSelect value={codeDays} onChange={setCodeDays} />
          <label>
            Uses <input type="number" min={1} max={100000} value={maxUses} onChange={(e) => setMaxUses(Number(e.target.value))} style={{ width: '6rem' }} />
          </label>
          <label>
            Ends <input type="datetime-local" value={codeEnds} onChange={(e) => setCodeEnds(e.target.value)} />
          </label>
          <input placeholder="note (campaign)" aria-label="Code note" value={codeNote} onChange={(e) => setCodeNote(e.target.value)} />
          <button type="submit">Make code</button>
        </form>
        {fresh ? (
          <p role="status">
            New code: <strong style={{ fontSize: '1.2rem', letterSpacing: '0.1em' }}>{fresh.code}</strong>{' '}
            <button type="button" className="link" onClick={() => void navigator.clipboard?.writeText(fresh.code)}>
              Copy
            </button>
          </p>
        ) : null}
        <Loading state={codes}>
          {({ items }) =>
            items.length === 0 ? (
              <Empty>No codes yet.</Empty>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Gives</th>
                    <th>Used</th>
                    <th>Ends</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {items.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <strong>{c.code}</strong>
                        {c.note ? <div className="muted">{c.note}</div> : null}
                      </td>
                      <td>
                        {c.tier}, {lengthLabel(c.days)}
                      </td>
                      <td>
                        {int(c.usedCount)} / {int(c.maxUses)}
                      </td>
                      <td>{c.expiresAt ? day(c.expiresAt) : 'no end'}</td>
                      <td>
                        {c.active ? (
                          <ConfirmButton label="Pause" confirm={`Stop ${c.code} from working?`} onConfirm={() => run(() => api.patch(`/v1/admin/promo-codes/${c.id}`, { active: false }), codes.reload)} />
                        ) : (
                          <ConfirmButton label="Resume" confirm={`Let ${c.code} work again?`} onConfirm={() => run(() => api.patch(`/v1/admin/promo-codes/${c.id}`, { active: true }), codes.reload)} />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          }
        </Loading>
      </Card>

      <Card title="Sales">
        <p className="muted">
          A sale shows a calm line on the plans screen. The real discount is a store offer: set it up in App Store Connect (introductory or promotional offer) and Google Play (offer on the base plan), with the same dates.
        </p>
        <form className="row" onSubmit={makeSale}>
          <TierSelect any value={saleTier} onChange={setSaleTier} />
          <label>
            % off <input type="number" min={1} max={90} value={percent} onChange={(e) => setPercent(Number(e.target.value))} style={{ width: '5rem' }} />
          </label>
          <input required minLength={2} maxLength={80} placeholder="e.g. Launch week" aria-label="Sale label" value={label} onChange={(e) => setLabel(e.target.value)} />
          <label>
            From <input type="datetime-local" required value={starts} onChange={(e) => setStarts(e.target.value)} />
          </label>
          <label>
            To <input type="datetime-local" required value={ends} onChange={(e) => setEnds(e.target.value)} />
          </label>
          <button type="submit">Save sale</button>
        </form>
        <Loading state={sales}>
          {({ items }) =>
            items.length === 0 ? (
              <Empty>No sales yet.</Empty>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Sale</th>
                    <th>Plan</th>
                    <th>When</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {items.map((s) => (
                    <tr key={s.id}>
                      <td>
                        {s.percentOff}% off <span className="muted">{s.label}</span>
                      </td>
                      <td>{s.tier ?? 'both'}</td>
                      <td>
                        {day(s.startsAt)} to {day(s.endsAt)} {!s.active ? <span className="tag warn">ended</span> : null}
                      </td>
                      <td>{s.active ? <ConfirmButton danger label="End now" confirm={`End "${s.label}" now?`} onConfirm={() => run(() => api.post(`/v1/admin/sales/${s.id}/end`), sales.reload)} /> : null}</td>
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
