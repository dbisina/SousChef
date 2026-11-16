// Sponsored ads against the SousChef server. Used by adService when EXPO_PUBLIC_API_URL is set.
import { Timestamp } from '@/lib/firebase';
import type { AdInquiryRequest, AdminAd, CreateAdRequest, PublicAd, UpdateAdRequest } from '@shared/index';
import { api } from '@/lib/api';
import type { AdPlacement, SponsoredAd } from '@/types/ads';

/** A public ad as the app's ad card expects it. Money and counts are not sent to phones, so they are zero here. */
export function toAppPublicAd(a: PublicAd, placement: AdPlacement): SponsoredAd {
  const now = Timestamp.now();
  return {
    id: a.id,
    advertiserId: a.isFallback ? 'souschef' : a.advertiserName,
    advertiserName: a.advertiserName,
    ...(a.advertiserLogoUrl ? { advertiserLogo: a.advertiserLogoUrl } : {}),
    title: a.title,
    subtitle: a.subtitle,
    imageURL: a.imageUrl,
    ctaText: a.ctaText,
    ctaURL: a.ctaUrl,
    placements: [placement],
    format: a.format,
    status: 'active',
    startDate: now,
    endDate: now,
    budgetCents: 0,
    cpmCents: 0,
    spentCents: 0,
    impressions: 0,
    clicks: 0,
    createdAt: now,
    updatedAt: now,
    ...(a.accentColor ? { accentColor: a.accentColor } : {}),
    darkMode: a.darkMode,
  };
}

export function toAppAdminAd(a: AdminAd): SponsoredAd {
  return {
    id: a.id,
    advertiserId: a.advertiserName,
    advertiserName: a.advertiserName,
    ...(a.advertiserLogoUrl ? { advertiserLogo: a.advertiserLogoUrl } : {}),
    title: a.title,
    subtitle: a.subtitle,
    imageURL: a.imageUrl,
    ctaText: a.ctaText,
    ctaURL: a.ctaUrl,
    placements: a.placements,
    format: a.format,
    status: a.expired ? 'expired' : a.status,
    startDate: Timestamp.fromDate(new Date(a.startsAt)),
    endDate: Timestamp.fromDate(new Date(a.endsAt)),
    budgetCents: a.budgetCents,
    cpmCents: a.cpmCents,
    spentCents: Math.round(a.metrics.spend * 100),
    impressions: a.metrics.impressions,
    clicks: a.metrics.clicks,
    createdAt: Timestamp.fromDate(new Date(a.createdAt)),
    updatedAt: Timestamp.fromDate(new Date(a.updatedAt)),
    ...(a.accentColor ? { accentColor: a.accentColor } : {}),
    darkMode: a.darkMode,
  };
}

const iso = (t: { toDate(): Date }) => t.toDate().toISOString();

function toCreate(ad: Partial<SponsoredAd>): UpdateAdRequest {
  return {
    ...(ad.advertiserName !== undefined ? { advertiserName: ad.advertiserName } : {}),
    ...(ad.advertiserLogo !== undefined ? { advertiserLogoUrl: ad.advertiserLogo || null } : {}),
    ...(ad.title !== undefined ? { title: ad.title } : {}),
    ...(ad.subtitle !== undefined ? { subtitle: ad.subtitle } : {}),
    ...(ad.imageURL !== undefined ? { imageUrl: ad.imageURL } : {}),
    ...(ad.ctaText !== undefined ? { ctaText: ad.ctaText } : {}),
    ...(ad.ctaURL !== undefined ? { ctaUrl: ad.ctaURL } : {}),
    ...(ad.placements !== undefined ? { placements: ad.placements } : {}),
    ...(ad.format !== undefined ? { format: ad.format } : {}),
    // "expired" is worked out from the end date on the server; it is not a status you can set.
    ...(ad.status !== undefined ? { status: ad.status === 'expired' ? 'paused' : ad.status } : {}),
    ...(ad.startDate !== undefined ? { startsAt: iso(ad.startDate) } : {}),
    ...(ad.endDate !== undefined ? { endsAt: iso(ad.endDate) } : {}),
    ...(ad.budgetCents !== undefined ? { budgetCents: ad.budgetCents } : {}),
    ...(ad.cpmCents !== undefined ? { cpmCents: ad.cpmCents } : {}),
    ...(ad.accentColor !== undefined ? { accentColor: ad.accentColor || null } : {}),
    ...(ad.darkMode !== undefined ? { darkMode: ad.darkMode } : {}),
  };
}

/** Null when the person's plan has no ads. */
export async function apiAdForPlacement(placement: AdPlacement): Promise<SponsoredAd | null> {
  const res = await api().get<{ ad: PublicAd | null }>('/v1/ads', { query: { placement } });
  return res.ad ? toAppPublicAd(res.ad, placement) : null;
}

export async function apiRecordAd(adId: string, kind: 'impression' | 'click'): Promise<void> {
  await api().post(`/v1/ads/${adId}/${kind}`);
}

export async function apiSubmitInquiry(inquiry: Omit<import('@/types/ads').AdInquiry, 'id' | 'status' | 'submittedAt'>): Promise<void> {
  const body: AdInquiryRequest = {
    name: inquiry.name,
    email: inquiry.email,
    company: inquiry.company,
    ...(inquiry.website ? { website: inquiry.website } : {}),
    budget: inquiry.budget,
    placements: inquiry.placements,
    ...(inquiry.startDate ? { startDate: inquiry.startDate } : {}),
    message: inquiry.message,
  };
  await api().post('/v1/ad-inquiries', body);
}

export async function apiAllAds(): Promise<SponsoredAd[]> {
  const res = await api().get<{ items: AdminAd[] }>('/v1/admin/ads');
  return res.items.map(toAppAdminAd);
}

export async function apiCreateAd(ad: Partial<SponsoredAd>): Promise<string> {
  // A new ad carries every required field (the admin form fills them); the server checks that.
  return (await api().post<AdminAd>('/v1/admin/ads', toCreate(ad) as CreateAdRequest)).id;
}

export async function apiUpdateAd(id: string, updates: Partial<SponsoredAd>): Promise<void> {
  await api().patch(`/v1/admin/ads/${id}`, toCreate(updates));
}

export async function apiDeleteAd(id: string): Promise<void> {
  await api().delete(`/v1/admin/ads/${id}`);
}
