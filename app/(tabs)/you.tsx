import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text as RNText, View, useWindowDimensions } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { SAMPLE } from '@/assets/sample';
import {
  AvatarStack,
  Display,
  Icon,
  Muted,
  PhotoCard,
  Screen,
  Segmented,
  Tag,
  UAvatar,
  UButton,
  UIconButton,
  type IconName,
  type PhotoSource,
} from '@/components/ui';
import { FONT } from '@/components/ui/fonts';
import { CURRENT_USER } from '@/data/sample/social';
import { useAuthStore } from '@/stores/authStore';
import { useGamificationStore } from '@/stores/gamificationStore';
import { latestGlucose, readingStatus, useHealthStore } from '@/stores/healthStore';
import { useOrderStore } from '@/stores/orderStore';
import { useRecipeStore } from '@/stores/recipeStore';
import { useSocialStore } from '@/stores/socialStore';
import { compactCount } from '@/lib/timeAgo';
import { FEATURES } from '@/constants/features';
import { photoOf, shareText } from '@/components/feed/shared';
import type { Recipe } from '@/types';
import { ME_ID } from '@/types/social';

type ProfileTab = 'posts' | 'recipes' | 'saved';

interface Quick {
  key: string;
  title: string;
  subtitle?: string;
  leading: React.ReactNode;
  onPress: () => void;
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View className="flex-row items-baseline" style={{ gap: 4 }}>
      <RNText className="text-ink" style={{ fontFamily: FONT.display, fontSize: 15 }}>
        {value}
      </RNText>
      <RNText className="text-muted" style={{ fontFamily: FONT.sans, fontSize: 12 }}>
        {label}
      </RNText>
    </View>
  );
}

