import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, RefreshControl, ScrollView, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/authStore';
import { useMealPlanStore } from '@/stores/mealPlanStore';
import { useWantToCookStore, safeTimestampMillis } from '@/stores/wantToCookStore';
import { useShareIntentStore } from '@/stores/shareIntentStore';
import { useMessageStore, selectUnreadTotal } from '@/stores/messageStore';
import { latestGlucose, readingStatus, useHealthStore } from '@/stores/healthStore';
import { useSocialStore } from '@/stores/socialStore';
import { useSubscription } from '@/hooks/useSubscription';
import { getTierFeatures } from '@/services/subscriptionService';
import { FEATURES } from '@/constants/features';
import { ListRow, Rows, Screen, SponsoredAdCard, WelcomeModal, useColor, type PhotoSource } from '@/components/ui';
import { isDesignReview } from '@/lib/designReview';
import { HomeHeader, StoriesRow, TonightCard } from '@/components/feed/HomeTop';
import {
  ChallengeCard,
  ForYouList,
  GlucoseReminder,
  ImportedCard,
  MadeYourRecipe,
  MysteryCard,
  PlanShare,
  SpoolsRow,
  type ImportedCardData,
  type PlanCardData,
} from '@/components/feed/HomeFeed';
import type { MealType } from '@/types/mealplan';
import { ME_ID } from '@/types/social';
import * as ImagePicker from 'expo-image-picker';
import { TonightCard as AiTonightCard } from '@/components/ai/AiKitchen';
import { apiEnabled } from '@/lib/api';
import { BecauseYouCooked } from '@/components/recipe/BecauseYouCooked';
import { feedReporter, reportFeedEvent } from '@/lib/feedEvents';
import { ViewTracker } from '@/lib/viewTracker';
import { apiFeedPreferences } from '@/services/socialApi';
import { showErrorToast, showSuccessToast } from '@/stores/toastStore';

const todayKey = () => {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
};

const PLATFORMS: Record<string, string> = {
  tiktok: 'TikTok',
  instagram: 'Instagram',
  youtube: 'YouTube',
  website: 'Website',
};

const photoFor = (imageURL: string | undefined): PhotoSource | null => (imageURL ? { uri: imageURL } : null);

const weekday = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1).toLocaleDateString(undefined, { weekday: 'short' });
};

