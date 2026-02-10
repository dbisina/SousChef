import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Share,
  StyleSheet,
  Image,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useCookbookLibraryStore } from '@/stores/cookbookLibraryStore';
import { useThemeColors } from '@/stores/themeStore';
import { CookbookRecipeContent } from '@/types/cookbookLibrary';

export default function ShelfRecipeScreen() {
  const { id, cookbookId } = useLocalSearchParams<{ id: string; cookbookId: string }>();
  const router = useRouter();
  const colors = useThemeColors();

  const cookbooks = useCookbookLibraryStore((s) => s.cookbooks);
  const fetchFullRecipe = useCookbookLibraryStore((s) => s.fetchFullRecipe);

  const cookbook = cookbooks.find((c) => c.id === cookbookId);
  const recipe = cookbook?.recipes.find((r) => r.id === id);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(false);
  const [checkedServings, setCheckedServings] = useState<Set<number>>(new Set());

  const bookColor = cookbook?.coverColor || '#6366F1';
  const content: CookbookRecipeContent | undefined = recipe?.fullContent;

  useEffect(() => {
    if (recipe && !recipe.fullContent) {
      loadFullRecipe();
    }
  }, [recipe?.id]);

  const loadFullRecipe = useCallback(async () => {
    if (!cookbookId || !id) return;
    setIsLoading(true);
    setError(false);
    try {
      const success = await fetchFullRecipe(cookbookId, id);
      if (!success) setError(true);
    } catch {
      setError(true);
    } finally {
      setIsLoading(false);
    }
  }, [cookbookId, id, fetchFullRecipe]);

  const handleShare = async () => {
    if (!recipe || !cookbook) return;
    try {
      await Share.share({
        message: `Check out "${recipe.name}" from ${cookbook.title}!\n\nFound on SousChef App`,
      });
    } catch (e) {
      console.error(e);
    }
  };

  const toggleInstruction = (index: number) => {
    setCheckedServings((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  if (!cookbook || !recipe) {
    return (
      <SafeAreaView className="flex-1 bg-white dark:bg-neutral-900 items-center justify-center px-4">
        <Ionicons name="alert-circle-outline" size={64} color="#EF4444" />
        <Text className="text-xl font-semibold text-neutral-900 dark:text-neutral-100 mt-4">
          Recipe not found
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

  return (
    <View className="flex-1 bg-neutral-50 dark:bg-neutral-900">
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Recipe Image Hero (when available) */}
        {content?.imageURL ? (
          <View className="relative">
            <Image
              source={{ uri: content.imageURL }}
              className="w-full"
              style={{ height: 260 }}
              resizeMode="cover"
            />
            {/* Gradient overlay into header */}
            <LinearGradient
              colors={['transparent', bookColor]}
              style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 100 }}
            />
            {/* Back button over image */}
            <SafeAreaView edges={['top']} className="absolute top-0 left-0 right-0">
              <View className="flex-row items-center justify-between pr-4 pl-4 pt-2">
                <TouchableOpacity
                  onPress={() => router.back()}
                  className="w-10 h-10 rounded-full bg-black/30 items-center justify-center"
                >
                  <Ionicons name="arrow-back" size={24} color="white" />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleShare}
                  className="w-10 h-10 rounded-full bg-black/30 items-center justify-center"
                >
                  <Ionicons name="share-outline" size={20} color="white" />
                </TouchableOpacity>
              </View>
            </SafeAreaView>
          </View>
        ) : null}

        {/* Hero Header */}
        <View style={{ backgroundColor: bookColor }}>
          {/* Spine accent */}
          <LinearGradient
            colors={[
              'rgba(255,255,255,0.3)',
              'rgba(255,255,255,0.05)',
              'rgba(0,0,0,0.05)',
              'rgba(0,0,0,0.12)',
            ]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 18, zIndex: 10 }}
          />
          <View
            className="absolute top-0 bottom-0 w-[1px] bg-black/10"
            style={{ left: 18, zIndex: 10 }}
          />

          <SafeAreaView edges={content?.imageURL ? [] : ['top']}>
            {/* Nav — only show when there's no image hero above */}
            {!content?.imageURL && (
            <View className="flex-row items-center justify-between pr-4 pl-7 pt-2 pb-1">
              <TouchableOpacity
                onPress={() => router.back()}
                className="w-10 h-10 rounded-full bg-black/20 items-center justify-center"
              >
                <Ionicons name="arrow-back" size={24} color="white" />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleShare}
                className="w-10 h-10 rounded-full bg-black/20 items-center justify-center"
              >
                <Ionicons name="share-outline" size={20} color="white" />
              </TouchableOpacity>
            </View>
            )}

            {/* Recipe title */}
            <View className="pr-6 pl-8 pt-4 pb-8">
              {/* Cookbook source badge */}
              <TouchableOpacity
                onPress={() => router.back()}
                className="bg-white/15 self-start px-3 py-1 rounded-full flex-row items-center mb-3"
              >
                <Ionicons name="book" size={12} color="white" />
                <Text className="text-white/80 text-xs font-medium ml-1.5" numberOfLines={1}>
                  {cookbook.title}
                </Text>
              </TouchableOpacity>

              <Text
                className="text-white font-bold text-2xl leading-tight"
                style={{
                  textShadowColor: 'rgba(0,0,0,0.2)',
                  textShadowOffset: { width: 0, height: 1 },
                  textShadowRadius: 3,
                }}
              >
                {recipe.name}
              </Text>

              {recipe.pageNumber ? (
                <Text className="text-white/50 text-sm mt-1">Page {recipe.pageNumber}</Text>
              ) : null}

              {/* Quick meta badges */}
              {content && (
                <Animated.View entering={FadeIn.duration(400)} className="flex-row flex-wrap gap-2 mt-4">
                  <View className="bg-white/20 px-3 py-1.5 rounded-full flex-row items-center">
                    <Ionicons name="time-outline" size={14} color="white" />
                    <Text className="text-white text-xs font-medium ml-1">
                      {content.prepTime + content.cookTime} min
                    </Text>
                  </View>
                  <View className="bg-white/20 px-3 py-1.5 rounded-full flex-row items-center">
                    <Ionicons name="people-outline" size={14} color="white" />
                    <Text className="text-white text-xs font-medium ml-1">
                      {content.servings} servings
                    </Text>
                  </View>
                  <View className="bg-white/20 px-3 py-1.5 rounded-full flex-row items-center">
                    <Ionicons name="speedometer-outline" size={14} color="white" />
                    <Text className="text-white text-xs font-medium ml-1 capitalize">
                      {content.difficulty}
                    </Text>
                  </View>
                  {content.nutrition && (
                    <View className="bg-white/20 px-3 py-1.5 rounded-full flex-row items-center">
                      <Ionicons name="flame-outline" size={14} color="white" />
                      <Text className="text-white text-xs font-medium ml-1">
                        {content.nutrition.caloriesPerServing} cal
                      </Text>
                    </View>
                  )}
                </Animated.View>
              )}
            </View>
          </SafeAreaView>
        </View>

        {/* Loading state */}
        {isLoading && (
          <View className="py-20 items-center">
            <ActivityIndicator size="large" color={bookColor} />
            <Text className="text-neutral-500 dark:text-neutral-400 mt-4 text-base font-medium">
              Loading full recipe...
            </Text>
            <Text className="text-neutral-400 dark:text-neutral-500 mt-1 text-sm">
              Fetching from {cookbook.title}
            </Text>
          </View>
        )}

        {/* Error state */}
        {error && !isLoading && (
          <View className="py-16 items-center px-8">
            <View
              className="w-16 h-16 rounded-full items-center justify-center mb-4"
              style={{ backgroundColor: bookColor + '15' }}
            >
              <Ionicons name="warning-outline" size={32} color={bookColor} />
            </View>
            <Text className="text-lg font-bold text-neutral-700 dark:text-neutral-300 text-center">
              Couldn't load recipe
            </Text>
            <Text className="text-neutral-500 dark:text-neutral-400 text-center mt-2 mb-4">
              We had trouble fetching the full recipe details. Try again?
            </Text>
            <TouchableOpacity
              onPress={loadFullRecipe}
              className="py-3 px-6 rounded-xl flex-row items-center"
              style={{ backgroundColor: bookColor }}
            >
              <Ionicons name="refresh" size={18} color="#fff" />
              <Text className="text-white font-bold ml-2">Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Full recipe content */}
        {content && !isLoading && (
          <View className="pb-24">
            {/* Description */}
            {content.description ? (
              <Animated.View
                entering={FadeInDown.duration(300).delay(50)}
                className="mx-5 mt-5 p-4 rounded-2xl bg-white dark:bg-neutral-800"
                style={styles.card}
              >
                <Text className="text-neutral-700 dark:text-neutral-300 leading-relaxed text-[15px]">
                  {content.description}
                </Text>
              </Animated.View>
            ) : null}

            {/* Time breakdown */}
            <Animated.View
              entering={FadeInDown.duration(300).delay(100)}
              className="mx-5 mt-3 flex-row gap-3"
            >
              <View className="flex-1 p-4 rounded-2xl bg-white dark:bg-neutral-800 items-center" style={styles.card}>
                <View
                  className="w-10 h-10 rounded-full items-center justify-center mb-2"
                  style={{ backgroundColor: bookColor + '15' }}
                >
                  <Ionicons name="cut-outline" size={20} color={bookColor} />
                </View>
                <Text className="text-xl font-bold text-neutral-900 dark:text-neutral-100">
                  {content.prepTime}
                </Text>
                <Text className="text-xs text-neutral-500 dark:text-neutral-400">min prep</Text>
              </View>
              <View className="flex-1 p-4 rounded-2xl bg-white dark:bg-neutral-800 items-center" style={styles.card}>
                <View
                  className="w-10 h-10 rounded-full items-center justify-center mb-2"
                  style={{ backgroundColor: bookColor + '15' }}
                >
                  <Ionicons name="flame-outline" size={20} color={bookColor} />
                </View>
                <Text className="text-xl font-bold text-neutral-900 dark:text-neutral-100">
                  {content.cookTime}
                </Text>
                <Text className="text-xs text-neutral-500 dark:text-neutral-400">min cook</Text>
              </View>
              <View className="flex-1 p-4 rounded-2xl bg-white dark:bg-neutral-800 items-center" style={styles.card}>
                <View
                  className="w-10 h-10 rounded-full items-center justify-center mb-2"
                  style={{ backgroundColor: bookColor + '15' }}
                >
                  <Ionicons name="time-outline" size={20} color={bookColor} />
                </View>
                <Text className="text-xl font-bold text-neutral-900 dark:text-neutral-100">
                  {content.prepTime + content.cookTime}
                </Text>
                <Text className="text-xs text-neutral-500 dark:text-neutral-400">min total</Text>
              </View>
            </Animated.View>

            {/* Ingredients */}
            <Animated.View
              entering={FadeInDown.duration(300).delay(150)}
              className="mx-5 mt-5"
            >
              <View className="flex-row items-center mb-3">
                <Ionicons name="cart-outline" size={20} color={bookColor} />
                <Text className="text-lg font-bold text-neutral-900 dark:text-neutral-100 ml-2">
                  Ingredients
                </Text>
                <View className="bg-neutral-200 dark:bg-neutral-700 px-2 py-0.5 rounded-full ml-2">
                  <Text className="text-xs font-medium text-neutral-600 dark:text-neutral-400">
                    {content.ingredients.length}
                  </Text>
                </View>
              </View>

              <View className="rounded-2xl bg-white dark:bg-neutral-800 overflow-hidden" style={styles.card}>
                {content.ingredients.map((ing, index) => (
                  <View
                    key={`${ing.name}-${index}`}
                    className={`flex-row items-center px-4 py-3 ${
                      index < content.ingredients.length - 1
                        ? 'border-b border-neutral-100 dark:border-neutral-700'
                        : ''
                    }`}
                  >
                    <View
                      className="w-2 h-2 rounded-full mr-3"
                      style={{ backgroundColor: bookColor }}
                    />
                    <Text className="flex-1 text-neutral-800 dark:text-neutral-200 text-[15px]">
                      {ing.name}
                    </Text>
                    <Text className="text-neutral-500 dark:text-neutral-400 text-sm font-medium">
                      {ing.amount} {ing.unit}
                    </Text>
                  </View>
                ))}
              </View>
            </Animated.View>

            {/* Instructions */}
            <Animated.View
              entering={FadeInDown.duration(300).delay(200)}
              className="mx-5 mt-5"
            >
              <View className="flex-row items-center mb-3">
                <Ionicons name="list-outline" size={20} color={bookColor} />
                <Text className="text-lg font-bold text-neutral-900 dark:text-neutral-100 ml-2">
                  Instructions
                </Text>
              </View>

              {content.instructions.map((step, index) => {
                const isChecked = checkedServings.has(index);
                return (
                  <TouchableOpacity
                    key={index}
                    onPress={() => toggleInstruction(index)}
                    activeOpacity={0.7}
                    className="mb-3"
                  >
                    <View
                      className="rounded-2xl bg-white dark:bg-neutral-800 overflow-hidden"
                      style={styles.card}
                    >
                      <View className="flex-row">
                        {/* Step number */}
                        <View
                          className="w-12 items-center justify-start pt-4"
                          style={{ backgroundColor: isChecked ? bookColor + '08' : bookColor + '10' }}
                        >
                          <View
                            className="w-7 h-7 rounded-full items-center justify-center"
                            style={{
                              backgroundColor: isChecked ? bookColor : bookColor + '20',
                            }}
                          >
                            {isChecked ? (
                              <Ionicons name="checkmark" size={16} color="white" />
                            ) : (
                              <Text
                                className="text-xs font-bold"
                                style={{ color: bookColor }}
                              >
                                {index + 1}
                              </Text>
                            )}
                          </View>
                        </View>

                        {/* Step text */}
                        <View className="flex-1 p-4">
                          <Text
                            className={`text-[15px] leading-relaxed ${
                              isChecked
                                ? 'text-neutral-400 dark:text-neutral-500 line-through'
                                : 'text-neutral-800 dark:text-neutral-200'
                            }`}
                          >
                            {step}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </Animated.View>

            {/* Tips */}
            {content.tips ? (
              <Animated.View
                entering={FadeInDown.duration(300).delay(250)}
                className="mx-5 mt-5"
              >
                <View
                  className="p-4 rounded-2xl border"
                  style={{
                    backgroundColor: bookColor + '08',
                    borderColor: bookColor + '25',
                  }}
                >
                  <View className="flex-row items-center mb-2">
                    <Ionicons name="bulb-outline" size={18} color={bookColor} />
                    <Text className="font-bold ml-2" style={{ color: bookColor }}>
                      Chef's Tip
                    </Text>
                  </View>
                  <Text className="text-neutral-700 dark:text-neutral-300 text-sm leading-relaxed">
                    {content.tips}
                  </Text>
                </View>
              </Animated.View>
            ) : null}

            {/* Nutrition */}
            {content.nutrition && (
              <Animated.View
                entering={FadeInDown.duration(300).delay(300)}
                className="mx-5 mt-5"
              >
                <View className="flex-row items-center mb-3">
                  <Ionicons name="nutrition-outline" size={20} color={bookColor} />
                  <Text className="text-lg font-bold text-neutral-900 dark:text-neutral-100 ml-2">
                    Nutrition
                  </Text>
                  <Text className="text-neutral-400 dark:text-neutral-500 text-xs ml-2">
                    per serving
                  </Text>
                </View>

                <View className="flex-row gap-2">
                  {[
                    {
                      label: 'Calories',
                      value: content.nutrition.caloriesPerServing,
                      unit: 'kcal',
                      icon: 'flame-outline' as const,
                    },
                    {
                      label: 'Protein',
                      value: content.nutrition.protein,
                      unit: 'g',
                      icon: 'fitness-outline' as const,
                    },
                    {
                      label: 'Carbs',
                      value: content.nutrition.carbs,
                      unit: 'g',
                      icon: 'leaf-outline' as const,
                    },
                    {
                      label: 'Fat',
                      value: content.nutrition.fat,
                      unit: 'g',
                      icon: 'water-outline' as const,
                    },
                  ].map((item) => (
                    <View
                      key={item.label}
                      className="flex-1 p-3 rounded-xl bg-white dark:bg-neutral-800 items-center"
                      style={styles.card}
                    >
                      <Ionicons name={item.icon} size={18} color={bookColor} />
                      <Text className="text-lg font-bold text-neutral-900 dark:text-neutral-100 mt-1">
                        {item.value}
                      </Text>
                      <Text className="text-[10px] text-neutral-400 dark:text-neutral-500">
                        {item.unit}
                      </Text>
                      <Text className="text-[10px] text-neutral-500 dark:text-neutral-400 font-medium mt-0.5">
                        {item.label}
                      </Text>
                    </View>
                  ))}
                </View>
              </Animated.View>
            )}

            {/* Source attribution */}
            <Animated.View
              entering={FadeIn.duration(300).delay(350)}
              className="mx-5 mt-6 items-center"
            >
              <View className="flex-row items-center">
                <Ionicons name="book-outline" size={14} color={colors.textMuted} />
                <Text className="text-xs text-neutral-400 dark:text-neutral-500 ml-1">
                  From "{cookbook.title}"{cookbook.author ? ` by ${cookbook.author}` : ''}
                </Text>
              </View>
              <Text className="text-[10px] text-neutral-300 dark:text-neutral-600 mt-1">
                Recipe details generated by AI — may differ slightly from original
              </Text>
            </Animated.View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
});
