/**
 * Clean remote (Firestore) copy before showing it to users: the design language
 * forbids em/en dashes used as punctuation, so swap them for a comma.
 */
export function cleanCopy(s: string | null | undefined): string {
  if (!s) return '';
  return s
    .replace(/\s*(?:—|–|--)\s*/g, ', ')
    .replace(/,\s*,/g, ',')
    .replace(/\s+/g, ' ')
    .trim();
}
