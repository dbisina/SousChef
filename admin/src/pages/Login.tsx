import { useState, type FormEvent } from 'react';
import { ApiError, NotStaffError, type AdminApi } from '../api';

export function Login({ api, onSignedIn }: { api: AdminApi; onSignedIn: (name: string) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const me = await api.login(email.trim(), password);
      setPassword('');
      onSignedIn(me.displayName);
    } catch (err) {
      setError(
        err instanceof NotStaffError
          ? 'This account is not staff.'
          : err instanceof ApiError && err.code === 'invalid_credentials'
            ? 'That email or password is not right.'
            : err instanceof ApiError && err.code === 'rate_limited'
              ? 'Too many tries. Wait a minute and try again.'
              : 'Could not sign in just now.',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="login">
      <form onSubmit={submit} className="card" aria-label="Sign in">
        <h1>SousChef staff</h1>
        <label>
          Email
          <input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label>
          Password
          <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        {error ? (
          <p role="alert" className="error">
            {error}
          </p>
        ) : null}
        <button type="submit" disabled={busy}>
          {busy ? 'Signing in...' : 'Sign in'}
        </button>
      </form>
    </main>
  );
}
