import { Timestamp } from 'firebase/firestore';
import { CALORIE_DATABASE, CalorieEntry, UNIT_ALIASES } from '@/constants/calories';
import { Ingredient, NutritionInfo } from '@/types';

// Format time in minutes to human readable string
export const formatTime = (minutes: number): string => {
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) {
    return `${hours} hr`;
  }
  return `${hours} hr ${mins} min`;
};

// Format date to relative time (e.g., "2 days ago")
export const formatRelativeTime = (date: Date | Timestamp): string => {
  const now = new Date();
  const targetDate = date instanceof Timestamp ? date.toDate() : date;
  const diffMs = now.getTime() - targetDate.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    if (diffHours === 0) {
      const diffMins = Math.floor(diffMs / (1000 * 60));
      return diffMins <= 1 ? 'just now' : `${diffMins} min ago`;
    }
    return diffHours === 1 ? '1 hour ago' : `${diffHours} hours ago`;
  }
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    return weeks === 1 ? '1 week ago' : `${weeks} weeks ago`;
  }
  if (diffDays < 365) {
    const months = Math.floor(diffDays / 30);
    return months === 1 ? '1 month ago' : `${months} months ago`;
  }
  const years = Math.floor(diffDays / 365);
  return years === 1 ? '1 year ago' : `${years} years ago`;
};

// Format date to display string
export const formatDate = (date: Date | Timestamp): string => {
  const targetDate = date instanceof Timestamp ? date.toDate() : date;
  return targetDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

// Normalize unit name
export const normalizeUnit = (unit: string): string => {
  const lower = unit.toLowerCase().trim();
  return UNIT_ALIASES[lower] || lower;
};

// Find calorie entry for ingredient
export const findCalorieEntry = (ingredientName: string): CalorieEntry | null => {
  const normalized = ingredientName.toLowerCase().trim();

  // Direct match
  if (CALORIE_DATABASE[normalized]) {
    return CALORIE_DATABASE[normalized];
  }

  // Partial match
  for (const [key, entry] of Object.entries(CALORIE_DATABASE)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return entry;
    }
  }

  return null;
};

// Calculate calories for an ingredient
export const calculateIngredientCalories = (
  name: string,
  amount: number,
  unit: string
): number => {
  const entry = findCalorieEntry(name);
  if (!entry) {
    return 0;
  }

  const normalizedUnit = normalizeUnit(unit);

  // If units match, calculate directly
  if (normalizedUnit === entry.defaultUnit) {
    const grams = amount * entry.gramsPerUnit;
    return Math.round((grams / 100) * entry.caloriesPer100g);
  }

  // Try to convert weight units
  const weightUnits: Record<string, number> = {
    g: 1,
    kg: 1000,
    oz: 28.35,
    lb: 453.592,
  };

  if (weightUnits[normalizedUnit]) {
    const grams = amount * weightUnits[normalizedUnit];
    return Math.round((grams / 100) * entry.caloriesPer100g);
  }

  // For volume units, estimate based on density (rough approximation)
  const volumeUnits: Record<string, number> = {
    tsp: 5,
    tbsp: 15,
    cup: 240,
    ml: 1,
    l: 1000,
  };

  if (volumeUnits[normalizedUnit]) {
    // Assume ~1g per ml for most ingredients (rough estimate)
    const grams = amount * volumeUnits[normalizedUnit];
    return Math.round((grams / 100) * entry.caloriesPer100g);
  }

  // Fallback: use default unit calculation
  const grams = amount * entry.gramsPerUnit;
  return Math.round((grams / 100) * entry.caloriesPer100g);
};

// Calculate nutrition info for a list of ingredients
export const calculateNutrition = (
  ingredients: Ingredient[],
  servings: number
): NutritionInfo => {
  let totalCalories = 0;
  let totalProtein = 0;
  let totalCarbs = 0;
  let totalFat = 0;
  let totalFiber = 0;

  for (const ingredient of ingredients) {
    const entry = findCalorieEntry(ingredient.name);
    if (entry) {
      const grams = ingredient.amount * entry.gramsPerUnit;
      const factor = grams / 100;

      totalCalories += factor * entry.caloriesPer100g;
      totalProtein += factor * entry.protein;
      totalCarbs += factor * entry.carbs;
      totalFat += factor * entry.fat;
      totalFiber += factor * entry.fiber;
    } else {
      // Use provided calorie if available
      totalCalories += ingredient.calories || 0;
    }
  }

  return {
    totalCalories: Math.round(totalCalories),
    caloriesPerServing: Math.round(totalCalories / servings),
    protein: Math.round(totalProtein),
    carbs: Math.round(totalCarbs),
    fat: Math.round(totalFat),
    fiber: Math.round(totalFiber),
  };
};

