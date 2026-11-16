// Sponsored ads. Dates are ISO strings; money is whole cents.

export const AD_PLACEMENTS = ['welcome_modal', 'home_feed', 'recipe_detail', 'shopping_list', 'browse'] as const;
export type AdPlacement = (typeof AD_PLACEMENTS)[number];

export const AD_FORMATS = ['banner', 'card', 'featured'] as const;
export type AdFormat = (typeof AD_FORMATS)[number];

export type AdStatus = 'active' | 'paused' | 'pending_review';

/** What the app needs to show an ad. Nothing about money or targeting. */
export interface PublicAd {
  /** `fallback` for SousChef's own ad, shown when no campaign is running. */
  id: string;
  advertiserName: string;
  advertiserLogoUrl: string | null;
  title: string;
  subtitle: string;
  imageUrl: string;
  ctaText: string;
  ctaUrl: string;
  format: AdFormat;
  accentColor: string | null;
  darkMode: boolean;
  isFallback: boolean;
}

export interface AdMetrics {
  impressions: number;
  clicks: number;
  /** Click-through rate as a percentage, two decimals. */
  ctr: number;
  /** Dollars spent so far (impressions x CPM). */
  spend: number;
  /** Dollars of budget left; 0 for an ad with no budget cap. */
  remaining: number;
}

export interface AdminAd extends Omit<PublicAd, 'isFallback'> {
  placements: AdPlacement[];
  status: AdStatus;
  /** True once the end date has passed, whatever `status` says. */
  expired: boolean;
  startsAt: string;
  endsAt: string;
  /** 0 means no cap. */
  budgetCents: number;
  cpmCents: number;
  metrics: AdMetrics;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAdRequest {
  advertiserName: string;
  advertiserLogoUrl?: string;
  title: string;
  subtitle: string;
  imageUrl: string;
  ctaText: string;
  ctaUrl: string;
  placements: AdPlacement[];
  format: AdFormat;
  /** Default `active`. */
  status?: AdStatus;
  startsAt: string;
  endsAt: string;
  budgetCents?: number;
  cpmCents?: number;
  accentColor?: string;
  darkMode?: boolean;
}

export type UpdateAdRequest = Partial<Omit<CreateAdRequest, 'advertiserLogoUrl' | 'accentColor'>> & {
  advertiserLogoUrl?: string | null;
  accentColor?: string | null;
};

export interface AdDayStat {
  /** YYYY-MM-DD */
  day: string;
  impressions: number;
  clicks: number;
}

export const AD_BUDGET_RANGES = ['under_500', '500_2000', '2000_5000', '5000_plus'] as const;
export type AdBudgetRange = (typeof AD_BUDGET_RANGES)[number];

export type AdInquiryStatus = 'new' | 'contacted' | 'active' | 'declined';

/** A business asking to advertise. */
export interface AdInquiryRequest {
  name: string;
  email: string;
  company: string;
  website?: string;
  budget: AdBudgetRange;
  placements: AdPlacement[];
  /** YYYY-MM-DD */
  startDate?: string;
  message: string;
}

export interface AdInquiry extends Omit<AdInquiryRequest, 'website' | 'startDate'> {
  id: string;
  website: string | null;
  startDate: string | null;
  status: AdInquiryStatus;
  submittedAt: string;
}
