import { PHOTOS, type PhotoName } from '@/assets/photos';
import type { PhotoSource } from '@/components/ui';

// The app ships a photo for common staples; anything else shows its initial.
const PHOTO_MATCHERS: Array<[RegExp, PhotoName]> = [
  [/avocado/i, 'avocado'],
  [/\beggs?\b/i, 'eggs'],
  [/garlic|onion/i, 'garlic'],
  [/broccoli/i, 'broccoli'],
  [/tomato/i, 'tomatoes'],
  [/spinach|kale|lettuce/i, 'spinach'],
  [/chicken/i, 'chicken'],
  [/beef|steak/i, 'beef'],
  [/salmon|fish/i, 'salmon'],
  [/pasta|spaghetti|noodle/i, 'pasta'],
  [/rice/i, 'ricebowl'],
  [/bread|toast/i, 'toast'],
];

/** Photo for a pantry / shopping ingredient name, when the app has one. */
export function pantryPhoto(name: string): PhotoSource | undefined {
  for (const [re, key] of PHOTO_MATCHERS) {
    if (re.test(name)) return PHOTOS[key] as PhotoSource;
  }
  return undefined;
}
