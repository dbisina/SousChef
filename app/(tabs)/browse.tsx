import React, { useState, useCallback, useMemo } from 'react';
import { ActivityIndicator, Alert, FlatList, RefreshControl, View, useWindowDimensions } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SAMPLE } from '@/assets/sample';
import { useRecipes, useRecipeSearch } from '@/hooks/useRecipes';
import { useCookbooks } from '@/hooks/useCookbooks';
import { useMealPlanStore } from '@/stores/mealPlanStore';
import { Recipe, Cookbook, RecipeCategory } from '@/types';
import { MealType, PlannedMeal } from '@/types/mealplan';
import { RecipeFilters } from '@/components/recipe/RecipeFilters';
import {
  Chip,
  ChipRow,
  Icon,
  Muted,
  PhotoCard,
  Screen,
  SponsoredAdCard,
  Tag,
  Title,
  TopBar,
  UButton,
  UCard,
  UIconButton,
  UInput,
  useColor,
} from '@/components/ui';
import type { PhotoSource } from '@/components/ui';
import { useSubscription } from '@/hooks/useSubscription';
import { getTierFeatures } from '@/services/subscriptionService';
import { debounce } from '@/lib/utils';

type BrowseTab = 'recipes' | 'cookbooks';

const CATEGORY_CHIPS: Array<{ id: RecipeCategory; key: string; label: string }> = [
  { id: 'breakfast', key: 'breakfast', label: 'Breakfast' },
  { id: 'lunch', key: 'lunch', label: 'Lunch' },
  { id: 'dinner', key: 'dinner', label: 'Dinner' },
];

const photoFor = (url?: string): PhotoSource => (url ? { uri: url } : SAMPLE.plating);

