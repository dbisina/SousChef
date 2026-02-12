import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Share,
  Alert,
  Modal,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useShoppingList } from '@/hooks/useMealPlan';
import { useThemeColors } from '@/stores/themeStore';
import { ShoppingList, ShoppingListSummary } from '@/components/mealplan';
import { Loading, Empty } from '@/components/ui';
import { SHOPPING_CATEGORY_LABELS, ShoppingCategory, ShoppingListItem } from '@/types/mealplan';
import { PantryCategory } from '@/types';
import { usePantryStore } from '@/stores/pantryStore';
import { useAuthStore } from '@/stores/authStore';
import { showSuccessToast, showErrorToast, showInfoToast } from '@/stores/toastStore';

const PANTRY_CATEGORIES: PantryCategory[] = [
  'produce', 'dairy', 'meat', 'seafood', 'grains',
  'spices', 'condiments', 'canned', 'frozen', 'beverages', 'other',
];

// Map shopping categories to pantry categories
const shoppingToPantryCategory = (cat: ShoppingCategory): PantryCategory => {
  const map: Partial<Record<ShoppingCategory, PantryCategory>> = {
    produce: 'produce', dairy: 'dairy', meat: 'meat', seafood: 'seafood',
    grains: 'grains', spices: 'spices', condiments: 'condiments',
    canned: 'canned', frozen: 'frozen', beverages: 'beverages',
  };
  return map[cat] || 'other';
};

