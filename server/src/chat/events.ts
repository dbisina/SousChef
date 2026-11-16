import type { ChatEvent } from '@shared';

/** Where the chat service announces what happened, so connected phones hear about it at once. */
export interface ChatEvents {
  /** Tell these people (all their connected devices) about an event. Must never throw into the caller. */
  publish(userIds: string[], event: ChatEvent): void;
}

/** Used when nothing is listening (no live connections, or tests that do not care). */
export const noEvents: ChatEvents = { publish() {} };
