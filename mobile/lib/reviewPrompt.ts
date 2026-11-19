// Asking for a store rating. Everyone is asked the same way with the system's own dialog (no "do you like it?" question that
// sends only happy people to the store: both stores treat that as manipulating ratings), nothing is offered in return, and
// `lib/engagement.ts` decides when (after a finished cook, rarely).
import { Linking } from 'react-native';
import * as StoreReview from 'expo-store-review';

/** Shows the system rating dialog if this phone can. The system also limits how often it really appears. */
export async function askForStoreReview(): Promise<void> {
  try {
    if (await StoreReview.hasAction()) await StoreReview.requestReview();
  } catch {
    // no dialog available: nothing to do
  }
}

/** "Rate enplace" in settings: opens the store page, or the dialog when there is no page address yet. */
export async function openStoreReviewPage(): Promise<void> {
  try {
    const url = StoreReview.storeUrl();
    if (url) await Linking.openURL(url);
    else await askForStoreReview();
  } catch {
    // ignore
  }
}
