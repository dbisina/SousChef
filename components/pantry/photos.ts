import { SAMPLE } from '@/assets/sample';
import type { PhotoSource } from '@/components/ui';

// Only a handful of staple photos ship with the app. Anything else falls back to initials / a plain tile.
const PHOTO_MATCHERS: Array<[RegExp, keyof typeof SAMPLE]> = [
  [/avocado/i, 'avocado'],
  [/\beggs?\b/i, 'eggs'],
  [/garlic/i, 'garlic'],
  [/broccoli/i, 'broccoli'],
  [/tomato/i, 'tomatoes'],
  [/spinach/i, 'spinach'],
  [/chicken/i, 'chicken'],
  [/beef|steak/i, 'beef'],
  [/salmon/i, 'salmon'],
];

/** Photo for a pantry / shopping ingredient name, when we have one. */
export function pantryPhoto(name: string): PhotoSource | undefined {
  for (const [re, key] of PHOTO_MATCHERS) {
    if (re.test(name)) return SAMPLE[key];
  }
  return undefined;
}
