import {
  db,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp,
  generateId,
} from '@/lib/firebase';
import {
  WeeklyMealPlan,
  MealPlanDay,
  PlannedMeal,
  ShoppingListItem,
  MealPlanStats,
  FoodWasteEntry,
  WasteStats,
  WasteReason,
  WasteEntryFormData,
  MealType,
} from '@/types/mealplan';

// Collection paths
const getMealPlansCollection = (userId: string) =>
  collection(db, 'users', userId, 'mealPlans');

const getWasteLogCollection = (userId: string) =>
  collection(db, 'users', userId, 'wasteLog');

const getWasteStatsDoc = (userId: string) =>
  doc(db, 'users', userId, 'wasteStats', 'current');

// Helper: Get Monday of the week for a given date
export const getWeekStartDate = (date: Date = new Date()): string => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Sunday
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().split('T')[0];
};

// Helper: Generate dates for a week
export const generateWeekDates = (startDate: string): string[] => {
  const dates: string[] = [];
  const start = new Date(startDate);

  for (let i = 0; i < 7; i++) {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    dates.push(date.toISOString().split('T')[0]);
  }

  return dates;
};

// Helper: Get day name from date string
export const getDayName = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { weekday: 'long' });
};

// ==================== MEAL PLAN CRUD ====================

// Get current week's meal plan
export const getCurrentMealPlan = async (
  userId: string
): Promise<WeeklyMealPlan | null> => {
  const weekStart = getWeekStartDate();
  return getMealPlanByWeek(userId, weekStart);
};

// Get meal plan by week start date
export const getMealPlanByWeek = async (
  userId: string,
  weekStartDate: string
): Promise<WeeklyMealPlan | null> => {
  try {
    const plansRef = getMealPlansCollection(userId);
    const q = query(plansRef, where('weekStartDate', '==', weekStartDate));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return null;
    }

    return {
      id: snapshot.docs[0].id,
      ...snapshot.docs[0].data(),
    } as WeeklyMealPlan;
  } catch (error) {
    console.error('Error getting meal plan:', error);
    return null;
  }
};

// Get all meal plans for a user
export const getMealPlans = async (userId: string): Promise<WeeklyMealPlan[]> => {
  try {
    const plansRef = getMealPlansCollection(userId);
    const q = query(plansRef, orderBy('weekStartDate', 'desc'));
    const snapshot = await getDocs(q);

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as WeeklyMealPlan[];
  } catch (error) {
    console.error('Error getting meal plans:', error);
    return [];
  }
};

// Create or update a meal plan
export const saveMealPlan = async (
  userId: string,
  plan: Omit<WeeklyMealPlan, 'id' | 'userId' | 'createdAt' | 'updatedAt'>
): Promise<WeeklyMealPlan> => {
  try {
    // Check if plan exists for this week
    const existing = await getMealPlanByWeek(userId, plan.weekStartDate);
    const now = Timestamp.now();

    if (existing) {
      // Update existing plan
      const planRef = doc(getMealPlansCollection(userId), existing.id);
      const updateData = {
        ...plan,
        updatedAt: now,
      };
      await setDoc(planRef, updateData, { merge: true });

      return {
        ...existing,
        ...updateData,
      };
    } else {
      // Create new plan
      const planId = generateId();
      const newPlan: WeeklyMealPlan = {
        id: planId,
        userId,
        ...plan,
        createdAt: now,
        updatedAt: now,
      };

      await setDoc(doc(getMealPlansCollection(userId), planId), newPlan);
      return newPlan;
    }
  } catch (error) {
    console.error('Error saving meal plan:', error);
    throw error;
  }
};

