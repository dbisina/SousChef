// Plan codes and sales as the app sees them: plain-words messages, and a sale line that never costs an error.
const mockPost = jest.fn();
const mockGet = jest.fn();
let mockEnabled = true;
jest.mock('@/lib/api', () => ({ api: () => ({ post: mockPost, get: mockGet }), apiEnabled: () => mockEnabled }));

import type { SaleView } from '@shared/index';
import { currentSale, redeemCode, redeemProblem, saleLine } from '@/services/promoApi';

const sale = (over: Partial<SaleView> = {}): SaleView => ({ id: 's1', tier: null, percentOff: 30, label: 'Launch week', startsAt: '2026-11-19T00:00:00Z', endsAt: '2026-12-01T12:00:00Z', active: true, ...over });

beforeEach(() => {
  mockPost.mockReset();
  mockGet.mockReset();
  mockEnabled = true;
});

describe('redeeming a code', () => {
  it('sends the code to the server and returns what it gave', async () => {
    mockPost.mockResolvedValue({ tier: 'pro', endsAt: '2027-01-01T00:00:00Z' });
    await expect(redeemCode('ABCDE23456')).resolves.toEqual({ tier: 'pro', endsAt: '2027-01-01T00:00:00Z' });
    expect(mockPost).toHaveBeenCalledWith('/v1/me/redeem', { code: 'ABCDE23456' });
  });

  it('explains each way it can fail in plain words', () => {
    expect(redeemProblem('not_found')).toMatch(/isn't valid or has ended/);
    expect(redeemProblem('conflict')).toMatch(/used up|used it before/);
    expect(redeemProblem('forbidden')).toMatch(/Apple/);
    expect(redeemProblem('network')).toMatch(/Couldn't reach/);
    expect(redeemProblem(undefined)).toMatch(/did not work/);
  });
});

describe('the sale line', () => {
  it('names the plan and the end date, without pressure', () => {
    expect(saleLine(sale())).toBe('Launch week: 30% off Premium and Pro until Dec 1');
    expect(saleLine(sale({ tier: 'pro', percentOff: 20 }))).toBe('Launch week: 20% off Pro until Dec 1');
    expect(saleLine(sale({ tier: 'premium' }))).toContain('off Premium until');
  });

  it('is null when there is no sale, no server, or the server cannot be reached', async () => {
    mockGet.mockResolvedValue({ sale: sale() });
    await expect(currentSale()).resolves.toMatchObject({ percentOff: 30 });
    mockGet.mockResolvedValue({ sale: null });
    await expect(currentSale()).resolves.toBeNull();
    mockGet.mockRejectedValue(new Error('offline'));
    await expect(currentSale()).resolves.toBeNull();
    mockEnabled = false;
    await expect(currentSale()).resolves.toBeNull();
  });
});
