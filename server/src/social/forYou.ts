import { rankFeed, type FeedCandidate } from '../native';

export type { FeedCandidate };

/** Posts older than this are not considered for "for you". */
export const FOR_YOU_WINDOW_MS = 7 * 24 * 3_600_000;
/** Most posts handed to the ranker per request. */
export const FOR_YOU_CANDIDATES = 300;

/** Which part of the ranked feed the next page starts at, and the moment the candidate set was fixed at. */
export interface ForYouCursor {
  asOf: string;
  offset: number;
}

export const encodeCursor = (c: ForYouCursor): string => Buffer.from(JSON.stringify(c)).toString('base64url');

/** Reads a cursor the server made earlier; anything else is null. */
export function decodeCursor(value: string): ForYouCursor | null {
  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as Partial<ForYouCursor>;
    if (typeof parsed.asOf === 'string' && !Number.isNaN(Date.parse(parsed.asOf)) && Number.isInteger(parsed.offset) && (parsed.offset as number) >= 0) {
      return { asOf: parsed.asOf, offset: parsed.offset as number };
    }
  } catch {
    // fall through
  }
  return null;
}

/** How much the viewer cares about an author: someone they follow counts most, someone whose posts they liked or saved less. */
export const AFFINITY = { followed: 1, engaged: 0.5, self: 0.3, stranger: 0 } as const;

/** The ids of the best `want` candidates, best first (the Rust ranker). */
export function rank(candidates: FeedCandidate[], want: number): string[] {
  return rankFeed(candidates, want);
}