export default function YouScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const user = useAuthStore((s) => s.user);
  const fetchUserRecipes = useRecipeStore((s) => s.fetchUserRecipes);
  const streak = useGamificationStore((s) => s.streak.currentStreak);
  const readings = useHealthStore((s) => s.readings);
  const orders = useOrderStore((s) => s.orders);
  const posts = useSocialStore((s) => s.posts);
  const communities = useSocialStore((s) => s.communities);
  const joinedIds = useSocialStore((s) => s.joinedCommunityIds);
  const savedPostIds = useSocialStore((s) => s.savedPostIds);

  const [tab, setTab] = useState<ProfileTab>('posts');
  const [myRecipes, setMyRecipes] = useState<Recipe[]>([]);

  useEffect(() => {
    if (!user) {
      setMyRecipes([]);
      return;
    }
    let live = true;
    fetchUserRecipes(user.id)
      .then((list) => {
        if (live) setMyRecipes(list);
      })
      .catch(() => {
        if (live) setMyRecipes([]);
      });
    return () => {
      live = false;
    };
  }, [user, fetchUserRecipes]);

  const go = (href: string) => router.push(href as Href);
  const name = user?.displayName || CURRENT_USER.displayName;
  const handle = user?.email ? user.email.split('@')[0] : CURRENT_USER.handle;
  const avatar: PhotoSource = user?.photoURL ? { uri: user.photoURL } : (SAMPLE.chef as PhotoSource);
  const recipeCount = Math.max(myRecipes.length, user?.recipeCount ?? 0);

  const myPosts = useMemo(() => posts.filter((p) => p.authorId === ME_ID), [posts]);
  const savedPosts = useMemo(() => posts.filter((p) => savedPostIds.includes(p.id)), [posts, savedPostIds]);

  const latest = useMemo(() => latestGlucose(readings), [readings]);
  const healthLine = latest
    ? t('you.healthLatest', '{{status}} · {{value}} mmol/L', {
        status:
          readingStatus(latest) === 'in-range'
            ? t('you.inRange', 'In range')
            : readingStatus(latest) === 'high'
              ? t('you.high', 'High')
              : t('you.low', 'Low'),
        value: latest.mmol,
      })
    : t('you.healthEmpty', 'Log a reading');

  const lastOrder = useMemo(
    () => [...orders].sort((a, b) => b.placedAt.localeCompare(a.placedAt))[0],
    [orders],
  );
  const communityTarget = joinedIds[0] ?? communities[0]?.id;

  const quick: Quick[] = [];
  if (FEATURES.health) {
    quick.push({
      key: 'health',
      title: t('you.health', 'Health'),
      subtitle: healthLine,
      leading: (
        <View className="items-center justify-center bg-accent" style={{ width: 36, height: 36, borderRadius: 18 }}>
          <Icon name="drop" size="sm" color="accent-ink" />
        </View>
      ),
      onPress: () => go('/health'),
    });
  }
  if (FEATURES.feed && communityTarget) {
    quick.push({
      key: 'communities',
      title:
        joinedIds.length > 0
          ? t('you.communities', '{{n}} communities', { n: joinedIds.length })
          : t('you.communitiesNone', 'Communities'),
      leading: <AvatarStack people={[SAMPLE.p_woman, SAMPLE.p_man].map((s, i) => ({ name: `c${i}`, source: s as PhotoSource }))} size={30} max={2} />,
      onPress: () => go(`/community/${communityTarget}`),
    });
  }
  if (FEATURES.ordering) {
    quick.push({
      key: 'orders',
      title: t('you.orders', 'Orders'),
      subtitle: lastOrder ? lastOrder.status : undefined,
      leading: (
        <View className="items-center justify-center bg-ground" style={{ width: 36, height: 36, borderRadius: 18 }}>
          <Icon name="bag" size="sm" />
        </View>
      ),
      onPress: () => go(lastOrder ? `/order/${lastOrder.id}` : '/restaurant/smash'),
    });
  }

  const tile = (width - 8) / 3;
  const grid: { key: string; source: PhotoSource; label: string; href: string }[] =
    tab === 'recipes'
      ? myRecipes
          .filter((r) => r.imageURL)
          .map((r) => ({ key: r.id, source: { uri: r.imageURL } as PhotoSource, label: r.title, href: `/recipe/${r.id}` }))
      : (tab === 'posts' ? myPosts : savedPosts).map((p) => ({
          key: p.id,
          source: photoOf(p.photo),
          label: p.title,
          href: `/post/${p.id}`,
        }));

  const emptyText =
    tab === 'posts'
      ? t('you.emptyPosts', 'Share your first dish with friends.')
      : tab === 'recipes'
        ? t('you.emptyRecipes', 'Recipes you write or upload show up here.')
        : t('you.emptySaved', 'Posts you save show up here.');

  return (
    <Screen bare>
      <ScrollView contentContainerStyle={{ paddingBottom: 130 }} showsVerticalScrollIndicator={false}>
        <PhotoCard source={SAMPLE.veg} height={200} radius={0} fade="both">
          <View
            className="flex-row items-center justify-between"
            style={{ position: 'absolute', top: Math.max(insets.top, 20) + 14, left: 20, right: 20 }}
          >
            <Tag tone="glassDark" large label={`@${handle}`} />
            <View className="flex-row" style={{ gap: 8 }}>
              <UIconButton tone="glassDark" icon="send" label={t('you.messages', 'Messages')} onPress={() => go('/messages')} />
              <UIconButton tone="glassDark" icon="settings" label={t('you.settings', 'Settings')} onPress={() => go('/(tabs)/profile')} />
            </View>
          </View>
        </PhotoCard>

        <View style={{ paddingHorizontal: 20, gap: 14, marginTop: -46 }}>
          <View className="flex-row justify-between" style={{ alignItems: 'flex-end' }}>
            <View className="bg-ground" style={{ padding: 4, borderRadius: 50 }}>
              <UAvatar source={avatar} name={name} size={92} />
            </View>
            <View className="flex-row items-center" style={{ gap: 8 }}>
              <UButton size="sm" variant="ghost" label={t('you.editProfile', 'Edit profile')} onPress={() => go('/settings/edit-profile')} />
              <UIconButton icon="share" label={t('you.shareProfile', 'Share profile')} onPress={() => shareText(`${name} on SousChef`)} />
            </View>
          </View>

          <View style={{ gap: 2 }}>
            <Display size={24} numberOfLines={1}>
              {name}
            </Display>
            {user?.bio ? <Muted>{user.bio}</Muted> : null}
          </View>

          <View className="flex-row items-center justify-between" style={{ gap: 10 }}>
            <Stat value={compactCount(recipeCount)} label={t('you.recipes', 'recipes')} />
            <Stat value={compactCount(user?.followers?.length ?? 0)} label={t('you.followers', 'followers')} />
            <Stat value={compactCount(user?.following?.length ?? 0)} label={t('you.following', 'following')} />
            {streak > 0 ? <Tag tone="o" icon="flame" label={t('you.streak', '{{n}}-day streak', { n: streak })} /> : null}
          </View>

          {quick.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ flexGrow: 0, marginRight: -20 }}
              contentContainerStyle={{ gap: 10, paddingRight: 20 }}
            >
              {quick.map((q) => (
                <Pressable
                  key={q.key}
                  accessibilityRole="button"
                  accessibilityLabel={q.subtitle ? `${q.title}, ${q.subtitle}` : q.title}
                  onPress={q.onPress}
                  className="flex-row items-center bg-surface"
                  style={({ pressed }) => ({ paddingVertical: 12, paddingHorizontal: 14, borderRadius: 22, gap: 10, minHeight: 60, opacity: pressed ? 0.85 : 1 })}
                >
                  {q.leading}
                  <View>
                    <RNText className="text-ink" style={{ fontFamily: FONT.sansSemi, fontSize: 12 }}>
                      {q.title}
                    </RNText>
                    {q.subtitle ? (
                      <RNText className="text-muted" style={{ fontFamily: FONT.sans, fontSize: 12 }}>
                        {q.subtitle}
                      </RNText>
                    ) : null}
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          ) : null}

          <Segmented<ProfileTab>
            value={tab}
            onChange={setTab}
            options={[
              { value: 'posts', label: t('you.tabPosts', 'Posts'), icon: 'grid' as IconName },
              { value: 'recipes', label: t('you.tabRecipes', 'Recipes') },
              { value: 'saved', label: t('you.tabSaved', 'Saved') },
            ]}
          />
        </View>

        {grid.length === 0 ? (
          <View className="items-center" style={{ paddingHorizontal: 32, paddingTop: 28, gap: 14 }}>
            <Muted center>{emptyText}</Muted>
            {tab === 'posts' ? <UButton size="sm" label={t('you.newPost', 'New post')} onPress={() => go('/post/new')} /> : null}
          </View>
        ) : (
          <View className="flex-row flex-wrap" style={{ gap: 4, marginTop: 14 }}>
            {grid.map((g) => (
              <PhotoCard
                key={g.key}
                source={g.source}
                width={tile}
                height={130}
                radius={0}
                fade="none"
                onPress={() => go(g.href)}
                accessibilityLabel={g.label}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}
