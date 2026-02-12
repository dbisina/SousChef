import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  StyleSheet,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useCookbookLibraryStore } from '@/stores/cookbookLibraryStore';
import { usePantryStore } from '@/stores/pantryStore';
import { useThemeColors } from '@/stores/themeStore';
import { showSuccessToast, showErrorToast, showInfoToast, showWarningToast } from '@/stores/toastStore';
import { lookupCookbook, fetchBookCoverImage } from '@/services/cookbookLibraryService';
import { CookbookEntry, CookbookSuggestion } from '@/types/cookbookLibrary';
import { CookbookScanner } from '@/components/import';
import { CookbookSuggestionCarousel } from '@/components/cookbook';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const bookShadow = {
  shadowColor: '#000',
  shadowOffset: { width: 4, height: 4 },
  shadowOpacity: 0.3,
  shadowRadius: 5,
  elevation: 8,
};

export default function CookbookLibraryScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const {
    cookbooks,
    suggestions,
    isSuggesting,
    addCookbook,
    removeCookbook,
    getSuggestions,
    clearSuggestions,
    fetchRecipesForCookbook,
  } = useCookbookLibraryStore();
  const { items: pantryItems } = usePantryStore();

  const [showAddForm, setShowAddForm] = useState(false);
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [scannerCookbookId, setScannerCookbookId] = useState<string | null>(null);

  const handleAdd = useCallback(async () => {
    if (!title.trim()) return;

    setIsLookingUp(true);
    let cookbookId: string;
    try {
      // Fetch cookbook details and cover image in parallel
      const [details, coverImageURL] = await Promise.all([
        lookupCookbook(title),
        fetchBookCoverImage(title, author || undefined),
      ]);

      if (details) {
        cookbookId = addCookbook(details.title, details.author, {
          description: details.description,
          coverColor: details.coverColor,
          coverImageURL: coverImageURL || undefined,
        });
      } else {
        cookbookId = addCookbook(title, author || undefined, {
          coverImageURL: coverImageURL || undefined,
        });
      }
    } catch {
      cookbookId = addCookbook(title, author || undefined);
    }
    setIsLookingUp(false);
    setTitle('');
    setAuthor('');
    setShowAddForm(false);

    // Auto-fetch recipes from AI, then navigate to the cookbook
    fetchRecipesForCookbook(cookbookId).then(({ isComplete }) => {
      if (!isComplete) {
        Alert.alert(
          'Wait, we\'re missing a few! 📚',
          "We couldn't find all the recipes for this book online. Would you like to scan some pages from your physical copy to fill them in?",
          [
            { text: 'Scan Now', onPress: () => { setScannerCookbookId(cookbookId); setShowScanner(true); } },
            { text: 'Later', style: 'cancel' },
          ]
        );
      }
    });

    // Navigate immediately to the cookbook detail (shows loading)
    router.push(`/shelf-cookbook/${cookbookId}` as any);
  }, [title, author, addCookbook, fetchRecipesForCookbook, router]);

  const handleRemove = useCallback(
    (cookbook: CookbookEntry) => {
      Alert.alert('Remove Cookbook?', `Are you sure you want to remove "${cookbook.title}"? You'll lose all its recipes from your shelf.`, [
        { text: 'Keep It', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => removeCookbook(cookbook.id),
        },
      ]);
    },
    [removeCookbook]
  );

  const handleRetryFetch = useCallback(async (cookbook: CookbookEntry) => {
    const { isComplete } = await fetchRecipesForCookbook(cookbook.id);
    if (!isComplete) {
      Alert.alert(
        'Still Incomplete',
        'Would you like to scan your physical cookbook to add the recipes we couldn\'t find?',
        [
          { text: 'Scan Pages', onPress: () => { setScannerCookbookId(cookbook.id); setShowScanner(true); } },
          { text: 'Not Now', style: 'cancel' },
        ]
      );
    }
  }, [fetchRecipesForCookbook]);

  const handleScanSuccess = useCallback((recipeTitle: string) => {
    if (scannerCookbookId) {
      const store = useCookbookLibraryStore.getState();
      store.addScannedRecipe(scannerCookbookId, {
        id: `scanned-${Date.now()}`,
        name: recipeTitle,
        source: 'scanned',
      });
    }
  }, [scannerCookbookId]);

  const handlePressSuggestion = useCallback((suggestion: CookbookSuggestion) => {
    // Find the cookbook and recipe by name to navigate to the detail screen
    const cookbook = cookbooks.find(
      (c) => c.title.toLowerCase() === suggestion.cookbookTitle.toLowerCase()
    );
    if (!cookbook) {
      showErrorToast(`"${suggestion.cookbookTitle}" isn't on your shelf anymore! 📚`, 'Book Missing');
      return;
    }
    const recipe = cookbook.recipes?.find(
      (r) => r.name.toLowerCase() === suggestion.recipeName.toLowerCase()
    );
    if (!recipe) {
      showErrorToast(`We couldn't find "${suggestion.recipeName}" in that book. It might have been removed. 🍳`, 'Recipe Missing');
      return;
    }
    router.push({
      pathname: '/shelf-recipe/[id]',
      params: { id: recipe.id, cookbookId: cookbook.id },
    } as any);
  }, [cookbooks, router]);

  const handleGetSuggestions = useCallback(() => {
    if (cookbooks.length === 0) {
      showInfoToast('Add some cookbooks to your shelf so we can find the perfect recipe for you! 📚', 'Add a Book');
      return;
    }
    if (pantryItems.length === 0) {
      showInfoToast('Add some items to your pantry so we can match them with recipes you\'ll love! 🍎', 'Fill Your Pantry');
      return;
    }
    getSuggestions(pantryItems);
  }, [cookbooks, pantryItems, getSuggestions]);

  // Book cover colors - cycle through if AI didn't provide one
  const BOOK_COLORS = ['#B91C1C', '#1D4ED8', '#047857', '#7C3AED', '#C2410C', '#0F766E', '#4338CA', '#9D174D'];
  const getBookColor = (item: CookbookEntry, index: number) =>
    item.coverColor || BOOK_COLORS[index % BOOK_COLORS.length];

  const renderBookCover = ({ item, index }: { item: CookbookEntry; index: number }) => {
    const isFetching = item.fetchStatus === 'fetching';
    const recipeCount = item.recipes?.length || 0;
    const bookColor = getBookColor(item, index);
    const hasCoverImage = !!item.coverImageURL;

    return (
      <Animated.View entering={FadeInDown.duration(300).delay(index * 80)}>
        <TouchableOpacity
          onPress={() => router.push(`/shelf-cookbook/${item.id}` as any)}
          onLongPress={() => handleRemove(item)}
          activeOpacity={0.9}
          className="mb-5"
          style={{ width: (SCREEN_WIDTH - 60) / 2 }}
        >
          {/* Book Cover */}
          <View
            className="rounded-r-lg rounded-l-sm overflow-hidden relative"
            style={[{ height: 220, backgroundColor: bookColor }, bookShadow]}
          >
            {/* Cover Image (when available) */}
            {hasCoverImage && (
              <Image
                source={{ uri: item.coverImageURL }}
                style={{ position: 'absolute', width: '100%', height: '100%' }}
                resizeMode="cover"
              />
            )}

            {/* Spine Effect */}
            <LinearGradient
              colors={['rgba(255,255,255,0.35)', 'rgba(255,255,255,0.08)', 'rgba(0,0,0,0.05)', 'rgba(0,0,0,0.25)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 14, zIndex: 10 }}
            />
            <View
              className="absolute top-0 bottom-0 w-[0.5px] bg-black/20"
              style={{ left: 14, zIndex: 10 }}
            />

            {/* Embossed title area — only show text overlay when there's a cover image */}
            {hasCoverImage ? (
              <View className="flex-1 justify-end">
                <LinearGradient
                  colors={['transparent', 'rgba(0,0,0,0.7)']}
                  className="px-3 pb-3 pt-10"
                >
                  <Text className="text-white font-bold text-sm leading-tight" numberOfLines={2}
                    style={{ textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 }}>
                    {item.title}
                  </Text>
                  {item.author ? (
                    <Text className="text-white/80 text-[10px] mt-0.5 font-medium" numberOfLines={1}>
                      {item.author}
                    </Text>
                  ) : null}
                  {recipeCount > 0 && (
                    <View className="flex-row items-center bg-black/30 self-start px-2 py-0.5 rounded-full mt-1.5">
                      <Ionicons name="restaurant-outline" size={9} color="white" />
                      <Text className="text-white text-[9px] font-medium ml-1">{recipeCount}</Text>
                    </View>
                  )}
                </LinearGradient>
              </View>
            ) : (
              <View className="flex-1 pr-5 pl-[22px] pt-6 pb-3 justify-between">
                <View>
                  <Text className="text-white font-bold text-lg leading-tight" numberOfLines={3}
                    style={{ textShadowColor: 'rgba(0,0,0,0.3)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 }}>
                    {item.title}
                  </Text>
                  {item.author ? (
                    <Text className="text-white/70 text-xs mt-1.5 font-medium" numberOfLines={1}>
                      {item.author}
                    </Text>
                  ) : null}
                </View>

                <View>
                  {isFetching ? (
                    <View className="flex-row items-center">
                      <ActivityIndicator size={10} color="rgba(255,255,255,0.8)" />
                      <Text className="text-white/60 text-[10px] ml-1.5">Finding recipes...</Text>
                    </View>
                  ) : recipeCount > 0 ? (
                    <View className="flex-row items-center bg-black/20 self-start px-2 py-1 rounded-full">
                      <Ionicons name="restaurant-outline" size={10} color="white" />
                      <Text className="text-white text-[10px] font-medium ml-1">
                        {recipeCount} recipes
                      </Text>
                    </View>
                  ) : null}
                </View>
              </View>
            )}

            {/* Subtle decorative line at bottom */}
            {!hasCoverImage && (
              <View className="absolute bottom-0 left-4 right-2 h-[0.5px] bg-white/15" />
            )}
          </View>

          {/* Pages Effect (Right Edge) */}
          <View
            className="absolute top-1 bottom-1 -right-1.5 w-1.5 bg-neutral-100 rounded-r-sm border-r border-t border-b border-neutral-300"
            style={{ zIndex: -1 }}
          >
            <View className="h-full w-full flex-col justify-evenly opacity-30">
              {[...Array(8)].map((_, i) => (
                <View key={i} className="h-[0.5px] bg-black w-full" />
              ))}
            </View>
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-neutral-50 dark:bg-neutral-900" edges={['top']}>
      {/* Cookbook Scanner Modal */}
      <CookbookScanner
        visible={showScanner}
        onClose={() => { setShowScanner(false); setScannerCookbookId(null); }}
        onSuccess={handleScanSuccess}
      />

      {/* Header */}
      <View className="flex-row items-center px-5 py-4 border-b border-neutral-100 dark:border-neutral-700 bg-white dark:bg-neutral-800">
        <TouchableOpacity onPress={() => router.back()} className="mr-3">
          <Ionicons name="arrow-back" size={24} color={colors.icon} />
        </TouchableOpacity>
        <View className="flex-1">
          <Text className="text-xl font-bold text-neutral-900 dark:text-neutral-50">
            My Cookbook Shelf
          </Text>
          <Text className="text-sm text-neutral-500 dark:text-neutral-400">
            {cookbooks.length} cookbook{cookbooks.length !== 1 ? 's' : ''} · {cookbooks.reduce((sum, c) => sum + (c.recipes?.length || 0), 0)} recipes
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => setShowAddForm(true)}
          className="bg-amber-500 w-9 h-9 rounded-full items-center justify-center"
        >
          <Ionicons name="add" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        <FlatList
          data={cookbooks}
          keyExtractor={(item) => item.id}
          renderItem={renderBookCover}
          numColumns={2}
          columnWrapperStyle={{ justifyContent: 'space-between', paddingHorizontal: 20 }}
          contentContainerStyle={{ paddingTop: 16, paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <>
              {/* Add form */}
              {showAddForm && (
                <Animated.View entering={FadeInDown.duration(300)} className="mx-5 mb-4 p-4 rounded-2xl bg-white dark:bg-neutral-800 border border-amber-200 dark:border-amber-800">
                  <Text className="font-bold text-neutral-900 dark:text-neutral-50 mb-1">
                    Add a Cookbook
                  </Text>
                  <Text className="text-xs text-neutral-500 dark:text-neutral-400 mb-3">
                    We'll search online for all the recipes in it
                  </Text>
                  <TextInput
                    value={title}
                    onChangeText={setTitle}
                    placeholder='e.g. "Salt, Fat, Acid, Heat"'
                    placeholderTextColor={colors.textMuted}
                    className="p-3 mb-2 rounded-xl bg-neutral-100 dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100"
                    autoFocus
                  />
                  <TextInput
                    value={author}
                    onChangeText={setAuthor}
                    placeholder="Author (optional — helps find the right book)"
                    placeholderTextColor={colors.textMuted}
                    className="p-3 mb-3 rounded-xl bg-neutral-100 dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100"
                  />
                  <View className="flex-row gap-2">
                    <TouchableOpacity
                      onPress={() => {
                        setShowAddForm(false);
                        setTitle('');
                        setAuthor('');
                      }}
                      className="flex-1 py-3 rounded-xl bg-neutral-200 dark:bg-neutral-600 items-center"
                    >
                      <Text className="font-semibold text-neutral-700 dark:text-neutral-300">Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={handleAdd}
                      disabled={!title.trim() || isLookingUp}
                      className="flex-1 py-3 rounded-xl bg-amber-500 items-center flex-row justify-center"
                      style={{ opacity: !title.trim() || isLookingUp ? 0.5 : 1 }}
                    >
                      {isLookingUp ? (
                        <>
                          <ActivityIndicator size="small" color="#fff" />
                          <Text className="font-semibold text-white ml-2">Finding...</Text>
                        </>
                      ) : (
                        <>
                          <Ionicons name="sparkles" size={16} color="#fff" />
                          <Text className="font-semibold text-white ml-1.5">Add & Fetch Recipes</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                </Animated.View>
              )}

              {/* Suggestion carousel */}
              {(suggestions.length > 0 || isSuggesting) && (
                <CookbookSuggestionCarousel
                  suggestions={suggestions}
                  onClear={clearSuggestions}
                  onPressSuggestion={handlePressSuggestion}
                  isSuggesting={isSuggesting}
                />
              )}

              {/* What can I cook? button */}
              {cookbooks.length > 0 && (
                <TouchableOpacity
                  onPress={handleGetSuggestions}
                  disabled={isSuggesting}
                  className={`mx-5 mb-4 p-4 rounded-2xl items-center flex-row justify-center ${
                    suggestions.length > 0
                      ? 'border border-amber-400 dark:border-amber-600'
                      : 'bg-amber-500'
                  }`}
                  style={{ opacity: isSuggesting ? 0.7 : 1 }}
                >
                  {isSuggesting ? (
                    <ActivityIndicator size="small" color={suggestions.length > 0 ? '#D97706' : '#fff'} className="mr-2" />
                  ) : (
                    <Ionicons
                      name={suggestions.length > 0 ? 'refresh' : 'sparkles'}
                      size={20}
                      color={suggestions.length > 0 ? '#D97706' : '#fff'}
                      style={{ marginRight: 8 }}
                    />
                  )}
                  <Text className={`font-bold text-base ${
                    suggestions.length > 0
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-white'
                  }`}>
                    {isSuggesting
                      ? 'Finding recipes...'
                      : suggestions.length > 0
                        ? 'Refresh suggestions'
                        : 'What can I cook from my books?'}
                  </Text>
                </TouchableOpacity>
              )}

              {/* Shelf label */}
              {cookbooks.length > 0 && (
                <Text className="px-5 mb-2 font-bold text-neutral-900 dark:text-neutral-50 text-base">
                  Your Shelf
                </Text>
              )}
            </>
          }
          ListEmptyComponent={
            !showAddForm ? (
              <View className="items-center justify-center px-8 py-16">
                <Ionicons name="library-outline" size={64} color={colors.textMuted} />
                <Text className="text-lg font-bold text-neutral-600 dark:text-neutral-400 mt-4 text-center">
                  Your cookbook shelf is empty
                </Text>
                <Text className="text-neutral-400 dark:text-neutral-500 text-center mt-2 mb-6">
                  Add a cookbook and we'll automatically find all its recipes online. If we can't find them, you can scan the pages.
                </Text>
                <TouchableOpacity
                  onPress={() => setShowAddForm(true)}
                  className="flex-row items-center bg-amber-500 px-6 py-3 rounded-full"
                >
                  <Ionicons name="add" size={20} color="#fff" />
                  <Text className="font-bold text-white ml-2">Add Your First Cookbook</Text>
                </TouchableOpacity>
              </View>
            ) : null
          }
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
