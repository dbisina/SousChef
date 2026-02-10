import React, { useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  TouchableOpacity,
  Share,
  Alert,
  Linking,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useWantToCookStore } from '@/stores/wantToCookStore';
import { useAuthStore } from '@/stores/authStore';
import { DifficultyBadge, TimeBadge, Badge, Button } from '@/components/ui';
import { SimpleIngredientList, InstructionList } from '@/components/recipe';
import { useThemeColors } from '@/stores/themeStore';
import { getCategoryEmoji } from '@/lib/utils';

export default function ImportedRecipeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuthStore();
  const {
    items,
    addToShoppingList,
    markAsCooked,
    removeFromWantToCook,
  } = useWantToCookStore();

  const item = useMemo(() => items.find((i) => i.id === id), [items, id]);
  const recipe = item?.importedRecipe;
  const colors = useThemeColors();

  if (!item || !recipe) {
    return (
      <SafeAreaView className="flex-1 bg-white dark:bg-neutral-900 items-center justify-center px-4">
        <Ionicons name="alert-circle-outline" size={64} color="#EF4444" />
        <Text className="text-xl font-semibold text-neutral-900 dark:text-neutral-50 mt-4">
          Recipe not found
        </Text>
        <Text className="text-neutral-500 dark:text-neutral-400 text-center mt-2">
          This recipe may have been removed.
        </Text>
        <Button title="Go Back" onPress={() => router.back()} className="mt-6" />
      </SafeAreaView>
    );
  }

  const totalTime = (recipe.prepTime || 0) + (recipe.cookTime || 0);

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Check out this recipe: ${recipe.title}\n${recipe.sourceURL || ''}`.trim(),
      });
    } catch (e) {
      console.error(e);
    }
  };

  const handleOpenSource = () => {
    if (recipe.sourceURL) Linking.openURL(recipe.sourceURL);
  };

  const handleAddToShoppingList = () => {
    const ingredients = item.missingIngredients?.map((name) => ({
      name,
      amount: 1,
      unit: 'item',
      recipeId: item.id,
      recipeName: recipe.title,
    })) || recipe.ingredients.map((ing) => ({
      name: ing.name,
      amount: ing.amount,
      unit: ing.unit,
      recipeId: item.id,
      recipeName: recipe.title,
    }));

    addToShoppingList(ingredients);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert('Added!', 'Ingredients added to your shopping list.');
  };

  const handleMarkCooked = () => {
    markAsCooked(item.id);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert('Nice! 🎉', 'Recipe marked as cooked!');
  };

  const handleRemove = () => {
    Alert.alert('Remove Recipe', 'Are you sure you want to remove this recipe?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          removeFromWantToCook(item.id);
          router.back();
        },
      },
    ]);
  };

  const platformIcon =
    recipe.sourcePlatform === 'youtube' ? 'logo-youtube' :
    recipe.sourcePlatform === 'tiktok' ? 'logo-tiktok' :
    recipe.sourcePlatform === 'instagram' ? 'logo-instagram' :
    recipe.sourcePlatform === 'x' ? 'logo-twitter' :
    'globe-outline';

  return (
    <View className="flex-1 bg-white dark:bg-neutral-900">
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Hero Image */}
        <View className="relative">
          {recipe.imageURL ? (
            <Image
              source={{ uri: recipe.imageURL }}
              className="w-full h-72"
              resizeMode="cover"
            />
          ) : (
            <LinearGradient
              colors={[colors.accent, colors.accent + 'CC']}
              className="w-full h-72 items-center justify-center"
            >
              <Ionicons name="restaurant-outline" size={64} color="white" />
            </LinearGradient>
          )}

          {/* Gradient overlay */}
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.5)']}
            className="absolute inset-0"
          />

          {/* Top bar */}
          <SafeAreaView className="absolute top-0 left-0 right-0">
            <View className="flex-row items-center justify-between px-4 pt-2">
              <TouchableOpacity
                onPress={() => router.back()}
                className="w-10 h-10 rounded-full bg-black/30 items-center justify-center"
              >
                <Ionicons name="arrow-back" size={24} color="white" />
              </TouchableOpacity>
              <View className="flex-row" style={{ gap: 8 }}>
                <TouchableOpacity
                  onPress={handleShare}
                  className="w-10 h-10 rounded-full bg-black/30 items-center justify-center"
                >
                  <Ionicons name="share-outline" size={22} color="white" />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleRemove}
                  className="w-10 h-10 rounded-full bg-black/30 items-center justify-center"
                >
                  <Ionicons name="trash-outline" size={22} color="white" />
                </TouchableOpacity>
              </View>
            </View>
          </SafeAreaView>

          {/* Source badge */}
          {recipe.sourcePlatform && (
            <View className="absolute bottom-4 left-4">
              <TouchableOpacity
                onPress={handleOpenSource}
                className="bg-black/60 px-3 py-1.5 rounded-full flex-row items-center"
              >
                <Ionicons name={platformIcon as any} size={16} color="white" />
                <Text className="text-white text-sm font-medium ml-1.5 capitalize">
                  {recipe.sourcePlatform}
                </Text>
                <Ionicons name="open-outline" size={12} color="white" style={{ marginLeft: 4 }} />
              </TouchableOpacity>
            </View>
          )}

          {/* Confidence badge */}
          <View className="absolute bottom-4 right-4">
            <View className="bg-black/60 px-3 py-1.5 rounded-full flex-row items-center">
              <Ionicons name="sparkles" size={14} color="#FFD700" />
              <Text className="text-white text-sm font-medium ml-1">
                {Math.round(recipe.extractionConfidence * 100)}% match
              </Text>
            </View>
          </View>
        </View>

        {/* Content */}
        <View className="px-4 py-6">
          {/* Title */}
          <Text className="text-2xl font-bold text-neutral-900 dark:text-neutral-50">
            {recipe.title}
          </Text>

          {/* Description */}
          {recipe.description ? (
            <Text className="text-neutral-600 dark:text-neutral-400 mt-2 leading-relaxed">
              {recipe.description}
            </Text>
          ) : null}

          {/* Badges */}
          <View className="flex-row flex-wrap mt-4" style={{ gap: 8 }}>
            {recipe.difficulty && <DifficultyBadge difficulty={recipe.difficulty} />}
            {totalTime > 0 && <TimeBadge minutes={totalTime} />}
            {recipe.category && (
              <Badge
                label={`${getCategoryEmoji(recipe.category)} ${recipe.category}`}
                variant="default"
              />
            )}
            {recipe.cuisine && (
              <Badge label={recipe.cuisine} variant="info" />
            )}
          </View>

          {/* Quick stats */}
          <View className="flex-row justify-around mt-6 py-4 bg-neutral-50 dark:bg-neutral-800 rounded-xl">
            <View className="items-center">
              <Text className="text-xl font-bold text-neutral-900 dark:text-neutral-50">
                {recipe.prepTime || '—'}
              </Text>
              <Text className="text-sm text-neutral-500 dark:text-neutral-400">Prep (min)</Text>
            </View>
            <View className="w-px bg-neutral-200 dark:bg-neutral-700" />
            <View className="items-center">
              <Text className="text-xl font-bold text-neutral-900 dark:text-neutral-50">
                {recipe.cookTime || '—'}
              </Text>
              <Text className="text-sm text-neutral-500 dark:text-neutral-400">Cook (min)</Text>
            </View>
            <View className="w-px bg-neutral-200 dark:bg-neutral-700" />
            <View className="items-center">
              <Text className="text-xl font-bold text-neutral-900 dark:text-neutral-50">
                {recipe.servings}
              </Text>
              <Text className="text-sm text-neutral-500 dark:text-neutral-400">Servings</Text>
            </View>
          </View>

          {/* Pantry Match */}
          {item.pantryMatchPercent !== undefined && (
            <View className="mt-4 p-4 bg-emerald-50 dark:bg-emerald-950 rounded-xl flex-row items-center">
              <Ionicons name="basket" size={24} color="#10B981" />
              <View className="ml-3 flex-1">
                <Text className="text-emerald-800 dark:text-emerald-300 font-semibold">
                  {item.pantryMatchPercent}% Pantry Match
                </Text>
                {item.missingIngredients && item.missingIngredients.length > 0 && (
                  <Text className="text-emerald-600 dark:text-emerald-400 text-sm mt-0.5">
                    Missing: {item.missingIngredients.join(', ')}
                  </Text>
                )}
              </View>
            </View>
          )}

          {/* Ingredients */}
          <View className="mt-6">
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-xl font-bold text-neutral-900 dark:text-neutral-50">
                Ingredients
              </Text>
              <Text className="text-neutral-500 dark:text-neutral-400">
                {recipe.ingredients.length} items
              </Text>
            </View>
            <View className="bg-neutral-50 dark:bg-neutral-800 rounded-xl p-4">
              <SimpleIngredientList ingredients={recipe.ingredients} />
            </View>
          </View>

          {/* Instructions */}
          <View className="mt-6">
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-xl font-bold text-neutral-900 dark:text-neutral-50">
                Instructions
              </Text>
              <Text className="text-neutral-500 dark:text-neutral-400">
                {recipe.instructions.length} steps
              </Text>
            </View>
            <InstructionList instructions={recipe.instructions} />
          </View>

          {/* Tags */}
          {recipe.tags && recipe.tags.length > 0 && (
            <View className="mt-6">
              <Text className="text-sm font-medium text-neutral-500 dark:text-neutral-400 mb-2">
                Tags
              </Text>
              <View className="flex-row flex-wrap" style={{ gap: 8 }}>
                {recipe.tags.map((tag) => (
                  <Badge key={tag} label={`#${tag}`} variant="default" />
                ))}
              </View>
            </View>
          )}

          {/* Source link */}
          {recipe.sourceURL && (
            <TouchableOpacity
              onPress={handleOpenSource}
              className="mt-6 p-4 bg-neutral-50 dark:bg-neutral-800 rounded-xl flex-row items-center"
            >
              <Ionicons name={platformIcon as any} size={20} color="#6366F1" />
              <Text className="text-indigo-600 font-medium ml-2 flex-1" numberOfLines={1}>
                View original on {recipe.sourcePlatform || 'web'}
              </Text>
              <Ionicons name="open-outline" size={16} color="#6366F1" />
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      {/* Bottom action bar */}
      <SafeAreaView edges={['bottom']} className="bg-white dark:bg-neutral-800 border-t border-neutral-100 dark:border-neutral-700">
        <View className="px-4 py-3 flex-row" style={{ gap: 12 }}>
          <TouchableOpacity
            onPress={handleAddToShoppingList}
            className="flex-row items-center px-4 py-3 bg-neutral-100 dark:bg-neutral-700 rounded-xl"
          >
            <Ionicons name="cart-outline" size={20} color={colors.accent} />
            <Text className="ml-2 font-medium text-neutral-700 dark:text-neutral-300">Shop</Text>
          </TouchableOpacity>

          {item.status !== 'cooked' ? (
            <TouchableOpacity
              onPress={handleMarkCooked}
              className="flex-1 flex-row items-center justify-center py-3 rounded-xl"
              style={{ backgroundColor: colors.accent }}
            >
              <Ionicons name="checkmark-circle" size={20} color="white" />
              <Text className="text-white font-semibold ml-2">Mark as Cooked</Text>
            </TouchableOpacity>
          ) : (
            <View className="flex-1 flex-row items-center justify-center py-3 bg-green-100 rounded-xl">
              <Ionicons name="checkmark-circle" size={20} color="#22C55E" />
              <Text className="text-green-700 font-semibold ml-2">Cooked!</Text>
            </View>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}
