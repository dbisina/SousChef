import { getReviewTheme, isDesignReview } from '@/lib/designReview';

/**
 * Design-review bootstrap: forces the theme from `?theme=`, marks auth as initialised (so the
 * auth gate never blocks a route) and exposes the zustand stores on `window.__SC__` so the
 * fidelity harness can inject fixture data. No-op unless EXPO_PUBLIC_DESIGN_REVIEW=1.
 */
export function bootDesignReview(): void {
  if (!isDesignReview || typeof window === 'undefined') return;

  /* eslint-disable @typescript-eslint/no-require-imports */
  const stores = {
    auth: require('@/stores/authStore').useAuthStore,
    pantry: require('@/stores/pantryStore').usePantryStore,
    recipe: require('@/stores/recipeStore').useRecipeStore,
    mealPlan: require('@/stores/mealPlanStore').useMealPlanStore,
    subscription: require('@/stores/subscriptionStore').useSubscriptionStore,
    theme: require('@/stores/themeStore').useThemeStore,
    cookbook: require('@/stores/cookbookStore').useCookbookStore,
    cookbookLibrary: require('@/stores/cookbookLibraryStore').useCookbookLibraryStore,
    gamification: require('@/stores/gamificationStore').useGamificationStore,
    health: require('@/stores/healthStore').useHealthStore,
    language: require('@/stores/languageStore').useLanguageStore,
    message: require('@/stores/messageStore').useMessageStore,
    order: require('@/stores/orderStore').useOrderStore,
    play: require('@/stores/playStore').usePlayStore,
    setup: require('@/stores/setupStore').useSetupStore,
    social: require('@/stores/socialStore').useSocialStore,
    toast: require('@/stores/toastStore').useToastStore,
    voice: require('@/stores/voiceStore').useVoiceStore,
    wantToCook: require('@/stores/wantToCookStore').useWantToCookStore,
    ad: require('@/stores/adStore').useAdStore,
    shareIntent: require('@/stores/shareIntentStore').useShareIntentStore,
  } as Record<string, { getState: () => unknown; setState: (p: unknown) => void } | undefined>;
  /* eslint-enable @typescript-eslint/no-require-imports */

  (window as unknown as { __SC__: unknown }).__SC__ = { stores, ready: false };

  const theme = getReviewTheme();
  if (theme) {
    const { buildColors } = require('@/stores/themeStore') as typeof import('@/stores/themeStore');
    const themeStore = stores.theme;
    const s = themeStore?.getState() as { settings: object } | undefined;
    themeStore?.setState({
      settings: { ...(s?.settings ?? {}), theme },
      effectiveTheme: theme,
      colors: buildColors(theme),
      isLoaded: true,
    });
  }
  stores.auth?.setState({ isInitialized: true });
}
