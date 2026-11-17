import type { FeedEventInput, RecordFeedEventsRequest, RecordFeedEventsResponse } from '@shared/index';
import { api, apiEnabled } from '@/lib/api';

/** The server takes at most this many events in one go. */
export const MAX_BATCH = 50;

export interface ReporterOptions {
  send: (batch: FeedEventInput[]) => Promise<unknown>;
  /** Report when this many are waiting. */
  flushAt?: number;
  /** Report this long after the first one is waiting (ms). */
  flushMs?: number;
  /** Never hold more than this many (the oldest go first when the phone is offline for a long time). */
  maxQueue?: number;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (t: unknown) => void;
}

/**
 * Collects what the person does with the feed and reports it in small batches in the background. It never blocks a screen and
 * never throws: a failed batch is put back to try again with the next one, and the queue is capped so a long offline stretch
 * cannot grow without end.
 */
export function createFeedReporter(options: ReporterOptions) {
  const flushAt = options.flushAt ?? 20;
  const flushMs = options.flushMs ?? 8000;
  const maxQueue = options.maxQueue ?? 200;
  const setTimer = options.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
  const clearTimer = options.clearTimer ?? ((t) => clearTimeout(t as ReturnType<typeof setTimeout>));
  let queue: FeedEventInput[] = [];
  let timer: unknown = null;
  let sending = false;
  let enabled = true;

  const stopTimer = () => {
    if (timer !== null) clearTimer(timer);
    timer = null;
  };

  const flush = async (): Promise<void> => {
    stopTimer();
    if (sending || queue.length === 0) return;
    sending = true;
    const batch = queue.slice(0, MAX_BATCH);
    queue = queue.slice(batch.length);
    try {
      await options.send(batch);
    } catch {
      queue = [...batch, ...queue].slice(-maxQueue);
    } finally {
      sending = false;
    }
    if (queue.length >= flushAt) void flush();
    else if (queue.length > 0 && timer === null) timer = setTimer(() => void flush(), flushMs);
  };

  return {
    report(event: FeedEventInput): void {
      if (!enabled) return;
      queue.push(event);
      if (queue.length > maxQueue) queue = queue.slice(-maxQueue);
      if (queue.length >= flushAt) void flush();
      else if (timer === null) timer = setTimer(() => void flush(), flushMs);
    },
    /** Sends what is waiting now (when the app goes to the background or a screen closes). */
    flush,
    /** Off: nothing is kept or sent, and what was waiting is dropped. */
    setEnabled(on: boolean): void {
      enabled = on;
      if (!on) {
        queue = [];
        stopTimer();
      }
    },
    pending: () => queue.length,
  };
}

/** The one reporter the app uses. It does nothing without a server. */
export const feedReporter = createFeedReporter({
  send: (events) => (apiEnabled() ? api().post<RecordFeedEventsResponse>('/v1/feed/events', { events } satisfies RecordFeedEventsRequest) : Promise.resolve()),
});

export const reportFeedEvent = (event: FeedEventInput): void => {
  if (apiEnabled()) feedReporter.report(event);
};
