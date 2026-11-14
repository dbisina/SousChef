import { SAMPLE } from '@/assets/sample';
import type { PhotoSource } from '@/components/ui';
import type { PhotoRef } from '@/types/social';

/** Bundled sample photo for a PhotoRef key. */
export const samplePhoto = (ref: PhotoRef): PhotoSource => SAMPLE[ref] as PhotoSource;

/** Mystery photo shown (blurred) for a Daily Dish answer. */
export function dailyDishPhoto(answer: string): PhotoSource {
  const a = answer.toLowerCase();
  if (a.includes('ramen')) return SAMPLE.ramen as PhotoSource;
  if (a.includes('pizza')) return SAMPLE.pizza as PhotoSource;
  if (a.includes('pad thai')) return SAMPLE.pasta as PhotoSource;
  return SAMPLE.ricebowl as PhotoSource;
}
