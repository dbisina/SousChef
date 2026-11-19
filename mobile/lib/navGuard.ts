/**
 * Stops a screen opening twice or three times. A quick double tap (or a tap that fires while the screen is still sliding in)
 * calls router.push again with the very same address, and expo-router happily stacks another copy. This wraps the router once:
 * a repeat of the same call within a short window is dropped. Different addresses always go through.
 */
type Nav = (href: unknown, ...rest: unknown[]) => unknown;
type RouterLike = { push: Nav; navigate: Nav; replace: Nav; back?: () => void };

export const NAV_GUARD_MS = 700;
const BACK_GUARD_MS = 350;

const keyOf = (href: unknown): string => {
  try {
    return typeof href === 'string' ? href : JSON.stringify(href);
  } catch {
    return String(href);
  }
};

export function installNavGuard(router: RouterLike, now: () => number = Date.now): void {
  const flagged = router as RouterLike & { __guarded?: boolean };
  if (flagged.__guarded) return;
  flagged.__guarded = true;

  const last = new Map<string, number>();
  for (const method of ['push', 'navigate', 'replace'] as const) {
    const original = router[method].bind(router) as Nav;
    router[method] = (href: unknown, ...rest: unknown[]) => {
      const key = `${method}:${keyOf(href)}`;
      const t = now();
      const prev = last.get(key);
      if (prev !== undefined && t - prev < NAV_GUARD_MS) return undefined;
      last.set(key, t);
      return original(href, ...rest);
    };
  }

  if (router.back) {
    const originalBack = router.back.bind(router);
    let lastBack = 0;
    router.back = () => {
      const t = now();
      if (t - lastBack < BACK_GUARD_MS) return;
      lastBack = t;
      originalBack();
    };
  }
}
