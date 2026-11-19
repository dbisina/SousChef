// Plan codes and sales. A code is typed on Android; iPhone uses Apple's own offer-code sheet (see lib/revenuecat.ts).
import type { RedeemPromoCodeResponse, SaleView } from '@shared/index';
import { api, apiEnabled } from '@/lib/api';

/** Redeems a code the server made. Throws ApiError: not_found (bad or ended code), conflict (used up or used already). */
export async function redeemCode(code: string): Promise<RedeemPromoCodeResponse> {
  return api().post<RedeemPromoCodeResponse>('/v1/me/redeem', { code });
}

/** The sale to mention now, or null (also null when there is no server or it cannot be reached: a sale line is never worth an error). */
export async function currentSale(): Promise<SaleView | null> {
  if (!apiEnabled()) return null;
  try {
    return (await api().get<{ sale: SaleView | null }>('/v1/sales/current')).sale;
  } catch {
    return null;
  }
}

/** "30% off Premium and Pro until Dec 1", in plain words. */
export function saleLine(sale: SaleView): string {
  const who = sale.tier === 'premium' ? 'Premium' : sale.tier === 'pro' ? 'Pro' : 'Premium and Pro';
  const until = new Date(sale.endsAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${sale.label}: ${sale.percentOff}% off ${who} until ${until}`;
}

/** The message to show when a code did not work. */
export function redeemProblem(code: string | undefined): string {
  if (code === 'not_found') return "That code isn't valid or has ended.";
  if (code === 'conflict') return 'That code was already used up or you used it before.';
  if (code === 'forbidden') return "On iPhone, use Apple's code sheet instead.";
  if (code === 'network' || code === 'timeout') return "Couldn't reach enplace. Try again.";
  return 'That did not work. Try again.';
}
