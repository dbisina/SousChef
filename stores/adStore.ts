import { create } from 'zustand';
import { SponsoredAd, AdPlacement } from '@/types/ads';
import {
    getAdForPlacement,
    recordImpression,
    recordClick,
} from '@/services/adService';

interface AdStore {
    // State
    ads: Record<AdPlacement, SponsoredAd | null>;
    loading: Record<AdPlacement, boolean>;
    impressedAdIds: Set<string>; // Track which ads have been impressed this session

    // Actions
    fetchAdForPlacement: (placement: AdPlacement) => Promise<SponsoredAd | null>;
    trackImpression: (adId: string) => void;
    trackClick: (adId: string) => void;
    clearAds: () => void;
}

export const useAdStore = create<AdStore>((set, get) => ({
    ads: {
        welcome_modal: null,
        home_feed: null,
        recipe_detail: null,
        shopping_list: null,
        browse: null,
    },
    loading: {
        welcome_modal: false,
        home_feed: false,
        recipe_detail: false,
        shopping_list: false,
        browse: false,
    },
    impressedAdIds: new Set(),

    fetchAdForPlacement: async (placement: AdPlacement) => {
        // Skip if already loaded
        const existing = get().ads[placement];
        if (existing) return existing;

        set((state) => ({
            loading: { ...state.loading, [placement]: true },
        }));

        try {
            const ad = await getAdForPlacement(placement);
            set((state) => ({
                ads: { ...state.ads, [placement]: ad },
                loading: { ...state.loading, [placement]: false },
            }));
            return ad;
        } catch (error) {
            console.error(`Failed to fetch ad for ${placement}:`, error);
            set((state) => ({
                loading: { ...state.loading, [placement]: false },
            }));
            return null;
        }
    },

    trackImpression: (adId: string) => {
        const { impressedAdIds } = get();
        if (impressedAdIds.has(adId)) return; // Already tracked this session

        // Add to set
        const newSet = new Set(impressedAdIds);
        newSet.add(adId);
        set({ impressedAdIds: newSet });

        // Fire and forget
        recordImpression(adId);
    },

    trackClick: (adId: string) => {
        // Fire and forget
        recordClick(adId);
    },

    clearAds: () => {
        set({
            ads: {
                welcome_modal: null,
                home_feed: null,
                recipe_detail: null,
                shopping_list: null,
                browse: null,
            },
            impressedAdIds: new Set(),
        });
    },
}));
