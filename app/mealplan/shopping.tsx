import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Share, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useShoppingList } from '@/hooks/useMealPlan';
import { ShoppingList, ShoppingListSummary } from '@/components/mealplan';
import { Loading, Empty } from '@/components/ui';
import { SHOPPING_CATEGORY_LABELS, ShoppingCategory } from '@/types/mealplan';

export default function ShoppingListScreen() {
  const router = useRouter();
  const {
    shoppingList,
    totalItems,
    checkedItems,
    itemsInPantry,
    totalToBuy,
    toggleItem,
    clearChecked,
    getCategorizedItems,
  } = useShoppingList();

  const [filterMode, setFilterMode] = useState<'all' | 'toBuy' | 'inPantry'>('all');

  // Filter items based on mode
  const filteredItems = React.useMemo(() => {
    switch (filterMode) {
      case 'toBuy':
        return shoppingList.filter((item) => item.toBuy > 0 && !item.checked);
      case 'inPantry':
        return shoppingList.filter((item) => item.inPantry);
      default:
        return shoppingList;
    }
  }, [shoppingList, filterMode]);

  // Share shopping list
  const handleShare = async () => {
    const itemsToBuy = shoppingList.filter((item) => item.toBuy > 0 && !item.checked);

    if (itemsToBuy.length === 0) {
      Alert.alert('Nothing to Share', 'Your shopping list is empty or all items are checked.');
      return;
    }

    // Group by category for nice formatting
    const grouped = new Map<ShoppingCategory, string[]>();
    itemsToBuy.forEach((item) => {
      const existing = grouped.get(item.category) || [];
      existing.push(`- ${item.toBuy} ${item.unit} ${item.name}`);
      grouped.set(item.category, existing);
    });

    let message = '🛒 Shopping List from SousChef\n\n';
    grouped.forEach((items, category) => {
      message += `📦 ${SHOPPING_CATEGORY_LABELS[category]}\n`;
      message += items.join('\n');
      message += '\n\n';
    });

    try {
      await Share.share({
        message,
        title: 'Shopping List',
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  // Clear all checked items
  const handleClearChecked = () => {
    if (checkedItems === 0) return;

    Alert.alert(
      'Clear Checked Items',
      `Remove ${checkedItems} checked item${checkedItems !== 1 ? 's' : ''} from the list?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => {
            clearChecked();
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-neutral-50" edges={['top']}>
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-3 bg-white border-b border-neutral-100">
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#404040" />
        </TouchableOpacity>
        <Text className="text-lg font-bold text-neutral-900">Shopping List</Text>
        <View className="flex-row">
          <TouchableOpacity onPress={handleShare} className="p-2">
            <Ionicons name="share-outline" size={22} color="#404040" />
          </TouchableOpacity>
          {checkedItems > 0 && (
            <TouchableOpacity onPress={handleClearChecked} className="p-2">
              <Ionicons name="trash-outline" size={22} color="#EF4444" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Summary */}
      <ShoppingListSummary
        totalItems={totalItems}
        checkedItems={checkedItems}
        itemsInPantry={itemsInPantry}
        itemsToBuy={totalToBuy}
      />

      {/* Filter tabs */}
      <View className="flex-row px-4 py-2 bg-white border-b border-neutral-100">
        <TouchableOpacity
          onPress={() => setFilterMode('all')}
          className={`flex-1 py-2 rounded-lg mr-2 ${
            filterMode === 'all' ? 'bg-primary-500' : 'bg-neutral-100'
          }`}
        >
          <Text
            className={`text-center font-medium ${
              filterMode === 'all' ? 'text-white' : 'text-neutral-600'
            }`}
          >
            All ({totalItems})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setFilterMode('toBuy')}
          className={`flex-1 py-2 rounded-lg mr-2 ${
            filterMode === 'toBuy' ? 'bg-primary-500' : 'bg-neutral-100'
          }`}
        >
          <Text
            className={`text-center font-medium ${
              filterMode === 'toBuy' ? 'text-white' : 'text-neutral-600'
            }`}
          >
            To Buy ({totalToBuy})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setFilterMode('inPantry')}
          className={`flex-1 py-2 rounded-lg ${
            filterMode === 'inPantry' ? 'bg-primary-500' : 'bg-neutral-100'
          }`}
        >
          <Text
            className={`text-center font-medium ${
              filterMode === 'inPantry' ? 'text-white' : 'text-neutral-600'
            }`}
          >
            In Pantry ({itemsInPantry})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Shopping list */}
      <ShoppingList
        items={filteredItems}
        onToggleItem={toggleItem}
        showPantryIndicator={filterMode !== 'inPantry'}
      />

      {/* Tip card at bottom */}
      {totalToBuy > 0 && (
        <View className="absolute bottom-0 left-0 right-0 p-4 bg-white border-t border-neutral-100">
          <View className="flex-row items-center bg-primary-50 rounded-xl p-3">
            <Ionicons name="bulb-outline" size={20} color="#FF6B35" />
            <Text className="text-primary-700 text-sm ml-2 flex-1">
              Tap items to check them off as you shop
            </Text>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}
