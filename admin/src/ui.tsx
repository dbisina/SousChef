import { createContext, useContext, type ReactNode } from 'react';
import type { AdminApi } from './api';
import type { Loaded } from './useLoad';

export const ApiContext = createContext<AdminApi | null>(null);

export function useApi(): AdminApi {
  const api = useContext(ApiContext);
  if (!api) throw new Error('No API client');
  return api;
}

export function Page({ title, actions, children }: { title: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <section>
      <header className="page-head">
        <h1>{title}</h1>
        <div className="row">{actions}</div>
      </header>
      {children}
    </section>
  );
}

/** Shows loading and error states around a loaded value. */
export function Loading<T>({ state, children }: { state: Loaded<T>; children: (data: T) => ReactNode }) {
  if (state.error) {
    return (
      <p role="alert" className="error">
        {state.error} <button onClick={state.reload}>Try again</button>
      </p>
    );
  }
  if (!state.data) return <p className="muted">Loading...</p>;
  return <>{children(state.data)}</>;
}

export function Card({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <div className="card">
      {title ? <h2>{title}</h2> : null}
      {children}
    </div>
  );
}

export function Stat({ label, value, tone }: { label: string; value: string; tone?: 'warn' }) {
  return (
    <div className={tone === 'warn' ? 'stat warn' : 'stat'}>
      <span className="stat-value">{value}</span>
      <span className="stat-label">{label}</span>
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="muted">{children}</p>;
}

/** A button for something that cannot be undone or that affects a person: asks first. */
export function ConfirmButton({ label, confirm, onConfirm, danger, disabled }: { label: string; confirm: string; onConfirm: () => void | Promise<void>; danger?: boolean; disabled?: boolean }) {
  return (
    <button
      className={danger ? 'danger' : undefined}
      disabled={disabled}
      onClick={() => {
        if (window.confirm(confirm)) void onConfirm();
      }}
    >
      {label}
    </button>
  );
}
