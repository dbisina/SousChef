import type { PhotoSource } from '@/components/ui';

/** Pantry items carry no photo, so an ingredient shows its initial. */
export function pantryPhoto(_name: string): PhotoSource | undefined {
  return undefined;
}