// Truncate text to specified length
export const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
};

// Capitalize first letter
export const capitalize = (str: string): string => {
  return str.charAt(0).toUpperCase() + str.slice(1);
};

// Generate random color from string (for avatars, etc.)
export const stringToColor = (str: string): string => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }

  const colors = [
    '#FF6B35', // Primary
    '#22C55E', // Secondary
    '#3B82F6', // Blue
    '#8B5CF6', // Purple
    '#EC4899', // Pink
    '#F59E0B', // Amber
    '#10B981', // Emerald
    '#6366F1', // Indigo
  ];

  return colors[Math.abs(hash) % colors.length];
};

// Get initials from name
export const getInitials = (name: string): string => {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};

// Validate email format
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Format number with commas
export const formatNumber = (num: number): string => {
  return num.toLocaleString('en-US');
};

// Debounce function
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

// Sleep function for delays
export const sleep = (ms: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

// Check if expiry date is soon (within 3 days)
export const isExpiringSoon = (expiryDate: Date | Timestamp): boolean => {
  const date = expiryDate instanceof Timestamp ? expiryDate.toDate() : expiryDate;
  const now = new Date();
  const threeDays = 3 * 24 * 60 * 60 * 1000;
  return date.getTime() - now.getTime() < threeDays && date.getTime() > now.getTime();
};

// Check if expired
export const isExpired = (expiryDate: Date | Timestamp): boolean => {
  const date = expiryDate instanceof Timestamp ? expiryDate.toDate() : expiryDate;
  return date.getTime() < new Date().getTime();
};

// Difficulty color mapping
export const getDifficultyColor = (difficulty: string): string => {
  switch (difficulty) {
    case 'easy':
      return '#22C55E';
    case 'medium':
      return '#F59E0B';
    case 'hard':
      return '#EF4444';
    default:
      return '#737373';
  }
};

// Category emoji mapping
export const getCategoryEmoji = (category: string): string => {
  const emojis: Record<string, string> = {
    breakfast: '🍳',
    lunch: '🥗',
    dinner: '🍽️',
    dessert: '🍰',
    snack: '🍿',
    appetizer: '🥟',
    beverage: '🥤',
    side: '🥔',
  };
  return emojis[category] || '🍴';
};

/** Map technical Firebase Auth errors to user-friendly messages. */
export const getFriendlyAuthError = (error: any): string => {
  const code = error?.code || (typeof error === 'string' ? error : '');

  if (code.includes('auth/invalid-email')) {
    return 'That email address doesn\'t look quite right. Double-check the spelling?';
  }
  if (code.includes('auth/user-disabled')) {
    return 'This account has been disabled. Please contact support if you think this is a mistake.';
  }
  if (code.includes('auth/user-not-found') || code.includes('auth/wrong-password') || code.includes('auth/invalid-credential')) {
    return 'Hmm, those credentials don\'t match our records. Try again?';
  }
  if (code.includes('auth/email-already-in-use')) {
    return 'Looks like that email is already registered! Try logging in instead?';
  }
  if (code.includes('auth/weak-password')) {
    return 'Your password is a bit too short. Try making it at least 6 characters!';
  }
  if (code.includes('auth/network-request-failed')) {
    return 'Connection trouble! Please check your internet and try again.';
  }
  if (code.includes('auth/too-many-requests')) {
    return 'Woah, slow down! Too many attempts. Please wait a moment and try again.';
  }

  // Fallback for unknown errors but strip technical prefixes
  const message = error?.message || String(error);
  return message.replace(/\[firebase\/auth\]\s*/i, '').replace(/auth\//g, '');
};
