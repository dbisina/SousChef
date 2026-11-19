import { Share } from 'react-native';
import type { PortionAnalysis } from '@/types';

const APP_LINK = 'https://souschef-api-production.up.railway.app';
const MAX_ITEMS = 5;

/**
 * The words that go out when someone shares a plate scan: what was found, the calories and the macros, with a plain reminder
 * that a photo gives an estimate. Pure (no phone APIs) so it can be tested, and reused by an in-app "send to chat" later.
 */
export function buildScanShareText(result: PortionAnalysis): string {
  const lines: string[] = [];
  const kcal = Math.round(result.totalEstimatedCalories);
  lines.push(`My plate on enplace: about ${kcal} kcal${result.suggestedServings > 1 ? ` (${result.suggestedServings} servings)` : ''}`);

  const n = result.totalNutrition;
  if (n) {
    lines.push(`Protein ${Math.round(n.proteinG)} g · Carbs ${Math.round(n.carbsG)} g · Fat ${Math.round(n.fatG)} g`);
  }

  const items = (result.detectedItems ?? []).filter((i) => i.name.trim().length > 0);
  if (items.length > 0) {
    const shown = items.slice(0, MAX_ITEMS).map((i) => i.name.trim());
    const more = items.length - shown.length;
    lines.push(`On the plate: ${shown.join(', ')}${more > 0 ? ` and ${more} more` : ''}`);
  }

  lines.push('An estimate from a photo, not medical advice.');
  lines.push(`Scan your own plate: ${APP_LINK}`);
  return lines.join('\n');
}

/** Opens the share sheet with the scan's summary. Cancelling or an unsupported device is not an error worth showing. */
export async function shareScanResult(result: PortionAnalysis): Promise<boolean> {
  try {
    const out = await Share.share({ message: buildScanShareText(result) });
    return out.action === Share.sharedAction;
  } catch {
    return false;
  }
}