// Update a single meal in a plan
export const updateMeal = async (
  userId: string,
  planId: string,
  date: string,
  mealType: MealType,
  meal: PlannedMeal | null
): Promise<void> => {
  try {
    const planRef = doc(getMealPlansCollection(userId), planId);
    const planDoc = await getDoc(planRef);

    if (!planDoc.exists()) {
      throw new Error('Meal plan not found');
    }

    const plan = planDoc.data() as WeeklyMealPlan;
    const dayIndex = plan.days.findIndex((d) => d.date === date);

    if (dayIndex === -1) {
      throw new Error('Day not found in plan');
    }

    const updatedDays = [...plan.days];
    if (meal) {
      updatedDays[dayIndex] = {
        ...updatedDays[dayIndex],
        [mealType]: meal,
      };
    } else {
      // Remove the meal
      const { [mealType]: removed, ...rest } = updatedDays[dayIndex];
      updatedDays[dayIndex] = rest as MealPlanDay;
    }

    await setDoc(
      planRef,
      {
        days: updatedDays,
        updatedAt: Timestamp.now(),
      },
      { merge: true }
    );
  } catch (error) {
    console.error('Error updating meal:', error);
    throw error;
  }
};

// Delete a meal plan
export const deleteMealPlan = async (
  userId: string,
  planId: string
): Promise<void> => {
  try {
    await deleteDoc(doc(getMealPlansCollection(userId), planId));
  } catch (error) {
    console.error('Error deleting meal plan:', error);
    throw error;
  }
};

// Update shopping list item (toggle checked)
export const updateShoppingListItem = async (
  userId: string,
  planId: string,
  itemId: string,
  checked: boolean
): Promise<void> => {
  try {
    const planRef = doc(getMealPlansCollection(userId), planId);
    const planDoc = await getDoc(planRef);

    if (!planDoc.exists()) {
      throw new Error('Meal plan not found');
    }

    const plan = planDoc.data() as WeeklyMealPlan;
    const updatedList = plan.shoppingList.map((item) =>
      item.id === itemId ? { ...item, checked } : item
    );

    await setDoc(
      planRef,
      {
        shoppingList: updatedList,
        updatedAt: Timestamp.now(),
      },
      { merge: true }
    );
  } catch (error) {
    console.error('Error updating shopping list item:', error);
    throw error;
  }
};

// ==================== WASTE TRACKING ====================

// Log a waste entry
export const logWasteEntry = async (
  userId: string,
  data: WasteEntryFormData
): Promise<FoodWasteEntry> => {
  try {
    const entryId = generateId();
    const entry: FoodWasteEntry = {
      id: entryId,
      userId,
      itemName: data.itemName,
      amount: data.amount,
      unit: data.unit,
      reason: data.reason,
      date: Timestamp.now(),
      estimatedValue: data.estimatedValue,
      notes: data.notes,
    };

    await setDoc(doc(getWasteLogCollection(userId), entryId), entry);

    // Update aggregated stats
    await updateWasteStats(userId, entry);

    return entry;
  } catch (error) {
    console.error('Error logging waste entry:', error);
    throw error;
  }
};

// Get waste log entries
export const getWasteLog = async (
  userId: string,
  limit?: number
): Promise<FoodWasteEntry[]> => {
  try {
    const wasteRef = getWasteLogCollection(userId);
    const q = query(wasteRef, orderBy('date', 'desc'));
    const snapshot = await getDocs(q);

    let entries = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as FoodWasteEntry[];

    if (limit) {
      entries = entries.slice(0, limit);
    }

    return entries;
  } catch (error) {
    console.error('Error getting waste log:', error);
    return [];
  }
};

// Delete a waste entry
export const deleteWasteEntry = async (
  userId: string,
  entryId: string
): Promise<void> => {
  try {
    await deleteDoc(doc(getWasteLogCollection(userId), entryId));
  } catch (error) {
    console.error('Error deleting waste entry:', error);
    throw error;
  }
};

// Get waste statistics
export const getWasteStats = async (userId: string): Promise<WasteStats | null> => {
  try {
    const statsDoc = await getDoc(getWasteStatsDoc(userId));

    if (!statsDoc.exists()) {
      return null;
    }

    return statsDoc.data() as WasteStats;
  } catch (error) {
    console.error('Error getting waste stats:', error);
    return null;
  }
};

