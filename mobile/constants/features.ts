/** Connected to an enplace server (EXPO_PUBLIC_API_URL). The app shows real data or an empty state, never invented content. */
export const SERVER_MODE = Boolean(process.env.EXPO_PUBLIC_API_URL);

/** Feature switches. Everything the app offers has a server behind it, so they are all on. */
export const FEATURES = {
  feed: true,
  messages: true,
  play: true,
  health: true,
} as const;

export type FeatureArea = keyof typeof FEATURES;

