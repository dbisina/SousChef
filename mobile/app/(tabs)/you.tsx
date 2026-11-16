import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, Text as RNText, View, useWindowDimensions } from 'react-native';
import { Pressable } from '@/components/ui/Pressable';
import { useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import {
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
  useTokens,
  type IconName,
  type PhotoSource,
} from '@/components/ui';
import { FONT } from '@/components/ui/fonts';
import { useAuthStore } from '@/stores/authStore';
import { useGamificationStore } from '@/stores/gamificationStore';
import { latestGlucose, readingStatus, useHealthStore } from '@/stores/healthStore';
import { useRecipeStore } from '@/stores/recipeStore';
import { useSocialStore } from '@/stores/socialStore';
import { compactCount } from '@/lib/timeAgo';
import { apiEnabled } from '@/lib/api';
import { apiProfile } from '@/services/socialApi';
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
    <View>
      <RNText className="text-ink" style={{ fontFamily: FONT.display, fontSize: 15, lineHeight: 20 }}>
        {value}
      </RNText>
      <RNText className="text-muted" style={{ fontFamily: FONT.sans, fontSize: 12, marginTop: 2 }}>
        {label}
      </RNText>
    </View>
  );
}

export default function YouScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const tokens = useTokens();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const user = useAuthStore((s) => s.user);
  const fetchUserRecipes = useRecipeStore((s) => s.fetchUserRecipes);
  const streak = useGamificationStore((s) => s.streak.currentStreak);
  const readings = useHealthStore((s) => s.readings);
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
  const name = user?.displayName || t('you.guest', 'Guest');
  // Follower and following counts live on the server (the legacy lists on the user are empty there).
  const [counts, setCounts] = useState<{ followers: number; following: number } | null>(null);
  useEffect(() => {
    if (!apiEnabled() || !user?.id || user.id.startsWith('guest-')) return;
    apiProfile(user.id)
      .then((p) => setCounts({ followers: p.followerCount, following: p.followingCount }))
      .catch(() => undefined);
  }, [user?.id]);
  const handle = user?.email ? user.email.split('@')[0] : 'guest';
  const avatar: PhotoSource | undefined = user?.photoURL ? { uri: user.photoURL } : undefined;
  const recipeCount = Math.max(myRecipes.length, user?.recipeCount ?? 0);

  const myPosts = useMemo(() => posts.filter((p) => p.authorId === ME_ID), [posts]);
  const savedPosts = useMemo(() => posts.filter((p) => savedPostIds.includes(p.id)), [posts, savedPostIds]);

  const latest = useMemo(() => latestGlucose(readings), [readings]);
  const healthLine = latest && readingStatus(latest) === 'in-range' && new Date(latest.at).toDateString() === new Date().toDateString()
    ? t('you.inRangeToday', 'In range today')
    : latest
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
      leading: (
        <View className="items-center justify-center bg-ground" style={{ width: 36, height: 36, borderRadius: 18 }}>
          <Icon name="people" size="sm" />
        </View>
      ),
      onPress: () => go(`/community/${communityTarget}`),
    });
  }

  const tile = (width - 8) / 3;
  const grid: { key: string; source: PhotoSource | null; label: string; href: string }[] =
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
        <PhotoCard source={user?.bannerURL ? { uri: user.bannerURL } : null} height={200} radius={0} fade="both">
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
            <View className="border-ground bg-ground overflow-hidden" style={{ width: 92, height: 92, borderRadius: 46, borderWidth: 4 }}>
              <UAvatar source={avatar} name={name} size={84} />
            </View>
            <View className="flex-row items-center" style={{ gap: 8 }}>
              <UButton size="sm" variant="ghost" label={t('you.editProfile', 'Edit profile')} onPress={() => go('/settings/edit-profile')} />
              <UIconButton icon="share" label={t('you.shareProfile', 'Share profile')} onPress={() => shareText(`${name} on SousChef`)} />
            </View>
          </View>

          <View style={{ gap: 5, paddingTop: 5 }}>
            <Display size={24} numberOfLines={1}>
              {name}
            </Display>
            {user?.handle ? <Muted>@{user.handle}</Muted> : null}
            {user?.bio ? <Muted>{user.bio}</Muted> : null}
          </View>

          <View className="flex-row items-center justify-between" style={{ gap: 10 }}>
            <Stat value={compactCount(recipeCount)} label={t('you.recipes', 'recipes')} />
            <Stat value={compactCount(counts?.followers ?? user?.followers?.length ?? 0)} label={t('you.followers', 'followers')} />
            <Stat value={compactCount(counts?.following ?? user?.following?.length ?? 0)} label={t('you.following', 'following')} />
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
                  style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', backgroundColor: tokens.surface, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 22, gap: 10, minHeight: 60, opacity: pressed ? 0.85 : 1 })}
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
