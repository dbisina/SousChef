import { PHOTOS } from '@/assets/photos';
import type { PhotoSource } from '@/components/ui';

// Dish photos for shelf covers and thumbnails when a book or recipe has no picture of its own. Picked from the id so a
// given book always gets the same photo.
const DISHES: PhotoSource[] = [
  PHOTOS.pasta,
  PHOTOS.greens,
  PHOTOS.pancakes,
  PHOTOS.gnocchi,
  PHOTOS.penne,
  PHOTOS.pizza,
  PHOTOS.tacos,
  PHOTOS.powerbowl,
  PHOTOS.ramen,
  PHOTOS.salmon,
  PHOTOS.toast,
  PHOTOS.salad,
] as PhotoSource[];

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
