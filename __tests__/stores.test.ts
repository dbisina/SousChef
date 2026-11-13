import { useSocialStore } from '@/stores/socialStore';
import { useMessageStore, filterConversations, messagesFor } from '@/stores/messageStore';
import { useOrderStore, selectCartTotals } from '@/stores/orderStore';
import { usePlayStore } from '@/stores/playStore';
import { useHealthStore, latestGlucose } from '@/stores/healthStore';

describe('social store', () => {
  it('likes, follows, comments and posts work locally', () => {
    const s = useSocialStore.getState();
    const find = () => useSocialStore.getState().posts.find((p) => p.id === 'post-katsu')!;
    const before = find();
    s.toggleLikePost('post-katsu');
    expect(find().likes).toBe(before.likes + 1);
    s.toggleLikePost('post-katsu');
    expect(find().likes).toBe(before.likes);
    s.toggleFollow('ama');
    expect(useSocialStore.getState().followingIds).toContain('ama');
    expect(s.addComment('post-katsu', '   ')).toBeNull();
    s.addComment('post-katsu', 'Looks great');
    expect(find().commentCount).toBe(before.commentCount + 1);
    const post = s.createPost({ kind: 'recipe', photo: 'gnocchi', caption: 'Walnut gnocchi' });
    expect(useSocialStore.getState().posts[0].id).toBe(post.id);
  });
});

describe('message store', () => {
  it('sends a message and updates the conversation preview', () => {
    useMessageStore.getState().sendMessage('conv-ama', { kind: 'text', text: 'On my way' });
    const conv = useMessageStore.getState().conversations.find((c) => c.id === 'conv-ama')!;
    expect(conv.lastPreview).toBe('On my way');
    const list = filterConversations(useMessageStore.getState().conversations, 'orders');
    expect(list.map((c) => c.kind)).toEqual(['order']);
    expect(messagesFor(useMessageStore.getState().messages, 'conv-ama').pop()!.kind).toBe('text');
  });
});

describe('order store', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('adds to order, totals, places a demo order and advances status on a timer', () => {
    useOrderStore.getState().addToOrder('double-smash', { extraIds: [], logToHealth: true });
    expect(selectCartTotals(useOrderStore.getState())).toEqual({
      subtotalPence: 950,
      deliveryPence: 199,
      totalPence: 1149,
      itemCount: 1,
    });
    const healthMeals = useHealthStore.getState().meals.length;
    const order = useOrderStore.getState().placeDemoOrder()!;
    expect(order.status).toBe('Confirmed');
    expect(useOrderStore.getState().cart).toHaveLength(0);
    expect(useHealthStore.getState().meals.length).toBe(healthMeals + 1);
    jest.advanceTimersByTime(7_000);
    expect(useOrderStore.getState().orders[0].status).toBe('Preparing');
    jest.advanceTimersByTime(40_000);
    expect(useOrderStore.getState().orders[0].status).toBe('Arrived');
  });
});

describe('play store', () => {
  it('daily dish: clue and guess flow', () => {
    const now = new Date(2026, 10, 13);
    const p = usePlayStore.getState();
    p.startDaily(now);
    p.revealNextClue();
    expect(usePlayStore.getState().daily!.cluesShown).toBe(2);
    p.guessDaily('definitely wrong', now);
    expect(usePlayStore.getState().daily!.status).toBe('playing');
  });
  it('mystery kitchen: host, start, hint, submit', () => {
    const p = usePlayStore.getState();
    p.hostRound();
    p.startRound(0);
    expect(usePlayStore.getState().round!.phase).toBe('cooking');
    expect(p.useHint()).toBeTruthy();
    p.submitPlate(60_000);
    const r = usePlayStore.getState().round!;
    expect(r.phase).toBe('reveal');
    expect(r.submissions).toHaveLength(4);
  });
});

describe('health store', () => {
  it('logs a reading and exposes sample data', () => {
    const r = useHealthStore.getState().logReading({ kind: 'glucose', mmol: 6.4, timing: 'fasting' });
    expect(r.kind).toBe('glucose');
    expect(latestGlucose(useHealthStore.getState().readings)?.id).toBe(r.id);
    expect(useHealthStore.getState().readings.some((x) => x.source === 'sample')).toBe(true);
  });
});
