import React from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  TouchableOpacity,
  Share,
  FlatList,
  StyleSheet,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useCookbook } from '@/hooks/useCookbooks';
import { useAuthStore } from '@/stores/authStore';
import { Recipe } from '@/types';
import { RecipeCard } from '@/components/recipe';
import { Loading, Button, Badge } from '@/components/ui';
import { useThemeColors } from '@/stores/themeStore';
import { formatRelativeTime } from '@/lib/utils';

export default function CookbookDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const colors = useThemeColors();
  const { user } = useAuthStore();
  const {
    cookbook,
    recipes,
    isLoading,
    error,
    isSaved,
    toggleSave,
    handleLike,
  } = useCookbook(id);

  const handleShare = async () => {
    if (!cookbook) return;
    try {
      await Share.share({
        message: `Check out this cookbook: ${cookbook.title}\n\nFrom SousChef App`,
      });
    } catch (error) {
      console.error(error);
    }
  };

  const handleRecipePress = (recipe: Recipe) => {
    router.push(`/recipe/${recipe.id}`);
  };

  if (isLoading) {
    return <Loading fullScreen message="Loading cookbook..." />;
  }

  if (error || !cookbook) {
    return (
      <SafeAreaView className="flex-1 bg-white dark:bg-neutral-900 items-center justify-center px-4">
        <Ionicons name="alert-circle-outline" size={64} color="#EF4444" />
        <Text className="text-xl font-semibold text-neutral-900 dark:text-neutral-100 mt-4">
          Cookbook not found
        </Text>
        <Text className="text-neutral-500 dark:text-neutral-400 text-center mt-2">
          {error || "This cookbook doesn't exist or has been removed."}
        </Text>
        <Button
          title="Go Back"
          onPress={() => router.back()}
          className="mt-6"
        />
      </SafeAreaView>
    );
  }

  return (
    <View className="flex-1 bg-white dark:bg-neutral-900">
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Hero Image */}
        <View className="relative">
          <Image
            source={{ uri: cookbook.coverImageURL }}
            className="w-full h-72"
            resizeMode="cover"
          />

          {/* Overlay gradient */}
          <LinearGradient
            colors={['rgba(0,0,0,0.3)', 'transparent', 'rgba(0,0,0,0.6)']}
            className="absolute inset-0"
          />

          {/* Back button */}
          <SafeAreaView className="absolute top-0 left-0 right-0">
            <View className="flex-row items-center justify-between px-4 pt-2">
              <TouchableOpacity
                onPress={() => router.back()}
                className="w-10 h-10 rounded-full bg-black/30 items-center justify-center"
              >
                <Ionicons name="arrow-back" size={24} color="white" />
              </TouchableOpacity>

              <View className="flex-row space-x-2">
                {user && (
                  <TouchableOpacity
                    onPress={toggleSave}
                    className="w-10 h-10 rounded-full bg-black/30 items-center justify-center"
                  >
                    <Ionicons
                      name={isSaved ? 'bookmark' : 'bookmark-outline'}
                      size={22}
                      color={isSaved ? colors.accent : 'white'}
                    />
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  onPress={handleShare}
                  className="w-10 h-10 rounded-full bg-black/30 items-center justify-center"
                >
                  <Ionicons name="share-outline" size={22} color="white" />
                </TouchableOpacity>
              </View>
            </View>
          </SafeAreaView>

          {/* Cookbook badge */}
          <View className="absolute bottom-4 left-4 px-3 py-1 rounded-full flex-row items-center" style={{ backgroundColor: colors.accent }}>
            <Ionicons name="book" size={16} color="white" />
            <Text className="text-white font-medium ml-1">Cookbook</Text>
          </View>

          {/* Recipe count */}
          <View className="absolute bottom-4 right-4 bg-black/50 px-3 py-1 rounded-full flex-row items-center">
            <Ionicons name="restaurant-outline" size={16} color="white" />
            <Text className="text-white font-medium ml-1">
              {cookbook.recipeIds.length} recipes
            </Text>
          </View>
        </View>

        {/* Content */}
        <View className="px-4 py-6">
          {/* Title and meta */}
          <Text className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
            {cookbook.title}
          </Text>

          <View className="flex-row items-center mt-2">
            <View className="flex-row items-center">
              <Ionicons name="heart" size={16} color={colors.accent} />
              <Text className="text-neutral-600 dark:text-neutral-400 ml-1">{cookbook.likes} likes</Text>
            </View>
            {cookbook.createdAt && (
              <>
                <Text className="text-neutral-300 dark:text-neutral-600 mx-2">|</Text>
                <Text className="text-neutral-500 dark:text-neutral-400">
                  {formatRelativeTime(cookbook.createdAt)}
                </Text>
              </>
            )}
          </View>

          {/* Category badge */}
          {cookbook.category && (
            <View className="mt-3">
              <Badge label={cookbook.category} variant="primary" />
            </View>
          )}

          {/* Description */}
          <Text className="text-neutral-600 dark:text-neutral-400 mt-4 leading-relaxed">
            {cookbook.description}
          </Text>

          {/* Quick stats */}
          <View className="flex-row justify-around mt-6 py-4 bg-neutral-50 dark:bg-neutral-800 rounded-xl">
            <View className="items-center">
              <Text className="text-xl font-bold text-neutral-900 dark:text-neutral-100">
                {cookbook.recipeIds.length}
              </Text>
              <Text className="text-sm text-neutral-500 dark:text-neutral-400">Recipes</Text>
            </View>
            <View className="w-px bg-neutral-200 dark:bg-neutral-700" />
            <View className="items-center">
              <Text className="text-xl font-bold text-neutral-900 dark:text-neutral-100">
                {cookbook.likes}
              </Text>
              <Text className="text-sm text-neutral-500 dark:text-neutral-400">Likes</Text>
            </View>
          </View>

          {/* Recipes Section */}
          <View className="mt-8">
            <Text className="text-xl font-bold text-neutral-900 dark:text-neutral-100 mb-4">
              Recipes in this Cookbook
            </Text>

            {recipes.length === 0 ? (
              <View className="py-8 items-center">
                <Ionicons name="restaurant-outline" size={48} color="#D4D4D4" />
                <Text className="text-neutral-500 dark:text-neutral-400 mt-3 text-center">
                  No recipes in this cookbook yet
                </Text>
              </View>
            ) : (
              recipes.map((recipe) => (
                <RecipeCard
                  key={recipe.id}
                  recipe={recipe}
                  onPress={() => handleRecipePress(recipe)}
                  compact
                />
              ))
            )}
          </View>
        </View>
      </ScrollView>

      {/* Bottom action bar */}
      {user && (
        <View className="px-4 py-4 bg-white dark:bg-neutral-900 border-t border-neutral-100 dark:border-neutral-800">
          <View className="flex-row space-x-3">
            <TouchableOpacity
              onPress={handleLike}
              className="flex-row items-center px-4 py-3 bg-neutral-100 dark:bg-neutral-800 rounded-xl"
            >
              <Ionicons name="heart-outline" size={20} color={colors.accent} />
              <Text className="ml-2 font-medium text-neutral-700 dark:text-neutral-300">
                {cookbook.likes}
              </Text>
            </TouchableOpacity>
            <Button
              title={isSaved ? 'Saved' : 'Save Cookbook'}
              onPress={toggleSave}
              leftIcon={
                <Ionicons
                  name={isSaved ? 'bookmark' : 'bookmark-outline'}
                  size={20}
                  color="white"
                />
              }
              variant={isSaved ? 'secondary' : 'primary'}
              className="flex-1"
            />
          </View>
        </View>
      )}
    </View>
  );
}
