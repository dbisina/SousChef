// Asking for the verified-chef badge: the app talks to the server's own endpoints.
const mockGet = jest.fn();
const mockPost = jest.fn();
jest.mock('@/lib/api', () => ({ api: () => ({ get: mockGet, post: mockPost }) }));

import { apiChefVerification, apiRequestChefVerification } from '@/services/chefApi';

const view = { status: 'pending', note: 'I cook daily', portfolioUrl: null, submittedAt: '2026-11-18T10:00:00.000Z', decidedAt: null, rejectionReason: null };

describe('chef verification', () => {
  beforeEach(() => {
    mockGet.mockReset().mockResolvedValue(view);
    mockPost.mockReset().mockResolvedValue(view);
  });

  it('reads where the request stands', async () => {
    expect(await apiChefVerification()).toEqual(view);
    expect(mockGet).toHaveBeenCalledWith('/v1/chef/verification');
  });

  it('sends the note and the link', async () => {
    await apiRequestChefVerification({ note: 'I cook daily for a street stall', portfolioUrl: 'https://stall.example' });
    expect(mockPost).toHaveBeenCalledWith('/v1/chef/verification', { note: 'I cook daily for a street stall', portfolioUrl: 'https://stall.example' });
  });
});
