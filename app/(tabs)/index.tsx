import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SAMPLE } from '@/assets/sample';
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
import { HomeHeader, LinkBar, StoriesRow, TonightCard } from '@/components/feed/HomeTop';
import {
  ChallengeCard,
  FriendPost,
  GlucoseReminder,
  ImportedCard,
  MadeYourRecipe,
  MysteryCard,
  PlanShare,
  ReelsRow,
  SponsoredDish,
  type ImportedCardData,
  type PlanCardData,
} from '@/components/feed/HomeFeed';
import type { MealType } from '@/types/mealplan';
import { ME_ID } from '@/types/social';

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

const MEAL_FALLBACK: Record<MealType, keyof typeof SAMPLE> = {
  breakfast: 'toast',
  lunch: 'bowl',
  dinner: 'salmon',
  snack: 'brownie',
};

const photoFor = (imageURL: string | undefined, type: MealType): PhotoSource =>
  imageURL ? { uri: imageURL } : (SAMPLE[MEAL_FALLBACK[type]] as PhotoSource);

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

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      user ? fetchWantToCookItems(user.id) : Promise.resolve(),
      user ? fetchCurrentPlan(user.id) : Promise.resolve(),
    ]);
    setRefreshing(false);
  };

  // Tonight: today's dinner from the real plan, else a sample card.
  const tonightMeal = currentPlan?.days.find((d) => d.date === todayKey())?.dinner;
  const tonight = tonightMeal
    ? {
        title: tonightMeal.recipeName,
        sub: t('home.tonightServes', 'Serves {{n}}', { n: tonightMeal.servings }),
        photo: photoFor(tonightMeal.imageURL, 'dinner'),
        preview: false,
        href: `/recipe/${tonightMeal.recipeId}`,
      }
    : {
        title: t('home.sampleTonightTitle', 'Herb salmon with broccoli'),
        sub: t('home.sampleTonightSub', '25 min · you have 5 of 6'),
        photo: SAMPLE.salmon as PhotoSource,
        preview: true,
        href: '/(tabs)/mealplan',
      };

  // Imported by you: newest saved import, else a sample card.
  const imported: ImportedCardData & { href: string } = useMemo(() => {
    const items = wantToCookItems
      .filter((i) => i.status === 'saved' && i.importedRecipe)
      .sort((a, b) => safeTimestampMillis(b.savedAt) - safeTimestampMillis(a.savedAt));
    const item = items[0];
    const r = item?.importedRecipe;
    if (item && r) {
      const key = (r.sourcePlatform ?? '').toLowerCase();
      const minutes = (r.prepTime ?? 0) + (r.cookTime ?? 0);
      return {
        id: item.id,
        title: r.title,
        platform: PLATFORMS[key] ?? (key ? key.charAt(0).toUpperCase() + key.slice(1) : t('home.link', 'Link')),
        minutes: minutes > 0 ? minutes : undefined,
        photo: r.imageURL ? { uri: r.imageURL } : (SAMPLE.tacos2 as PhotoSource),
        href: `/imported-recipe/${item.id}`,
      };
    }
    return {
      id: 'sample-import',
      title: t('home.sampleImportTitle', 'Chickpea avocado tacos'),
      platform: 'TikTok',
      minutes: 20,
      photo: SAMPLE.tacos2 as PhotoSource,
      preview: true,
      href: '/import',
    };
  }, [wantToCookItems, t]);

  // Plan carousel: the real plan when one exists, else a friend's sample plan.
  const planCards: PlanCardData[] = useMemo(() => {
    const real = (currentPlan?.days ?? [])
      .map((d) => {
        const type: MealType | undefined = d.dinner ? 'dinner' : d.lunch ? 'lunch' : d.breakfast ? 'breakfast' : undefined;
        const meal = type ? d[type] : undefined;
        return type && meal
          ? { key: d.date, day: weekday(d.date), title: meal.recipeName, photo: photoFor(meal.imageURL, type) }
          : null;
      })
      .filter((c): c is PlanCardData => c !== null)
      .slice(0, 5);
    if (real.length > 0) return real;
    return [
      { key: 'mon', day: t('home.mon', 'Mon'), title: t('home.sampleEggToast', 'Egg toast'), photo: SAMPLE.toast as PhotoSource },
      { key: 'tue', day: t('home.tue', 'Tue'), title: t('home.sampleSalmonBowl', 'Salmon bowl'), photo: SAMPLE.powerbowl as PhotoSource },
      { key: 'wed', day: t('home.wed', 'Wed'), title: t('home.sampleChickenSalad', 'Chicken salad'), photo: SAMPLE.salad as PhotoSource },
    ];
  }, [currentPlan, t]);
  const planIsReal = (currentPlan?.days ?? []).some((d) => d.breakfast || d.lunch || d.dinner);

  const friendPost = posts.find((p) => p.kind === 'recipe');
  const madePost = posts.find((p) => p.kind === 'made-this' && !p.communityId && p.authorId !== ME_ID);

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
      />
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, gap: 22, paddingBottom: 130 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={accent} />}
      >
        <LinkBar onPress={() => go('/import')} />
        {FEATURES.feed ? <StoriesRow onOpen={(id) => go(`/story/${id}`)} onAdd={() => go('/post/new')} /> : null}
        <TonightCard title={tonight.title} sub={tonight.sub} photo={tonight.photo} preview={tonight.preview} onPress={() => go(tonight.href)} />
        {FEATURES.feed && friendPost ? <FriendPost postId={friendPost.id} /> : null}
        {FEATURES.feed ? <ReelsRow /> : null}
        <ImportedCard item={imported} onPress={() => go(imported.href)} />
        <PlanShare shared={!planIsReal} cards={planCards} onUse={() => go('/(tabs)/mealplan')} />
        {FEATURES.ordering ? <SponsoredDish /> : null}
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
