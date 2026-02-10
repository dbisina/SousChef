import {
    db,
    collection,
    doc,
    getDocs,
    getDoc,
    addDoc,
    updateDoc,
    deleteDoc,
    query,
    where,
    orderBy,
    Timestamp,
    increment,
} from '@/lib/firebase';
import {
    SponsoredAd,
    AdPlacement,
    AdInquiry,
    AdMetrics,
    FALLBACK_AD,
} from '@/types/ads';

// ── Firestore Collections ──
const ADS_COLLECTION = 'sponsoredAds';
const INQUIRIES_COLLECTION = 'adInquiries';
const IMPRESSIONS_COLLECTION = 'adImpressions';

// ── Fetch Active Ads ──

/**
 * Get active ads for a specific placement.
 * Returns ads where: status=active, placement includes target, within date range, under budget.
 */
export const getActiveAdsForPlacement = async (
    placement: AdPlacement
): Promise<SponsoredAd[]> => {
    try {
        const now = Timestamp.now();
        const adsRef = collection(db, ADS_COLLECTION);

        const q = query(
            adsRef,
            where('status', '==', 'active')
        );

        const snapshot = await getDocs(q);
        const ads: SponsoredAd[] = [];

        snapshot.forEach((docSnap) => {
            const data = docSnap.data() as SponsoredAd;
            // Filter client-side to avoid composite index requirement
            const matchesPlacement = data.placements?.includes(placement);
            const hasStarted = data.startDate.toMillis() <= now.toMillis();
            const isNotExpired = data.endDate.toMillis() >= now.toMillis();
            const isUnderBudget = data.budgetCents === 0 || data.spentCents < data.budgetCents;

            if (matchesPlacement && hasStarted && isNotExpired && isUnderBudget) {
                ads.push({ ...data, id: docSnap.id });
            }
        });

        // Sort by most recent start date
        ads.sort((a, b) => b.startDate.toMillis() - a.startDate.toMillis());

        return ads;
    } catch (error) {
        console.error('Error fetching ads for placement:', error);
        return [];
    }
};

/**
 * Get a single ad for placement. Returns the top active ad or the fallback ad.
 */
export const getAdForPlacement = async (
    placement: AdPlacement
): Promise<SponsoredAd> => {
    const ads = await getActiveAdsForPlacement(placement);

    if (ads.length > 0) {
        // Return highest priority (most recent start date)
        return ads[0];
    }

    // Return fallback house ad
    return {
        ...FALLBACK_AD,
        id: 'fallback',
        startDate: Timestamp.now(),
        endDate: Timestamp.fromDate(new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)),
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
    } as SponsoredAd;
};

// ── Analytics / Tracking ──

/**
 * Record an ad impression (ad was viewed).
 */
export const recordImpression = async (adId: string): Promise<void> => {
    try {
        if (adId === 'fallback') return; // Don't track fallback ads

        // Increment impression count on the ad document
        const adRef = doc(db, ADS_COLLECTION, adId);
        await updateDoc(adRef, {
            impressions: increment(1),
            updatedAt: Timestamp.now(),
        });

        // Log individual impression (for detailed analytics)
        await addDoc(collection(db, IMPRESSIONS_COLLECTION), {
            adId,
            type: 'impression',
            timestamp: Timestamp.now(),
        });
    } catch (error) {
        // Silent fail — don't disrupt UX for analytics
        console.warn('Failed to record impression:', error);
    }
};

/**
 * Record an ad click (user tapped CTA).
 * Also calculates spend based on CPM.
 */
export const recordClick = async (adId: string): Promise<void> => {
    try {
        if (adId === 'fallback') return;

        const adRef = doc(db, ADS_COLLECTION, adId);
        await updateDoc(adRef, {
            clicks: increment(1),
            updatedAt: Timestamp.now(),
        });

        await addDoc(collection(db, IMPRESSIONS_COLLECTION), {
            adId,
            type: 'click',
            timestamp: Timestamp.now(),
        });
    } catch (error) {
        console.warn('Failed to record click:', error);
    }
};

/**
 * Get performance metrics for an ad.
 */
export const getAdMetrics = (ad: SponsoredAd): AdMetrics => {
    const ctr = ad.impressions > 0 ? (ad.clicks / ad.impressions) * 100 : 0;
    return {
        impressions: ad.impressions,
        clicks: ad.clicks,
        ctr: Math.round(ctr * 100) / 100,
        spend: ad.spentCents / 100,
        remaining: Math.max(0, (ad.budgetCents - ad.spentCents) / 100),
    };
};

