import { SAMPLE, photoSource } from '@/assets/sample';
import type { PhotoSource } from '@/components/ui';
import type { PhotoLike as PhotoRef } from '@/assets/sample';

/** The photo for a reference: a bundled sample, or a picture from the server. */
export const samplePhoto = (ref: PhotoRef): PhotoSource => photoSource(ref) as PhotoSource;

/** Mystery photo shown (blurred) for a Daily Dish answer. */
export function dailyDishPhoto(answer: string): PhotoSource {
  const a = answer.toLowerCase();
  if (a.includes('ramen')) return SAMPLE.ramen as PhotoSource;
  if (a.includes('pizza')) return SAMPLE.pizza as PhotoSource;
  if (a.includes('pad thai')) return SAMPLE.pasta as PhotoSource;
  return SAMPLE.ricebowl as PhotoSource;
}
