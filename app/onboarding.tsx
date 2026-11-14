import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, Image, Pressable, Text as RNText, View, useWindowDimensions, type ViewToken } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  CtaBar,
  Dim,
  Dots,
  FONT,
  Glass,
  H1,
  Muted,
  Screen,
  Tag,
  UButton,
  UIconButton,
  type IconName,
} from '@/components/ui';
import { SAMPLE } from '@/assets/sample';
import { FIXED, TOKEN_HEX } from '@/stores/themeStore';
import { isDesignReview } from '@/lib/designReview';

const ONBOARDING_KEY = '@souschef_onboarding_complete';

// Check if onboarding has been completed (used by useAuth for routing)
export const isOnboardingComplete = async (): Promise<boolean> => {
  try {
    const value = await AsyncStorage.getItem(ONBOARDING_KEY);
    return value === 'true';
  } catch {
    return false;
  }
};

const HERO_HEIGHT = 560;

/** Design-review only: `?slide=1|2` opens a later slide so the harness can compare Onboarding2/3. */
const reviewStartSlide = (): number => {
  if (!isDesignReview || typeof window === 'undefined' || !window.location) return 0;
  try {
    const n = Number(new URLSearchParams(window.location.search).get('slide'));
    return Number.isInteger(n) && n > 0 && n < 3 ? n : 0;
  } catch {
    return 0;
  }
};

interface Chip {
  icon: IconName;
  key: string;
  text: string;
  top: number;
  left?: number;
  right?: number;
}

interface Slide {
  id: string;
  photo: number;
  alt: string;
  chips: Chip[];
}

