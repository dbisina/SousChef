import type { Message, MessageReaction, ReplyRef } from '@/types/social';

/** The reaction bar offered on long press, in order. */
export const REACTION_EMOJI = ['❤️', '😂', '😮', '🔥', '👏', '😋'] as const;

/**
 * One reaction per person per message (like iMessage): choosing a new emoji replaces the old one,
 * choosing the same emoji again removes it. Reactions with no people left disappear.
 */
export function toggleReaction(
  reactions: MessageReaction[] | undefined,
  emoji: string,
  userId: string,
): MessageReaction[] {
  const current = reactions ?? [];
  const had = current.find((r) => r.userIds.includes(userId));
  const withoutUser = current
    .map((r) => ({ ...r, userIds: r.userIds.filter((id) => id !== userId) }))
    .filter((r) => r.userIds.length > 0);
  if (had?.emoji === emoji) return withoutUser;
  const existing = withoutUser.find((r) => r.emoji === emoji);
  if (existing) {
    return withoutUser.map((r) => (r.emoji === emoji ? { ...r, userIds: [...r.userIds, userId] } : r));
  }
  return [...withoutUser, { emoji, userIds: [userId] }];
}

/** Distance in px a bubble must travel before a release counts as "reply". */
export const REPLY_THRESHOLD = 56;

/**
 * Drag distance of the bubble for a finger movement: follows the finger 1:1 at first, then resists
 * (rubber band) so it never runs away. Only movement toward the reply side counts; the result is >= 0.
 */
export function rubberBand(dx: number, max = 84): number {
  const d = Math.max(0, dx);
  if (d <= REPLY_THRESHOLD) return d;
  const over = d - REPLY_THRESHOLD;
  const room = max - REPLY_THRESHOLD;
  return REPLY_THRESHOLD + room * (1 - Math.exp(-over / room));
}

export const replyArmed = (bubbleOffset: number): boolean => bubbleOffset >= REPLY_THRESHOLD - 0.5;

/** Short text shown in the reply bar and the quoted block. */
export function replyPreview(m: Message): string {
  if (m.kind === 'text') return m.text.length > 90 ? `${m.text.slice(0, 87)}...` : m.text;
  if (m.kind === 'recipe-card') return m.title;
  const mins = Math.floor(m.durationSec / 60);
  const secs = `${m.durationSec % 60}`.padStart(2, '0');
  return `Voice message ${mins}:${secs}`;
}

export const toReplyRef = (m: Message): ReplyRef => ({
  messageId: m.id,
  senderId: m.senderId,
  preview: replyPreview(m),
});

/** Messages left in "sending" when the app was closed can never be confirmed: mark them failed so they can be retried. */
export function failStuckMessages(messages: Message[]): Message[] {
  return messages.map((m) => (m.status === 'sending' ? { ...m, status: 'failed' as const } : m));
}

/** Waveform for a recording from raw metering values (dB, about -60 silent to 0 loud) down to `bars` heights 0..100. */
export function waveformFromMetering(levels: number[], bars = 40): number[] {
  if (levels.length === 0) return Array.from({ length: bars }, () => 12);
  const out: number[] = [];
  for (let i = 0; i < bars; i++) {
    const from = Math.floor((i * levels.length) / bars);
    const to = Math.max(from + 1, Math.floor(((i + 1) * levels.length) / bars));
    let peak = -160;
    for (let j = from; j < to && j < levels.length; j++) peak = Math.max(peak, levels[j]!);
    const clamped = Math.min(0, Math.max(-60, peak));
    out.push(Math.round(8 + ((clamped + 60) / 60) * 92));
  }
  return out;
}
