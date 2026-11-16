// Without a server the stores start empty: no invented people, posts, conversations, readings or games.
import { useSocialStore } from '@/stores/socialStore';
import { useMessageStore } from '@/stores/messageStore';
import { usePlayStore } from '@/stores/playStore';
import { useHealthStore, latestGlucose } from '@/stores/healthStore';

describe('stores start empty', () => {
  it('social store has no sample people or posts', () => {
    const s = useSocialStore.getState();
    expect(s.posts).toEqual([]);
    expect(s.authors).toEqual([]);
    expect(s.stories).toEqual([]);
    expect(s.communities).toEqual([]);
  });
  it('message store has no sample conversations', () => {
    expect(useMessageStore.getState().conversations).toEqual([]);
  });
  it('play store has no sample streak or round', () => {
    const p = usePlayStore.getState();
    expect(p.streak).toEqual({ current: 0, best: 0, lastSolvedDate: '' });
    expect(p.round).toBeNull();
  });
  it('health store has no sample readings, and a logged reading is the only one', () => {
    expect(useHealthStore.getState().readings).toEqual([]);
    const r = useHealthStore.getState().logReading({ kind: 'glucose', mmol: 6.4, timing: 'fasting' });
    expect(r.kind).toBe('glucose');
    expect(latestGlucose(useHealthStore.getState().readings)?.id).toBe(r.id);
    expect(useHealthStore.getState().readings).toHaveLength(1);
  });
});
