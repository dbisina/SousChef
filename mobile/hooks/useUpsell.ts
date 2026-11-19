import { useCallback, useState } from 'react';
import { canOfferUpsell, markUpsellDismissed, markUpsellShown } from '@/lib/engagement';
import { showInfoToast } from '@/stores/toastStore';

/**
 * The plan sheet, the polite way: it never opens by itself unless it has been a while (see `lib/engagement.ts`), and when it
 * stays closed the person still gets a calm line saying what happened. Tapping "See plans" always opens it.
 */
export function useUpsell() {
  const [visible, setVisible] = useState(false);

  /** The person asked to see plans. */
  const open = useCallback(() => {
    setVisible(true);
    void markUpsellShown();
  }, []);

  /** A limit was reached. Opens the sheet only if it is a good time; otherwise tells them in a sentence. */
  const offer = useCallback(
    async (calmMessage?: string) => {
      if (await canOfferUpsell()) open();
      else if (calmMessage) showInfoToast(calmMessage);
    },
    [open],
  );

  const close = useCallback(() => {
    setVisible(false);
    void markUpsellDismissed();
  }, []);

  return { visible, open, offer, close };
}
