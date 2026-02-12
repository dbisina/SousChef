import React, { useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useWantToCookStore } from '@/stores/wantToCookStore';
import { useThemeColors } from '@/stores/themeStore';
import { WantToCookCard } from '@/components/import';
import { WantToCookItem } from '@/types/wantToCook';
import { showSuccessToast } from '@/stores/toastStore';

export default function WantToCookScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const {
    items,
    addToShoppingList,
    markAsCooked,
    removeFromWantToCook,
  } = useWantToCookStore();

  const handleAddToShoppingList = useCallback((item: WantToCookItem) => {
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
    showSuccessToast('Ingredients are on your list! 🛒 See you at the store.', 'Added!');
  }, [addToShoppingList]);

  const handleRemove = useCallback((item: WantToCookItem) => {
    Alert.alert(
      'Remove Recipe?',
      'Are you sure you want to remove this recipe? You can always add it back later if you change your mind!',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => removeFromWantToCook(item.id),
        },
      ]
    );
  }, [removeFromWantToCook]);

  const renderItem = useCallback(({ item }: { item: WantToCookItem }) => (
    <View className="px-5 mb-2">
      <WantToCookCard
        item={item}
        onPress={() => {
          router.push(`/imported-recipe/${item.id}` as any);
        }}
        onAddToShoppingList={() => handleAddToShoppingList(item)}
        onMarkAsCooked={() => markAsCooked(item.id)}
        onRemove={() => handleRemove(item)}
      />
    </View>
  ), [handleAddToShoppingList, markAsCooked, handleRemove]);

  return (
    <SafeAreaView className="flex-1 bg-neutral-50 dark:bg-neutral-900" edges={['top']}>
      {/* Header */}
      <View className="flex-row items-center px-5 py-4 border-b border-neutral-100 dark:border-neutral-700 bg-white dark:bg-neutral-800">
        <TouchableOpacity onPress={() => router.back()} className="mr-3">
          <Ionicons name="arrow-back" size={24} color={colors.icon} />
        </TouchableOpacity>
        <View className="flex-1">
          <Text className="text-xl font-bold text-neutral-900 dark:text-neutral-50">Want to Cook</Text>
          <Text className="text-sm text-neutral-500 dark:text-neutral-400">
            {items.length} recipe{items.length !== 1 ? 's' : ''} saved
          </Text>
        </View>
      </View>

      {items.length > 0 ? (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingTop: 16, paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <View className="flex-1 items-center justify-center px-8">
          <Ionicons name="bookmark-outline" size={64} color={colors.textMuted} />
          <Text className="text-lg font-bold text-neutral-600 dark:text-neutral-400 mt-4 text-center">
            No saved recipes yet
          </Text>
          <Text className="text-neutral-400 dark:text-neutral-500 text-center mt-2">
            Import recipes from URLs or scan them from cookbooks to add them here
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
}
