/** Feature flags for the SousChef 2.0 areas that run on local sample data. */
export const FEATURES = {
  feed: true,
  messages: true,
  ordering: true,
  play: true,
  health: true,
} as const;

export type FeatureArea = keyof typeof FEATURES;

/** Small tag screens show where data is local sample content. */
export const PREVIEW_LABEL = 'Preview';
