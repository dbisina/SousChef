// What people do with the feed, reported by the app so the feed can learn what each person likes.

export const FEED_EVENT_KINDS = ['impression', 'view', 'open', 'like', 'save', 'share', 'cook_start', 'cook_finish', 'hide'] as const;
export type FeedEventKind = (typeof FEED_EVENT_KINDS)[number];

export interface FeedEventInput {
  kind: FeedEventKind;
  /** The post it happened on (a feed card). */
  postId?: string;
  /** The recipe, for events that have no post (starting or finishing a recipe in cook mode). */
  recipeId?: string;
  /** How long it stayed on screen in milliseconds (view events). */
  dwellMs?: number;
}

export interface RecordFeedEventsRequest {
  events: FeedEventInput[];
}

export interface RecordFeedEventsResponse {
  /** How many were kept (events about things that do not exist, or all of them when personalisation is off, are dropped). */
  accepted: number;
}

export interface FeedPreferences {
  /** Whether the feed may learn from what this person does. */
  personalised: boolean;
}
