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

/** Parses a TikTok, Instagram or YouTube link. Returns null if it is not one of those, or not a video. */
export function parseVideoLink(input: string): VideoLink | null;
