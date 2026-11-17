import React, { useEffect, useState, useCallback } from 'react';
import { RefreshControl, ScrollView, Text as RNText, View, useWindowDimensions } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/authStore';
import { useRecipeStore } from '@/stores/recipeStore';
import { Recipe, User } from '@/types';
import {
  H2,
  Icon,
  Loading,
  Muted,
  PhotoCard,
  Screen,
  UButton,
  UIconButton,
} from '@/components/ui';
import { FONT } from '@/components/ui/fonts';
import { ProfileHeader } from '@/components/profile/ProfileHeader';
import { db, doc, getDoc } from '@/lib/firebase';
import { isDesignReview } from '@/lib/designReview';
import { apiEnabled } from '@/lib/api';
import { apiProfile, apiSetFollowing } from '@/services/socialApi';

export default function UserProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const { user: currentUser } = useAuthStore();
  const { fetchUserRecipes, followUser, unfollowUser } = useRecipeStore();

  const [profileUser, setProfileUser] = useState<User | null>(null);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [postCount, setPostCount] = useState(0);

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
      if (apiEnabled()) {
        // The server is the source of truth: the profile, the follower count and whether you follow them.
        const p = await apiProfile(id);
        setProfileUser({
          id: p.id,
          displayName: p.displayName,
          photoURL: p.photoUrl ?? undefined,
          bio: p.bio,
          isVerifiedChef: p.isVerifiedChef,
          handle: p.handle,
        } as unknown as User);
        setFollowerCount(p.followerCount);
        setFollowingCount(p.followingCount);
        setPostCount(p.postCount);
        setIsFollowing(p.viewer?.following ?? false);
      } else {
        const userDoc = await getDoc(doc(db, 'users', id));
        if (userDoc.exists()) {
          const userData = { id: userDoc.id, ...userDoc.data() } as User;
          setProfileUser(userData);
          setFollowerCount(userData.followers?.length ?? 0);
          setIsFollowing(currentUser?.following?.includes(id) || false);
        }
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
  }, [id]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const handleFollowToggle = async () => {
    if (!currentUser || !id || isOwnProfile) return;
    const next = !isFollowing;
    setIsFollowing(next); // optimistic; the server's answer below replaces it
    setFollowerCount((n) => Math.max(0, n + (next ? 1 : -1)));
    try {
      if (apiEnabled()) {
        const r = await apiSetFollowing(id, next);
        setIsFollowing(r.following);
        setFollowerCount(r.followerCount);
      } else if (next) {
        await followUser(currentUser.id, id);
      } else {
        await unfollowUser(currentUser.id, id);
      }
    } catch {
      setIsFollowing(!next);
      setFollowerCount((n) => Math.max(0, n + (next ? -1 : 1)));
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

  const tile = Math.floor((width - 8) / 3);
  const handle = (profileUser as User & { handle?: string }).handle;

  return (
    <Screen bare>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 60 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={loadProfile} />}
      >
        <ProfileHeader
          handle={handle ?? profileUser.displayName}
          name={profileUser.displayName}
          bio={profileUser.bio}
          avatar={profileUser.photoURL ? { uri: profileUser.photoURL } : undefined}
          verified={Boolean(profileUser.isVerifiedChef)}
          topLeft={<UIconButton icon="back" label={t('common.back', 'Back')} onPress={() => router.back()} />}
          stats={[
            { value: Math.max(postCount, 0), label: t('cookbooks.profile.posts', 'posts') },
            { value: followerCount, label: t('cookbooks.profile.followers', 'followers') },
            { value: followingCount, label: t('cookbooks.profile.followingLabel', 'following') },
          ]}
          actions={
            !isOwnProfile && currentUser ? (
              <View style={{ flex: 1 }}>
                <UButton
                  size="sm"
                  variant={isFollowing ? 'ghost' : 'accent'}
                  label={isFollowing ? t('cookbooks.profile.following', 'Following') : t('cookbooks.profile.follow', 'Follow')}
                  onPress={handleFollowToggle}
                />
              </View>
            ) : undefined
          }
        />

        <View style={{ marginTop: 18 }}>
          <View className="flex-row items-center" style={{ paddingHorizontal: 20, paddingBottom: 10, gap: 8 }}>
            <Icon name="grid" size="sm" />
            <RNText className="text-ink" style={{ fontFamily: FONT.sansSemi, fontSize: 13 }}>
              {t('cookbooks.profile.recipes', 'Recipes')} · {recipes.length}
            </RNText>
          </View>
          {recipes.length === 0 ? (
            <View className="items-center" style={{ paddingVertical: 40, gap: 10 }}>
              <Icon name="kitchen" size="lg" color="muted" />
              <Muted>{t('cookbooks.profile.noRecipes', 'No recipes yet')}</Muted>
            </View>
          ) : (
            <View className="flex-row flex-wrap" style={{ gap: 4 }}>
              {recipes.map((item) => (
                <PhotoCard
                  key={item.id}
                  source={item.imageURL ? { uri: item.imageURL } : null}
                  width={tile}
                  height={tile}
                  radius={0}
                  fade="none"
                  accessibilityLabel={item.title}
                  onPress={() => router.push(`/recipe/${item.id}`)}
                />
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </Screen>
  );
}