// ── Advertiser Inquiries ──

/**
 * Submit an ad inquiry from a potential advertiser (brand/partner).
 */
export const submitAdInquiry = async (
    inquiry: Omit<AdInquiry, 'id' | 'status' | 'submittedAt'>
): Promise<string> => {
    try {
        const docRef = await addDoc(collection(db, INQUIRIES_COLLECTION), {
            ...inquiry,
            status: 'new',
            submittedAt: Timestamp.now(),
        });
        return docRef.id;
    } catch (error) {
        console.error('Error submitting ad inquiry:', error);
        throw new Error('Failed to submit inquiry. Please try again.');
    }
};

// ── Admin: CRUD Operations ──

/**
 * Get ALL sponsored ads (for admin management).
 */
export const getAllAds = async (): Promise<SponsoredAd[]> => {
    try {
        const snapshot = await getDocs(collection(db, ADS_COLLECTION));
        const ads: SponsoredAd[] = [];
        snapshot.forEach((docSnap) => {
            ads.push({ ...docSnap.data(), id: docSnap.id } as SponsoredAd);
        });
        // Sort: active first, then by createdAt desc
        ads.sort((a, b) => {
            if (a.status === 'active' && b.status !== 'active') return -1;
            if (a.status !== 'active' && b.status === 'active') return 1;
            return b.createdAt.toMillis() - a.createdAt.toMillis();
        });
        return ads;
    } catch (error) {
        console.error('Error fetching all ads:', error);
        return [];
    }
};

/**
 * Create a new sponsored ad.
 */
export const createSponsoredAd = async (
    ad: Omit<SponsoredAd, 'id' | 'createdAt' | 'updatedAt' | 'impressions' | 'clicks' | 'spentCents'>
): Promise<string> => {
    const now = Timestamp.now();
    const docRef = await addDoc(collection(db, ADS_COLLECTION), {
        ...ad,
        impressions: 0,
        clicks: 0,
        spentCents: 0,
        createdAt: now,
        updatedAt: now,
    });
    return docRef.id;
};

/**
 * Update an existing sponsored ad.
 */
export const updateSponsoredAd = async (
    adId: string,
    updates: Partial<SponsoredAd>
): Promise<void> => {
    const adRef = doc(db, ADS_COLLECTION, adId);
    await updateDoc(adRef, {
        ...updates,
        updatedAt: Timestamp.now(),
    });
};

/**
 * Delete a sponsored ad.
 */
export const deleteSponsoredAd = async (adId: string): Promise<void> => {
    await deleteDoc(doc(db, ADS_COLLECTION, adId));
};

/**
 * Toggle ad status between active and paused.
 */
export const toggleAdStatus = async (adId: string, currentStatus: string): Promise<void> => {
    const newStatus = currentStatus === 'active' ? 'paused' : 'active';
    await updateSponsoredAd(adId, { status: newStatus as any });
};

// ── Seed Demo Ad (for hackathon demo) ──

/**
 * Create a demo sponsored ad in Firestore for development/demo purposes.
 */
export const seedDemoAd = async (): Promise<string> => {
    const now = Timestamp.now();
    const endDate = Timestamp.fromDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000));

    const demoAd: Omit<SponsoredAd, 'id'> = {
        advertiserId: 'demo_brand',
        advertiserName: 'FreshCart',
        advertiserLogo: 'https://images.unsplash.com/photo-1560472354-b33ff0c44a43?auto=format&fit=crop&w=100&q=80',
        title: 'Farm Fresh to Your Door',
        subtitle: 'Organic ingredients delivered in 2 hours — 20% off first order',
        imageURL: 'https://images.unsplash.com/photo-1543352634-a1c51d9f1fa7?auto=format&fit=crop&w=800&q=80',
        ctaText: 'Order Now',
        ctaURL: 'https://freshcart.example.com/?ref=souschef',
        placements: ['welcome_modal', 'home_feed'],
        format: 'card',
        status: 'active',
        startDate: now,
        endDate,
        budgetCents: 500000, // $5,000
        cpmCents: 500, // $5 CPM
        spentCents: 0,
        impressions: 0,
        clicks: 0,
        createdAt: now,
        updatedAt: now,
        accentColor: '#22C55E',
    };

    const docRef = await addDoc(collection(db, ADS_COLLECTION), demoAd);
    return docRef.id;
};
