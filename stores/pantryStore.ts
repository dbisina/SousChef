import { create } from 'zustand';
import {
  db,
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  orderBy,
  Timestamp,
  generateId,
} from '@/lib/firebase';
import { PantryItem, PantryCategory, PantryItemFormData } from '@/types';

interface PantryState {
  items: PantryItem[];
  isLoading: boolean;
  error: string | null;

  // Actions
  setItems: (items: PantryItem[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;

  // Pantry operations
  fetchPantryItems: (userId: string) => Promise<void>;
  addPantryItem: (userId: string, data: PantryItemFormData) => Promise<void>;
  updatePantryItem: (userId: string, itemId: string, data: Partial<PantryItem>) => Promise<void>;
  deletePantryItem: (userId: string, itemId: string) => Promise<void>;
  clearPantry: (userId: string) => Promise<void>;

  // Helper functions
  getItemsByCategory: (category: PantryCategory) => PantryItem[];
  getExpiringItems: () => PantryItem[];
  getExpiredItems: () => PantryItem[];
  searchItems: (searchQuery: string) => PantryItem[];
}

export const usePantryStore = create<PantryState>((set, get) => ({
  items: [],
  isLoading: false,
  error: null,

  setItems: (items) => set({ items }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),

  fetchPantryItems: async (userId) => {
    set({ isLoading: true, error: null });
    try {
      const pantryRef = collection(db, 'users', userId, 'pantry');
      const q = query(pantryRef, orderBy('addedAt', 'desc'));
      const snapshot = await getDocs(q);

      const items = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as PantryItem[];

      set({ items, isLoading: false });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to fetch pantry items';
      set({ error: message, isLoading: false });
    }
  },

  addPantryItem: async (userId, data) => {
    set({ isLoading: true, error: null });
    try {
      const itemId = generateId();
      const itemData: PantryItem = {
        id: itemId,
        name: data.name,
        amount: data.amount,
        unit: data.unit,
        category: data.category,
        expiryDate: data.expiryDate ? Timestamp.fromDate(data.expiryDate) : undefined,
        addedAt: Timestamp.now(),
      };

      await setDoc(doc(db, 'users', userId, 'pantry', itemId), itemData);

      set((state) => ({
        items: [itemData, ...state.items],
        isLoading: false,
      }));
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to add pantry item';
      set({ error: message, isLoading: false });
      throw error;
    }
  },

  updatePantryItem: async (userId, itemId, data) => {
    set({ isLoading: true, error: null });
    try {
      const itemRef = doc(db, 'users', userId, 'pantry', itemId);
      await setDoc(itemRef, data, { merge: true });

      set((state) => ({
        items: state.items.map((item) =>
          item.id === itemId ? { ...item, ...data } : item
        ),
        isLoading: false,
      }));
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to update pantry item';
      set({ error: message, isLoading: false });
      throw error;
    }
  },

  deletePantryItem: async (userId, itemId) => {
    set({ isLoading: true, error: null });
    try {
      await deleteDoc(doc(db, 'users', userId, 'pantry', itemId));

      set((state) => ({
        items: state.items.filter((item) => item.id !== itemId),
        isLoading: false,
      }));
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to delete pantry item';
      set({ error: message, isLoading: false });
      throw error;
    }
  },

  clearPantry: async (userId) => {
    set({ isLoading: true, error: null });
    try {
      const { items } = get();

      // Delete all items
      await Promise.all(
        items.map((item) => deleteDoc(doc(db, 'users', userId, 'pantry', item.id)))
      );

      set({ items: [], isLoading: false });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to clear pantry';
      set({ error: message, isLoading: false });
      throw error;
    }
  },

  getItemsByCategory: (category) => {
    return get().items.filter((item) => item.category === category);
  },

  getExpiringItems: () => {
    const now = new Date();
    const threeDays = 3 * 24 * 60 * 60 * 1000;

    return get().items.filter((item) => {
      if (!item.expiryDate) return false;
      const expiryDate = item.expiryDate.toDate();
      const diff = expiryDate.getTime() - now.getTime();
      return diff > 0 && diff < threeDays;
    });
  },

  getExpiredItems: () => {
    const now = new Date();

    return get().items.filter((item) => {
      if (!item.expiryDate) return false;
      return item.expiryDate.toDate().getTime() < now.getTime();
    });
  },

  searchItems: (searchQuery) => {
    const query = searchQuery.toLowerCase();
    return get().items.filter(
      (item) =>
        item.name.toLowerCase().includes(query) ||
        item.category.toLowerCase().includes(query)
    );
  },
}));

// Common pantry items for quick add
export const COMMON_PANTRY_ITEMS: Array<{ name: string; category: PantryCategory; unit: string }> = [
  // Produce
  { name: 'Onions', category: 'produce', unit: 'piece' },
  { name: 'Garlic', category: 'produce', unit: 'clove' },
  { name: 'Tomatoes', category: 'produce', unit: 'piece' },
  { name: 'Potatoes', category: 'produce', unit: 'piece' },
  { name: 'Carrots', category: 'produce', unit: 'piece' },
  { name: 'Bell Peppers', category: 'produce', unit: 'piece' },
  { name: 'Lemons', category: 'produce', unit: 'piece' },
  { name: 'Limes', category: 'produce', unit: 'piece' },
  { name: 'Avocados', category: 'produce', unit: 'piece' },
  { name: 'Lettuce', category: 'produce', unit: 'head' },
  { name: 'Spinach', category: 'produce', unit: 'cup' },
  { name: 'Broccoli', category: 'produce', unit: 'head' },
  { name: 'Mushrooms', category: 'produce', unit: 'cup' },
  { name: 'Celery', category: 'produce', unit: 'stalk' },

  // Dairy
  { name: 'Milk', category: 'dairy', unit: 'cup' },
  { name: 'Butter', category: 'dairy', unit: 'tbsp' },
  { name: 'Eggs', category: 'dairy', unit: 'piece' },
  { name: 'Cheddar Cheese', category: 'dairy', unit: 'oz' },
  { name: 'Mozzarella Cheese', category: 'dairy', unit: 'oz' },
  { name: 'Parmesan Cheese', category: 'dairy', unit: 'oz' },
  { name: 'Greek Yogurt', category: 'dairy', unit: 'cup' },
  { name: 'Sour Cream', category: 'dairy', unit: 'tbsp' },
  { name: 'Heavy Cream', category: 'dairy', unit: 'cup' },

  // Meat
  { name: 'Chicken Breast', category: 'meat', unit: 'oz' },
  { name: 'Chicken Thighs', category: 'meat', unit: 'oz' },
  { name: 'Ground Beef', category: 'meat', unit: 'oz' },
  { name: 'Bacon', category: 'meat', unit: 'slice' },
  { name: 'Pork Chops', category: 'meat', unit: 'oz' },
  { name: 'Sausage', category: 'meat', unit: 'piece' },

  // Seafood
  { name: 'Salmon', category: 'seafood', unit: 'oz' },
  { name: 'Shrimp', category: 'seafood', unit: 'oz' },
  { name: 'Tuna', category: 'seafood', unit: 'can' },

  // Grains
  { name: 'White Rice', category: 'grains', unit: 'cup' },
  { name: 'Brown Rice', category: 'grains', unit: 'cup' },
  { name: 'Pasta', category: 'grains', unit: 'oz' },
  { name: 'Bread', category: 'grains', unit: 'slice' },
  { name: 'Flour', category: 'grains', unit: 'cup' },
  { name: 'Oats', category: 'grains', unit: 'cup' },
  { name: 'Quinoa', category: 'grains', unit: 'cup' },

  // Spices
  { name: 'Salt', category: 'spices', unit: 'tsp' },
  { name: 'Black Pepper', category: 'spices', unit: 'tsp' },
  { name: 'Paprika', category: 'spices', unit: 'tsp' },
  { name: 'Cumin', category: 'spices', unit: 'tsp' },
  { name: 'Oregano', category: 'spices', unit: 'tsp' },
  { name: 'Basil', category: 'spices', unit: 'tsp' },
  { name: 'Garlic Powder', category: 'spices', unit: 'tsp' },
  { name: 'Onion Powder', category: 'spices', unit: 'tsp' },
  { name: 'Cinnamon', category: 'spices', unit: 'tsp' },
  { name: 'Chili Powder', category: 'spices', unit: 'tsp' },

  // Condiments
  { name: 'Olive Oil', category: 'condiments', unit: 'tbsp' },
  { name: 'Vegetable Oil', category: 'condiments', unit: 'tbsp' },
  { name: 'Soy Sauce', category: 'condiments', unit: 'tbsp' },
  { name: 'Ketchup', category: 'condiments', unit: 'tbsp' },
  { name: 'Mustard', category: 'condiments', unit: 'tbsp' },
  { name: 'Mayonnaise', category: 'condiments', unit: 'tbsp' },
  { name: 'Hot Sauce', category: 'condiments', unit: 'tbsp' },
  { name: 'Vinegar', category: 'condiments', unit: 'tbsp' },
  { name: 'Honey', category: 'condiments', unit: 'tbsp' },

  // Canned
  { name: 'Tomato Sauce', category: 'canned', unit: 'can' },
  { name: 'Diced Tomatoes', category: 'canned', unit: 'can' },
  { name: 'Black Beans', category: 'canned', unit: 'can' },
  { name: 'Chickpeas', category: 'canned', unit: 'can' },
  { name: 'Coconut Milk', category: 'canned', unit: 'can' },
  { name: 'Chicken Broth', category: 'canned', unit: 'cup' },
  { name: 'Vegetable Broth', category: 'canned', unit: 'cup' },
];
