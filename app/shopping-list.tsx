import React from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '@/stores/themeStore';
import { ShoppingListView } from '@/components/import';

export default function WantToCookShoppingScreen() {
  const router = useRouter();
  const colors = useThemeColors();

  return (
    <SafeAreaView className="flex-1 bg-neutral-50 dark:bg-neutral-900" edges={['top']}>
      {/* Header */}
      <View className="flex-row items-center px-5 py-4 border-b border-neutral-100 dark:border-neutral-700 bg-white dark:bg-neutral-800">
        <TouchableOpacity onPress={() => router.back()} className="mr-3">
          <Ionicons name="arrow-back" size={24} color={colors.icon} />
        </TouchableOpacity>
        <View className="flex-1">
          <Text className="text-xl font-bold text-neutral-900 dark:text-neutral-50">Shopping List</Text>
          <Text className="text-sm text-neutral-500 dark:text-neutral-400">
            Check items off, then move them to your pantry
          </Text>
        </View>
      </View>

      {/* Full shopping list (not compact) */}
      <View className="flex-1 px-5 pt-4">
        <ShoppingListView compact={false} />
      </View>
    </SafeAreaView>
  );
}
