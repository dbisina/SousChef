// The pantry store and service against a pretend server.
const mockFirebaseTouched = jest.fn();
jest.mock('firebase/firestore', () => ({ Timestamp: { now: () => ({}), fromDate: (d: Date) => ({ toDate: () => d }) } }));
jest.mock('@/lib/firebase', () => {
  const touch = () => mockFirebaseTouched();
  return {
    db: {},
    collection: touch,
    doc: touch,
    getDocs: touch,
    setDoc: touch,
    deleteDoc: touch,
    query: touch,
    where: touch,
    orderBy: touch,
    generateId: touch,
    Timestamp: { now: () => ({}), fromDate: (d: Date) => ({ toDate: () => d }) },
  };
});
jest.mock('expo-secure-store', () => ({ getItemAsync: async () => null, setItemAsync: async () => undefined, deleteItemAsync: async () => undefined }));

import { api, resetApiForTests } from '@/lib/api';
import * as pantry from '@/services/pantryService';
import { toAppPantryItem } from '@/services/pantryApi';
import { usePantryStore } from '@/stores/pantryStore';
import type { PantryItem as ApiItem } from '@shared/index';

const item = (over: Partial<ApiItem> = {}): ApiItem => ({ id: 'p1', name: 'Rice', amount: 2, unit: 'cup', category: 'grains', expiresAt: null, createdAt: '2026-11-01T10:00:00.000Z', ...over });
const reply = (status: number, body?: unknown) => ({ ok: status < 300, status, json: async () => body ?? null }) as Response;
const tokens = { accessToken: 'a1', accessTokenExpiresAt: new Date(Date.now() + 900_000).toISOString(), refreshToken: 'r1' };

let server: jest.Mock;
const sent = (i: number) => ({ method: (server.mock.calls[i][1] as RequestInit).method, path: new URL(String(server.mock.calls[i][0])), body: (server.mock.calls[i][1] as RequestInit).body ? JSON.parse(String((server.mock.calls[i][1] as RequestInit).body)) : undefined });

beforeEach(async () => {
  mockFirebaseTouched.mockClear();
  process.env.EXPO_PUBLIC_API_URL = 'https://api.test';
  resetApiForTests();
  server = jest.fn();
  global.fetch = server as unknown as typeof fetch;
  await api().setTokens(tokens);
  usePantryStore.setState({ items: [], isLoading: false, error: null });
});
afterAll(() => {
  delete process.env.EXPO_PUBLIC_API_URL;
});

describe('mapping', () => {
  it('keeps the expiry only when there is one', () => {
    expect(toAppPantryItem(item()).expiryDate).toBeUndefined();
    expect(toAppPantryItem(item({ expiresAt: '2026-12-01T00:00:00.000Z' })).expiryDate?.toDate().toISOString()).toBe('2026-12-01T00:00:00.000Z');
    expect(toAppPantryItem(item()).addedAt.toDate().toISOString()).toBe('2026-11-01T10:00:00.000Z');
  });
});

