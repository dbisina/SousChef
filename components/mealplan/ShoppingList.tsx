import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  SectionList,
  SectionListData,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '@/stores/themeStore';
import {
  ShoppingListItem,
  ShoppingCategory,
  SHOPPING_CATEGORY_LABELS,
} from '@/types/mealplan';

interface ShoppingListProps {
  items: ShoppingListItem[];
  onToggleItem: (itemId: string) => void;
  onItemPress?: (item: ShoppingListItem) => void;
  showPantryIndicator?: boolean;
}

export const ShoppingList: React.FC<ShoppingListProps> = ({
  items,
  onToggleItem,
  onItemPress,
  showPantryIndicator = true,
}) => {
  // Group items by category
  const sections = React.useMemo(() => {
    const grouped = new Map<ShoppingCategory, ShoppingListItem[]>();

    items.forEach((item) => {
      const existing = grouped.get(item.category) || [];
      existing.push(item);
      grouped.set(item.category, existing);
    });

    const result: SectionListData<ShoppingListItem>[] = [];

    grouped.forEach((data, category) => {
      result.push({
        title: SHOPPING_CATEGORY_LABELS[category] || category,
        data,
      });
    });

    // Sort sections alphabetically
    return result.sort((a, b) => a.title.localeCompare(b.title));
  }, [items]);

  const renderItem = ({ item }: { item: ShoppingListItem }) => (
    <ShoppingListRow
      item={item}
      onToggle={() => onToggleItem(item.id)}
      onPress={onItemPress ? () => onItemPress(item) : undefined}
      showPantryIndicator={showPantryIndicator}
    />
  );

  const renderSectionHeader = ({
    section,
  }: {
    section: SectionListData<ShoppingListItem>;
  }) => (
    <View className="bg-neutral-100 dark:bg-neutral-700 px-4 py-2">
      <Text className="text-sm font-semibold text-neutral-600 dark:text-neutral-400 uppercase">
        {section.title}
      </Text>
    </View>
  );

  if (items.length === 0) {
    return (
      <View className="flex-1 items-center justify-center py-12">
        <Ionicons name="cart-outline" size={48} color="#D4D4D4" />
        <Text className="text-neutral-400 dark:text-neutral-500 mt-4 text-center">
          No items in your shopping list
        </Text>
        <Text className="text-neutral-400 dark:text-neutral-500 text-sm text-center mt-1">
          Generate a meal plan to create your list
        </Text>
      </View>
    );
  }

  return (
    <SectionList
      sections={sections}
      keyExtractor={(item) => item.id}
      renderItem={renderItem}
      renderSectionHeader={renderSectionHeader}
      stickySectionHeadersEnabled
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: 100 }}
    />
  );
};

// Individual shopping list row
interface ShoppingListRowProps {
  item: ShoppingListItem;
  onToggle: () => void;
  onPress?: () => void;
  showPantryIndicator: boolean;
}

const ShoppingListRow: React.FC<ShoppingListRowProps> = ({
  item,
  onToggle,
  onPress,
  showPantryIndicator,
}) => {
  const colors = useThemeColors();
  const needsToBuy = item.toBuy > 0;

  return (
    <TouchableOpacity
      onPress={onPress || onToggle}
      className={`flex-row items-center px-4 py-3 bg-white dark:bg-neutral-800 border-b border-neutral-100 dark:border-neutral-700 ${
        item.checked ? 'opacity-60' : ''
      }`}
    >
      {/* Checkbox */}
      <TouchableOpacity
        onPress={onToggle}
        className={`w-6 h-6 rounded-full border-2 items-center justify-center mr-3 ${
          item.checked
            ? 'bg-secondary-500 border-secondary-500'
            : 'border-neutral-300'
        }`}
      >
        {item.checked && (
          <Ionicons name="checkmark" size={14} color="white" />
        )}
      </TouchableOpacity>

      {/* Item info */}
      <View className="flex-1">
        <Text
          className={`text-base ${
            item.checked
              ? 'text-neutral-400 dark:text-neutral-500 line-through'
              : 'text-neutral-900 dark:text-neutral-50'
          }`}
        >
          {item.name}
        </Text>

        <View className="flex-row items-center mt-0.5">
          {/* Amount needed */}
          <Text className="text-sm text-neutral-500 dark:text-neutral-400">
            {needsToBuy
              ? `${item.toBuy} ${item.unit}`
              : `${item.amount} ${item.unit}`}
          </Text>

          {/* In pantry indicator */}
          {showPantryIndicator && item.inPantry && (
            <View className="flex-row items-center ml-2">
              <View className="w-1.5 h-1.5 rounded-full bg-secondary-400 mr-1" />
              <Text className="text-xs text-secondary-600">
                {item.pantryAmount} {item.unit} in pantry
              </Text>
            </View>
          )}
        </View>

        {/* Used in recipes */}
        {item.recipeNames.length > 0 && (
          <Text className="text-xs text-neutral-400 dark:text-neutral-500 mt-0.5" numberOfLines={1}>
            For: {item.recipeNames.join(', ')}
          </Text>
        )}
      </View>

      {/* Multi-recipe indicator */}
      {item.recipes.length > 1 && (
        <View className="bg-primary-100 px-2 py-1 rounded-full ml-2">
          <Text className="text-xs font-medium" style={{ color: colors.accent }}>
            x{item.recipes.length}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

// Shopping list summary component
interface ShoppingListSummaryProps {
  totalItems: number;
  checkedItems: number;
  itemsInPantry: number;
  itemsToBuy: number;
}

export const ShoppingListSummary: React.FC<ShoppingListSummaryProps> = ({
  totalItems,
  checkedItems,
  itemsInPantry,
  itemsToBuy,
}) => {
  const colors = useThemeColors();
  const progress = totalItems > 0 ? (checkedItems / totalItems) * 100 : 0;

  return (
    <View className="bg-white dark:bg-neutral-800 p-4 border-b border-neutral-100 dark:border-neutral-700">
      {/* Progress bar */}
      <View className="h-2 bg-neutral-100 dark:bg-neutral-700 rounded-full overflow-hidden mb-3">
        <View
          style={{ width: `${progress}%` }}
          className="h-full bg-secondary-500 rounded-full"
        />
      </View>

      {/* Stats */}
      <View className="flex-row justify-between">
        <View className="items-center">
          <Text className="text-lg font-bold text-neutral-900 dark:text-neutral-50">
            {checkedItems}/{totalItems}
          </Text>
          <Text className="text-xs text-neutral-500 dark:text-neutral-400">Checked</Text>
        </View>

        <View className="items-center">
          <Text className="text-lg font-bold text-secondary-600">
            {itemsInPantry}
          </Text>
          <Text className="text-xs text-neutral-500 dark:text-neutral-400">In Pantry</Text>
        </View>

        <View className="items-center">
          <Text className="text-lg font-bold" style={{ color: colors.accent }}>
            {itemsToBuy}
          </Text>
          <Text className="text-xs text-neutral-500 dark:text-neutral-400">To Buy</Text>
        </View>
      </View>
    </View>
  );
};
