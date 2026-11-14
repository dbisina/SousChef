/**
 * Design-review mode (web only, build-time).
 *
 * `EXPO_PUBLIC_DESIGN_REVIEW=1` is inlined by Metro at build time. When it is unset this is the
 * literal `false` and every branch guarded by it is dead code, so production paths are untouched.
 * Used by tools/fidelity to render every route as a guest next to the design HTML.
 */
export const isDesignReview: boolean = process.env.EXPO_PUBLIC_DESIGN_REVIEW === '1';

/** `?theme=dark|light` from the web URL, review mode only. */
export const getReviewTheme = (): 'light' | 'dark' | null => {
  if (!isDesignReview || typeof window === 'undefined' || !window.location) return null;
  try {
    const t = new URLSearchParams(window.location.search).get('theme');
    return t === 'dark' || t === 'light' ? t : null;
  } catch {
    return null;
  }
};

/** `?welcome=1` from the web URL, review mode only: forces the welcome sheet open for measurement. */
export const isReviewWelcome = (): boolean => {
  if (!isDesignReview || typeof window === 'undefined' || !window.location) return false;
  try {
    return new URLSearchParams(window.location.search).get('welcome') === '1';
  } catch {
    return false;
  }
};
