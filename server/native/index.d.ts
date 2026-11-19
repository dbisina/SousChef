/** What a link points at. See `links/src/lib.rs` for the rules. */
export interface VideoLink {
  /** "youtube", "tiktok" or "instagram". */
  platform: string;
  /** The platform's video id, or the short code when `canonical` is null. */
  id: string;
  /**
   * Stable cache key such as "youtube:dQw4w9WgXcQ". Null for a short link that must be resolved by following its
   * redirect once and parsing the final address.
   */
  canonical: string | null;
}

/** One post to be ranked. See `feed/src/lib.rs` for how the numbers are used. */
export interface FeedCandidate {
  id: string;
  authorId: string;
  /** Hours since it was posted. */
  ageHours: number;
  likes: number;
  comments: number;
  saves: number;
  views: number;
  /** 0 (a stranger) to 1 (someone the viewer follows). */
  authorAffinity: number;
  hasRecipe: boolean;
  /** 0 to 1: how close the dish is to what the viewer likes. Left out: 0. */
  taste?: number | null;
  /** 0 to 1: how much the viewer has pushed this author away. Left out: 0. */
  avoid?: number | null;
  /** How many times the viewer was shown it and ignored it. Left out: 0. */
  seen?: number | null;
  /** What kind of dish (its cuisine), so one kind does not fill the page. Left out: no group. */
  group?: string | null;
}

/** Orders posts for the "for you" feed and returns the ids of the best `limit`, best first. */
export function rankFeed(candidates: FeedCandidate[], limit: number): string[];

/** Parses a TikTok, Instagram or YouTube link. Returns null if it is not one of those, or not a video. */
export function parseVideoLink(input: string): VideoLink | null;
