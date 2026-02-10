import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  StyleSheet,
  Dimensions,
  Alert,
  Platform,
  Image,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withRepeat,
  withSequence,
  withTiming,
  FadeIn,
  FadeInDown,
} from 'react-native-reanimated';
import { useAuthStore } from '@/stores/authStore';
import { useRecipeStore } from '@/stores/recipeStore';
import { usePantryStore } from '@/stores/pantryStore';
import { useWantToCookStore, safeTimestampMillis } from '@/stores/wantToCookStore';
import { useFeaturedCookbooks } from '@/hooks/useCookbooks';
import { useThemeColors } from '@/stores/themeStore';
import { Recipe } from '@/types';
import { RecipeCard, HorizontalRecipeCard } from '@/components/recipe';
import { HorizontalCookbookCard } from '@/components/cookbook';
import { Loading, Card, WelcomeModal, SponsoredAdCard } from '@/components/ui';
import { useSubscription } from '@/hooks/useSubscription';
import { getTierFeatures } from '@/services/subscriptionService';
import { URLImportModal, WantToCookCard, CookbookScanner, ShoppingListView } from '@/components/import';
import { useCookbookLibraryStore } from '@/stores/cookbookLibraryStore';
import { useShareIntentStore } from '@/stores/shareIntentStore';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function HomeScreen() {
  const router = useRouter();
  const { user, isGuest } = useAuthStore();
  const { recipes, isLoading, fetchRecipes } = useRecipeStore();
  const { items: pantryItems, getExpiringItems, getExpiredItems } = usePantryStore();
  const {
    items: wantToCookItems,
    shoppingList,
    fetchWantToCookItems,
    updatePantryMatches,
    addToShoppingList,
    markAsCooked,
    removeFromWantToCook,
  } = useWantToCookStore();
  const { cookbooks: featuredCookbooks, refresh: refreshCookbooks } = useFeaturedCookbooks(5);
  const { cookbooks: ownedCookbooks } = useCookbookLibraryStore();
  const colors = useThemeColors();
  const { subscriptionTier } = useSubscription();
  const adFree = getTierFeatures(subscriptionTier).adFree;
  
  // Check onboarding status
  useEffect(() => {
    const checkOnboarding = async () => {
      try {
        const completed = await AsyncStorage.getItem('@souschef_onboarding_complete');
        if (completed !== 'true') {
           router.replace('/onboarding');
        }
      } catch (e) {
        console.error('Failed to check onboarding status:', e);
      }
    };
    
    checkOnboarding();
  }, []);

  const { sharedURL, consumeSharedURL } = useShareIntentStore();
  const [refreshing, setRefreshing] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [shareIntentURL, setShareIntentURL] = useState<string | undefined>(undefined);

  // Handle incoming shared URLs
  useEffect(() => {
    if (sharedURL) {
      const url = consumeSharedURL();
      if (url) {
        setShareIntentURL(url);
        setShowImportModal(true);
      }
    }
  }, [sharedURL]);

  // Animations
  const importButtonScale = useSharedValue(1);
  const pulseAnim = useSharedValue(1);

  const expiringItems = getExpiringItems();
  const expiredItems = getExpiredItems();
  const alertCount = expiringItems.length + expiredItems.length;

  const savedRecipes = wantToCookItems.filter(i => i.status === 'saved');
  const oldSavedRecipes = savedRecipes.filter(item => {
    const millis = safeTimestampMillis(item.savedAt);
    const daysAgo = Math.floor((Date.now() - millis) / (1000 * 60 * 60 * 24));
    return daysAgo >= 7;
  });

  const popularRecipes = recipes
    .filter((r) => r.isOfficial)
    .slice(0, 5);

  useEffect(() => {
    fetchRecipes(true);
    if (user && !isGuest) {
      fetchWantToCookItems(user.id);
    } else {
      // Clear stale items from previous user session for guests / logged-out
      useWantToCookStore.setState({ items: [] });
    }
  }, [user]);

  // Update pantry matches when pantry changes
  useEffect(() => {
    if (pantryItems.length > 0) {
      updatePantryMatches(pantryItems);
    }
  }, [pantryItems, wantToCookItems.length]);

  // Pulse animation for import button
  useEffect(() => {
    pulseAnim.value = withRepeat(
      withSequence(
        withTiming(1.05, { duration: 1500 }),
        withTiming(1, { duration: 1500 })
      ),
      -1
    );
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      fetchRecipes(true),
      refreshCookbooks(),
      user ? fetchWantToCookItems(user.id) : Promise.resolve(),
    ]);
    setRefreshing(false);
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const handleImportSuccess = (title: string, recipeId?: string) => {
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    Alert.alert(
      'Recipe Imported! 🎉',
      `"${title}" has been added to your Want to Cook list.`,
      [
        { text: 'View Recipes', onPress: () => router.push('/want-to-cook' as any) },
        { text: 'OK', style: 'default' },
      ]
    );
    // Refresh items so the new recipe shows immediately
    if (user) fetchWantToCookItems(user.id);
  };

  const handleAddToShoppingList = useCallback((item: typeof wantToCookItems[0]) => {
    if (!item.importedRecipe) return;

    const ingredients = item.missingIngredients?.map(name => ({
      name,
      amount: 1,
      unit: 'item',
      recipeId: item.id,
      recipeName: item.importedRecipe?.title,
    })) || item.importedRecipe.ingredients.map(ing => ({
      name: ing.name,
      amount: ing.amount,
      unit: ing.unit,
      recipeId: item.id,
      recipeName: item.importedRecipe?.title,
    }));

    addToShoppingList(ingredients);

    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    Alert.alert('Added to List', `${ingredients.length} items added to your shopping list.`);
  }, []);

  const importButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseAnim.value }],
  }));

  // Don't redirect to login - allow guest access

  return (
    <View className="flex-1">
      {/* Welcome Modal */}
      <WelcomeModal />

      {/* Import Modal */}
      <URLImportModal
        visible={showImportModal}
        onClose={() => {
          setShowImportModal(false);
          setShareIntentURL(undefined);
        }}
        onSuccess={handleImportSuccess}
        initialURL={shareIntentURL}
      />

      {/* Cookbook Scanner */}
      <CookbookScanner
        visible={showScanner}
        onClose={() => setShowScanner(false)}
        onSuccess={handleImportSuccess}
      />

      {/* Gradient Background */}
      <LinearGradient
        colors={colors.gradientBg}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Decorative circles */}
      <View
        className="absolute w-64 h-64 rounded-full bg-primary-200/40"
        style={[styles.decorativeCircle, { top: -50, right: -50 }]}
      />
      <View
        className="absolute w-48 h-48 rounded-full bg-secondary-200/30"
        style={[styles.decorativeCircle, { top: 200, left: -80 }]}
      />

      <SafeAreaView className="flex-1" edges={['top']}>
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingBottom: 120 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.accent}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View className="px-5 pt-4 pb-4">
            <View className="flex-row items-center justify-between">
              <View>
                <Text className="text-neutral-500 dark:text-neutral-400 text-sm font-medium">
                  {getGreeting()}
                </Text>
                <Text className="text-3xl font-bold text-neutral-800 dark:text-neutral-100 mt-1">
                  {user?.displayName?.split(' ')[0] || 'Chef'}
                </Text>
              </View>
              <View className="flex-row items-center">
                <TouchableOpacity
                  onPress={() => router.push('/profile')}
                  className="rounded-full overflow-hidden border border-neutral-100"
                  style={styles.avatarContainer}
                >
                  {user?.photoURL ? (
                    <Image 
                      source={{ uri: user.photoURL }} 
                      className="w-12 h-12"
                      resizeMode="cover"
                    />
                  ) : (
                    <View className="w-12 h-12 items-center justify-center bg-primary-100">
                      <Text className="text-xl font-bold text-primary-600">
                        {user?.displayName?.charAt(0).toUpperCase() || 'U'}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* HERO: Import Recipe CTA */}
          <Animated.View
            entering={FadeInDown.duration(500).delay(100)}
            className="px-5 mb-6"
          >
            <Animated.View style={importButtonStyle}>
              <TouchableOpacity
                onPress={() => setShowImportModal(true)}
                activeOpacity={0.9}
              >
                <LinearGradient
                  colors={['#FF6B35', '#FF8F5A']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  className="rounded-3xl overflow-hidden"
                  style={styles.heroCard}
                >
                  <View className="p-6">
                    <View className="flex-row items-start justify-between">
                      <View className="flex-1">
                        <View className="flex-row items-center mb-2">
                          <View className="bg-white/20 px-3 py-1 rounded-full">
                            <Text className="text-white/90 text-xs font-semibold">
                              AI POWERED
                            </Text>
                          </View>
                        </View>
                        <Text className="text-2xl font-bold text-white mb-2">
                          Import Any Recipe
                        </Text>
                        <Text className="text-white/80 text-base leading-relaxed">
                          Paste a TikTok, Instagram, YouTube, or any recipe link
                        </Text>

                        <View className="flex-row items-center mt-4 bg-white/20 rounded-2xl p-3">
                          <Ionicons name="link-outline" size={20} color="white" />
                          <Text className="text-white/90 ml-2 flex-1" numberOfLines={1}>
                            https://...
                          </Text>
                          <View className="bg-white px-4 py-2 rounded-xl">
                            <Text className="text-primary-500 font-bold">Paste</Text>
                          </View>
                        </View>
                      </View>
                    </View>
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>
          </Animated.View>

          {/* Quick Actions Row */}
          <View className="px-5 mb-6">
            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={() => setShowScanner(true)}
                className="flex-1 rounded-2xl overflow-hidden"
                style={styles.quickAction}
                activeOpacity={0.85}
              >
                <BlurView intensity={50} tint="light" style={StyleSheet.absoluteFill} />
                <View className="items-center py-4 px-3 bg-white/70 flex-row justify-center">
                  <View className="w-10 h-10 rounded-xl bg-purple-100 items-center justify-center mr-3">
                    <Ionicons name="camera-outline" size={22} color="#9333EA" />
                  </View>
                  <View>
                    <Text className="text-sm font-semibold text-neutral-800">Scan</Text>
                    <Text className="text-xs text-neutral-500">Cookbook</Text>
                  </View>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => router.push('/cookbook-library' as any)}
                className="flex-1 rounded-2xl overflow-hidden"
                style={styles.quickAction}
                activeOpacity={0.85}
              >
                <BlurView intensity={50} tint="light" style={StyleSheet.absoluteFill} />
                <View className="items-center py-4 px-3 bg-white/70 flex-row justify-center">
                  <View className="w-10 h-10 rounded-xl bg-amber-100 items-center justify-center mr-3">
                    <Ionicons name="library-outline" size={22} color="#D97706" />
                  </View>
                  <View>
                    <Text className="text-sm font-semibold text-neutral-800">My</Text>
                    <Text className="text-xs text-neutral-500">Shelf</Text>
                  </View>
                </View>
              </TouchableOpacity>
            </View>
          </View>

          {/* Guest sign-up prompt */}
          {isGuest && (
            <Animated.View
              entering={FadeInDown.duration(400).delay(200)}
              className="px-5 mb-6"
            >
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={() => router.push('/auth/login')}
              >
                <View className="bg-indigo-50 border border-indigo-200 rounded-2xl p-4 flex-row items-center" style={styles.nudgeCard}>
                  <View className="w-10 h-10 rounded-xl bg-indigo-100 items-center justify-center">
                    <Ionicons name="person-add" size={20} color="#6366F1" />
                  </View>
                  <View className="flex-1 ml-3">
                    <Text className="text-indigo-800 font-semibold text-sm">
                      Create an account to sync & save
                    </Text>
                    <Text className="text-indigo-500 text-xs mt-0.5">
                      Your recipes are local until you sign up
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color="#6366F1" />
                </View>
              </TouchableOpacity>
            </Animated.View>
          )}

          {/* Want to Cook Section — CORE of the app */}
          {savedRecipes.length > 0 && (
            <View className="mb-6">
              <View className="flex-row items-center justify-between px-5 mb-4">
                <View>
                  <Text className="text-xl font-bold text-neutral-800">
                    Want to Cook
                  </Text>
                  <Text className="text-sm text-neutral-500 mt-0.5">
                    {savedRecipes.length} recipe{savedRecipes.length > 1 ? 's' : ''} saved
                  </Text>
                </View>
                <TouchableOpacity
                  className="flex-row items-center"
                  onPress={() => router.push('/want-to-cook' as any)}
                >
                  <Text className="text-primary-500 font-semibold mr-1">View all</Text>
                  <Ionicons name="arrow-forward" size={16} color="#F97316" />
                </TouchableOpacity>
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 20 }}
              >
                {savedRecipes.slice(0, 5).map((item, index) => (
                  <View key={item.id} style={{ width: SCREEN_WIDTH * 0.85, marginRight: 16 }}>
                    <WantToCookCard
                      item={item}
                      onPress={() => router.push(`/imported-recipe/${item.id}` as any)}
                      onAddToShoppingList={() => handleAddToShoppingList(item)}
                      onMarkAsCooked={() => markAsCooked(item.id)}
                      onRemove={() => {
                        Alert.alert(
                          'Remove Recipe',
                          'Are you sure you want to remove this recipe?',
                          [
                            { text: 'Cancel', style: 'cancel' },
                            { text: 'Remove', style: 'destructive', onPress: () => removeFromWantToCook(item.id) },
                          ]
                        );
                      }}
                    />
                  </View>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Empty State for Want to Cook */}
          {savedRecipes.length === 0 && (
            <Animated.View
              entering={FadeInDown.duration(500).delay(300)}
              className="px-5 mb-6"
            >
              <View className="bg-white rounded-3xl p-6 items-center" style={styles.sectionCard}>
                <View className="w-20 h-20 rounded-full bg-primary-50 items-center justify-center mb-4">
                  <Ionicons name="bookmark-outline" size={40} color="#FF6B35" />
                </View>
                <Text className="text-lg font-bold text-neutral-800 text-center mb-2">
                  Your Want to Cook list is empty
                </Text>
                <Text className="text-neutral-500 text-center mb-4">
                  Import a recipe from any website or video to get started
                </Text>
                <TouchableOpacity
                  onPress={() => setShowImportModal(true)}
                  className="bg-primary-500 px-6 py-3 rounded-xl flex-row items-center"
                >
                  <Ionicons name="add" size={20} color="white" />
                  <Text className="text-white font-semibold ml-2">Import First Recipe</Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          )}

          {/* Cooking Nudge - Old Saved Recipes */}
          {oldSavedRecipes.length > 0 && (
            <Animated.View
              entering={FadeInDown.duration(500).delay(200)}
              className="px-5 mb-6"
            >
              <TouchableOpacity activeOpacity={0.9} onPress={() => router.push('/want-to-cook' as any)}>
                <View className="bg-amber-50 border border-amber-200 rounded-2xl p-4" style={styles.nudgeCard}>
                  <View className="flex-row items-center">
                    <View className="w-12 h-12 rounded-xl bg-amber-100 items-center justify-center">
                      <Ionicons name="time-outline" size={24} color="#D97706" />
                    </View>
                    <View className="flex-1 ml-3">
                      <Text className="text-amber-800 font-bold text-base">
                        Time to cook!
                      </Text>
                      <Text className="text-amber-600 text-sm">
                        You have {oldSavedRecipes.length} recipe{oldSavedRecipes.length > 1 ? 's' : ''} saved for over a week
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="#D97706" />
                  </View>
                </View>
              </TouchableOpacity>
            </Animated.View>
          )}

          {/* Pantry Alert */}
          {alertCount > 0 && (
            <TouchableOpacity
              onPress={() => router.push('/(tabs)/pantry')}
              className="mx-5 mb-6"
            >
              <View className="rounded-2xl overflow-hidden" style={styles.alertCard}>
                <BlurView intensity={60} tint="light" style={StyleSheet.absoluteFill} />
                <View className="flex-row items-center p-4 bg-amber-50/70">
                  <View className="w-12 h-12 rounded-xl bg-amber-100/80 items-center justify-center">
                    <Ionicons name="warning-outline" size={24} color="#D97706" />
                  </View>
                  <View className="flex-1 ml-4">
                    <Text className="font-semibold text-amber-800 text-base">
                      Pantry Alert
                    </Text>
                    <Text className="text-sm text-amber-600 mt-0.5">
                      {expiredItems.length > 0
                        ? `${expiredItems.length} expired item(s)`
                        : `${expiringItems.length} item(s) expiring soon`}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#D97706" />
                </View>
              </View>
            </TouchableOpacity>
          )}

          {/* Shopping List — always visible when items exist */}
          {shoppingList.length > 0 && (
            <Animated.View
              entering={FadeIn.duration(300)}
              className="px-5 mb-6"
            >
              <View className="bg-white rounded-3xl p-4" style={styles.sectionCard}>
                <ShoppingListView compact onViewFull={() => router.push('/shopping-list' as any)} />
              </View>
            </Animated.View>
          )}

          {/* My Cookbook Shelf — show recent books with book-spine design */}
          {ownedCookbooks.length > 0 && (
            <View className="mb-6">
              <View className="flex-row items-center justify-between px-5 mb-4">
                <View>
                  <Text className="text-xl font-bold text-neutral-800">
                    My Shelf
                  </Text>
                  <Text className="text-sm text-neutral-500 mt-0.5">
                    {ownedCookbooks.length} cookbook{ownedCookbooks.length !== 1 ? 's' : ''}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => router.push('/cookbook-library' as any)}
                  className="flex-row items-center"
                >
                  <Text className="text-primary-500 font-semibold mr-1">See all</Text>
                  <Ionicons name="arrow-forward" size={16} color="#F97316" />
                </TouchableOpacity>
              </View>
              <FlatList
                data={ownedCookbooks.slice(0, 5)}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 20 }}
                keyExtractor={(item) => item.id}
                renderItem={({ item, index }) => {
                  const SHELF_COLORS = ['#B91C1C', '#1D4ED8', '#047857', '#7C3AED', '#C2410C', '#0F766E', '#4338CA', '#9D174D'];
                  const bookColor = item.coverColor || SHELF_COLORS[index % SHELF_COLORS.length];
                  const recipeCount = item.recipes?.length || 0;
                  const hasCoverImage = !!item.coverImageURL;
                  return (
                    <TouchableOpacity
                      onPress={() => router.push(`/shelf-cookbook/${item.id}` as any)}
                      className="mr-5 mb-2"
                      activeOpacity={0.9}
                    >
                      <View
                        className="w-40 h-60 rounded-r-lg rounded-l-sm overflow-hidden relative"
                        style={{
                          backgroundColor: bookColor,
                          shadowColor: '#000',
                          shadowOffset: { width: 4, height: 4 },
                          shadowOpacity: 0.3,
                          shadowRadius: 5,
                          elevation: 8,
                        }}
                      >
                        {/* Cover Image */}
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

                        {/* Content */}
                        {hasCoverImage ? (
                          <View className="flex-1 justify-end">
                            <LinearGradient
                              colors={['transparent', 'rgba(0,0,0,0.75)']}
                              className="px-3 pb-3 pt-12"
                            >
                              <Text className="text-white font-bold text-sm leading-tight" numberOfLines={2}
                                style={{ textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 }}>
                                {item.title}
                              </Text>
                              {recipeCount > 0 && (
                                <Text className="text-white/80 text-[10px] mt-1">{recipeCount} recipes</Text>
                              )}
                            </LinearGradient>
                          </View>
                        ) : (
                          <View className="flex-1 pr-5 pl-5 pt-5 pb-3 justify-between">
                            <View>
                              <Text className="text-white font-bold text-base leading-tight" numberOfLines={3}
                                style={{ textShadowColor: 'rgba(0,0,0,0.3)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 }}>
                                {item.title}
                              </Text>
                              {item.author ? (
                                <Text className="text-white/60 text-xs mt-1" numberOfLines={1}>
                                  {item.author}
                                </Text>
                              ) : null}
                            </View>
                            <View className="flex-row items-center justify-between">
                              {recipeCount > 0 ? (
                                <Text className="text-white/80 text-xs font-medium">
                                  {recipeCount} recipes
                                </Text>
                              ) : (
                                <Text className="text-white/50 text-xs">Loading...</Text>
                              )}
                            </View>
                          </View>
                        )}

                        {/* Decorative bottom line */}
                        {!hasCoverImage && (
                          <View className="absolute bottom-0 left-4 right-2 h-[0.5px] bg-white/15" />
                        )}
                      </View>

                      {/* Pages Effect */}
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
                  );
                }}
              />
            </View>
          )}

          {/* Cookbook Shelf CTA — Eitan's "tell the app which cookbooks you own" */}
          {ownedCookbooks.length === 0 && (
            <Animated.View
              entering={FadeInDown.duration(500).delay(300)}
              className="px-5 mb-6 rounded-2xl overflow-hidden"
            >
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={() => router.push('/cookbook-library' as any)}
                className="rounded-2xl overflow-hidden"
              >
                <LinearGradient
                  colors={['#F59E0B', '#D97706']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  className="rounded-2xl overflow-hidden p-4"
                  style={styles.nudgeCard}
                >
                  <View className="flex-row items-center p-6 ">
                    <View className="w-12 h-12 rounded-xl bg-white/20 items-center justify-center">
                      <Ionicons name="library" size={24} color="#fff" />
                    </View>
                    <View className="flex-1 ml-3">
                      <Text className="text-white font-bold text-base">
                        Add your cookbooks
                      </Text>
                      <Text className="text-white/80 text-sm mt-0.5">
                        We'll match recipes to what's in your fridge
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.8)" />
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>
          )}

          {/* Sponsored Ad — compact banner, hidden for Premium/Pro */}
          {!adFree && (
            <View className="mb-4">
              <SponsoredAdCard placement="home_feed" compact />
            </View>
          )}

          {/* Chef's Picks */}
          {popularRecipes.length > 0 && (
            <View className="mb-6">
              <View className="flex-row items-center justify-between px-5 mb-4">
                <View>
                  <Text className="text-xl font-bold text-neutral-800">
                    Chef's Picks
                  </Text>
                  <Text className="text-sm text-neutral-500 mt-0.5">
                    Handpicked recipes for you
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => router.push('/(tabs)/browse')}
                  className="flex-row items-center"
                >
                  <Text className="text-primary-500 font-semibold mr-1">See all</Text>
                  <Ionicons name="arrow-forward" size={16} color="#F97316" />
                </TouchableOpacity>
              </View>
              <FlatList
                data={popularRecipes}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 20 }}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <HorizontalRecipeCard
                    recipe={item}
                    onPress={() => router.push(`/recipe/${item.id}`)}
                  />
                )}
              />
            </View>
          )}

          {/* Featured Cookbooks */}
          {featuredCookbooks.length > 0 && (
            <View className="mb-6">
              <View className="flex-row items-center justify-between px-5 mb-4">
                <View>
                  <Text className="text-xl font-bold text-neutral-800">
                    Cookbooks
                  </Text>
                  <Text className="text-sm text-neutral-500 mt-0.5">
                    Curated collections
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => router.push('/(tabs)/browse')}
                  className="flex-row items-center"
                >
                  <Text className="text-primary-500 font-semibold mr-1">See all</Text>
                  <Ionicons name="arrow-forward" size={16} color="#F97316" />
                </TouchableOpacity>
              </View>
              <FlatList
                data={featuredCookbooks}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 20 }}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <HorizontalCookbookCard
                    cookbook={item}
                    onPress={() => router.push(`/cookbook/${item.id}` as any)}
                  />
                )}
              />
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  decorativeCircle: {
    position: 'absolute',
    opacity: 0.6,
  },
  avatarContainer: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  iconButton: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  heroCard: {
    shadowColor: '#FF6B35',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  quickAction: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  sectionCard: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  nudgeCard: {
    shadowColor: '#D97706',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
  },
  alertCard: {
    shadowColor: '#D97706',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
  },
});
