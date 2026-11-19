import { PHOTOS, type PhotoName } from '@/assets/photos';
import type { PhotoSource } from '@/components/ui';
import type { MealType } from '@/types/mealplan';

// Ingredient keyword -> the app's own photo. Shopping and waste entries carry no picture of their own.
const KEYWORDS: [RegExp, PhotoName][] = [
  [/broccoli/i, 'broccoli'],
  [/salmon|fish|seafood/i, 'salmon'],
  [/avocado/i, 'avocado'],
  [/tomato/i, 'tomatoes'],
  [/spinach|kale|lettuce|greens|arugula/i, 'spinach'],
  [/chicken|turkey|poultry/i, 'chicken'],
  [/egg/i, 'eggs'],
  [/garlic|onion/i, 'garlic'],
  [/beef|steak|pork|meat/i, 'beef'],
  [/pasta|noodle|penne|spaghetti/i, 'pasta'],
  [/rice|quinoa|grain/i, 'ricebowl'],
  [/bread|toast|bagel/i, 'toast'],
  [/pancake|waffle/i, 'pancakes'],
  [/pepper|carrot|zucchini|cucumber|vegetable|veg\b/i, 'greens'],
];

/** The app's photo for an ingredient name, or null when nothing matches (the row then shows its initial). */
export function foodPhoto(name: string): PhotoSource | null {
  for (const [re, key] of KEYWORDS) {
    if (re.test(name)) return PHOTOS[key] as PhotoSource;
  }
  return null;
}

const MEAL_FALLBACK: Record<MealType, PhotoName> = {
  breakfast: 'toast',
  lunch: 'bowl',
  dinner: 'salmon',
  snack: 'brownie',
};

/** Photo for a planned meal: the recipe image when present, otherwise the app's photo for that meal type. */
export function mealPhoto(imageURL: string | undefined, type: MealType): PhotoSource {
  return imageURL ? { uri: imageURL } : (PHOTOS[MEAL_FALLBACK[type]] as PhotoSource);
}
