import type { Href, Router } from 'expo-router';

/**
 * Go to a tab (or any top-level screen) from inside a modal screen (cooking, reels, stories, import, create). A plain
 * `push` would stack the tab on top of the modal and leave the modal underneath; this closes the modals first.
 */
export function leaveModalTo(router: Pick<Router, 'canDismiss' | 'dismissAll' | 'replace'>, href: Href): void {
  if (router.canDismiss()) router.dismissAll();
  router.replace(href);
}
