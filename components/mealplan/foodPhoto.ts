import type { PhotoSource } from '@/components/ui';
import type { MealType } from '@/types/mealplan';

/** Shopping and waste entries carry no photo, so an ingredient shows its initial. */
export function foodPhoto(_name: string): PhotoSource | null {
  return null;
}

/** Photo for a planned meal: the recipe image when present. */
export function mealPhoto(imageURL: string | undefined, _type: MealType): PhotoSource | null {
  return imageURL ? { uri: imageURL } : null;
}
