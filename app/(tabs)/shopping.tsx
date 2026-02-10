import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useWantToCookStore } from '@/stores/wantToCookStore';
import { usePantryStore } from '@/stores/pantryStore';
import { useThemeColors } from '@/stores/themeStore';
import { ShoppingListView } from '@/components/import';

export default function ShoppingTab() {
  const router = useRouter();
  const colors = useThemeColors();
  const { shoppingList, clearShoppingList } = useWantToCookStore();
  const { addItem } = usePantryStore();

  const checkedCount = shoppingList.filter((i) => i.checked).length;
  const totalCount = shoppingList.length;
  const progressPercent = totalCount > 0 ? Math.round((checkedCount / totalCount) * 100) : 0;

  const handleClearList = () => {
    if (shoppingList.length === 0) return;
    Alert.alert(
      'Clear Shopping List',
      'Remove all items from your shopping list?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: () => {
            clearShoppingList();
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-neutral-50 dark:bg-neutral-900" edges={['top']}>
      {/* Header */}
      <View className="px-5 pt-4 pb-3">
        <View className="flex-row items-center justify-between">
          <View>
            <Text className="text-2xl font-bold text-neutral-800 dark:text-neutral-100">
              Shopping List
            </Text>
            {totalCount > 0 && (
              <Text className="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">
                {checkedCount} of {totalCount} items checked
              </Text>
            )}
          </View>
          {totalCount > 0 && (
            <TouchableOpacity
              onPress={handleClearList}
              className="bg-neutral-100 dark:bg-neutral-800 px-3 py-2 rounded-xl"
            >
              <Ionicons name="trash-outline" size={18} color="#EF4444" />
            </TouchableOpacity>
          )}
        </View>

        {/* Progress bar */}
        {totalCount > 0 && (
          <View className="mt-3">
            <View className="h-2 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
              <View
                className="h-full rounded-full"
                style={{
                  width: `${progressPercent}%`,
                  backgroundColor: progressPercent === 100 ? '#10B981' : colors.accent,
                }}
              />
            </View>
          </View>
        )}
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        {totalCount > 0 ? (
          <View className="px-5 pt-2">
            <ShoppingListView compact={false} />
          </View>
        ) : (
          /* Empty state */
          <Animated.View
            entering={FadeInDown.duration(400)}
            className="items-center justify-center px-8 pt-20"
          >
            <View className="w-24 h-24 rounded-full bg-primary-50 dark:bg-primary-950 items-center justify-center mb-5">
              <Ionicons name="cart-outline" size={48} color={colors.accent} />
            </View>
            <Text className="text-xl font-bold text-neutral-800 dark:text-neutral-100 text-center mb-2">
              Your shopping list is empty
            </Text>
            <Text className="text-neutral-500 dark:text-neutral-400 text-center mb-6 leading-relaxed">
              Import a recipe, then tap "Add to Shopping List" to automatically generate your grocery list
            </Text>

            {/* Quick action cards */}
            <View className="w-full gap-3">
              <TouchableOpacity
                onPress={() => router.push('/want-to-cook' as any)}
                className="bg-white dark:bg-neutral-800 rounded-2xl p-4 flex-row items-center"
                style={styles.card}
              >
                <View className="w-12 h-12 rounded-xl bg-primary-50 items-center justify-center mr-3">
                  <Ionicons name="bookmark" size={22} color={colors.accent} />
                </View>
                <View className="flex-1">
                  <Text className="font-semibold text-neutral-800 dark:text-neutral-100">
                    View Saved Recipes
                  </Text>
                  <Text className="text-sm text-neutral-500 dark:text-neutral-400">
                    Add ingredients from your saved recipes
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => router.push('/(tabs)/pantry' as any)}
                className="bg-white dark:bg-neutral-800 rounded-2xl p-4 flex-row items-center"
                style={styles.card}
              >
                <View className="w-12 h-12 rounded-xl bg-emerald-50 items-center justify-center mr-3">
                  <Ionicons name="basket" size={22} color="#10B981" />
                </View>
                <View className="flex-1">
                  <Text className="font-semibold text-neutral-800 dark:text-neutral-100">
                    Check Your Pantry
                  </Text>
                  <Text className="text-sm text-neutral-500 dark:text-neutral-400">
                    See what you already have at home
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
          </Animated.View>
        )}
      </ScrollView>
    </SafeAreaView>
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
