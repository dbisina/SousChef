import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Image,
  RefreshControl,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/stores/authStore';
import { useRecipeStore } from '@/stores/recipeStore';
import { useThemeColors } from '@/stores/themeStore';
import { Recipe, User } from '@/types';
import { RecipeCard } from '@/components/recipe';
import { Loading, Card, Button } from '@/components/ui';
import { db, doc, getDoc } from '@/lib/firebase';

export default function UserProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const colors = useThemeColors();
  const { user: currentUser } = useAuthStore();
  const { fetchUserRecipes, followUser, unfollowUser } = useRecipeStore();

  const [profileUser, setProfileUser] = useState<User | null>(null);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);

  const isOwnProfile = currentUser?.id === id;

  const loadProfile = useCallback(async () => {
    if (!id) return;
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
    return <Loading fullScreen message="Loading profile..." />;
  }

  if (!profileUser) {
    return (
      <SafeAreaView className="flex-1 bg-white dark:bg-neutral-900 items-center justify-center">
        <Ionicons name="person-outline" size={64} color="#9CA3AF" />
        <Text className="text-lg text-neutral-500 mt-4">User not found</Text>
        <TouchableOpacity onPress={() => router.back()} className="mt-4">
          <Text style={{ color: colors.accent }}>Go back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const followerCount = profileUser.followers?.length || 0;
  const followingCount = profileUser.following?.length || 0;

  return (
    <SafeAreaView className="flex-1 bg-neutral-50 dark:bg-neutral-900" edges={['top']}>
      {/* Header */}
      <View className="flex-row items-center px-4 py-3 bg-white dark:bg-neutral-800 border-b border-neutral-100 dark:border-neutral-700">
        <TouchableOpacity onPress={() => router.back()} className="p-2 -ml-2">
          <Ionicons name="arrow-back" size={24} color={colors.icon} />
        </TouchableOpacity>
        <Text className="flex-1 text-lg font-bold text-neutral-900 dark:text-neutral-50 ml-2">
          {profileUser.displayName}
        </Text>
      </View>

      <FlatList
        data={recipes}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={{ paddingHorizontal: 12, gap: 12 }}
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={loadProfile} />
        }
        ListHeaderComponent={
          <View className="px-4 pt-6 pb-4">
            {/* Profile info */}
            <View className="items-center mb-6">
              {profileUser.photoURL ? (
                <Image
                  source={{ uri: profileUser.photoURL }}
                  className="w-24 h-24 rounded-full"
                />
              ) : (
                <View
                  className="w-24 h-24 rounded-full items-center justify-center"
                  style={{ backgroundColor: colors.accent + '20' }}
                >
                  <Text style={{ color: colors.accent }} className="text-3xl font-bold">
                    {profileUser.displayName.charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}

              <View className="flex-row items-center mt-3">
                <Text className="text-xl font-bold text-neutral-900 dark:text-neutral-50">
                  {profileUser.displayName}
                </Text>
                {profileUser.isVerifiedChef && (
                  <Ionicons name="checkmark-circle" size={20} color="#3B82F6" style={{ marginLeft: 6 }} />
                )}
              </View>

              {profileUser.bio && (
                <Text className="text-neutral-500 dark:text-neutral-400 text-center mt-2 px-8">
                  {profileUser.bio}
                </Text>
              )}

              {/* Stats */}
              <View className="flex-row mt-4 space-x-8">
                <View className="items-center">
                  <Text className="text-lg font-bold text-neutral-900 dark:text-neutral-50">
                    {recipes.length}
                  </Text>
                  <Text className="text-xs text-neutral-500">Recipes</Text>
                </View>
                <View className="items-center">
                  <Text className="text-lg font-bold text-neutral-900 dark:text-neutral-50">
                    {followerCount}
                  </Text>
                  <Text className="text-xs text-neutral-500">Followers</Text>
                </View>
                <View className="items-center">
                  <Text className="text-lg font-bold text-neutral-900 dark:text-neutral-50">
                    {followingCount}
                  </Text>
                  <Text className="text-xs text-neutral-500">Following</Text>
                </View>
                <View className="items-center">
                  <Text className="text-lg font-bold text-neutral-900 dark:text-neutral-50">
                    {profileUser.totalLikes || 0}
                  </Text>
                  <Text className="text-xs text-neutral-500">Likes</Text>
                </View>
              </View>

              {/* Follow button */}
              {!isOwnProfile && currentUser && (
                <TouchableOpacity
                  onPress={handleFollowToggle}
                  className={`mt-4 px-8 py-2.5 rounded-full ${
                    isFollowing ? 'bg-neutral-200 dark:bg-neutral-700' : ''
                  }`}
                  style={!isFollowing ? { backgroundColor: colors.accent } : undefined}
                >
                  <Text
                    className={`font-semibold ${
                      isFollowing ? 'text-neutral-700 dark:text-neutral-300' : 'text-white'
                    }`}
                  >
                    {isFollowing ? 'Following' : 'Follow'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Recipes header */}
            <Text className="text-sm font-medium text-neutral-500 dark:text-neutral-400 uppercase mb-3">
              {isOwnProfile ? 'My Recipes' : 'Recipes'} ({recipes.length})
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <View className="flex-1 mb-3">
            <RecipeCard
              recipe={item}
              onPress={() => router.push(`/recipe/${item.id}`)}
              compact
            />
          </View>
        )}
        ListEmptyComponent={
          <View className="items-center py-12">
            <Ionicons name="restaurant-outline" size={48} color="#9CA3AF" />
            <Text className="text-neutral-500 mt-3">No recipes yet</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}
