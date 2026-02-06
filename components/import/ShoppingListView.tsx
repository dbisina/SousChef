import React, { memo, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import Animated, {
  useAnimatedStyle,
  withSpring,
  useSharedValue,
  FadeIn,
  FadeOut,
  Layout,
  SlideOutLeft,
} from 'react-native-reanimated';
import { useWantToCookStore } from '@/stores/wantToCookStore';
import { QuickShoppingItem } from '@/types/wantToCook';

interface ShoppingListViewProps {
  compact?: boolean;
  onViewFull?: () => void;
}

const ShoppingItem = memo<{
  item: QuickShoppingItem;
  onToggle: () => void;
  onRemove: () => void;
}>(({ item, onToggle, onRemove }) => {
  const scale = useSharedValue(1);

  const handlePress = () => {
    scale.value = withSpring(0.95, {}, () => {
      scale.value = withSpring(1);
    });
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onToggle();
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      exiting={SlideOutLeft.duration(200)}
      layout={Layout.springify()}
      style={animatedStyle}
    >
      <TouchableOpacity
        onPress={handlePress}
        onLongPress={onRemove}
        activeOpacity={0.7}
        className={`flex-row items-center p-4 mb-2 rounded-2xl ${
          item.checked ? 'bg-neutral-100' : 'bg-white'
        }`}
        style={{
          shadowColor: item.checked ? 'transparent' : '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.05,
          shadowRadius: 8,
          elevation: item.checked ? 0 : 2,
        }}
      >
        {/* Checkbox */}
        <View
          className={`w-7 h-7 rounded-full border-2 items-center justify-center mr-3 ${
            item.checked
              ? 'bg-green-500 border-green-500'
              : 'border-neutral-300'
          }`}
        >
          {item.checked && (
            <Ionicons name="checkmark" size={16} color="white" />
          )}
        </View>

        {/* Content */}
        <View className="flex-1">
          <Text
            className={`text-base font-medium ${
              item.checked ? 'text-neutral-400 line-through' : 'text-neutral-900'
            }`}
          >
            {item.name}
          </Text>
          <View className="flex-row items-center mt-0.5">
            <Text className="text-neutral-500 text-sm">
              {item.amount} {item.unit}
            </Text>
            {item.recipeName && (
              <>
                <View className="w-1 h-1 rounded-full bg-neutral-300 mx-2" />
                <Text className="text-neutral-400 text-sm" numberOfLines={1}>
                  {item.recipeName}
                </Text>
              </>
            )}
          </View>
        </View>

        {/* Remove button */}
        <TouchableOpacity
          onPress={onRemove}
          className="w-8 h-8 items-center justify-center"
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="close-circle" size={20} color="#D1D5DB" />
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  );
});

ShoppingItem.displayName = 'ShoppingItem';

export const ShoppingListView: React.FC<ShoppingListViewProps> = ({
  compact = false,
  onViewFull,
}) => {
  const {
    shoppingList,
    toggleShoppingItem,
    removeFromShoppingList,
    clearCheckedItems,
    clearShoppingList,
  } = useWantToCookStore();

  // Group items by recipe
  const groupedItems = useMemo(() => {
    const groups: Record<string, QuickShoppingItem[]> = {};
    shoppingList.forEach((item) => {
      const key = item.recipeName || 'Other';
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    });
    return groups;
  }, [shoppingList]);

  const checkedCount = shoppingList.filter((i) => i.checked).length;
  const totalCount = shoppingList.length;
  const progress = totalCount > 0 ? (checkedCount / totalCount) * 100 : 0;

  if (totalCount === 0) {
    return (
      <View className="items-center py-12">
        <View className="w-20 h-20 rounded-full bg-neutral-100 items-center justify-center mb-4">
          <Ionicons name="cart-outline" size={40} color="#D1D5DB" />
        </View>
        <Text className="text-lg font-semibold text-neutral-400 mb-1">
          No items yet
        </Text>
        <Text className="text-neutral-400 text-center px-8">
          Import a recipe and add ingredients to your shopping list
        </Text>
      </View>
    );
  }

  const displayItems = compact ? shoppingList.slice(0, 5) : shoppingList;

  return (
    <View className="flex-1">
      {/* Header with progress */}
      <View className="mb-4">
        <View className="flex-row items-center justify-between mb-2">
          <View className="flex-row items-center">
            <Ionicons name="cart" size={20} color="#FF6B35" />
            <Text className="text-lg font-bold text-neutral-900 ml-2">
              Shopping List
            </Text>
          </View>
          <Text className="text-neutral-500">
            {checkedCount}/{totalCount} items
          </Text>
        </View>

        {/* Progress bar */}
        <View className="h-2 bg-neutral-100 rounded-full overflow-hidden">
          <Animated.View
            style={{ width: `${progress}%` }}
            className="h-full bg-green-500 rounded-full"
          />
        </View>
      </View>

      {/* Items */}
      {compact ? (
        <View>
          {displayItems.map((item) => (
            <ShoppingItem
              key={item.id}
              item={item}
              onToggle={() => toggleShoppingItem(item.id)}
              onRemove={() => removeFromShoppingList(item.id)}
            />
          ))}
          {totalCount > 5 && (
            <TouchableOpacity
              onPress={onViewFull}
              className="flex-row items-center justify-center py-3 mt-2"
            >
              <Text className="text-primary-500 font-semibold">
                View all {totalCount} items
              </Text>
              <Ionicons name="chevron-forward" size={18} color="#FF6B35" />
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>
          {Object.entries(groupedItems).map(([recipeName, items]) => (
            <View key={recipeName} className="mb-4">
              <Text className="text-xs font-semibold text-neutral-400 uppercase mb-2 ml-1">
                {recipeName}
              </Text>
              {items.map((item) => (
                <ShoppingItem
                  key={item.id}
                  item={item}
                  onToggle={() => toggleShoppingItem(item.id)}
                  onRemove={() => removeFromShoppingList(item.id)}
                />
              ))}
            </View>
          ))}
        </ScrollView>
      )}

      {/* Action buttons */}
      {!compact && checkedCount > 0 && (
        <View className="flex-row gap-3 pt-4 border-t border-neutral-100 mt-4">
          <TouchableOpacity
            onPress={clearCheckedItems}
            className="flex-1 bg-neutral-100 py-3 rounded-xl items-center"
          >
            <Text className="text-neutral-600 font-semibold">
              Clear Checked ({checkedCount})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={clearShoppingList}
            className="px-6 bg-red-50 py-3 rounded-xl items-center"
          >
            <Ionicons name="trash-outline" size={20} color="#EF4444" />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

export default ShoppingListView;
