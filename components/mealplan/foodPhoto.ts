import { SAMPLE } from '@/assets/sample';
import type { PhotoSource } from '@/components/ui';
import type { MealType } from '@/types/mealplan';

type SampleKey = keyof typeof SAMPLE;

// Ingredient keyword -> bundled sample photo. Real food photos are not stored on shopping or waste entries.
const KEYWORDS: [RegExp, SampleKey][] = [
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
];

/** Sample photo for an ingredient name, or null when nothing matches. */
export function foodPhoto(name: string): PhotoSource | null {
  for (const [re, key] of KEYWORDS) {
    if (re.test(name)) return SAMPLE[key] as PhotoSource;
  }
  return null;
}

const MEAL_FALLBACK: Record<MealType, SampleKey> = {
  breakfast: 'toast',
  lunch: 'bowl',
  dinner: 'salmon',
  snack: 'brownie',
};

/** Photo for a planned meal: the recipe image when present, otherwise a sample by meal type. */
export function mealPhoto(imageURL: string | undefined, type: MealType): PhotoSource {
  return imageURL ? { uri: imageURL } : (SAMPLE[MEAL_FALLBACK[type]] as PhotoSource);
}
