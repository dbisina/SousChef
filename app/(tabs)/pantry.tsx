import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { usePantry, usePantrySearch, usePantryAlerts } from '@/hooks/usePantry';
import { useAuthStore } from '@/stores/authStore';
import { useThemeColors } from '@/stores/themeStore';
import { PantryItem, PantryCategory } from '@/types';
import { PantryItemCard, CategoryHeader, AddPantryItemModal, EditPantryItemModal } from '@/components/pantry';
import { Button, Loading, EmptyPantry, Card } from '@/components/ui';

export default function PantryScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const { user } = useAuthStore();
  const {
    items,
    isLoading,
    itemsByCategory,
    addItem,
    updateItem,
    deleteItem,
    refresh,
  } = usePantry();
  const { query, search, clear } = usePantrySearch();
  const { expiringItems, expiredItems, hasAlerts } = usePantryAlerts();

  const [isAddModalVisible, setAddModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<PantryItem | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<PantryCategory | null>(null);

  useEffect(() => {
    if (user) {
      refresh();
    }
  }, [user]);

  const onRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  const handleDelete = (itemId: string, itemName: string) => {
    Alert.alert(
      'Delete Item',
      `Are you sure you want to remove ${itemName} from your pantry?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteItem(itemId),
        },
      ]
    );
  };

  const handleSearchChange = (text: string) => {
    setSearchText(text);
    search(text);
  };

  // Get items to display based on filters
  const getDisplayedItems = (): PantryItem[] => {
    if (searchText.trim()) {
      return items.filter((item) =>
        item.name.toLowerCase().includes(searchText.toLowerCase())
      );
    }
    if (selectedCategory) {
      return itemsByCategory[selectedCategory] || [];
    }
    return items;
  };

  const displayedItems = getDisplayedItems();

  // Group items by category for display
  const renderSectionedList = () => {
    if (searchText.trim() || selectedCategory) {
      // Simple flat list for filtered results
      return (
        <FlatList
          data={displayedItems}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <PantryItemCard
              item={item}
              onPress={() => setEditingItem(item)}
              onDelete={() => handleDelete(item.id, item.name)}
            />
          )}
          ListEmptyComponent={
            <View className="items-center py-8">
              <Text className="text-neutral-500 dark:text-neutral-400">No items found</Text>
            </View>
          }
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
          }
          contentContainerStyle={{ paddingBottom: 120 }}
        />
      );
    }

    // Sectioned list by category
    const categories = Object.keys(itemsByCategory) as PantryCategory[];

    return (
      <FlatList
        data={categories}
        keyExtractor={(cat) => cat}
        renderItem={({ item: category }) => (
          <View>
            <CategoryHeader
              category={category}
              itemCount={itemsByCategory[category]?.length || 0}
            />
            {itemsByCategory[category]?.map((item, index) => (
              <PantryItemCard
                key={`${category}-${item.id}-${index}`}
                item={item}
                onPress={() => setEditingItem(item)}
                onDelete={() => handleDelete(item.id, item.name)}
              />
            ))}
          </View>
        )}
        ListEmptyComponent={
          <EmptyPantry onAction={() => setAddModalVisible(true)} />
        }
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
        }
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 120 }}
      />
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-neutral-50 dark:bg-neutral-900" edges={['top']}>
      {/* Header */}
      <View className="px-4 pt-4 pb-2">
        <View className="flex-row items-center justify-between mb-4">
          <Text className="text-2xl font-bold text-neutral-900 dark:text-neutral-50">My Pantry</Text>
          <TouchableOpacity
            onPress={() => setAddModalVisible(true)}
            className="w-10 h-10 rounded-full items-center justify-center"
            style={{ backgroundColor: colors.accent }}
          >
            <Ionicons name="add" size={24} color="white" />
          </TouchableOpacity>
        </View>

        {/* Search bar */}
        <View className="flex-row items-center bg-white dark:bg-neutral-800 rounded-xl px-4 py-3 shadow-sm">
          <Ionicons name="search" size={20} color={colors.textMuted} />
          <TextInput
            placeholder="Search pantry..."
            value={searchText}
            onChangeText={handleSearchChange}
            className="flex-1 ml-3 text-base text-neutral-900 dark:text-neutral-100"
            placeholderTextColor={colors.textMuted}
          />
          {searchText.length > 0 && (
            <TouchableOpacity onPress={() => { setSearchText(''); clear(); }}>
              <Ionicons name="close-circle" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Alerts */}
      {hasAlerts && (
        <View className="px-4 mb-2">
          {expiredItems.length > 0 && (
            <Card className="bg-red-50 border border-red-200 mb-2">
              <View className="flex-row items-center">
                <Ionicons name="warning" size={20} color="#DC2626" />
                <Text className="flex-1 ml-2 text-red-700">
                  {expiredItems.length} item(s) have expired
                </Text>
              </View>
            </Card>
          )}
          {expiringItems.length > 0 && (
            <Card className="bg-amber-50 border border-amber-200">
              <View className="flex-row items-center">
                <Ionicons name="alert-circle" size={20} color="#D97706" />
                <Text className="flex-1 ml-2 text-amber-700">
                  {expiringItems.length} item(s) expiring soon
                </Text>
              </View>
            </Card>
          )}
        </View>
      )}

      {/* Category filter chips */}
      <View className="px-4 py-2">
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={[null, ...CATEGORY_ORDER]}
          keyExtractor={(item) => item || 'all'}
          renderItem={({ item: category }) => (
            <TouchableOpacity
              onPress={() => setSelectedCategory(category)}
              className={`px-4 py-2 rounded-full mr-2 ${
                selectedCategory === category
                  ? ''
                  : 'bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700'
              }`}
              style={selectedCategory === category ? { backgroundColor: colors.accent } : undefined}
            >
              <Text
                className={
                  selectedCategory === category
                    ? 'text-white font-medium'
                    : 'text-neutral-700 dark:text-neutral-300'
                }
              >
                {category ? category.charAt(0).toUpperCase() + category.slice(1) : 'All'}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {/* Items list */}
      <View className="flex-1 px-4">
        {isLoading && items.length === 0 ? (
          <Loading fullScreen message="Loading pantry..." />
        ) : (
          renderSectionedList()
        )}
      </View>

      {/* Summary bar */}
      {items.length > 0 && (
        <View className="px-4 py-3 bg-white dark:bg-neutral-800 border-t border-neutral-200 dark:border-neutral-700">
          <View className="flex-row items-center justify-between">
            <Text className="text-neutral-500 dark:text-neutral-400">
              {items.length} item{items.length !== 1 ? 's' : ''} in pantry
            </Text>
            <TouchableOpacity
              onPress={() => router.push('/(tabs)/browse')}
              className="flex-row items-center"
            >
              <Text className="font-medium mr-1" style={{ color: colors.accent }}>
                Find Recipes
              </Text>
              <Ionicons name="arrow-forward" size={16} color={colors.accent} />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Add item modal */}
      <AddPantryItemModal
        visible={isAddModalVisible}
        onClose={() => setAddModalVisible(false)}
        onAdd={addItem}
      />

      {/* Edit item modal */}
      <EditPantryItemModal
        visible={!!editingItem}
        item={editingItem}
        onClose={() => setEditingItem(null)}
        onSave={updateItem}
        onDelete={(itemId) => {
          const name = editingItem?.name || 'Item';
          handleDelete(itemId, name);
        }}
      />
    </SafeAreaView>
  );
}

const CATEGORY_ORDER: PantryCategory[] = [
  'produce',
  'dairy',
  'meat',
  'seafood',
  'grains',
  'spices',
  'condiments',
  'canned',
  'frozen',
  'beverages',
  'other',
];
