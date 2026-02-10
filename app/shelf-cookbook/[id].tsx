import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StyleSheet,
  Image,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { useCookbookLibraryStore } from '@/stores/cookbookLibraryStore';
import { useThemeColors } from '@/stores/themeStore';
import { CookbookRecipe } from '@/types/cookbookLibrary';
import { CookbookScanner } from '@/components/import';

const BOOK_COLORS = ['#B91C1C', '#1D4ED8', '#047857', '#7C3AED', '#C2410C', '#0F766E', '#4338CA', '#9D174D'];

export default function ShelfCookbookDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const colors = useThemeColors();
  const { cookbooks, fetchRecipesForCookbook, addScannedRecipe, removeCookbook } =
    useCookbookLibraryStore();

  const cookbook = cookbooks.find((c) => c.id === id);
  const bookIndex = cookbooks.findIndex((c) => c.id === id);
  const bookColor = cookbook?.coverColor || BOOK_COLORS[Math.abs(bookIndex) % BOOK_COLORS.length];

  const [showScanner, setShowScanner] = useState(false);

  const handleRetryFetch = useCallback(async () => {
    if (!id) return;
    const { isComplete } = await fetchRecipesForCookbook(id);
    if (!isComplete) {
      Alert.alert(
        'Still Incomplete',
        'Would you like to scan your physical cookbook to add the missing recipes?',
        [
          { text: 'Scan Pages', onPress: () => setShowScanner(true) },
          { text: 'Not Now', style: 'cancel' },
        ]
      );
    }
  }, [id, fetchRecipesForCookbook]);

  const handleScanSuccess = useCallback(
    (recipeTitle: string) => {
      if (id) {
        addScannedRecipe(id, {
          id: `scanned-${Date.now()}`,
          name: recipeTitle,
          source: 'scanned',
        });
      }
    },
    [id, addScannedRecipe]
  );

  const handleDelete = useCallback(() => {
    if (!cookbook) return;
    Alert.alert('Remove Cookbook', `Remove "${cookbook.title}" from your shelf?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          removeCookbook(cookbook.id);
          router.back();
        },
      },
    ]);
  }, [cookbook, removeCookbook, router]);

  if (!cookbook) {
    return (
      <SafeAreaView className="flex-1 bg-white dark:bg-neutral-900 items-center justify-center px-4">
        <Ionicons name="alert-circle-outline" size={64} color="#EF4444" />
        <Text className="text-xl font-semibold text-neutral-900 dark:text-neutral-100 mt-4">
          Cookbook not found
        </Text>
        <TouchableOpacity
          onPress={() => router.back()}
          className="mt-6 bg-amber-500 px-6 py-3 rounded-xl"
        >
          <Text className="text-white font-semibold">Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const isFetching = cookbook.fetchStatus === 'fetching';
  const needsScan = cookbook.fetchStatus === 'failed' || cookbook.fetchStatus === 'partial';
  const recipes = cookbook.recipes || [];

  const renderRecipeCard = (recipe: CookbookRecipe, index: number) => (
    <TouchableOpacity
      key={recipe.id}
      activeOpacity={0.7}
      onPress={() =>
        router.push({
          pathname: '/shelf-recipe/[id]',
          params: { id: recipe.id, cookbookId: cookbook!.id },
        })
      }
    >
      <Animated.View
        entering={FadeInDown.duration(300).delay(index * 50)}
        className="mx-5 mb-3 rounded-2xl bg-white dark:bg-neutral-800 overflow-hidden"
        style={styles.recipeCard}
      >
        <View className="flex-row">
          {/* Color accent bar matching book */}
          <View className="w-0.5" style={{ backgroundColor: bookColor }} />
          <View className="flex-1 p-4">
            <View className="flex-row items-start justify-between">
              <View className="flex-1 mr-3">
                <Text className="font-bold text-neutral-900 dark:text-neutral-50 text-base">
                  {recipe.name}
                </Text>
                {recipe.description ? (
                  <Text
                    className="text-sm text-neutral-500 dark:text-neutral-400 mt-1 leading-relaxed"
                    numberOfLines={2}
                  >
                    {recipe.description}
                  </Text>
                ) : null}
              </View>
              <View className="flex-row items-center">
                {recipe.pageNumber ? (
                  <View className="bg-neutral-100 dark:bg-neutral-700 px-2 py-1 rounded-full mr-2">
                    <Text className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
                      p.{recipe.pageNumber}
                    </Text>
                  </View>
                ) : null}
                <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
              </View>
            </View>

            {/* Key ingredients */}
            {recipe.keyIngredients && recipe.keyIngredients.length > 0 && (
              <View className="flex-row flex-wrap mt-2.5 gap-1.5">
                {recipe.keyIngredients.map((ing) => (
                  <View
                    key={ing}
                    className="px-2 py-1 rounded-full"
                    style={{ backgroundColor: bookColor + '15' }}
                  >
                    <Text className="text-xs font-medium" style={{ color: bookColor }}>
                      {ing}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {/* Source badge + cached indicator */}
            <View className="flex-row items-center mt-2 justify-between">
              <View className="flex-row items-center">
                <Ionicons
                  name={recipe.source === 'scanned' ? 'camera' : 'sparkles'}
                  size={12}
                  color={colors.textMuted}
                />
                <Text className="text-[10px] text-neutral-400 dark:text-neutral-500 ml-1">
                  {recipe.source === 'scanned' ? 'Scanned from book' : 'Found by AI'}
                </Text>
              </View>
              {recipe.fullContent && (
                <View className="flex-row items-center">
                  <Ionicons name="checkmark-circle" size={12} color="#22C55E" />
                  <Text className="text-[10px] text-green-500 ml-0.5">Recipe loaded</Text>
                </View>
              )}
            </View>
          </View>
        </View>
      </Animated.View>
    </TouchableOpacity>
  );

  return (
    <View className="flex-1 bg-white dark:bg-neutral-900">
      <CookbookScanner
        visible={showScanner}
        onClose={() => setShowScanner(false)}
        onSuccess={handleScanSuccess}
      />

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Hero Book Cover */}
        <View className="relative" style={{ backgroundColor: bookColor }}>
          {/* Cover Image */}
          {cookbook.coverImageURL ? (
            <Image
              source={{ uri: cookbook.coverImageURL }}
              style={{ position: 'absolute', width: '100%', height: '100%' }}
              resizeMode="cover"
            />
          ) : null}

          {/* Spine Effect */}
          <LinearGradient
            colors={[
              'rgba(255,255,255,0.35)',
              'rgba(255,255,255,0.08)',
              'rgba(0,0,0,0.05)',
              'rgba(0,0,0,0.15)',
            ]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 20, zIndex: 10 }}
          />
          <View
            className="absolute top-0 bottom-0 w-[1px] bg-black/15"
            style={{ left: 20, zIndex: 10 }}
          />

          {/* Dark gradient overlay for text readability on cover images */}
          {cookbook.coverImageURL ? (
            <LinearGradient
              colors={['rgba(0,0,0,0.3)', 'rgba(0,0,0,0.1)', 'rgba(0,0,0,0.5)']}
              style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, zIndex: 5 }}
            />
          ) : null}

          <SafeAreaView edges={['top']}>
            {/* Nav bar */}
            <View className="flex-row items-center justify-between pr-4 pl-7 pt-2 pb-1">
              <TouchableOpacity
                onPress={() => router.back()}
                className="w-10 h-10 rounded-full bg-black/20 items-center justify-center"
              >
                <Ionicons name="arrow-back" size={24} color="white" />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleDelete}
                className="w-10 h-10 rounded-full bg-black/20 items-center justify-center"
              >
                <Ionicons name="trash-outline" size={20} color="white" />
              </TouchableOpacity>
            </View>

            {/* Title content */}
            <View className="pr-6 pl-8 pt-6 pb-10">
              <View className="bg-white/15 self-start px-3 py-1 rounded-full flex-row items-center mb-4">
                <Ionicons name="book" size={14} color="white" />
                <Text className="text-white/90 text-xs font-semibold ml-1.5">Cookbook</Text>
              </View>

              <Text
                className="text-white font-bold text-3xl leading-tight"
                style={{
                  textShadowColor: 'rgba(0,0,0,0.2)',
                  textShadowOffset: { width: 0, height: 1 },
                  textShadowRadius: 3,
                }}
              >
                {cookbook.title}
              </Text>

              {cookbook.author ? (
                <Text className="text-white/70 text-lg mt-2">{cookbook.author}</Text>
              ) : null}

              {cookbook.description ? (
                <Text className="text-white/60 text-sm mt-2 leading-relaxed" numberOfLines={2}>
                  {cookbook.description}
                </Text>
              ) : null}

              {/* Stats row */}
              <View className="flex-row items-center mt-4 gap-4">
                <View className="bg-black/20 px-3 py-1.5 rounded-full flex-row items-center">
                  <Ionicons name="restaurant-outline" size={14} color="white" />
                  <Text className="text-white text-sm font-medium ml-1.5">
                    {recipes.length} recipe{recipes.length !== 1 ? 's' : ''}
                  </Text>
                </View>

                {isFetching && (
                  <View className="bg-black/20 px-3 py-1.5 rounded-full flex-row items-center">
                    <ActivityIndicator size={12} color="white" />
                    <Text className="text-white/80 text-sm ml-1.5">Finding more...</Text>
                  </View>
                )}

                {needsScan && (
                  <View className="bg-white/20 px-3 py-1.5 rounded-full flex-row items-center">
                    <Ionicons name="alert-circle" size={14} color="white" />
                    <Text className="text-white/80 text-sm ml-1">Incomplete</Text>
                  </View>
                )}
              </View>
            </View>
          </SafeAreaView>
        </View>

        {/* Content */}
        <View className="pt-6 pb-24">
          {/* Action buttons when fetch is partial/failed */}
          {needsScan && (
            <Animated.View
              entering={FadeIn.duration(300)}
              className="mx-5 mb-5 p-4 rounded-2xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800"
            >
              <Text className="font-semibold text-amber-800 dark:text-amber-300 text-sm mb-2">
                Some recipes may be missing
              </Text>
              <Text className="text-amber-600 dark:text-amber-400 text-xs mb-3">
                We found {recipes.length} recipe{recipes.length !== 1 ? 's' : ''} online. Scan your
                physical copy to add the rest.
              </Text>
              <View className="flex-row gap-2">
                <TouchableOpacity
                  onPress={() => setShowScanner(true)}
                  className="flex-1 py-2.5 rounded-xl bg-purple-500 items-center flex-row justify-center"
                >
                  <Ionicons name="camera" size={16} color="#fff" />
                  <Text className="text-white font-semibold text-sm ml-1.5">Scan Pages</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleRetryFetch}
                  className="flex-1 py-2.5 rounded-xl bg-amber-500 items-center flex-row justify-center"
                >
                  <Ionicons name="refresh" size={16} color="#fff" />
                  <Text className="text-white font-semibold text-sm ml-1.5">Retry AI</Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          )}

          {/* Loading state */}
          {isFetching && recipes.length === 0 && (
            <View className="py-16 items-center">
              <ActivityIndicator size="large" color={bookColor} />
              <Text className="text-neutral-500 dark:text-neutral-400 mt-4 text-base">
                Finding all recipes in this cookbook...
              </Text>
              <Text className="text-neutral-400 dark:text-neutral-500 mt-1 text-sm">
                This may take a moment
              </Text>
            </View>
          )}

          {/* Empty state when failed */}
          {!isFetching && recipes.length === 0 && (
            <View className="py-12 items-center px-8">
              <View
                className="w-16 h-16 rounded-full items-center justify-center mb-4"
                style={{ backgroundColor: bookColor + '15' }}
              >
                <Ionicons name="book-outline" size={32} color={bookColor} />
              </View>
              <Text className="text-lg font-bold text-neutral-700 dark:text-neutral-300 text-center">
                No recipes found yet
              </Text>
              <Text className="text-neutral-500 dark:text-neutral-400 text-center mt-2 mb-4">
                We couldn't find recipes for this cookbook online. Scan pages from your physical copy to
                add them.
              </Text>
              <TouchableOpacity
                onPress={() => setShowScanner(true)}
                className="py-3 px-6 rounded-xl items-center flex-row"
                style={{ backgroundColor: bookColor }}
              >
                <Ionicons name="camera" size={18} color="#fff" />
                <Text className="text-white font-bold ml-2">Scan Your Copy</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Recipe list */}
          {recipes.length > 0 && (
            <View>
              <Text className="px-5 mb-3 text-lg font-bold text-neutral-900 dark:text-neutral-100">
                Recipes ({recipes.length})
              </Text>
              {recipes.map((recipe, i) => renderRecipeCard(recipe, i))}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  recipeCard: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
});
