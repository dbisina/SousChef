jest.mock('expo-updates', () => ({
  isEnabled: true,
  checkForUpdateAsync: jest.fn(),
  fetchUpdateAsync: jest.fn(),
  reloadAsync: jest.fn(),
}));

import * as Updates from 'expo-updates';
import { applyPendingUpdate } from '@/lib/otaUpdate';

const mockUpdates = Updates as unknown as Record<'checkForUpdateAsync' | 'fetchUpdateAsync' | 'reloadAsync', jest.Mock>;

describe('applyPendingUpdate', () => {
  beforeEach(() => {
    mockUpdates.checkForUpdateAsync.mockReset();
    mockUpdates.fetchUpdateAsync.mockReset();
    mockUpdates.reloadAsync.mockReset();
  });

  it('does nothing in development or when updates are off', async () => {
    expect(await applyPendingUpdate({ dev: true, enabled: true })).toBe('disabled');
    expect(await applyPendingUpdate({ dev: false, enabled: false })).toBe('disabled');
    expect(mockUpdates.checkForUpdateAsync).not.toHaveBeenCalled();
  });

  it('leaves the app alone when there is no newer update', async () => {
    mockUpdates.checkForUpdateAsync.mockResolvedValue({ isAvailable: false });
    expect(await applyPendingUpdate({ dev: false, enabled: true })).toBe('none');
    expect(mockUpdates.reloadAsync).not.toHaveBeenCalled();
  });

  it('downloads a newer update and restarts into it', async () => {
    mockUpdates.checkForUpdateAsync.mockResolvedValue({ isAvailable: true });
    mockUpdates.fetchUpdateAsync.mockResolvedValue({ isNew: true });
    expect(await applyPendingUpdate({ dev: false, enabled: true })).toBe('applied');
    expect(mockUpdates.reloadAsync).toHaveBeenCalledTimes(1);
  });

  it('does not restart when the download was not new', async () => {
    mockUpdates.checkForUpdateAsync.mockResolvedValue({ isAvailable: true });
    mockUpdates.fetchUpdateAsync.mockResolvedValue({ isNew: false });
    expect(await applyPendingUpdate({ dev: false, enabled: true })).toBe('none');
    expect(mockUpdates.reloadAsync).not.toHaveBeenCalled();
  });

  it('swallows errors so the app still opens', async () => {
    mockUpdates.checkForUpdateAsync.mockRejectedValue(new Error('offline'));
    expect(await applyPendingUpdate({ dev: false, enabled: true })).toBe('error');
  });

  it('gives up after the wait so the app is never held up', async () => {
    mockUpdates.checkForUpdateAsync.mockReturnValue(new Promise(() => undefined));
    expect(await applyPendingUpdate({ dev: false, enabled: true, maxWaitMs: 30 })).toBe('timeout');
  });
});
