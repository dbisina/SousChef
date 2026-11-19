// Staff-made plan codes, plan grants for named people, and sales shown on the plans screen.
import type { SubscriptionTier } from './tiers';

export type PromoTier = Exclude<SubscriptionTier, 'free'>;

export interface PromoCodeAdmin {
  id: string;
  code: string;
  tier: PromoTier;
  days: number;
  maxUses: number;
  usedCount: number;
  expiresAt: string | null;
  note: string | null;
  active: boolean;
  createdAt: string;
}

export interface CreatePromoCodeRequest {
  tier: PromoTier;
  days: number;
  maxUses: number;
  expiresAt?: string | undefined;
  note?: string | undefined;
}

export interface PromoGrantAdmin {
  id: string;
  userId: string;
  email: string | null;
  handle: string;
  tier: PromoTier;
  startsAt: string;
  endsAt: string;
  key: string;
  note: string | null;
}

export interface GrantPlanRequest {
  email: string;
  tier: PromoTier;
  days: number;
  note?: string | undefined;
}

export interface RedeemPromoCodeResponse {
  tier: PromoTier;
  endsAt: string;
}

export interface SaleView {
  id: string;
  tier: PromoTier | null;
  percentOff: number;
  label: string;
  startsAt: string;
  endsAt: string;
  active: boolean;
}

export interface CreateSaleRequest {
  tier?: PromoTier | undefined;
  percentOff: number;
  label: string;
  startsAt: string;
  endsAt: string;
}

/** Lengths the admin form offers; any whole number of days from 1 to 730 is accepted. */
export const PROMO_LENGTHS: { label: string; days: number }[] = [
  { label: '1 month', days: 30 },
  { label: '3 months', days: 90 },
  { label: '6 months', days: 180 },
  { label: '12 months', days: 365 },
];
