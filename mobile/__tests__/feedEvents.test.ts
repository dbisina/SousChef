import type { FeedEventInput } from '@shared/index';
import { createFeedReporter, MAX_BATCH } from '@/lib/feedEvents';
import { MIN_DWELL_MS, ViewTracker } from '@/lib/viewTracker';

const ev = (n: number): FeedEventInput => ({ kind: 'impression', postId: `p${n}` });

/** A timer the test controls. */
function fakeTimers() {
  let next = 1;
  const pending = new Map<number, () => void>();
  return {
    setTimer: (fn: () => void) => {
      pending.set(next, fn);
      return next++;
    },
    clearTimer: (t: unknown) => void pending.delete(t as number),
    fire: () => {
      const fns = [...pending.values()];
      pending.clear();
      fns.forEach((f) => f());
    },
    count: () => pending.size,
  };
}

describe('reporting what people do with the feed', () => {
  it('waits a little, then sends what is queued in one batch', async () => {
    const timers = fakeTimers();
    const sent: FeedEventInput[][] = [];
    const r = createFeedReporter({ send: async (b) => void sent.push(b), ...timers });
    r.report(ev(1));
    r.report(ev(2));
    expect(sent).toEqual([]);
    expect(timers.count()).toBe(1);
    timers.fire();
    await r.flush();
    expect(sent).toEqual([[ev(1), ev(2)]]);
    expect(r.pending()).toBe(0);
  });

  it('sends at once when enough have piled up, never more than the server takes', async () => {
    const timers = fakeTimers();
    const sent: FeedEventInput[][] = [];
    const r = createFeedReporter({ send: async (b) => void sent.push(b), flushAt: 40, maxQueue: 500, ...timers });
    for (let i = 0; i < 39; i++) r.report(ev(i)); // below the threshold: nothing sent yet
    expect(sent).toEqual([]);
    for (let i = 39; i < 120; i++) r.report(ev(i));
    await r.flush();
    await r.flush();
    await r.flush();
    expect(sent.map((b) => b.length).every((n) => n <= MAX_BATCH)).toBe(true);
    expect(sent.flat()).toHaveLength(120);
  });

  it('puts a failed batch back and tries again, and never throws', async () => {
    const timers = fakeTimers();
    let fail = true;
    const sent: FeedEventInput[][] = [];
    const r = createFeedReporter({
      send: async (b) => {
        if (fail) throw new Error('offline');
        sent.push(b);
      },
      ...timers,
    });
    r.report(ev(1));
    await r.flush();
    expect(r.pending()).toBe(1);
    fail = false;
    r.report(ev(2));
    await r.flush();
    expect(sent).toEqual([[ev(1), ev(2)]]);
  });

  it('keeps only the newest when the phone has been offline a long time', async () => {
    const timers = fakeTimers();
    const r = createFeedReporter({ send: async () => Promise.reject(new Error('offline')), maxQueue: 5, flushAt: 1000, ...timers });
    for (let i = 0; i < 12; i++) r.report(ev(i));
    expect(r.pending()).toBe(5);
  });

  it('drops everything and stays quiet while turned off', async () => {
    const timers = fakeTimers();
    const sent: FeedEventInput[][] = [];
    const r = createFeedReporter({ send: async (b) => void sent.push(b), ...timers });
    r.report(ev(1));
    r.setEnabled(false);
    expect(r.pending()).toBe(0);
    r.report(ev(2));
    await r.flush();
    expect(sent).toEqual([]);
    r.setEnabled(true);
    r.report(ev(3));
    await r.flush();
    expect(sent).toEqual([[ev(3)]]);
  });
});

describe('working out what was looked at', () => {
  const collect = () => {
    const out: FeedEventInput[] = [];
    return { out, tracker: new ViewTracker((e) => out.push(e)) };
  };

  it('counts an impression once when a card is mostly on screen, and a view after three seconds', () => {
    const { out, tracker } = collect();
    tracker.layout('a', 0, 400);
    tracker.layout('b', 420, 400);
    tracker.update(0, 800, 1000);
    expect(out).toEqual([{ kind: 'impression', postId: 'a' }, { kind: 'impression', postId: 'b' }]);
    tracker.update(0, 800, 1500); // still there: nothing new
    expect(out).toHaveLength(2);
    tracker.update(900, 800, 1000 + MIN_DWELL_MS + 200); // both scrolled away
    expect(out.slice(2)).toEqual([
      { kind: 'view', postId: 'a', dwellMs: MIN_DWELL_MS + 200 },
      { kind: 'view', postId: 'b', dwellMs: MIN_DWELL_MS + 200 },
    ]);
  });

  it('does not call a quick scroll past a view, and does not repeat an impression on coming back', () => {
    const { out, tracker } = collect();
    tracker.layout('a', 0, 400);
    tracker.update(0, 800, 0);
    tracker.update(1000, 800, 800); // gone after 0.8 s
    tracker.update(0, 800, 5000); // back again
    expect(out).toEqual([{ kind: 'impression', postId: 'a' }]);
  });

  it('needs half of the card on screen', () => {
    const { out, tracker } = collect();
    tracker.layout('a', 700, 400);
    tracker.update(0, 800, 0); // 100 of 400 showing
    expect(out).toEqual([]);
    tracker.update(300, 800, 10); // 400 of 400 showing
    expect(out).toEqual([{ kind: 'impression', postId: 'a' }]);
  });

  it('counts a tall card that fills the screen even though less than half of it shows', () => {
    const { out, tracker } = collect();
    tracker.layout('tall', 0, 2000);
    tracker.update(0, 800, 0);
    expect(out).toEqual([{ kind: 'impression', postId: 'tall' }]);
  });

  it('closes out what is on screen when the screen goes away', () => {
    const { out, tracker } = collect();
    tracker.layout('a', 0, 400);
    tracker.update(0, 800, 0);
    tracker.stop(MIN_DWELL_MS + 1);
    expect(out).toEqual([{ kind: 'impression', postId: 'a' }, { kind: 'view', postId: 'a', dwellMs: MIN_DWELL_MS + 1 }]);
    tracker.stop(99_999); // nothing left on screen: no second view
    expect(out).toHaveLength(2);
  });
});
