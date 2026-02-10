import React, { memo, useMemo, useCallback, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Platform,
  Alert,
  Modal,
  TextInput,
  KeyboardAvoidingView,
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
import { usePantryStore } from '@/stores/pantryStore';
import { useAuthStore } from '@/stores/authStore';
import { QuickShoppingItem } from '@/types/wantToCook';
import { useThemeColors } from '@/stores/themeStore';
import { PantryCategory } from '@/types';

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
          item.checked ? 'bg-neutral-100 dark:bg-neutral-700' : 'bg-white dark:bg-neutral-800'
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
              : 'border-neutral-300 dark:border-neutral-600'
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
              item.checked ? 'text-neutral-400 dark:text-neutral-500 line-through' : 'text-neutral-900 dark:text-neutral-50'
            }`}
          >
            {item.name}
          </Text>
          <View className="flex-row items-center mt-0.5">
            <Text className="text-neutral-500 dark:text-neutral-400 text-sm">
              {item.amount} {item.unit}
            </Text>
            {item.recipeName && (
              <>
                <View className="w-1 h-1 rounded-full bg-neutral-300 dark:bg-neutral-600 mx-2" />
                <Text className="text-neutral-400 dark:text-neutral-500 text-sm" numberOfLines={1}>
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

// ── Add-to-Pantry modal shown when user checks off a shopping item ──
interface AddToPantryModalProps {
  visible: boolean;
  item: QuickShoppingItem | null;
  onConfirm: (amount: number, unit: string, category: PantryCategory) => void;
  onSkip: () => void;
  onClose: () => void;
}

const PANTRY_CATEGORIES: PantryCategory[] = [
  'produce', 'dairy', 'meat', 'seafood', 'grains',
  'spices', 'condiments', 'canned', 'frozen', 'beverages', 'other',
];

const AddToPantryModal: React.FC<AddToPantryModalProps> = ({
  visible,
  item,
  onConfirm,
  onSkip,
  onClose,
}) => {
  const colors = useThemeColors();
  const [amount, setAmount] = useState('');
  const [unit, setUnit] = useState('');
  const [category, setCategory] = useState<PantryCategory>('other');

  React.useEffect(() => {
    if (item) {
      setAmount(item.amount?.toString() || '1');
      setUnit(item.unit || 'piece');
      // Try to guess category from item.category
      const cat = (item.category || 'other') as PantryCategory;
      setCategory(PANTRY_CATEGORIES.includes(cat) ? cat : 'other');
    }
  }, [item]);

  if (!item) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <View style={{
          flex: 1,
          justifyContent: 'flex-end',
          backgroundColor: 'rgba(0,0,0,0.5)',
        }}>
          <View style={{
            backgroundColor: colors.surface,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            paddingTop: 12,
            paddingBottom: Platform.OS === 'ios' ? 40 : 24,
            paddingHorizontal: 20,
            maxHeight: '80%',
          }}>
            {/* Handle bar */}
            <View style={{
              width: 40,
              height: 4,
              backgroundColor: colors.border,
              borderRadius: 2,
              alignSelf: 'center',
              marginBottom: 16,
            }} />

            {/* Title */}
            <Text style={{
              fontSize: 20,
              fontWeight: '700',
              color: colors.text,
              marginBottom: 4,
            }}>
              Add to Pantry
            </Text>
            <Text style={{
              fontSize: 14,
              color: colors.textMuted,
              marginBottom: 20,
            }}>
              Specify how much of "{item.name}" you bought
            </Text>

            {/* Amount & Unit row */}
            <View style={{ flexDirection: 'row', marginBottom: 16 }}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={{
                  fontSize: 13, fontWeight: '600',
                  color: colors.textSecondary, marginBottom: 6,
                }}>
                  Quantity Bought
                </Text>
                <TextInput
                  value={amount}
                  onChangeText={setAmount}
                  keyboardType="decimal-pad"
                  placeholder="1"
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                    backgroundColor: colors.surfaceSecondary,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: colors.border,
                    color: colors.text,
                    fontSize: 18,
                    fontWeight: '600',
             textAlign: 'center',
                  }}
                  placeholderTextColor={colors.textMuted}
                />
              </View>
              <View style={{ flex: 1, marginLeft: 8 }}>
                <Text style={{
                  fontSize: 13, fontWeight: '600',
                  color: colors.textSecondary, marginBottom: 6,
                }}>
                  Unit
                </Text>
                <TextInput
                  value={unit}
                  onChangeText={setUnit}
                  placeholder="piece"
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                    backgroundColor: colors.surfaceSecondary,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: colors.border,
                    color: colors.text,
                    fontSize: 16,
                  }}
                  placeholderTextColor={colors.textMuted}
                />
              </View>
            </View>

            {/* Category selector */}
            <Text style={{
              fontSize: 13, fontWeight: '600',
              color: colors.textSecondary, marginBottom: 8,
            }}>
              Category
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginBottom: 20 }}
            >
              {PANTRY_CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  onPress={() => setCategory(cat)}
                  style={{
                    paddingHorizontal: 14,
                    paddingVertical: 8,
                    borderRadius: 10,
                    marginRight: 8,
                    backgroundColor: category === cat ? colors.accent : colors.surfaceSecondary,
                    borderWidth: category === cat ? 0 : 1,
                    borderColor: colors.border,
                  }}
                >
                  <Text style={{
                    textTransform: 'capitalize',
                    fontSize: 13,
                    fontWeight: category === cat ? '600' : '400',
                    color: category === cat ? '#FFFFFF' : colors.text,
                  }}>
                    {cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Action buttons */}
            <TouchableOpacity
              onPress={() => {
                const parsedAmount = parseFloat(amount) || 1;
                onConfirm(parsedAmount, unit || 'piece', category);
              }}
              style={{
                backgroundColor: '#16A34A',
                paddingVertical: 14,
                borderRadius: 14,
                alignItems: 'center',
                flexDirection: 'row',
                justifyContent: 'center',
                marginBottom: 10,
              }}
            >
              <Ionicons name="nutrition" size={20} color="#FFFFFF" />
              <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 16, marginLeft: 8 }}>
                Add to Pantry
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={onSkip}
              style={{
                paddingVertical: 12,
                borderRadius: 14,
                alignItems: 'center',
                backgroundColor: colors.surfaceSecondary,
              }}
            >
              <Text style={{ color: colors.textSecondary, fontWeight: '600', fontSize: 14 }}>
                Just check off (don't add to pantry)
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

export const ShoppingListView: React.FC<ShoppingListViewProps> = ({
  compact = false,
  onViewFull,
}) => {
  const colors = useThemeColors();
  const {
    shoppingList,
    toggleShoppingItem,
    removeFromShoppingList,
    clearCheckedItems,
    clearShoppingList,
  } = useWantToCookStore();
  const { addPantryItem } = usePantryStore();
  const { user } = useAuthStore();

  // State for the add-to-pantry modal
  const [pantryModalItem, setPantryModalItem] = useState<QuickShoppingItem | null>(null);
  const [showPantryModal, setShowPantryModal] = useState(false);

  // When user taps an unchecked item, show the pantry modal
  const handleToggle = useCallback((item: QuickShoppingItem) => {
    if (!item.checked) {
      // Item is being checked OFF (bought) — show pantry modal
      setPantryModalItem(item);
      setShowPantryModal(true);
    } else {
      // Item is already checked, just uncheck it
      toggleShoppingItem(item.id);
    }
  }, [toggleShoppingItem]);

  // Confirm adding to pantry with user-specified quantity
  const handleConfirmPantryAdd = useCallback(async (
    amount: number,
    unit: string,
    category: PantryCategory,
  ) => {
    if (!pantryModalItem || !user) return;

    try {
      await addPantryItem(user.id, {
        name: pantryModalItem.name,
        amount,
        unit,
        category,
      });
      toggleShoppingItem(pantryModalItem.id);
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (e) {
      console.warn('Failed to add to pantry:', pantryModalItem.name, e);
      Alert.alert('Error', `Failed to add ${pantryModalItem.name} to pantry.`);
    }

    setShowPantryModal(false);
    setPantryModalItem(null);
  }, [pantryModalItem, user, addPantryItem, toggleShoppingItem]);

  // Skip pantry add, just check the item off
  const handleSkipPantryAdd = useCallback(() => {
    if (pantryModalItem) {
      toggleShoppingItem(pantryModalItem.id);
    }
    setShowPantryModal(false);
    setPantryModalItem(null);
  }, [pantryModalItem, toggleShoppingItem]);

  // Batch-move all checked items to pantry, then clear them from the list
  const handleMoveCheckedToPantry = useCallback(async () => {
    const checkedItems = shoppingList.filter((i) => i.checked);
    if (checkedItems.length === 0) return;

    Alert.alert(
      'Move to Pantry',
      `Add ${checkedItems.length} checked item${checkedItems.length > 1 ? 's' : ''} to your pantry?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Move to Pantry',
          onPress: async () => {
            if (!user) return;
            let added = 0;
            for (const item of checkedItems) {
              try {
                await addPantryItem(user.id, {
                  name: item.name,
                  amount: item.amount,
                  unit: item.unit,
                  category: 'other',
                });
                added++;
              } catch (e) {
                console.warn('Failed to add to pantry:', item.name, e);
              }
            }
            clearCheckedItems();
            if (Platform.OS !== 'web') {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }
            Alert.alert(
              'Added to Pantry',
              `${added} item${added !== 1 ? 's' : ''} moved to your pantry.`
            );
          },
        },
      ]
    );
  }, [shoppingList, user, addPantryItem, clearCheckedItems]);

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
        <View className="w-20 h-20 rounded-full bg-neutral-100 dark:bg-neutral-700 items-center justify-center mb-4">
          <Ionicons name="cart-outline" size={40} color="#D1D5DB" />
        </View>
        <Text className="text-lg font-semibold text-neutral-400 dark:text-neutral-500 mb-1">
          No items yet
        </Text>
        <Text className="text-neutral-400 dark:text-neutral-500 text-center px-8">
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
            <Ionicons name="cart" size={20} color={colors.accent} />
            <Text className="text-lg font-bold text-neutral-900 dark:text-neutral-50 ml-2">
              Shopping List
            </Text>
          </View>
          <Text className="text-neutral-500 dark:text-neutral-400">
            {checkedCount}/{totalCount} items
          </Text>
        </View>

        {/* Progress bar */}
        <View className="h-2 bg-neutral-100 dark:bg-neutral-700 rounded-full overflow-hidden">
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
              onToggle={() => handleToggle(item)}
              onRemove={() => removeFromShoppingList(item.id)}
            />
          ))}
          {totalCount > 5 && (
            <TouchableOpacity
              onPress={onViewFull}
              className="flex-row items-center justify-center py-3 mt-2"
            >
              <Text className="font-semibold" style={{ color: colors.accent }}>
                View all {totalCount} items
              </Text>
              <Ionicons name="chevron-forward" size={18} color={colors.accent} />
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>
          {Object.entries(groupedItems).map(([recipeName, items]) => (
            <View key={recipeName} className="mb-4">
              <Text className="text-xs font-semibold text-neutral-400 dark:text-neutral-500 uppercase mb-2 ml-1">
                {recipeName}
              </Text>
              {items.map((item) => (
                <ShoppingItem
                  key={item.id}
                  item={item}
                  onToggle={() => handleToggle(item)}
                  onRemove={() => removeFromShoppingList(item.id)}
                />
              ))}
            </View>
          ))}
        </ScrollView>
      )}

      {/* Action buttons */}
      {!compact && checkedCount > 0 && (
        <View className="flex-row gap-3 pt-4 border-t border-neutral-100 dark:border-neutral-700 mt-4">
          <TouchableOpacity
            onPress={handleMoveCheckedToPantry}
            className="flex-1 bg-green-50 py-3 rounded-xl items-center flex-row justify-center"
          >
            <Ionicons name="nutrition-outline" size={18} color="#16A34A" />
            <Text className="text-green-700 font-semibold ml-1.5">
              Move to Pantry ({checkedCount})
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

      {/* Add-to-Pantry modal */}
      <AddToPantryModal
        visible={showPantryModal}
        item={pantryModalItem}
        onConfirm={handleConfirmPantryAdd}
        onSkip={handleSkipPantryAdd}
        onClose={() => {
          setShowPantryModal(false);
          setPantryModalItem(null);
        }}
      />
    </View>
  );
};

export default ShoppingListView;