export default function HomeScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const accent = useColor('accent');
  const { user, isGuest } = useAuthStore();
  const currentPlan = useMealPlanStore((s) => s.currentPlan);
  const fetchCurrentPlan = useMealPlanStore((s) => s.fetchCurrentPlan);
  const wantToCookItems = useWantToCookStore((s) => s.items);
  const fetchWantToCookItems = useWantToCookStore((s) => s.fetchWantToCookItems);
  const { sharedURL, consumeSharedURL } = useShareIntentStore();
  const unread = useMessageStore(selectUnreadTotal);
  const readings = useHealthStore((s) => s.readings);
  const posts = useSocialStore((s) => s.posts);
  const { subscriptionTier } = useSubscription();
  const adFree = getTierFeatures(subscriptionTier).adFree;
  const [refreshing, setRefreshing] = useState(false);

  const go = useCallback((href: string) => router.push(href as Href), [router]);

  // Server mode: "Your plate" shares a photo as a story straight away (gone after 24 hours).
  const addStory = useCallback(async () => {
    const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 });
    const uri = !picked.canceled ? picked.assets[0]?.uri : undefined;
    if (!uri) return;
    if (await useSocialStore.getState().postStory(uri)) showSuccessToast('Your story is up for 24 hours.');
    else showErrorToast('We could not post your story. Please try again.');
  }, []);

  // Send first-time users to onboarding.
  useEffect(() => {
    if (isDesignReview) return; // review mode renders every route directly
    const checkOnboarding = async () => {
      try {
        const completed = await AsyncStorage.getItem('@souschef_onboarding_complete');
        if (completed !== 'true') {
          router.replace('/onboarding');
        }
      } catch (e) {
        console.error('Failed to check onboarding status:', e);
      }
    };
    checkOnboarding();
    // Runs once on mount, like the original screen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A URL shared into the app opens the import screen with the link pre-filled.
  useEffect(() => {
    if (sharedURL) {
      const url = consumeSharedURL();
      if (url) router.push({ pathname: '/import', params: { url } });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sharedURL]);

  useEffect(() => {
    if (user && !isGuest) {
      fetchWantToCookItems(user.id);
    } else {
      // Clear stale items from a previous user session for guests / logged-out.
      useWantToCookStore.setState({ items: [] });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    if (user && !currentPlan) {
      fetchCurrentPlan(user.id);
    }
  }, [user, currentPlan, fetchCurrentPlan]);

  // The feed, stories and who you follow come from the server: fetch them fresh whenever home opens for a signed-in person.
  const meId = user?.id;
  useEffect(() => {
    if (apiEnabled() && meId) void useSocialStore.getState().loadFromServer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meId, isGuest]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      apiEnabled() && user ? useSocialStore.getState().loadFromServer() : Promise.resolve(),
      user ? fetchWantToCookItems(user.id) : Promise.resolve(),
      user ? fetchCurrentPlan(user.id) : Promise.resolve(),
    ]);
    setRefreshing(false);
  };

  // Tonight: today's dinner from the real plan. Without one the home screen offers the AI "what can I cook tonight" card.
  const tonightMeal = currentPlan?.days.find((d) => d.date === todayKey())?.dinner;
  const tonight = tonightMeal
    ? {
        title: tonightMeal.recipeName,
        sub: t('home.tonightServes', 'Serves {{n}}', { n: tonightMeal.servings }),
        photo: photoFor(tonightMeal.imageURL),
        href: `/recipe/${tonightMeal.recipeId}`,
      }
    : null;

  // Imported by you: the newest saved import, if there is one.
  const imported: (ImportedCardData & { href: string }) | null = useMemo(() => {
    const items = wantToCookItems
      .filter((i) => i.status === 'saved' && i.importedRecipe)
      .sort((a, b) => safeTimestampMillis(b.savedAt) - safeTimestampMillis(a.savedAt));
    const item = items[0];
    const r = item?.importedRecipe;
    if (!item || !r) return null;
    const key = (r.sourcePlatform ?? '').toLowerCase();
    const minutes = (r.prepTime ?? 0) + (r.cookTime ?? 0);
    return {
      id: item.id,
      title: r.title,
      platform: PLATFORMS[key] ?? (key ? key.charAt(0).toUpperCase() + key.slice(1) : t('home.link', 'Link')),
      minutes: minutes > 0 ? minutes : undefined,
      photo: r.imageURL ? { uri: r.imageURL } : null,
      href: `/imported-recipe/${item.id}`,
    };
  }, [wantToCookItems, t]);

  // Plan carousel: the days of the real plan.
  const planCards: PlanCardData[] = useMemo(
    () =>
      (currentPlan?.days ?? [])
        .map((d): PlanCardData | null => {
          const type: MealType | undefined = d.dinner ? 'dinner' : d.lunch ? 'lunch' : d.breakfast ? 'breakfast' : undefined;
          const meal = type ? d[type] : undefined;
          return type && meal ? { key: d.date, day: weekday(d.date), title: meal.recipeName, photo: photoFor(meal.imageURL) } : null;
        })
        .filter((c): c is PlanCardData => c !== null)
        .slice(0, 5),
    [currentPlan],
  );
  const planIsReal = (currentPlan?.days ?? []).some((d) => d.breakfast || d.lunch || d.dinner);

  const forYouIds = useSocialStore((st) => st.forYouIds);
  const madePost = posts.find((p) => p.kind === 'made-this' && !p.communityId && p.authorId !== ME_ID);
  // The server's own order for this person (best first); without a server, or before it has answered, the newest recipe post.
  const rankedIds = useMemo(() => {
    const byId = new Map(posts.map((p) => [p.id, p]));
    const picked = forYouIds.filter((id) => {
      const p = byId.get(id);
      return !!p && p.id !== madePost?.id && !p.communityId && p.authorId !== ME_ID;
    });
    if (picked.length > 0) return picked.slice(0, 12);
    const newest = posts.find((p) => p.kind === 'recipe');
    return newest ? [newest.id] : [];
  }, [forYouIds, posts, madePost?.id]);

  // What was on screen and for how long, reported in the background so the feed can learn.
  const tracker = useRef(new ViewTracker(reportFeedEvent)).current;
  const scrollState = useRef({ offset: 0, viewport: 0 });
  const listTop = useRef(0);
  const cards = useRef(new Map<string, { y: number; h: number }>());
  const placeCards = useCallback(() => {
    for (const [id, c] of cards.current) tracker.layout(id, listTop.current + c.y, c.h);
    if (scrollState.current.viewport > 0) tracker.update(scrollState.current.offset, scrollState.current.viewport, Date.now());
  }, [tracker]);
  const onCardLayout = useCallback(
    (id: string, y: number, h: number) => {
      cards.current.set(id, { y, h });
      placeCards();
    },
    [placeCards],
  );
  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      scrollState.current = { offset: e.nativeEvent.contentOffset.y, viewport: e.nativeEvent.layoutMeasurement.height };
      tracker.update(scrollState.current.offset, scrollState.current.viewport, Date.now());
    },
    [tracker],
  );
  const closeOut = useCallback(() => {
    tracker.stop(Date.now());
    void feedReporter.flush();
  }, [tracker]);
  useFocusEffect(useCallback(() => closeOut, [closeOut]));
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') closeOut();
    });
    return () => sub.remove();
  }, [closeOut]);
  // Learning is on unless the person turned it off in settings.
  useEffect(() => {
    if (!apiEnabled()) return;
    if (isGuest) {
      feedReporter.setEnabled(false); // nothing to learn from without an account
      return;
    }
    apiFeedPreferences()
      .then((p) => feedReporter.setEnabled(p.personalised))
      .catch(() => undefined);
  }, [isGuest]);

  const latest = useMemo(() => latestGlucose(readings), [readings]);
  const latestLine = latest
    ? t('home.glucoseLatest', 'Last reading {{value}} mmol/L · {{status}}', {
        value: latest.mmol,
        status:
          readingStatus(latest) === 'in-range'
            ? t('home.inRange', 'in range')
            : readingStatus(latest) === 'high'
              ? t('home.high', 'high')
              : t('home.low', 'low'),
      })
    : undefined;

  return (
    <Screen bare>
      <WelcomeModal />
      <HomeHeader
        unread={unread}
        onSearch={() => go('/(tabs)/browse')}
        onNotifications={() => go('/settings/notifications')}
        onMessages={() => go('/messages')}
        onAdd={() => go('/import')}
      />
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, gap: 22, paddingBottom: 130 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        onScroll={onScroll}
        scrollEventThrottle={120}
        onLayout={(e) => { scrollState.current.viewport = e.nativeEvent.layout.height; placeCards(); }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={accent} />}
      >
        {FEATURES.feed ? <StoriesRow onOpen={(id) => go(`/story/${id}`)} onAdd={apiEnabled() ? () => void addStory() : () => go('/post/new')} /> : null}
        {tonight ? <TonightCard title={tonight.title} sub={tonight.sub} photo={tonight.photo} onPress={() => go(tonight.href)} /> : null}
        {FEATURES.feed && rankedIds.length > 0 ? (
          <View onLayout={(e) => { listTop.current = e.nativeEvent.layout.y; placeCards(); }}>
            <ForYouList postIds={rankedIds} onCardLayout={onCardLayout} />
          </View>
        ) : null}
        {FEATURES.feed ? <SpoolsRow /> : null}
        {FEATURES.feed ? <BecauseYouCooked signedIn={!isGuest} /> : null}
        {!isGuest ? <AiTonightCard /> : null}
        {imported ? <ImportedCard item={imported} onPress={() => go(imported.href)} /> : null}
        {planIsReal ? <PlanShare cards={planCards} onUse={() => go('/(tabs)/mealplan')} /> : null}
        {FEATURES.feed ? <ChallengeCard /> : null}
        {FEATURES.feed && madePost ? <MadeYourRecipe postId={madePost.id} /> : null}
        {FEATURES.play ? <MysteryCard /> : null}
        {FEATURES.health ? <GlucoseReminder latestLine={latestLine} onPress={() => go('/health/log')} /> : null}
        {!adFree ? <SponsoredAdCard placement="home_feed" compact /> : null}
        {isGuest ? (
          <Rows box>
            <ListRow
              icon="user"
              title={t('home.guestTitle', 'Create an account to sync & save')}
              subtitle={t('home.guestSub', 'Your recipes are local until you sign up')}
              onPress={() => go('/auth/login')}
            />
          </Rows>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
