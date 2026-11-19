import { useCallback, useEffect, useState } from 'react';
import type { AiAllowance } from '@shared/index';
import { apiEnabled } from '@/lib/api';
import { isGuestSession } from '@/lib/session';
import { apiAllowance } from '@/services/aiToolsApi';

/** "2 of 3 left this week": the account's allowance for photo-reading AI, from the server. Null when there is no server or no account. */
export function useAllowance(): { allowance: AiAllowance | null; refresh: () => Promise<void> } {
  const [allowance, setAllowance] = useState<AiAllowance | null>(null);
  const refresh = useCallback(async () => {
    if (!apiEnabled() || isGuestSession()) return;
    try {
      setAllowance(await apiAllowance());
    } catch {
      // the meter is a convenience: without it the screen still works
    }
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  return { allowance, refresh };
}

/** How many are left in the pool, or null when unknown. */
export const leftIn = (a: AiAllowance | null): number | null => (a ? Math.max(0, a.intensive.max - a.intensive.used) : null);

/** "this week" or "today", for the line under the meter. */
export const windowWord = (a: AiAllowance): string => (a.intensive.windowDays <= 1 ? 'today' : 'this week');