export default function ShoppingListScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const { user } = useAuthStore();
  const { addPantryItem } = usePantryStore();
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
  const [pantryModalItem, setPantryModalItem] = useState<ShoppingListItem | null>(null);
  const [showPantryModal, setShowPantryModal] = useState(false);
  const [pantryAmount, setPantryAmount] = useState('');
  const [pantryUnit, setPantryUnit] = useState('');
  const [pantryCategory, setPantryCategory] = useState<PantryCategory>('other');

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

  // When toggling an unchecked item, show pantry modal
  const handleToggleItem = useCallback((itemId: string) => {
    const item = shoppingList.find(i => i.id === itemId);
    if (item && !item.checked) {
      // Show pantry modal to let user specify quantity
      setPantryModalItem(item);
      setPantryAmount(item.toBuy > 0 ? item.toBuy.toString() : item.amount.toString());
      setPantryUnit(item.unit);
      setPantryCategory(shoppingToPantryCategory(item.category));
      setShowPantryModal(true);
    } else {
      // Already checked — just uncheck
      toggleItem(itemId);
    }
  }, [shoppingList, toggleItem]);

  // Confirm add to pantry
  const handleConfirmPantryAdd = useCallback(async () => {
    if (!pantryModalItem || !user) return;

    const amount = parseFloat(pantryAmount) || 1;
    try {
      await addPantryItem(user.id, {
        name: pantryModalItem.name,
        amount,
        unit: pantryUnit || pantryModalItem.unit,
        category: pantryCategory,
      });
      await toggleItem(pantryModalItem.id);
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (e) {
      console.warn('Failed to add to pantry:', e);
      showErrorToast(`Oops! We couldn't add ${pantryModalItem.name} to your pantry. Let's try once more? 🔄`, 'Pantry Problem');
    }

    setShowPantryModal(false);
    setPantryModalItem(null);
  }, [pantryModalItem, user, pantryAmount, pantryUnit, pantryCategory, addPantryItem, toggleItem]);

  // Just check off without adding to pantry
  const handleSkipPantryAdd = useCallback(async () => {
    if (pantryModalItem) {
      await toggleItem(pantryModalItem.id);
    }
    setShowPantryModal(false);
    setPantryModalItem(null);
  }, [pantryModalItem, toggleItem]);

  // Share shopping list
  const handleShare = async () => {
    const itemsToBuy = shoppingList.filter((item) => item.toBuy > 0 && !item.checked);

    if (itemsToBuy.length === 0) {
      showInfoToast('Your shopping list is empty or all items are checked. Add some ingredients to share them! 🛒', 'List is Empty');
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
      'Clear List?',
      `Are you sure you want to remove ${checkedItems} checked item${checkedItems !== 1 ? 's' : ''} from your list?`,
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
    <SafeAreaView className="flex-1 bg-neutral-50 dark:bg-neutral-950" edges={['top']}>
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-3 bg-white dark:bg-neutral-900 border-b border-neutral-100 dark:border-neutral-800">
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.icon} />
        </TouchableOpacity>
        <Text className="text-lg font-bold text-neutral-900 dark:text-neutral-100">Shopping List</Text>
        <View className="flex-row">
          <TouchableOpacity onPress={handleShare} className="p-2">
            <Ionicons name="share-outline" size={22} color={colors.icon} />
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
      <View className="flex-row px-4 py-2 bg-white dark:bg-neutral-900 border-b border-neutral-100 dark:border-neutral-800">
        <TouchableOpacity
          onPress={() => setFilterMode('all')}
          className={`flex-1 py-2 rounded-lg mr-2 ${
            filterMode === 'all' ? '' : 'bg-neutral-100 dark:bg-neutral-800'
          }`}
          style={filterMode === 'all' ? { backgroundColor: colors.accent } : undefined}
        >
          <Text
            className={`text-center font-medium ${
              filterMode === 'all' ? 'text-white' : 'text-neutral-600 dark:text-neutral-400'
            }`}
          >
            All ({totalItems})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setFilterMode('toBuy')}
          className={`flex-1 py-2 rounded-lg mr-2 ${
            filterMode === 'toBuy' ? '' : 'bg-neutral-100 dark:bg-neutral-800'
          }`}
          style={filterMode === 'toBuy' ? { backgroundColor: colors.accent } : undefined}
        >
          <Text
            className={`text-center font-medium ${
              filterMode === 'toBuy' ? 'text-white' : 'text-neutral-600 dark:text-neutral-400'
            }`}
          >
            To Buy ({totalToBuy})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setFilterMode('inPantry')}
          className={`flex-1 py-2 rounded-lg ${
            filterMode === 'inPantry' ? '' : 'bg-neutral-100 dark:bg-neutral-800'
          }`}
          style={filterMode === 'inPantry' ? { backgroundColor: colors.accent } : undefined}
        >
          <Text
            className={`text-center font-medium ${
              filterMode === 'inPantry' ? 'text-white' : 'text-neutral-600 dark:text-neutral-400'
            }`}
          >
            In Pantry ({itemsInPantry})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Shopping list */}
      <ShoppingList
        items={filteredItems}
        onToggleItem={handleToggleItem}
        showPantryIndicator={filterMode !== 'inPantry'}
      />

      {/* Tip card at bottom */}
      {totalToBuy > 0 && (
        <View className="absolute bottom-0 left-0 right-0 p-4 bg-white dark:bg-neutral-900 border-t border-neutral-100 dark:border-neutral-800">
          <View className="flex-row items-center bg-primary-50 dark:bg-neutral-800 rounded-xl p-3">
            <Ionicons name="bulb-outline" size={20} color={colors.accent} />
            <Text className="text-primary-700 dark:text-primary-400 text-sm ml-2 flex-1">
              Tap items to check them off and add to pantry
            </Text>
          </View>
        </View>
      )}

      {/* Add-to-Pantry Modal */}
      <Modal
        visible={showPantryModal}
        animationType="slide"
        transparent
        onRequestClose={() => {
          setShowPantryModal(false);
          setPantryModalItem(null);
        }}
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
                width: 40, height: 4,
                backgroundColor: colors.border,
                borderRadius: 2,
                alignSelf: 'center',
                marginBottom: 16,
              }} />

              <Text style={{
                fontSize: 20, fontWeight: '700',
                color: colors.text, marginBottom: 4,
              }}>
                Add to Pantry
              </Text>
              <Text style={{
                fontSize: 14, color: colors.textMuted, marginBottom: 20,
              }}>
                Specify how much of "{pantryModalItem?.name}" you bought
              </Text>

              {/* Amount & Unit */}
              <View style={{ flexDirection: 'row', marginBottom: 16 }}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={{
                    fontSize: 13, fontWeight: '600',
                    color: colors.textSecondary, marginBottom: 6,
                  }}>Quantity Bought</Text>
                  <TextInput
                    value={pantryAmount}
                    onChangeText={setPantryAmount}
                    keyboardType="decimal-pad"
                    placeholder="1"
                    style={{
                      paddingHorizontal: 16, paddingVertical: 12,
                      backgroundColor: colors.surfaceSecondary,
                      borderRadius: 12, borderWidth: 1,
                      borderColor: colors.border,
                      color: colors.text, fontSize: 18,
                      fontWeight: '600', textAlign: 'center',
                    }}
                    placeholderTextColor={colors.textMuted}
                  />
                </View>
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={{
                    fontSize: 13, fontWeight: '600',
                    color: colors.textSecondary, marginBottom: 6,
                  }}>Unit</Text>
                  <TextInput
                    value={pantryUnit}
                    onChangeText={setPantryUnit}
                    placeholder="piece"
                    style={{
                      paddingHorizontal: 16, paddingVertical: 12,
                      backgroundColor: colors.surfaceSecondary,
                      borderRadius: 12, borderWidth: 1,
                      borderColor: colors.border,
                      color: colors.text, fontSize: 16,
                    }}
                    placeholderTextColor={colors.textMuted}
                  />
                </View>
              </View>

              {/* Category */}
              <Text style={{
                fontSize: 13, fontWeight: '600',
                color: colors.textSecondary, marginBottom: 8,
              }}>Category</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ marginBottom: 20 }}
              >
                {PANTRY_CATEGORIES.map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    onPress={() => setPantryCategory(cat)}
                    style={{
                      paddingHorizontal: 14, paddingVertical: 8,
                      borderRadius: 10, marginRight: 8,
                      backgroundColor: pantryCategory === cat ? colors.accent : colors.surfaceSecondary,
                      borderWidth: pantryCategory === cat ? 0 : 1,
                      borderColor: colors.border,
                    }}
                  >
                    <Text style={{
                      textTransform: 'capitalize', fontSize: 13,
                      fontWeight: pantryCategory === cat ? '600' : '400',
                      color: pantryCategory === cat ? '#FFFFFF' : colors.text,
                    }}>{cat}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Buttons */}
              <TouchableOpacity
                onPress={handleConfirmPantryAdd}
                style={{
                  backgroundColor: '#16A34A',
                  paddingVertical: 14, borderRadius: 14,
                  alignItems: 'center', flexDirection: 'row',
                  justifyContent: 'center', marginBottom: 10,
                }}
              >
                <Ionicons name="nutrition" size={20} color="#FFFFFF" />
                <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 16, marginLeft: 8 }}>
                  Add to Pantry
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleSkipPantryAdd}
                style={{
                  paddingVertical: 12, borderRadius: 14,
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
    </SafeAreaView>
  );
}
