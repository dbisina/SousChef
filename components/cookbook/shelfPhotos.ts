import type { PhotoSource } from '@/components/ui';

// A book or recipe with no picture of its own shows its initials / the brand backdrop; there are no stand-in photos.

/** No stand-in picture: callers show the brand backdrop. */
export function dishPhoto(_seed: string): PhotoSource | null {
  return null;
}

/** Photo for a shelf book: its fetched cover when there is one. */
export function coverPhoto(book: { id: string; coverImageURL?: string }): PhotoSource | null {
  return book.coverImageURL ? { uri: book.coverImageURL } : null;
}

/** Photo for a shelf recipe: its fetched image when there is one. */
export function recipePhoto(recipe: { id: string; fullContent?: { imageURL?: string } }): PhotoSource | null {
  const uri = recipe.fullContent?.imageURL;
  return uri ? { uri } : null;
}
