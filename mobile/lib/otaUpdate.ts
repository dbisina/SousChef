import * as Updates from 'expo-updates';

/**
 * Over-the-air fixes: when the app opens (while the opening animation still covers it) ask the update server whether a newer
 * JavaScript bundle exists for this exact build, download it and restart into it. Anything slow, offline or broken is skipped:
 * the app must never wait on this, and it only ever looks at the "production" channel this build was made for.
 * Returns what happened so it can be tested.
 */
export type OtaOutcome = 'disabled' | 'none' | 'applied' | 'timeout' | 'error';

export async function applyPendingUpdate(opts: { maxWaitMs?: number; dev?: boolean; enabled?: boolean } = {}): Promise<OtaOutcome> {
  const { maxWaitMs = 5000, dev = __DEV__, enabled = Updates.isEnabled } = opts;
  if (dev || !enabled) return 'disabled';
  let timer: ReturnType<typeof setTimeout> | undefined;
  const give_up = new Promise<OtaOutcome>((resolve) => {
    timer = setTimeout(() => resolve('timeout'), maxWaitMs);
  });
  const work = (async (): Promise<OtaOutcome> => {
    try {
      const check = await Updates.checkForUpdateAsync();
      if (!check.isAvailable) return 'none';
      const fetched = await Updates.fetchUpdateAsync();
      if (!fetched.isNew) return 'none';
      await Updates.reloadAsync();
      return 'applied';
    } catch {
      return 'error';
    }
  })();
  try {
    return await Promise.race([work, give_up]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
