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
import { PantryItem, PantryCategory } from '@/types';
import { PantryItemCard, CategoryHeader, AddPantryItemModal } from '@/components/pantry';
import { Button, Loading, EmptyPantry, Card } from '@/components/ui';

export default function PantryScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const {
    items,
    isLoading,
    itemsByCategory,
    addItem,
    deleteItem,
    refresh,
  } = usePantry();
  const { query, search, clear } = usePantrySearch();
  const { expiringItems, expiredItems, hasAlerts } = usePantryAlerts();

  const [isAddModalVisible, setAddModalVisible] = useState(false);
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
              onDelete={() => handleDelete(item.id, item.name)}
            />
          )}
          ListEmptyComponent={
            <View className="items-center py-8">
              <Text className="text-neutral-500">No items found</Text>
            </View>
          }
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
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
            {itemsByCategory[category]?.map((item) => (
              <PantryItemCard
                key={item.id}
                item={item}
                onDelete={() => handleDelete(item.id, item.name)}
              />
            ))}
          </View>
        )}
        ListEmptyComponent={
          <EmptyPantry onAction={() => setAddModalVisible(true)} />
        }
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 120 }}
      />
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-neutral-50" edges={['top']}>
      {/* Header */}
      <View className="px-4 pt-4 pb-2">
        <View className="flex-row items-center justify-between mb-4">
          <Text className="text-2xl font-bold text-neutral-900">My Pantry</Text>
          <TouchableOpacity
            onPress={() => setAddModalVisible(true)}
            className="w-10 h-10 rounded-full bg-primary-500 items-center justify-center"
          >
            <Ionicons name="add" size={24} color="white" />
          </TouchableOpacity>
        </View>

        {/* Search bar */}
        <View className="flex-row items-center bg-white rounded-xl px-4 py-3 shadow-sm">
          <Ionicons name="search" size={20} color="#737373" />
          <TextInput
            placeholder="Search pantry..."
            value={searchText}
            onChangeText={handleSearchChange}
            className="flex-1 ml-3 text-base text-neutral-900"
            placeholderTextColor="#A3A3A3"
          />
          {searchText.length > 0 && (
            <TouchableOpacity onPress={() => { setSearchText(''); clear(); }}>
              <Ionicons name="close-circle" size={20} color="#A3A3A3" />
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
                  ? 'bg-primary-500'
                  : 'bg-white border border-neutral-200'
              }`}
            >
              <Text
                className={
                  selectedCategory === category
                    ? 'text-white font-medium'
                    : 'text-neutral-700'
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
        <View className="px-4 py-3 bg-white border-t border-neutral-200">
          <View className="flex-row items-center justify-between">
            <Text className="text-neutral-500">
              {items.length} item{items.length !== 1 ? 's' : ''} in pantry
            </Text>
            <TouchableOpacity
              onPress={() => router.push('/(tabs)/browse')}
              className="flex-row items-center"
            >
              <Text className="text-primary-500 font-medium mr-1">
                Find Recipes
              </Text>
              <Ionicons name="arrow-forward" size={16} color="#FF6B35" />
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
