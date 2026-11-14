import React, { useEffect, useState, useCallback } from 'react';
import { RefreshControl, ScrollView, Text as RNText, View, useWindowDimensions } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/authStore';
import { useRecipeStore } from '@/stores/recipeStore';
import { Recipe, User } from '@/types';
import {
  Display,
  H2,
  Icon,
  Loading,
  Muted,
  PhotoCard,
  Screen,
  SheetPanel,
  Tag,
  ToneBlock,
  UButton,
  UIconButton,
} from '@/components/ui';
import { FONT } from '@/components/ui/fonts';
import { FIXED } from '@/stores/themeStore';
import { db, doc, getDoc } from '@/lib/firebase';
import { isDesignReview } from '@/lib/designReview';

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View className="items-center">
      <RNText className="text-ink" style={{ fontFamily: FONT.display, fontSize: 20, lineHeight: 29 }}>
        {value}
      </RNText>
      <Muted small>{label}</Muted>
    </View>
  );
}

const compact = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, '')}k` : String(n));

export default function UserProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { user: currentUser } = useAuthStore();
  const { fetchUserRecipes, followUser, unfollowUser } = useRecipeStore();

  const [profileUser, setProfileUser] = useState<User | null>(null);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);

  const isOwnProfile = currentUser?.id === id;

  const loadProfile = useCallback(async () => {
    if (!id) return;
    // Design-review build only (dead code otherwise): the fidelity harness has no backend, so it injects the profile.
    const review = isDesignReview
      ? (window as unknown as { __REVIEW_PROFILE__?: { user: User; recipes: Recipe[] } }).__REVIEW_PROFILE__
      : undefined;
    if (review) {
      setProfileUser(review.user);
      setRecipes(review.recipes);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const userDoc = await getDoc(doc(db, 'users', id));
      if (userDoc.exists()) {
        const userData = { id: userDoc.id, ...userDoc.data() } as User;
        setProfileUser(userData);
        setIsFollowing(currentUser?.following?.includes(id) || false);
      }
      const userRecipes = await fetchUserRecipes(id);
      setRecipes(userRecipes.filter((r) => r.status !== 'flagged'));
    } catch (error) {
      console.error('Error loading user profile:', error);
    } finally {
      setIsLoading(false);
    }
    // fetchUserRecipes is a stable zustand action; currentUser.following drives the follow state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, currentUser?.following]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const handleFollowToggle = async () => {
    if (!currentUser || !id || isOwnProfile) return;
    if (isFollowing) {
      await unfollowUser(currentUser.id, id);
      setIsFollowing(false);
    } else {
      await followUser(currentUser.id, id);
      setIsFollowing(true);
    }
  };

  if (isLoading) {
    return <Loading fullScreen message={t('cookbooks.profile.loading', 'Loading profile...')} />;
  }

  if (!profileUser) {
    return (
      <Screen bare>
        <View className="flex-1 items-center justify-center" style={{ paddingHorizontal: 32, gap: 14 }}>
          <Icon name="user" size="lg" color="muted" />
          <H2 center>{t('cookbooks.profile.notFound', 'User not found')}</H2>
          <UButton label={t('cookbooks.profile.goBack', 'Go back')} size="sm" onPress={() => router.back()} />
        </View>
      </Screen>
    );
  }

  const followerCount = profileUser.followers?.length || 0;
  const topInset = Math.max(insets.top, 20) + 14;
  const tile = Math.floor((width - 40 - 12) / 2);

  const heroOverlay = (
    <>
      <View
        className="flex-row items-center justify-between"
        style={{ position: 'absolute', top: topInset, left: 20, right: 20, zIndex: 2 }}
      >
        <UIconButton icon="back" tone="glassDark" label={t('common.back', 'Back')} onPress={() => router.back()} />
      </View>
      <View style={{ position: 'absolute', left: 22, right: 22, bottom: 54, gap: 6 }}>
        {profileUser.isVerifiedChef ? (
          <View style={{ alignSelf: 'flex-start' }}>
            <Tag tone="glass" icon="check" label={t('cookbooks.profile.verified', 'Verified chef')} />
          </View>
        ) : null}
        <Display size={30} numberOfLines={2}>
          {profileUser.displayName}
        </Display>
        {profileUser.bio ? (
          <RNText numberOfLines={2} style={{ fontFamily: FONT.sans, fontSize: 12, lineHeight: 17.4, color: FIXED.captionSub }}>
            {profileUser.bio}
          </RNText>
        ) : null}
      </View>
    </>
  );

  return (
    <Screen bare>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 60 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={loadProfile} />}
      >
        {profileUser.photoURL ? (
          <PhotoCard
            source={{ uri: profileUser.photoURL }}
            height={340}
            radius={0}
            fade="both"
            accessibilityLabel={profileUser.displayName}
          >
            {heroOverlay}
          </PhotoCard>
        ) : (
          <ToneBlock tone="dark" className="bg-night" style={{ height: 340 }}>
            {heroOverlay}
          </ToneBlock>
        )}

        <SheetPanel gap={14}>
          <View className="flex-row items-center justify-between" style={{ gap: 12 }}>
            <Stat value={String(recipes.length)} label={t('cookbooks.profile.recipes', 'Recipes')} />
            <Stat value={compact(followerCount)} label={t('cookbooks.profile.followers', 'Followers')} />
            <Stat value={compact(profileUser.totalLikes || 0)} label={t('cookbooks.profile.likes', 'Likes')} />
            {!isOwnProfile && currentUser ? (
              <UButton
                size="sm"
                style={{ paddingHorizontal: 26 }}
                variant={isFollowing ? 'ghost' : 'accent'}
                label={isFollowing ? t('cookbooks.profile.following', 'Following') : t('cookbooks.profile.follow', 'Follow')}
                onPress={handleFollowToggle}
              />
            ) : (
              <View />
            )}
          </View>

          {recipes.length === 0 ? (
            <View className="items-center" style={{ paddingVertical: 40, gap: 10 }}>
              <Icon name="kitchen" size="lg" color="muted" />
              <Muted>{t('cookbooks.profile.noRecipes', 'No recipes yet')}</Muted>
            </View>
          ) : (
            <View className="flex-row flex-wrap" style={{ gap: 12 }}>
              {recipes.map((item) => (
                <PhotoCard
                  key={item.id}
                  source={{ uri: item.imageURL }}
                  width={tile}
                  height={170}
                  radius={24}
                  title={item.title}
                  titleSize={15}
                  captionInset={14}
                  onPress={() => router.push(`/recipe/${item.id}`)}
                />
              ))}
            </View>
          )}
        </SheetPanel>
      </ScrollView>
    </Screen>
  );
}
