// One friendly sentence for any failure from an AI helper. Screens show this, never raw error text.
import { ApiError } from '@/lib/api';

export function aiErrorText(err: unknown, fallback = 'That did not work just now. Try again in a moment.'): string {
  if (err instanceof ApiError) {
    if (err.code === 'limit_reached') return 'You have used today\'s allowance for this helper. It comes back tomorrow, or upgrade for more.';
    if (err.code === 'network' || err.code === 'timeout') return 'Could not reach SousChef. Check your connection and try again.';
    if (err.status === 503) return 'The AI helper is busy or switched off right now. Try again later.';
    if (err.status === 409 || err.status === 403 || err.status === 400) return err.message || fallback;
  }
  return fallback;
}
