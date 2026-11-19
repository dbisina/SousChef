import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { AuthTokens, PromoCodeAdmin } from '@shared';
import { App } from './App';
import { AdminApi, type TokenStore } from './api';

afterEach(() => {
  cleanup();
  window.location.hash = '';
});

const tokens: AuthTokens = { accessToken: 'a', accessTokenExpiresAt: '2030-01-01T00:00:00Z', refreshToken: 'r' };
const json = (status: number, body?: unknown) => ({ status, ok: status < 300, json: async () => body ?? null }) as unknown as Response;
const store: TokenStore = { load: () => tokens, save: () => undefined };

const code: PromoCodeAdmin = { id: 'c1', code: 'ABCDE23456', tier: 'pro', days: 90, maxUses: 20, usedCount: 3, expiresAt: null, note: 'launch', active: true, createdAt: '2026-11-19T00:00:00Z' };

function server() {
  const posts: { url: string; body: unknown }[] = [];
  const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
    if (init?.method === 'POST') posts.push({ url, body: JSON.parse(String(init.body ?? 'null')) });
    if (url === '/v1/admin/promo-grants') return json(200, { items: [] });
    if (url === '/v1/admin/promo-codes' && init?.method !== 'POST') return json(200, { items: [code] });
    if (url === '/v1/admin/promo-codes' && init?.method === 'POST') return json(201, { ...code, id: 'c2', code: 'ZZZZZ99999' });
    if (url === '/v1/admin/sales') return json(200, { items: [] });
    if (url === '/v1/admin/promos/grant') return json(201, {});
    return json(404, { error: { code: 'not_found', message: 'no' } });
  });
  return { fetcher, posts };
}

describe('plans, codes and sales page', () => {
  it('lists codes with how many are used and lets staff give a plan by email', async () => {
    window.location.hash = '#/promos';
    const { fetcher, posts } = server();
    render(<App api={new AdminApi(store, fetcher as unknown as typeof fetch)} />);
    expect(await screen.findByRole('heading', { name: 'Plans, codes and sales' })).toBeTruthy();
    expect(await screen.findByText('ABCDE23456')).toBeTruthy();
    expect(screen.getByText('3 / 20')).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'ama@example.com' } });
    fireEvent.change(screen.getByLabelText('Note'), { target: { value: 'beta' } });
    fireEvent.click(screen.getByRole('button', { name: 'Give plan' }));
    await waitFor(() => expect(posts.some((p) => p.url === '/v1/admin/promos/grant')).toBe(true));
    expect(posts.find((p) => p.url === '/v1/admin/promos/grant')?.body).toEqual({ email: 'ama@example.com', tier: 'premium', days: 30, note: 'beta' });
  });

  it('shows a new code once it is made, ready to copy', async () => {
    window.location.hash = '#/promos';
    const { fetcher, posts } = server();
    render(<App api={new AdminApi(store, fetcher as unknown as typeof fetch)} />);
    await screen.findByText('ABCDE23456');
    fireEvent.click(screen.getByRole('button', { name: 'Make code' }));
    expect(await screen.findByText('ZZZZZ99999')).toBeTruthy();
    expect(posts.find((p) => p.url === '/v1/admin/promo-codes')?.body).toMatchObject({ tier: 'premium', days: 30, maxUses: 50 });
  });
});
