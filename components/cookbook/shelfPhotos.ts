import { SAMPLE } from '@/assets/sample';
import type { PhotoSource } from '@/components/ui';

// Dish photos used to build shelf covers and recipe thumbnails when a book or
// recipe has no image of its own. Picked deterministically from an id so a
// given book always gets the same photo.
const DISHES: PhotoSource[] = [
  SAMPLE.pasta,
  SAMPLE.greens,
  SAMPLE.pancakes,
  SAMPLE.gnocchi,
  SAMPLE.penne,
  SAMPLE.pizza,
  SAMPLE.tacos,
  SAMPLE.powerbowl,
  SAMPLE.ramen,
  SAMPLE.salmon,
  SAMPLE.toast,
  SAMPLE.salad,
];

export function dishPhoto(seed: string): PhotoSource {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return DISHES[h % DISHES.length];
}

/** Photo for a shelf book: its fetched cover when there is one, else a dish photo. */
export function coverPhoto(book: { id: string; coverImageURL?: string }): PhotoSource {
  return book.coverImageURL ? { uri: book.coverImageURL } : dishPhoto(book.id);
}

/** Photo for a shelf recipe: its fetched image when there is one, else a dish photo. */
export function recipePhoto(recipe: { id: string; fullContent?: { imageURL?: string } }): PhotoSource {
  const uri = recipe.fullContent?.imageURL;
  return uri ? { uri } : dishPhoto(recipe.id);
}
