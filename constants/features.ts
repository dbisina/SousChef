/** Connected to a SousChef server (EXPO_PUBLIC_API_URL): there is no sample data to show, only real data or empty states. */
export const SERVER_MODE = Boolean(process.env.EXPO_PUBLIC_API_URL);

/**
 * Feature flags. Restaurants and orders have no server side yet, so they only exist on local sample data: when the app
 * is connected to a server they are hidden instead of showing invented restaurants and orders.
 */
export const FEATURES = {
  feed: true,
  messages: true,
  ordering: !SERVER_MODE,
  play: true,
  health: true,
} as const;

export type FeatureArea = keyof typeof FEATURES;

/** Small tag screens show where data is local sample content. */
export const PREVIEW_LABEL = 'Preview';