const SLIDES: Slide[] = [
  {
    id: '1',
    photo: SAMPLE.pasta,
    alt: 'A bowl of tagliatelle on a wooden table',
    chips: [
      { icon: 'play', key: 'tiktok', text: 'TikTok', top: 170, left: 22 },
      { icon: 'link', key: 'youtube', text: 'YouTube link', top: 250, right: 22 },
      { icon: 'camera', key: 'cookbook', text: 'Cookbook page', top: 340, left: 60 },
    ],
  },
  {
    id: '2',
    photo: SAMPLE.grocery,
    alt: 'A mesh bag of fresh produce',
    chips: [
      { icon: 'cart', key: 'shopping', text: 'Auto shopping list', top: 180, right: 22 },
      { icon: 'check', key: 'pantry', text: 'Pantry match', top: 262, left: 22 },
      { icon: 'bell', key: 'expiry', text: 'Expiry alerts', top: 350, right: 44 },
    ],
  },
  {
    id: '3',
    photo: SAMPLE.chef,
    alt: 'A woman cooking at a kitchen island',
    chips: [
      { icon: 'mic', key: 'next', text: '“Next step”', top: 170, left: 22 },
      { icon: 'clock', key: 'timer', text: 'Set a 5 min timer', top: 262, right: 22 },
      { icon: 'refresh', key: 'swap', text: 'Swap the cream', top: 350, left: 40 },
    ],
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  // This component renders the forced-dark <Screen>, so it sits above that ToneScope: useTokens() here
  // would return the app theme (light) and turn the Skip label and photo fade white. Use the dark table.
  const tokens = TOKEN_HEX.dark;
  const { width } = useWindowDimensions();
  const listRef = useRef<FlatList<Slide>>(null);
  const startSlide = useRef(reviewStartSlide()).current;
  const [index, setIndex] = useState(startSlide);

  useEffect(() => {
    if (startSlide > 0) {
      const id = setTimeout(() => listRef.current?.scrollToOffset({ offset: width * startSlide, animated: false }), 60);
      return () => clearTimeout(id);
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onViewableItemsChanged = useCallback(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const first = viewableItems[0];
    if (first && first.index !== null) setIndex(first.index);
  }, []);
  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  const completeOnboarding = async () => {
    try {
      await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
    } catch {
      // silently continue
    }
    router.replace('/auth/login');
  };

  const goTo = (i: number) => listRef.current?.scrollToIndex({ index: i, animated: true });

  const goNext = () => {
    if (index < SLIDES.length - 1) goTo(index + 1);
    else completeOnboarding();
  };

  const copy = [
    {
      l1: t('welcome.s1.line1', 'Import recipes'),
      l2: t('welcome.s1.line2', 'from anywhere'),
      body: t(
        'welcome.s1.body',
        'Paste a link or snap a cookbook page. SousChef turns it into ingredients, steps and timers.'
      ),
    },
    {
      l1: t('welcome.s2.line1', 'Smart pantry'),
      l2: t('welcome.s2.line2', '& shopping'),
      body: t(
        'welcome.s2.body',
        'Know what you have, what is about to expire and exactly what to buy this week.'
      ),
    },
    {
      l1: t('welcome.s3.line1', 'Cook hands-free'),
      l2: t('welcome.s3.line2', 'with your voice'),
      body: t(
        'welcome.s3.body',
        'Say “next step” or “set a timer” and keep your hands on the food, not the screen.'
      ),
    },
  ];

  const chipLabels: Record<string, string> = {
    tiktok: t('welcome.s1.chipTiktok', 'TikTok'),
    youtube: t('welcome.s1.chipYoutube', 'YouTube link'),
    cookbook: t('welcome.s1.chipCookbook', 'Cookbook page'),
    shopping: t('welcome.s2.chipShopping', 'Auto shopping list'),
    pantry: t('welcome.s2.chipPantry', 'Pantry match'),
    expiry: t('welcome.s2.chipExpiry', 'Expiry alerts'),
    next: t('welcome.s3.chipNext', '“Next step”'),
    timer: t('welcome.s3.chipTimer', 'Set a 5 min timer'),
    swap: t('welcome.s3.chipSwap', 'Swap the cream'),
  };

  const skipLabel = t('welcome.skip', 'Skip');
  const headerTop = Math.max(insets.top, 20) + 14;

  const renderSlide = ({ item, index: i }: { item: Slide; index: number }) => (
    <View style={{ width, flex: 1 }}>
      <View style={{ height: HERO_HEIGHT, backgroundColor: tokens.ground }}>
        <Image
          source={item.photo}
          accessibilityLabel={item.alt}
          resizeMode="cover"
          style={{ width: '100%', height: '100%' }}
        />
        <LinearGradient
          pointerEvents="none"
          colors={[`${tokens.ground}00`, tokens.ground]}
          locations={[0, 0.82]}
          style={{ position: 'absolute', left: 0, right: 0, bottom: -2, height: 300 }}
        />
        {item.chips.map((c) => (
          <View key={c.key} style={{ position: 'absolute', top: c.top, left: c.left, right: c.right }}>
            <Tag tone="glass" large icon={c.icon} label={chipLabels[c.key] ?? c.text} />
          </View>
        ))}
      </View>
      <View style={{ paddingHorizontal: 24, gap: 14, marginTop: -70 }}>
        <H1 style={{ fontSize: 40, lineHeight: 43, letterSpacing: -1.2 }}>
          <Dim>{copy[i].l1}</Dim>
          {'\n'}
          {copy[i].l2}
        </H1>
        <Muted style={{ fontSize: 15, lineHeight: 22 }}>{copy[i].body}</Muted>
      </View>
    </View>
  );

  return (
    <Screen tone="dark" bare>
      <FlatList
        ref={listRef}
        data={SLIDES}
        renderItem={renderSlide}
        keyExtractor={(s) => s.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        bounces={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
      />

      <View
        pointerEvents="box-none"
        style={{
          position: 'absolute',
          top: 0,
          left: 20,
          right: 20,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingTop: headerTop,
        }}
      >
        {index === 0 ? (
          <View className="flex-row items-center" style={{ gap: 10 }}>
            <Image
              source={require('../assets/icon.png')}
              accessibilityLabel=""
              style={{ width: 38, height: 38, borderRadius: 12 }}
            />
            <RNText style={{ fontFamily: FONT.display, fontSize: 18, color: FIXED.paper }}>SousChef</RNText>
          </View>
        ) : (
          <UIconButton
            icon="back"
            tone="glassDark"
            label={t('welcome.back', 'Back')}
            onPress={() => goTo(index - 1)}
          />
        )}
        <Pressable accessibilityRole="button" accessibilityLabel={skipLabel} onPress={completeOnboarding} hitSlop={4}>
          <Glass dark style={{ height: 42, borderRadius: 21, paddingHorizontal: 18, justifyContent: 'center' }}>
            <RNText style={{ fontFamily: FONT.sansMedium, fontSize: 13, color: FIXED.paper }}>{skipLabel}</RNText>
          </Glass>
        </Pressable>
      </View>

      <CtaBar>
        <View className="flex-row items-center justify-between">
          <Dots count={SLIDES.length} index={index} />
          <UButton
            variant="accent"
            label={
              index === SLIDES.length - 1
                ? t('welcome.getStarted', 'Get started')
                : t('welcome.next', 'Next')
            }
            trailingIcon="arrowRight"
            onPress={goNext}
            style={{ alignSelf: 'auto', paddingStart: 26, paddingEnd: 6 }}
          />
        </View>
      </CtaBar>
    </Screen>
  );
}
