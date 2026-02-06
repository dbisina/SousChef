import {
  db,
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  orderBy,
  where,
  Timestamp,
  generateId,
} from '@/lib/firebase';
import { PantryItem, PantryItemFormData, PantryCategory } from '@/types';

const getPantryCollection = (userId: string) =>
  collection(db, 'users', userId, 'pantry');

// Get all pantry items for a user
export const getPantryItems = async (userId: string): Promise<PantryItem[]> => {
  const q = query(getPantryCollection(userId), orderBy('addedAt', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as PantryItem[];
};

// Get pantry items by category
export const getPantryItemsByCategory = async (
  userId: string,
  category: PantryCategory
): Promise<PantryItem[]> => {
  const q = query(
    getPantryCollection(userId),
    where('category', '==', category),
    orderBy('addedAt', 'desc')
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as PantryItem[];
};

// Add a pantry item
export const addPantryItem = async (
  userId: string,
  data: PantryItemFormData
): Promise<PantryItem> => {
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

  await setDoc(doc(getPantryCollection(userId), itemId), itemData);
  return itemData;
};

// Update a pantry item
export const updatePantryItem = async (
  userId: string,
  itemId: string,
  data: Partial<PantryItemFormData>
): Promise<void> => {
  const updateData: Partial<PantryItem> = {
    ...data,
    expiryDate: data.expiryDate ? Timestamp.fromDate(data.expiryDate) : undefined,
  };
  await setDoc(doc(getPantryCollection(userId), itemId), updateData, { merge: true });
};

// Delete a pantry item
export const deletePantryItem = async (
  userId: string,
  itemId: string
): Promise<void> => {
  await deleteDoc(doc(getPantryCollection(userId), itemId));
};

// Clear all pantry items
export const clearPantry = async (userId: string): Promise<void> => {
  const items = await getPantryItems(userId);
  await Promise.all(
    items.map((item) => deleteDoc(doc(getPantryCollection(userId), item.id)))
  );
};

// Get expiring items (within 3 days)
export const getExpiringItems = async (userId: string): Promise<PantryItem[]> => {
  const items = await getPantryItems(userId);
  const now = new Date();
  const threeDays = 3 * 24 * 60 * 60 * 1000;

  return items.filter((item) => {
    if (!item.expiryDate) return false;
    const expiryDate = item.expiryDate.toDate();
    const diff = expiryDate.getTime() - now.getTime();
    return diff > 0 && diff < threeDays;
  });
};

// Get expired items
export const getExpiredItems = async (userId: string): Promise<PantryItem[]> => {
  const items = await getPantryItems(userId);
  const now = new Date();

  return items.filter((item) => {
    if (!item.expiryDate) return false;
    return item.expiryDate.toDate().getTime() < now.getTime();
  });
};

// Search pantry items
export const searchPantryItems = async (
  userId: string,
  searchQuery: string
): Promise<PantryItem[]> => {
  const items = await getPantryItems(userId);
  const query = searchQuery.toLowerCase();

  return items.filter(
    (item) =>
      item.name.toLowerCase().includes(query) ||
      item.category.toLowerCase().includes(query)
  );
};

// Get pantry item names (for AI comparison)
export const getPantryItemNames = async (userId: string): Promise<string[]> => {
  const items = await getPantryItems(userId);
  return items.map((item) => `${item.amount} ${item.unit} ${item.name}`);
};

// Bulk add pantry items
export const bulkAddPantryItems = async (
  userId: string,
  items: PantryItemFormData[]
): Promise<PantryItem[]> => {
  const addedItems = await Promise.all(
    items.map((item) => addPantryItem(userId, item))
  );
  return addedItems;
};

// Update pantry item amount (e.g., after cooking)
export const updatePantryItemAmount = async (
  userId: string,
  itemId: string,
  newAmount: number
): Promise<void> => {
  if (newAmount <= 0) {
    await deletePantryItem(userId, itemId);
  } else {
    await updatePantryItem(userId, itemId, { amount: newAmount } as Partial<PantryItemFormData>);
  }
};

// Get pantry summary by category
export const getPantrySummary = async (
  userId: string
): Promise<Record<PantryCategory, number>> => {
  const items = await getPantryItems(userId);
  const summary: Record<PantryCategory, number> = {
    produce: 0,
    dairy: 0,
    meat: 0,
    seafood: 0,
    grains: 0,
    spices: 0,
    condiments: 0,
    canned: 0,
    frozen: 0,
    beverages: 0,
    other: 0,
  };

  items.forEach((item) => {
    summary[item.category]++;
  });

  return summary;
};
