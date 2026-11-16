import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { AdminStats, AiUsageReport, AuthResponse, AuthTokens } from '@shared';
import { App } from './App';
import { AdminApi, type TokenStore } from './api';

afterEach(() => {
  cleanup();
  window.location.hash = '';
});

const tokens: AuthTokens = { accessToken: 'a', accessTokenExpiresAt: '2030-01-01T00:00:00Z', refreshToken: 'r' };
const json = (status: number, body?: unknown) => ({ status, ok: status < 300, json: async () => body ?? null }) as unknown as Response;
const store = (initial: AuthTokens | null): TokenStore => {
  let v = initial;
  return { load: () => v, save: (t) => void (v = t) };
};
const stats: AdminStats = { people: 12, newPeopleLast7Days: 3, suspendedPeople: 0, postsLast7Days: 40, openReports: 2, pendingChefVerifications: 1 };
const usage: AiUsageReport = { days: 30, since: '2026-10-16T00:00:00Z', budgetUsd: 5, spentThisMonthUsd: 1.25, byProvider: [], byTask: [], byDay: [] };

function fakeServer(role: 'admin' | 'user') {
  return vi.fn(async (url: string) => {
    if (url === '/v1/auth/login') return json(200, { user: { role, displayName: 'Ade' }, tokens } as AuthResponse);
    if (url === '/v1/auth/logout') return json(204);
    if (url === '/v1/admin/stats') return json(200, stats);
    if (url.startsWith('/v1/admin/ai/usage')) return json(200, usage);
    return json(404, { error: { code: 'not_found', message: 'no' } });
  });
}

describe('the dashboard', () => {
  it('asks for a sign-in first, then shows the overview numbers', async () => {
    const request = fakeServer('admin');
    render(<App api={new AdminApi(store(null), request as unknown as typeof fetch)} />);
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'ade@souschef.test' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'correct horse' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('heading', { name: 'Overview' })).toBeTruthy();
    expect(await screen.findByText('12')).toBeTruthy(); // people
    expect(await screen.findByText(/\$1\.25 of \$5\.00 \(25%\)/)).toBeTruthy();
    expect(screen.getByRole('navigation', { name: 'Sections' })).toBeTruthy();
  });

  it('turns an ordinary account away with a plain message', async () => {
    const request = fakeServer('user');
    render(<App api={new AdminApi(store(null), request as unknown as typeof fetch)} />);
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'x@y.co' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'pw' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect((await screen.findByRole('alert')).textContent).toBe('This account is not staff.');
    expect(screen.queryByRole('navigation')).toBeNull();
  });

  it('opens straight to the dashboard when a session already exists, and signs out', async () => {
    const request = fakeServer('admin');
    render(<App api={new AdminApi(store(tokens), request as unknown as typeof fetch)} />);
    expect(await screen.findByRole('heading', { name: 'Overview' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    await waitFor(() => expect(screen.getByRole('form', { name: 'Sign in' })).toBeTruthy());
  });
});