export default function BrowseScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { width: windowWidth } = useWindowDimensions();
  // Two columns inside the 20px page padding with a 12px gap.
  const cardWidth = Math.floor((windowWidth - 52) / 2);
  const spinner = useColor('muted');
  const { subscriptionTier } = useSubscription();
  const adFree = getTierFeatures(subscriptionTier).adFree;
  const params = useLocalSearchParams<{ selectForMeal?: string; date?: string }>();
  const isMealSelection = !!params.selectForMeal && !!params.date;
  const { addMealToPlan } = useMealPlanStore();
  const [activeTab, setActiveTab] = useState<BrowseTab>('recipes');
  const [showFilters, setShowFilters] = useState(false);
  const {
    recipes,
    isLoading: recipesLoading,
    hasMore,
    filters,
    applyFilters,
    clearFilters,
    loadMore,
    refresh: refreshRecipes,
  } = useRecipes();

  const {
    cookbooks,
    isLoading: cookbooksLoading,
    refresh: refreshCookbooks,
    toggleSave: toggleCookbookSave,
    isCookbookSaved,
  } = useCookbooks();

  const { results, isSearching, search, clear } = useRecipeSearch();
  const [refreshing, setRefreshing] = useState(false);
  const [searchText, setSearchText] = useState('');

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
      (c) => c.title.toLowerCase().includes(lowerSearch) || c.description?.toLowerCase().includes(lowerSearch)
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
      Alert.alert(
        t('browseUi.mealAdded', 'Meal Added'),
        t('browseUi.mealAddedBody', '{{title}} added to {{meal}}', { title: recipe.title, meal: params.selectForMeal }),
        [{ text: t('kitchen.ok', 'OK'), onPress: () => router.back() }]
      );
      return;
    }
    router.push(`/recipe/${recipe.id}`);
  };

  const handleCookbookPress = (cookbook: Cookbook) => {
    router.push(`/cookbook/${cookbook.id}` as never);
  };

  const displayedRecipes = searchText.trim() ? results : recipes;
  const isShowingSearch = searchText.trim().length > 0 && activeTab === 'recipes';

  // First recipe is the featured card (when not searching); the rest fill the 2-column grid.
  const featured = !isShowingSearch ? displayedRecipes[0] : undefined;
  const gridRecipes = featured ? displayedRecipes.slice(1) : displayedRecipes;

  const selectCategory = (category?: RecipeCategory) => {
    setActiveTab('recipes');
    applyFilters({ ...filters, category: filters.category === category ? undefined : category });
  };

  const minutes = (r: Recipe) => (r.prepTime || 0) + (r.cookTime || 0);
  const difficultyLabel = (r: Recipe) => t(`browseUi.difficulty.${r.difficulty}`, r.difficulty.charAt(0).toUpperCase() + r.difficulty.slice(1));

  const renderRecipe = ({ item }: { item: Recipe }) => (
    <PhotoCard
      source={photoFor(item.imageURL)}
      height={200}
      radius={26}
      width={cardWidth}
      title={item.title}
      titleSize={16}
      captionInset={16}
      accessibilityLabel={item.title}
      topLeft={minutes(item) > 0 ? <Tag tone="glassDark" label={t('browseUi.minutes', '{{n}} min', { n: minutes(item) })} /> : undefined}
      onPress={() => handleRecipePress(item)}
    />
  );

  const renderCookbook = ({ item }: { item: Cookbook }) => (
    <PhotoCard
      source={photoFor(item.coverImageURL)}
      height={170}
      title={item.title}
      subtitle={item.description}
      accessibilityLabel={item.title}
      topRight={
        <UIconButton
          icon="bookmark"
          tone="glassDark"
          size={44}
          iconSize="sm"
          filled={isCookbookSaved(item.id)}
          label={isCookbookSaved(item.id) ? t('browseUi.unsave', 'Remove from saved') : t('browseUi.save', 'Save recipe')}
          onPress={() => toggleCookbookSave(item.id)}
        />
      }
      onPress={() => handleCookbookPress(item)}
    />
  );

  const searchSummary = isShowingSearch
    ? isSearching
      ? t('browseUi.searching', 'Searching...')
      : t('browseUi.resultsFor', '{{n}} results for "{{q}}"', { n: results.length, q: searchText })
    : isSearchingCookbooks
      ? t('browseUi.cookbooksFor', '{{n}} cookbooks for "{{q}}"', { n: displayedCookbooks.length, q: searchText })
      : null;

  const renderFeatured = () => {
    if (!featured) return null;
    return (
      <PhotoCard
        source={photoFor(featured.imageURL)}
        height={250}
        fade="both"
        accessibilityLabel={featured.title}
        topLeft={
          featured.isOfficial ? <Tag tone="glassDark" large label={t('browseUi.chefsPick', "Chef's Pick")} /> : undefined
        }
        topRight={<Tag tone="glassDark" large icon="heart" label={String(featured.likes ?? 0)} />}
        glassBarTone="dark"
        glassBar={
          <>
            <View className="flex-1" style={{ minWidth: 0, gap: 4 }}>
              <Title numberOfLines={1} style={{ fontSize: 17 }}>
                {featured.title}
              </Title>
              <Muted small numberOfLines={1}>
                {[minutes(featured) > 0 ? t('browseUi.minutes', '{{n}} min', { n: minutes(featured) }) : null, difficultyLabel(featured)]
                  .filter(Boolean)
                  .join(' · ')}
              </Muted>
            </View>
            <View
              className="bg-paper items-center justify-center"
              style={{ width: 44, height: 44, borderRadius: 22 }}
            >
              <Icon name="arrowUpRight" color="night" />
            </View>
          </>
        }
        onPress={() => handleRecipePress(featured)}
      />
    );
  };

  const renderListHeader = () => (
    <View style={{ gap: 14, paddingBottom: 14 }}>
      {searchSummary ? <Muted small>{searchSummary}</Muted> : null}
      {activeTab === 'recipes' ? renderFeatured() : null}
    </View>
  );

  const renderEmpty = () => {
    const loading = activeTab === 'recipes' ? recipesLoading : cookbooksLoading;
    if (loading) {
      return (
        <View style={{ paddingVertical: 48 }}>
          <ActivityIndicator color={spinner} />
        </View>
      );
    }
    if (isShowingSearch || isSearchingCookbooks) {
      return (
        <View className="items-center" style={{ paddingVertical: 40, gap: 6 }}>
          <Title>{t('browseUi.noResults', 'No results found')}</Title>
          <Muted center>{t('browseUi.noResultsBody', 'Try different keywords or filters')}</Muted>
        </View>
      );
    }
    if (activeTab === 'cookbooks') {
      return (
        <View className="items-center" style={{ paddingVertical: 40, gap: 6 }}>
          <Title>{t('browseUi.noCookbooks', 'No cookbooks yet')}</Title>
          <Muted center>{t('browseUi.noCookbooksBody', 'Chef-curated cookbook collections will appear here')}</Muted>
        </View>
      );
    }
    return (
      <View className="items-center" style={{ paddingVertical: 40, gap: 12 }}>
        <Title>{t('browseUi.noRecipes', 'No recipes yet')}</Title>
        <Muted center>{t('browseUi.noRecipesBody', 'Be the first to share a recipe')}</Muted>
        <UButton size="sm" label={t('browseUi.createRecipe', 'Create a recipe')} onPress={() => router.push('/(tabs)/upload')} />
      </View>
    );
  };

  const renderFooter = () =>
    activeTab === 'recipes' && hasMore && !isShowingSearch && recipesLoading && displayedRecipes.length > 0 ? (
      <View style={{ paddingVertical: 16 }}>
        <ActivityIndicator color={spinner} />
      </View>
    ) : null;

  const refreshControl = <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />;

  return (
    <Screen bare>
      <TopBar
        title={isMealSelection ? t('browseUi.chooseRecipe', 'Choose a Recipe') : t('browseUi.title', 'Discover')}
        right={
          activeTab === 'recipes' && !isShowingSearch ? (
            <UIconButton
              icon="filters"
              tone={showFilters ? 'black' : 'default'}
              label={t('browseUi.filters', 'Filters')}
              onPress={() => setShowFilters((v) => !v)}
            />
          ) : undefined
        }
      />
      <View style={{ paddingHorizontal: 20, gap: 14, paddingBottom: 14 }}>
        {isMealSelection ? (
          <UCard>
            <View className="flex-row items-center" style={{ gap: 12 }}>
              <Icon name="clock" color="accent-text" />
              <View className="flex-1">
                <Title numberOfLines={2}>
                  {t('browseUi.selectFor', 'Select a recipe for {{meal}}', { meal: params.selectForMeal })}
                </Title>
                <Muted small>{params.date}</Muted>
              </View>
              <UIconButton icon="close" size={44} label={t('general.cancel', 'Cancel')} onPress={() => router.back()} />
            </View>
          </UCard>
        ) : null}
        <UInput
          icon="search"
          label={t('browseUi.searchLabel', 'Search recipes')}
          placeholder={
            activeTab === 'recipes'
              ? t('browseUi.searchPlaceholder', 'Search recipes, cuisines…')
              : t('browseUi.searchCookbooks', 'Search cookbooks...')
          }
          value={searchText}
          onChangeText={handleSearchChange}
          autoCorrect={false}
          returnKeyType="search"
          right={
            searchText.length > 0 ? (
              <UIconButton icon="close" size={44} label={t('browseUi.clearSearch', 'Clear search')} onPress={handleClearSearch} />
            ) : undefined
          }
        />
      </View>
      <ChipRow>
        <Chip
          label={t('browseUi.all', 'All')}
          on={activeTab === 'recipes' && !filters.category}
          onPress={() => {
            setActiveTab('recipes');
            applyFilters({ ...filters, category: undefined });
          }}
        />
        {CATEGORY_CHIPS.map((c) => (
          <Chip
            key={c.id}
            label={t(`browseUi.cat.${c.key}`, c.label)}
            on={activeTab === 'recipes' && filters.category === c.id}
            onPress={() => selectCategory(c.id)}
          />
        ))}
        <Chip
          label={t('browseUi.cookbooks', 'Cookbooks')}
          on={activeTab === 'cookbooks'}
          onPress={() => setActiveTab('cookbooks')}
        />
      </ChipRow>

      {/* Sponsored Ad: compact, hidden for ad-free subscribers */}
      {!adFree && <SponsoredAdCard placement="browse" compact />}

      {/* Full filter set (cuisine, difficulty, time, calories, dietary) */}
      {activeTab === 'recipes' && !isShowingSearch && showFilters ? (
        <RecipeFilters filters={filters} onApplyFilters={applyFilters} onClearFilters={clearFilters} />
      ) : null}

      {activeTab === 'recipes' ? (
        <FlatList
          key="recipes"
          data={gridRecipes}
          renderItem={renderRecipe}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={{ gap: 12, marginBottom: 12 }}
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 14, paddingBottom: 130, flexGrow: 1 }}
          showsVerticalScrollIndicator={false}
          refreshControl={refreshControl}
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          ListHeaderComponent={renderListHeader}
          ListFooterComponent={renderFooter}
          ListEmptyComponent={featured ? null : renderEmpty}
        />
      ) : (
        <FlatList
          key="cookbooks"
          data={displayedCookbooks}
          renderItem={renderCookbook}
          keyExtractor={(item) => item.id}
          ItemSeparatorComponent={() => <View style={{ height: 14 }} />}
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 14, paddingBottom: 130, flexGrow: 1 }}
          showsVerticalScrollIndicator={false}
          refreshControl={refreshControl}
          ListHeaderComponent={renderListHeader}
          ListEmptyComponent={renderEmpty}
        />
      )}
    </Screen>
  );
}
