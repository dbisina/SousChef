// Keeping the feed clean and the badge honest. Two layers: quick rules when something is written, and a model check after
// it is published ("post, then remove"). Staff have the last word.
import type { Participant } from './chat';
import type { ReportReason } from './social';

/* ---------------------------------------------------------------- layer 1: rules on write */

export type TextVerdict = { ok: true } | { ok: false; reason: ReportReason; message: string };

const SHORTENERS = new Set(['bit.ly', 'tinyurl.com', 't.co', 'goo.gl', 'cutt.ly', 'is.gd', 'rb.gy', 'shorturl.at', 'ow.ly', 'buff.ly']);
const LINK = /\b(?:https?:\/\/|www\.)[^\s<>"')]+/gi;
export const MAX_LINKS_IN_TEXT = 2;

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Cheap checks that catch the obvious: link spam, keyboard mashing, shouting, and any term staff have banned. */
export function checkText(text: string, bannedTerms: readonly string[] = []): TextVerdict {
  const spam = (message: string): TextVerdict => ({ ok: false, reason: 'spam', message });
  const links = text.match(LINK) ?? [];
  if (links.length > MAX_LINKS_IN_TEXT) return spam('That has too many links');
  for (const link of links) {
    const host = link.replace(/^(?:https?:\/\/)?(?:www\.)?/i, '').split(/[/?#:]/)[0]?.toLowerCase() ?? '';
    if (SHORTENERS.has(host)) return spam('Shortened links are not allowed');
  }
  if (/(.)\1{14,}/u.test(text)) return spam('That looks like spam');
  const words = text.toLowerCase().match(/\p{L}[\p{L}\p{N}']{2,}/gu) ?? [];
  if (words.length >= 10) {
    const counts = new Map<string, number>();
    for (const w of words) counts.set(w, (counts.get(w) ?? 0) + 1);
    if (Math.max(...counts.values()) >= 8 && Math.max(...counts.values()) / words.length >= 0.5) return spam('That looks like spam');
  }
  const letters = text.replace(/[^\p{L}]/gu, '');
  if (letters.length >= 40 && letters.replace(/[^\p{Lu}]/gu, '').length / letters.length > 0.85) return spam('Please do not write everything in capitals');
  for (const term of bannedTerms) {
    const t = term.trim();
    if (t && new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegex(t)}(?![\\p{L}\\p{N}])`, 'iu').test(text)) {
      return { ok: false, reason: 'abuse', message: 'That includes words we do not allow' };
    }
  }
  return { ok: true };
}

/* ---------------------------------------------------------------- suspension */

export interface SuspendRequest {
  reason: string;
}

/* ---------------------------------------------------------------- chef verification */

export type ChefVerificationStatus = 'none' | 'pending' | 'approved' | 'rejected' | 'revoked';

export interface ChefVerificationRequest {
  /** Where staff can see the person's cooking: a website, a restaurant page, a channel. */
  portfolioUrl?: string;
  /** Why they should be verified, in their own words. */
  note: string;
}

/** The person's own view of their request. */
export interface ChefVerificationView {
  status: ChefVerificationStatus;
  note: string | null;
  portfolioUrl: string | null;
  submittedAt: string | null;
  decidedAt: string | null;
  rejectionReason: string | null;
}

export interface AdminChefVerification {
  id: string;
  user: Participant;
  status: Exclude<ChefVerificationStatus, 'none'>;
  note: string;
  portfolioUrl: string | null;
  submittedAt: string;
  decidedAt: string | null;
  rejectionReason: string | null;
}

export interface RejectChefRequest {
  reason: string;
}

export interface ModerationRunResult {
  reviewed: number;
  hidden: number;
  /** True when the check stopped before the queue was empty (the AI was unavailable or over budget). */
  stoppedEarly: boolean;
}
