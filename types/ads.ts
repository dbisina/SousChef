import { Timestamp } from 'firebase/firestore';

// ── Sponsored Ad Types ──

export type AdPlacement = 'welcome_modal' | 'home_feed' | 'recipe_detail' | 'shopping_list' | 'browse';

export type AdFormat = 'banner' | 'card' | 'featured';

export type AdStatus = 'active' | 'paused' | 'expired' | 'pending_review';

export interface SponsoredAd {
    id: string;
    // Advertiser info
    advertiserId: string;
    advertiserName: string;
    advertiserLogo?: string;
    // Creative
    title: string;
    subtitle: string;
    imageURL: string;
    ctaText: string; // "Shop Now", "Try Free", "Learn More"
    ctaURL: string; // Deep link or web URL
    // Targeting
    placements: AdPlacement[];
    format: AdFormat;
    // Scheduling
    status: AdStatus;
    startDate: Timestamp;
    endDate: Timestamp;
    // Budget & pricing
    budgetCents: number; // Total budget in cents
    cpmCents: number; // Cost per 1000 impressions in cents
    spentCents: number; // Amount spent so far
    // Analytics
    impressions: number;
    clicks: number;
    // Metadata
    createdAt: Timestamp;
    updatedAt: Timestamp;
    // Styling
    accentColor?: string; // Brand color for CTA
    darkMode?: boolean; // Whether to show dark variant
}

// Ad inquiry from potential advertisers
export interface AdInquiry {
    id?: string;
    // Contact
    name: string;
    email: string;
    company: string;
    website?: string;
    // Campaign details
    budget: AdBudgetRange;
    placements: AdPlacement[];
    startDate?: string;
    message: string;
    // Status
    status: 'new' | 'contacted' | 'active' | 'declined';
    submittedAt: Timestamp;
}

export type AdBudgetRange = 'under_500' | '500_2000' | '2000_5000' | '5000_plus';

export const AD_BUDGET_LABELS: Record<AdBudgetRange, string> = {
    under_500: 'Under $500/mo',
    '500_2000': '$500 – $2,000/mo',
    '2000_5000': '$2,000 – $5,000/mo',
    '5000_plus': '$5,000+/mo',
};

export const AD_PLACEMENT_LABELS: Record<AdPlacement, string> = {
    welcome_modal: 'Welcome Screen',
    home_feed: 'Home Feed',
    recipe_detail: 'Recipe Detail',
    shopping_list: 'Shopping List',
    browse: 'Browse / Discover',
};

// Ad performance metrics
export interface AdMetrics {
    impressions: number;
    clicks: number;
    ctr: number; // click-through rate
    spend: number; // in dollars
    remaining: number; // budget remaining in dollars
}

// Default/fallback ad when no sponsored campaign is active
export const FALLBACK_AD: Omit<SponsoredAd, 'id' | 'createdAt' | 'updatedAt' | 'startDate' | 'endDate'> = {
    advertiserId: 'souschef',
    advertiserName: 'SousChef',
    title: 'Fresh Ingredients Delivered',
    subtitle: 'Get 20% off your first grocery order',
    imageURL: 'https://images.unsplash.com/photo-1543352634-a1c51d9f1fa7?auto=format&fit=crop&w=800&q=80',
    ctaText: 'Shop Now',
    ctaURL: 'https://souschef.app/partners',
    placements: ['welcome_modal', 'home_feed'],
    format: 'card',
    status: 'active',
    budgetCents: 0,
    cpmCents: 0,
    spentCents: 0,
    impressions: 0,
    clicks: 0,
    accentColor: '#22C55E',
};
