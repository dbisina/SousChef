import { useEffect, useCallback, useState, useMemo } from 'react';
import { usePantryStore, COMMON_PANTRY_ITEMS } from '@/stores/pantryStore';
import { PantryItem, PantryCategory, PantryItemFormData } from '@/types';
import { useAuth } from './useAuth';

// Main pantry hook
export const usePantry = () => {
  const {
    items,
    isLoading,
    error,
    fetchPantryItems,
    addPantryItem,
    updatePantryItem,
    deletePantryItem,
    clearPantry,
    getItemsByCategory,
    getExpiringItems,
    getExpiredItems,
    searchItems,
  } = usePantryStore();

  const { user } = useAuth();

  // Fetch pantry on mount
  useEffect(() => {
    if (user) {
      fetchPantryItems(user.id);
    }
  }, [user]);

  // Add item
  const addItem = useCallback(
    async (data: PantryItemFormData) => {
      if (!user) throw new Error('Must be logged in');
      await addPantryItem(user.id, data);
    },
    [user, addPantryItem]
  );

  // Update item
  const updateItem = useCallback(
    async (itemId: string, data: Partial<PantryItem>) => {
      if (!user) throw new Error('Must be logged in');
      await updatePantryItem(user.id, itemId, data);
    },
    [user, updatePantryItem]
  );

  // Delete item
  const deleteItem = useCallback(
    async (itemId: string) => {
      if (!user) throw new Error('Must be logged in');
      await deletePantryItem(user.id, itemId);
    },
    [user, deletePantryItem]
  );

  // Clear all items
  const clearAll = useCallback(async () => {
    if (!user) throw new Error('Must be logged in');
    await clearPantry(user.id);
  }, [user, clearPantry]);

  // Refresh
  const refresh = useCallback(async () => {
    if (user) {
      await fetchPantryItems(user.id);
    }
  }, [user, fetchPantryItems]);

  // Group items by category
  const itemsByCategory = useMemo(() => {
    const grouped: Partial<Record<PantryCategory, PantryItem[]>> = {};
    items.forEach((item) => {
      if (!grouped[item.category]) {
        grouped[item.category] = [];
      }
      grouped[item.category]!.push(item);
    });
    return grouped;
  }, [items]);

  // Get item names for AI comparison
  const itemNames = useMemo(() => {
    return items.map((item) => `${item.amount} ${item.unit} ${item.name}`);
  }, [items]);

  return {
    items,
    isLoading,
    error,
    itemsByCategory,
    itemNames,
    expiringItems: getExpiringItems(),
    expiredItems: getExpiredItems(),
    addItem,
    updateItem,
    deleteItem,
    clearAll,
    refresh,
    searchItems,
    getItemsByCategory,
    commonItems: COMMON_PANTRY_ITEMS,
  };
};

// Hook for quick add from common items
export const useQuickAdd = () => {
  const { addItem } = usePantry();
  const [recentlyAdded, setRecentlyAdded] = useState<string[]>([]);

  const quickAdd = useCallback(
    async (name: string, category: PantryCategory, unit: string, amount: number = 1) => {
      await addItem({
        name,
        category,
        unit,
        amount,
      });
      setRecentlyAdded((prev) => [name, ...prev.slice(0, 4)]);
    },
    [addItem]
  );

  return {
    quickAdd,
    recentlyAdded,
    suggestions: COMMON_PANTRY_ITEMS,
  };
};

// Hook for pantry alerts (expiring/expired items)
export const usePantryAlerts = () => {
  const { expiringItems, expiredItems } = usePantry();

  const alertCount = expiringItems.length + expiredItems.length;
  const hasAlerts = alertCount > 0;

  return {
    expiringItems,
    expiredItems,
    alertCount,
    hasAlerts,
    expiringCount: expiringItems.length,
    expiredCount: expiredItems.length,
  };
};

// Hook for pantry search
export const usePantrySearch = () => {
  const { searchItems } = usePantry();
  const [query, setQuery] = useState('');

  const results = useMemo(() => {
    if (!query.trim()) return [];
    return searchItems(query);
  }, [query, searchItems]);

  const search = useCallback((searchQuery: string) => {
    setQuery(searchQuery);
  }, []);

  const clear = useCallback(() => {
    setQuery('');
  }, []);

  return {
    query,
    results,
    search,
    clear,
    hasResults: results.length > 0,
  };
};

// Hook for category stats
export const usePantryStats = () => {
  const { items, itemsByCategory } = usePantry();

  const stats = useMemo(() => {
    const categories = Object.keys(itemsByCategory) as PantryCategory[];
    return categories.map((category) => ({
      category,
      count: itemsByCategory[category]?.length || 0,
    })).sort((a, b) => b.count - a.count);
  }, [itemsByCategory]);

  return {
    totalItems: items.length,
    categoryStats: stats,
    topCategories: stats.slice(0, 3),
  };
};
