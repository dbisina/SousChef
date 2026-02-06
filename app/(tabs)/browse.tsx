import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useRecipes, useRecipeSearch } from '@/hooks/useRecipes';
import { useCookbooks } from '@/hooks/useCookbooks';
import { Recipe, Cookbook } from '@/types';
import { RecipeCard } from '@/components/recipe';
import { CookbookCard } from '@/components/cookbook';
import { RecipeFilters } from '@/components/recipe/RecipeFilters';
import { Loading, EmptySearch, EmptyRecipes, SearchInput } from '@/components/ui';
import { debounce } from '@/lib/utils';

type BrowseTab = 'recipes' | 'cookbooks';

export default function BrowseScreen() {
  const router = useRouter();
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
    return (
      <View className="flex-1 items-center justify-center py-12">
        <View className="w-20 h-20 rounded-full bg-neutral-100 items-center justify-center mb-4">
          <Ionicons name="book-outline" size={40} color="#A8A29E" />
        </View>
        <Text className="text-neutral-800 text-lg font-semibold text-center">
          No cookbooks yet
        </Text>
        <Text className="text-neutral-500 mt-2 text-center px-8">
          Chef-curated cookbook collections will appear here
        </Text>
      </View>
    );
  };

  return (
    <View className="flex-1">
      {/* Gradient Background */}
      <LinearGradient
        colors={['#FFF7ED', '#FEF3C7', '#F0FDF4']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Decorative circles */}
      <View
        className="absolute w-72 h-72 rounded-full bg-primary-200/30"
        style={{ top: -100, right: -80 }}
      />
      <View
        className="absolute w-56 h-56 rounded-full bg-secondary-200/20"
        style={{ top: 300, left: -100 }}
      />

      <SafeAreaView className="flex-1" edges={['top']}>
        {/* Header */}
        <View className="px-5 pt-4 pb-4">
          <View className="mb-4">
            <Text className="text-3xl font-bold text-neutral-800 tracking-tight">
              Browse
            </Text>
            <Text className="text-neutral-500 text-sm mt-1">
              {activeTab === 'recipes' ? 'Discover delicious recipes' : 'Explore curated collections'}
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
          <View className="flex-row rounded-xl overflow-hidden" style={styles.tabContainer}>
            <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFill} />
            <TouchableOpacity
              onPress={() => setActiveTab('recipes')}
              className={`flex-1 flex-row items-center justify-center py-3 ${
                activeTab === 'recipes' ? 'bg-primary-500' : 'bg-transparent'
              }`}
              style={activeTab === 'recipes' ? styles.activeTab : null}
            >
              <Ionicons
                name="restaurant-outline"
                size={18}
                color={activeTab === 'recipes' ? 'white' : '#78716C'}
              />
              <Text
                className={`ml-2 font-semibold ${
                  activeTab === 'recipes' ? 'text-white' : 'text-neutral-600'
                }`}
              >
                Recipes
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setActiveTab('cookbooks')}
              className={`flex-1 flex-row items-center justify-center py-3 ${
                activeTab === 'cookbooks' ? 'bg-primary-500' : 'bg-transparent'
              }`}
              style={activeTab === 'cookbooks' ? styles.activeTab : null}
            >
              <Ionicons
                name="book-outline"
                size={18}
                color={activeTab === 'cookbooks' ? 'white' : '#78716C'}
              />
              <Text
                className={`ml-2 font-semibold ${
                  activeTab === 'cookbooks' ? 'text-white' : 'text-neutral-600'
                }`}
              >
                Cookbooks
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Filters (only for recipes tab, not when searching) */}
        {activeTab === 'recipes' && !isShowingSearch && (
          <RecipeFilters
            filters={filters}
            onApplyFilters={applyFilters}
            onClearFilters={clearFilters}
          />
        )}

        {/* Search indicator (only for recipes) */}
        {isShowingSearch && (
          <View className="px-5 py-3">
            <View className="rounded-xl overflow-hidden" style={styles.searchIndicator}>
              <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFill} />
              <View className="px-4 py-2.5 bg-white/60 flex-row items-center">
                <View className="w-2 h-2 rounded-full bg-primary-500 mr-2" />
                <Text className="text-neutral-600 font-medium">
                  {isSearching
                    ? 'Searching...'
                    : `${results.length} result${results.length !== 1 ? 's' : ''} for "${searchText}"`}
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
                tintColor="#F97316"
              />
            }
            onEndReached={loadMore}
            onEndReachedThreshold={0.5}
            ListFooterComponent={renderFooter}
            ListEmptyComponent={renderEmptyRecipes}
          />
        ) : (
          <FlatList
            data={cookbooks}
            renderItem={renderCookbook}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 120, flexGrow: 1 }}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor="#F97316"
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
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
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
