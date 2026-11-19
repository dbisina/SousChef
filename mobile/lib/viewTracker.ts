import type { FeedEventInput } from '@shared/index';

/** A card counts as seen when this share of its height is on screen. */
export const VISIBLE_SHARE = 0.5;
/** Looking at a card for this long (ms) counts as reading it, not scrolling past. */
export const MIN_DWELL_MS = 3000;

interface Box {
  y: number;
  height: number;
}

/**
 * Works out, from where each card sits and where the list is scrolled to, which cards were shown and for how long. It reports
 * one "impression" the first time a card is mostly on screen, and one "view" with the time when it leaves the screen (or the
 * screen closes) if it was there for at least three seconds. Pure: the screen feeds it positions and the time.
 */
export class ViewTracker {
  private readonly boxes = new Map<string, Box>();
  private readonly since = new Map<string, number>();
  private readonly shown = new Set<string>();

  constructor(private readonly emit: (event: FeedEventInput) => void) {}

  /** A card was laid out (its place in the scrolling content). */
  layout(postId: string, y: number, height: number): void {
    if (height > 0) this.boxes.set(postId, { y, height });
  }

  /** The list scrolled (or first appeared): `offset` from the top, `viewport` the visible height, `now` in ms. */
  update(offset: number, viewport: number, now: number): void {
    const top = offset;
    const bottom = offset + viewport;
    for (const [id, box] of this.boxes) {
      const visible = Math.max(0, Math.min(box.y + box.height, bottom) - Math.max(box.y, top));
      const isShown = visible / box.height >= VISIBLE_SHARE || visible >= viewport * 0.6;
      if (isShown) {
        if (!this.since.has(id)) {
          this.since.set(id, now);
          if (!this.shown.has(id)) {
            this.shown.add(id);
            this.emit({ kind: 'impression', postId: id });
          }
        }
      } else {
        this.leave(id, now);
      }
    }
  }

  /** The screen closed or went to the background: everything on screen is no longer being looked at. */
  stop(now: number): void {
    for (const id of [...this.since.keys()]) this.leave(id, now);
  }

  private leave(id: string, now: number): void {
    const start = this.since.get(id);
    if (start === undefined) return;
    this.since.delete(id);
    const dwell = now - start;
    if (dwell >= MIN_DWELL_MS) this.emit({ kind: 'view', postId: id, dwellMs: Math.round(dwell) });
  }
}
