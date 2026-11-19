import { useCallback, useEffect, useMemo, useState } from 'react';
import { AdminApi } from './api';
import { Ads } from './pages/Ads';
import { Ai } from './pages/Ai';
import { Chefs } from './pages/Chefs';
import { House } from './pages/House';
import { Login } from './pages/Login';
import { Overview } from './pages/Overview';
import { Promos } from './pages/Promos';
import { Reports } from './pages/Reports';
import { ApiContext } from './ui';

const ROUTES = [
  { path: 'overview', label: 'Overview', page: Overview },
  { path: 'reports', label: 'Reports', page: Reports },
  { path: 'chefs', label: 'Chef verification', page: Chefs },
  { path: 'ai', label: 'AI', page: Ai },
  { path: 'ads', label: 'Ads', page: Ads },
  { path: 'house', label: 'Official accounts', page: House },
  { path: 'promos', label: 'Plans & codes', page: Promos },
] as const;

const current = (): string => window.location.hash.replace(/^#\/?/, '') || 'overview';

export function App({ api: injected }: { api?: AdminApi }) {
  const [signedIn, setSignedIn] = useState(false);
  const api = useMemo(() => injected ?? new AdminApi(undefined, undefined, () => setSignedIn(false)), [injected]);
  const [route, setRoute] = useState(current());

  useEffect(() => {
    setSignedIn(api.signedIn);
    const onHash = () => setRoute(current());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, [api]);

  const signOut = useCallback(async () => {
    await api.logout();
    setSignedIn(false);
  }, [api]);

  if (!signedIn) return <Login api={api} onSignedIn={() => setSignedIn(true)} />;
  const Active = (ROUTES.find((r) => r.path === route) ?? ROUTES[0]).page;

  return (
    <ApiContext.Provider value={api}>
      <div className="shell">
        <nav aria-label="Sections">
          <strong className="brand">enplace staff</strong>
          {ROUTES.map((r) => (
            <a key={r.path} href={`#/${r.path}`} aria-current={route === r.path ? 'page' : undefined}>
              {r.label}
            </a>
          ))}
          <button className="link" onClick={() => void signOut()}>
            Sign out
          </button>
        </nav>
        <main>
          <Active />
        </main>
      </div>
    </ApiContext.Provider>
  );
}
