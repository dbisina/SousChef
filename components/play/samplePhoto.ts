import type { PhotoSource } from '@/components/ui';
import { photoSource } from '@/lib/photo';

/** The picture at an address (from the server), or null. */
export const samplePhoto = (ref: string | null | undefined): PhotoSource | null => photoSource(ref);