describe('the store', () => {
  it('loads, adds, edits, deletes and clears through the server', async () => {
    server.mockResolvedValueOnce(reply(200, { items: [item({ id: 'a' }), item({ id: 'b', name: 'Milk', category: 'dairy' })] }));
    await usePantryStore.getState().fetchPantryItems('u1');
    expect(usePantryStore.getState().items.map((i) => i.id)).toEqual(['a', 'b']);
    expect(sent(0)).toMatchObject({ method: 'GET' });
    expect(sent(0).path.pathname).toBe('/v1/me/pantry');

    server.mockResolvedValueOnce(reply(201, item({ id: 'c', name: 'Eggs', category: 'dairy' })));
    await usePantryStore.getState().addPantryItem('u1', { name: 'Eggs', amount: 6, unit: 'piece', category: 'dairy', expiryDate: new Date('2026-12-01T00:00:00Z') });
    expect(usePantryStore.getState().items[0]?.id).toBe('c'); // newest first
    expect(sent(1).body).toEqual({ name: 'Eggs', amount: 6, unit: 'piece', category: 'dairy', expiresAt: '2026-12-01T00:00:00.000Z' });

    server.mockResolvedValueOnce(reply(200, item({ id: 'a', amount: 5 })));
    await usePantryStore.getState().updatePantryItem('u1', 'a', { amount: 5 });
    expect(usePantryStore.getState().items.find((i) => i.id === 'a')?.amount).toBe(5);
    expect(sent(2)).toMatchObject({ method: 'PATCH', body: { amount: 5 } });

    server.mockResolvedValueOnce(reply(204));
    await usePantryStore.getState().deletePantryItem('u1', 'b');
    expect(usePantryStore.getState().items.map((i) => i.id)).toEqual(['c', 'a']);

    server.mockResolvedValueOnce(reply(204));
    await usePantryStore.getState().clearPantry('u1');
    expect(usePantryStore.getState().items).toEqual([]);
    expect(sent(4)).toMatchObject({ method: 'DELETE' });
    expect(sent(4).path.pathname).toBe('/v1/me/pantry');
    expect(mockFirebaseTouched).not.toHaveBeenCalled();
  });

  it('sends a changed expiry date from a Firestore-style timestamp', async () => {
    server.mockResolvedValueOnce(reply(200, item()));
    const { Timestamp } = jest.requireMock('@/lib/firebase') as { Timestamp: { fromDate: (d: Date) => never } };
    await usePantryStore.getState().updatePantryItem('u1', 'p1', { expiryDate: Timestamp.fromDate(new Date('2027-01-01T00:00:00Z')) });
    expect(sent(0).body).toEqual({ expiresAt: '2027-01-01T00:00:00.000Z' });
  });

  it('keeps the list and shows the problem when the server says no', async () => {
    usePantryStore.setState({ items: [toAppPantryItem(item())] });
    server.mockResolvedValueOnce(reply(404, { error: { code: 'not_found', message: 'Item not found' } }));
    await expect(usePantryStore.getState().deletePantryItem('u1', 'p1')).rejects.toMatchObject({ status: 404 });
    expect(usePantryStore.getState().items).toHaveLength(1);
    expect(usePantryStore.getState().error).toBe('Item not found');
  });
});

describe('the service', () => {
  it('asks the server to filter by category, expiry and text', async () => {
    server.mockResolvedValue(reply(200, { items: [item()] }));
    await pantry.getPantryItemsByCategory('u1', 'dairy');
    await pantry.getExpiringItems('u1');
    await pantry.getExpiredItems('u1');
    await pantry.searchPantryItems('u1', 'ric');
    expect([0, 1, 2, 3].map((i) => sent(i).path.search)).toEqual(['?category=dairy', '?filter=expiring', '?filter=expired', '?q=ric']);
  });

  it('adds many in one request, and nothing when the list is empty', async () => {
    server.mockResolvedValueOnce(reply(201, { items: [item({ id: 'x' }), item({ id: 'y' })] }));
    const added = await pantry.bulkAddPantryItems('u1', [
      { name: 'A', amount: 1, unit: 'cup', category: 'grains' },
      { name: 'B', amount: 2, unit: 'cup', category: 'grains' },
    ]);
    expect(added.map((i) => i.id)).toEqual(['x', 'y']);
    expect(sent(0).path.pathname).toBe('/v1/me/pantry/bulk');
    expect(sent(0).body.items).toHaveLength(2);
    server.mockClear();
    expect(await pantry.bulkAddPantryItems('u1', [])).toEqual([]);
    expect(server).not.toHaveBeenCalled();
  });

  it('reads the summary from the server', async () => {
    server.mockResolvedValueOnce(reply(200, { produce: 3, other: 1 }));
    expect(await pantry.getPantrySummary('u1')).toMatchObject({ produce: 3 });
  });
});
