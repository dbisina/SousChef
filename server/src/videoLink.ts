import { parseVideoLink, type VideoLink } from '@souschef/native';

export type { VideoLink };

/**
 * The key recipe imports are cached under, or null when the link is not a video link or is a short link that has to be
 * resolved first. Implemented in Rust (server/native/links).
 */
export const videoCacheKey = (link: string): string | null => parseVideoLink(link)?.canonical ?? null;

/** The addon leaves `canonical` out for a short link; callers get an explicit null instead. */
export const parseLink = (link: string): (VideoLink & { canonical: string | null }) | null => {
  const parsed = parseVideoLink(link);
  return parsed ? { ...parsed, canonical: parsed.canonical ?? null } : null;
};