// Update aggregated waste stats
const updateWasteStats = async (
  userId: string,
  newEntry: FoodWasteEntry
): Promise<void> => {
  try {
    const statsDoc = await getDoc(getWasteStatsDoc(userId));
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    let stats: WasteStats;

    if (statsDoc.exists()) {
      const existing = statsDoc.data() as WasteStats;

      // Update existing stats
      const wasteByReason = { ...existing.wasteByReason };
      wasteByReason[newEntry.reason] = (wasteByReason[newEntry.reason] || 0) + 1;

      stats = {
        ...existing,
        totalWasted: existing.totalWasted + newEntry.estimatedValue,
        wastedThisWeek: existing.wastedThisWeek + newEntry.estimatedValue,
        wastedThisMonth: existing.wastedThisMonth + newEntry.estimatedValue,
        itemsWastedThisMonth: existing.itemsWastedThisMonth + 1,
        wasteByReason,
        // Top wasted items would need recalculation
        topWastedItems: existing.topWastedItems,
      };
    } else {
      // Initialize new stats
      stats = {
        totalWasted: newEntry.estimatedValue,
        wastedThisWeek: newEntry.estimatedValue,
        wastedThisMonth: newEntry.estimatedValue,
        itemsWastedThisMonth: 1,
        topWastedItems: [{ name: newEntry.itemName, count: 1 }],
        wasteByReason: {
          expired: 0,
          spoiled: 0,
          leftover: 0,
          overcooked: 0,
          other: 0,
          [newEntry.reason]: 1,
        },
        trendDirection: 'stable',
        savedByPlanning: 0,
      };
    }

    await setDoc(getWasteStatsDoc(userId), stats);
  } catch (error) {
    console.error('Error updating waste stats:', error);
  }
};

// Calculate savings from meal planning
export const calculatePlanSavings = (
  stats: MealPlanStats,
  expiringItemsValue: number
): number => {
  // Estimate savings based on:
  // 1. Expiring items used (would have been wasted)
  // 2. Ingredient overlap (reduced shopping costs)

  const expiringItemsSaved = expiringItemsValue;
  const overlapSavings = (stats.ingredientOverlap / 100) * 15; // Rough estimate: 15% of average weekly grocery spend

  return expiringItemsSaved + overlapSavings;
};

// ==================== HELPER FUNCTIONS ====================

// Create empty meal plan for a week
export const createEmptyMealPlan = (
  weekStartDate: string = getWeekStartDate()
): Omit<WeeklyMealPlan, 'id' | 'userId' | 'createdAt' | 'updatedAt'> => {
  const dates = generateWeekDates(weekStartDate);

  return {
    weekStartDate,
    days: dates.map((date) => ({ date })),
    shoppingList: [],
    stats: {
      pantryItemsUsed: 0,
      expiringItemsUsed: 0,
      ingredientOverlap: 0,
      estimatedSavings: 0,
      totalMeals: 0,
      uniqueRecipes: 0,
    },
    isGenerated: false,
  };
};

// Count meals in a plan
export const countMealsInPlan = (days: MealPlanDay[]): number => {
  return days.reduce((count, day) => {
    let dayCount = 0;
    if (day.breakfast) dayCount++;
    if (day.lunch) dayCount++;
    if (day.dinner) dayCount++;
    if (day.snack) dayCount++;
    return count + dayCount;
  }, 0);
};

// Get unique recipe IDs from a plan
export const getUniqueRecipeIds = (days: MealPlanDay[]): string[] => {
  const ids = new Set<string>();

  days.forEach((day) => {
    if (day.breakfast) ids.add(day.breakfast.recipeId);
    if (day.lunch) ids.add(day.lunch.recipeId);
    if (day.dinner) ids.add(day.dinner.recipeId);
    if (day.snack) ids.add(day.snack.recipeId);
  });

  return Array.from(ids);
};
