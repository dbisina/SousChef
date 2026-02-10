import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRecipes, useRecipeSearch } from '@/hooks/useRecipes';
import { useCookbooks } from '@/hooks/useCookbooks';
import { useThemeColors } from '@/stores/themeStore';
import { useMealPlanStore } from '@/stores/mealPlanStore';
import { Recipe, Cookbook } from '@/types';
import { MealType, PlannedMeal } from '@/types/mealplan';
import { RecipeCard } from '@/components/recipe';
import { CookbookCard } from '@/components/cookbook';
import { RecipeFilters } from '@/components/recipe/RecipeFilters';
import { Loading, EmptySearch, EmptyRecipes, SearchInput, SponsoredAdCard } from '@/components/ui';
import { useSubscription } from '@/hooks/useSubscription';
import { getTierFeatures } from '@/services/subscriptionService';
import { debounce } from '@/lib/utils';

type BrowseTab = 'recipes' | 'cookbooks';

export default function BrowseScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const { subscriptionTier } = useSubscription();
  const adFree = getTierFeatures(subscriptionTier).adFree;
  const params = useLocalSearchParams<{ selectForMeal?: string; date?: string }>();
  const isMealSelection = !!params.selectForMeal && !!params.date;
  const { addMealToPlan } = useMealPlanStore();
  const [activeTab, setActiveTab] = useState<BrowseTab>('recipes');
  const {
    recipes,
    isLoading: recipesLoading,
    hasMore,
    filters,
    applyFilters,
    clearFilters,
    loadMore,
    refresh: refreshRecipes,
    toggleSave: toggleRecipeSave,
    isRecipeSaved,
  } = useRecipes();

  const {
    cookbooks,
    isLoading: cookbooksLoading,
    refresh: refreshCookbooks,
    toggleSave: toggleCookbookSave,
    isCookbookSaved,
  } = useCookbooks();

  const { results, isSearching, query, search, clear } = useRecipeSearch();
  const [refreshing, setRefreshing] = useState(false);
  const [searchText, setSearchText] = useState('');

  const isLoading = activeTab === 'recipes' ? recipesLoading : cookbooksLoading;

  const debouncedSearch = useCallback(
    debounce((text: string) => {
      search(text);
    }, 300),
    []
  );

  const handleSearchChange = (text: string) => {
    setSearchText(text);
    if (activeTab === 'recipes') {
      debouncedSearch(text);
    }
  };

  // Filter cookbooks by search text (client-side)
  const displayedCookbooks = useMemo(() => {
    if (!searchText.trim() || activeTab !== 'cookbooks') return cookbooks;
    const lowerSearch = searchText.toLowerCase();
    return cookbooks.filter(
      (c) =>
        c.name.toLowerCase().includes(lowerSearch) ||
        c.description?.toLowerCase().includes(lowerSearch) ||
        c.author?.toLowerCase().includes(lowerSearch)
    );
  }, [cookbooks, searchText, activeTab]);

  const isSearchingCookbooks = searchText.trim().length > 0 && activeTab === 'cookbooks';

  const handleClearSearch = () => {
    setSearchText('');
    clear();
  };

  const onRefresh = async () => {
    setRefreshing(true);
    if (activeTab === 'recipes') {
      await refreshRecipes();
    } else {
      await refreshCookbooks();
    }
    setRefreshing(false);
  };

  const handleRecipePress = (recipe: Recipe) => {
    if (isMealSelection) {
      // In meal selection mode: add recipe to the meal plan slot and go back
      const meal: PlannedMeal = {
        recipeId: recipe.id,
        recipeName: recipe.title,
        servings: recipe.servings || 2,
        imageURL: recipe.imageURL,
      };
      addMealToPlan(params.date!, params.selectForMeal as MealType, meal);
      Alert.alert('Meal Added', `${recipe.title} added to ${params.selectForMeal}`, [
        { text: 'OK', onPress: () => router.back() },
      ]);
      return;
    }
    router.push(`/recipe/${recipe.id}`);
  };

  const handleCookbookPress = (cookbook: Cookbook) => {
    router.push(`/cookbook/${cookbook.id}` as any);
  };

  const displayedRecipes = searchText.trim() ? results : recipes;
  const isShowingSearch = searchText.trim().length > 0 && activeTab === 'recipes';

  const renderRecipe = ({ item }: { item: Recipe }) => (
    <RecipeCard
      recipe={item}
      onPress={() => handleRecipePress(item)}
      onSave={() => toggleRecipeSave(item.id)}
      isSaved={isRecipeSaved(item.id)}
    />
  );

  const renderCookbook = ({ item }: { item: Cookbook }) => (
    <CookbookCard
      cookbook={item}
      onPress={() => handleCookbookPress(item)}
      onSave={() => toggleCookbookSave(item.id)}
      isSaved={isCookbookSaved(item.id)}
    />
  );

  const renderFooter = () => {
    if (activeTab !== 'recipes' || !hasMore || isShowingSearch) return null;
    if (recipesLoading) {
      return (
        <View className="py-4">
          <Loading size="small" />
        </View>
      );
    }
    return null;
  };

  const renderEmptyRecipes = () => {
    if (recipesLoading) return <Loading fullScreen message="Finding recipes..." />;
    if (isShowingSearch) return <EmptySearch />;
    return <EmptyRecipes onAction={() => router.push('/(tabs)/upload')} />;
  };

  const renderEmptyCookbooks = () => {
    if (cookbooksLoading) return <Loading fullScreen message="Loading cookbooks..." />;
    if (isSearchingCookbooks) return <EmptySearch />;
    return (
      <View className="flex-1 items-center justify-center py-12">
        <View className="w-20 h-20 rounded-full bg-neutral-100 dark:bg-neutral-800 items-center justify-center mb-4">
          <Ionicons name="book-outline" size={40} color={colors.textMuted} />
        </View>
        <Text className="text-neutral-800 dark:text-neutral-100 text-lg font-semibold text-center">
          No cookbooks yet
        </Text>
        <Text className="text-neutral-500 dark:text-neutral-400 mt-2 text-center px-8">
          Chef-curated cookbook collections will appear here
        </Text>
      </View>
    );
  };

  return (
    <View className="flex-1">
      {/* Gradient Background */}
      <LinearGradient
        colors={colors.gradientBg}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Decorative circles */}
      <View
        className="absolute w-72 h-72 rounded-full bg-primary-200/30 dark:bg-primary-800/20"
        style={{ top: -100, right: -80 }}
      />
      <View
        className="absolute w-56 h-56 rounded-full bg-secondary-200/20 dark:bg-secondary-800/10"
        style={{ top: 300, left: -100 }}
      />

      <SafeAreaView className="flex-1" edges={['top']}>
        {/* Meal Selection Banner */}
        {isMealSelection && (
          <View className="mx-5 mt-4 mb-2 px-4 py-3 bg-primary-50 dark:bg-primary-900/30 border border-primary-200 dark:border-primary-700 rounded-xl flex-row items-center">
            <Ionicons name="calendar" size={20} color={colors.accent} />
            <Text className="flex-1 ml-3 text-sm font-medium text-primary-800 dark:text-primary-200">
              Select a recipe for {params.selectForMeal}
            </Text>
            <TouchableOpacity onPress={() => router.back()}>
              <Ionicons name="close-circle" size={22} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        )}

        {/* Header */}
        <View className="px-5 pt-4 pb-4">
          <View className="mb-4">
            <Text className="text-3xl font-bold text-neutral-800 dark:text-neutral-100 tracking-tight">
              {isMealSelection ? 'Choose a Recipe' : 'Browse'}
            </Text>
            <Text className="text-neutral-500 dark:text-neutral-400 text-sm mt-1">
              {isMealSelection
                ? `Pick a recipe to add to ${params.selectForMeal} on ${params.date}`
                : activeTab === 'recipes' ? 'Discover delicious recipes' : 'Explore curated collections'}
            </Text>
          </View>

          {/* Glass Search bar */}
          <SearchInput
            placeholder={activeTab === 'recipes' ? 'Search recipes, ingredients...' : 'Search cookbooks...'}
            value={searchText}
            onChangeText={handleSearchChange}
            onClear={handleClearSearch}
          />
        </View>

        {/* Tab Switcher */}
        <View className="px-5 mb-3">
          <View className="flex-row rounded-xl overflow-hidden" style={[styles.tabContainer, { backgroundColor: colors.surface + '99' }]}>
            <TouchableOpacity
              onPress={() => setActiveTab('recipes')}
              className="flex-1 flex-row items-center justify-center py-3"
              style={activeTab === 'recipes' ? [styles.activeTab, { backgroundColor: colors.accent }] : null}
            >
              <Ionicons
                name="restaurant-outline"
                size={18}
                color={activeTab === 'recipes' ? 'white' : colors.textMuted}
              />
              <Text
                className={`ml-2 font-semibold ${
                  activeTab === 'recipes' ? 'text-white' : 'text-neutral-600 dark:text-neutral-400'
                }`}
              >
                Recipes
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setActiveTab('cookbooks')}
              className="flex-1 flex-row items-center justify-center py-3"
              style={activeTab === 'cookbooks' ? [styles.activeTab, { backgroundColor: colors.accent }] : null}
            >
              <Ionicons
                name="book-outline"
                size={18}
                color={activeTab === 'cookbooks' ? 'white' : colors.textMuted}
              />
              <Text
                className={`ml-2 font-semibold ${
                  activeTab === 'cookbooks' ? 'text-white' : 'text-neutral-600 dark:text-neutral-400'
                }`}
              >
                Cookbooks
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Sponsored Ad — compact, hidden for ad-free subscribers */}
        {!adFree && (
          <SponsoredAdCard placement="browse" compact />
        )}

        {/* Filters (only for recipes tab, not when searching) */}
        {activeTab === 'recipes' && !isShowingSearch && (
          <RecipeFilters
            filters={filters}
            onApplyFilters={applyFilters}
            onClearFilters={clearFilters}
          />
        )}

        {/* Search indicator */}
        {(isShowingSearch || isSearchingCookbooks) && (
          <View className="px-5 py-3">
            <View className="rounded-xl overflow-hidden" style={styles.searchIndicator}>
              <View className="px-4 py-2.5 bg-white/60 dark:bg-neutral-800/60 flex-row items-center">
                <View className="w-2 h-2 rounded-full mr-2" style={{ backgroundColor: colors.accent }} />
                <Text className="text-neutral-600 dark:text-neutral-300 font-medium">
                  {isShowingSearch
                    ? isSearching
                      ? 'Searching...'
                      : `${results.length} result${results.length !== 1 ? 's' : ''} for "${searchText}"`
                    : `${displayedCookbooks.length} cookbook${displayedCookbooks.length !== 1 ? 's' : ''} for "${searchText}"`}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Content */}
        {activeTab === 'recipes' ? (
          <FlatList
            data={displayedRecipes}
            renderItem={renderRecipe}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 120, flexGrow: 1 }}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={colors.accent}
              />
            }
            onEndReached={loadMore}
            onEndReachedThreshold={0.5}
            ListFooterComponent={renderFooter}
            ListEmptyComponent={renderEmptyRecipes}
          />
        ) : (
          <FlatList
            data={displayedCookbooks}
            renderItem={renderCookbook}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 120, flexGrow: 1 }}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={colors.accent}
              />
            }
            ListEmptyComponent={renderEmptyCookbooks}
          />
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  tabContainer: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  activeTab: {
    borderRadius: 12,
    margin: 4,
  },
  searchIndicator: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
});
