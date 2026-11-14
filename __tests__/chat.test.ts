import {
  REACTION_EMOJI,
  REPLY_THRESHOLD,
  failStuckMessages,
  replyArmed,
  replyPreview,
  rubberBand,
  toggleReaction,
  waveformFromMetering,
} from '@/lib/chatLogic';
import { messagesFor, setMessageTransport, useMessageStore } from '@/stores/messageStore';
import { localTransport } from '@/services/messageService';
import type { Message } from '@/types/social';

const find = (id: string) => useMessageStore.getState().messages.find((m) => m.id === id)!;

describe('toggleReaction', () => {
  it('adds, replaces and removes my reaction (one per person)', () => {
    let r = toggleReaction(undefined, 'a', 'me');
    expect(r).toEqual([{ emoji: 'a', userIds: ['me'] }]);
    r = toggleReaction(r, 'b', 'me');
    expect(r).toEqual([{ emoji: 'b', userIds: ['me'] }]);
    r = toggleReaction(r, 'b', 'me');
    expect(r).toEqual([]);
  });

  it('keeps other people on the same emoji', () => {
    const r = toggleReaction([{ emoji: 'a', userIds: ['ama'] }], 'a', 'me');
    expect(r).toEqual([{ emoji: 'a', userIds: ['ama', 'me'] }]);
    expect(toggleReaction(r, 'a', 'me')).toEqual([{ emoji: 'a', userIds: ['ama'] }]);
  });

  it('offers six reactions', () => {
    expect(REACTION_EMOJI).toHaveLength(6);
  });
});

describe('drag to reply', () => {
  it('follows the finger up to the threshold, then resists, never going negative or past the maximum', () => {
    expect(rubberBand(-30)).toBe(0);
    expect(rubberBand(20)).toBe(20);
    expect(rubberBand(REPLY_THRESHOLD)).toBe(REPLY_THRESHOLD);
    const far = rubberBand(500);
    expect(far).toBeGreaterThan(REPLY_THRESHOLD);
    expect(far).toBeLessThanOrEqual(84);
    expect(rubberBand(120)).toBeLessThan(120);
    expect(rubberBand(100)).toBeGreaterThan(rubberBand(70));
  });

  it('arms only at the threshold', () => {
    expect(replyArmed(REPLY_THRESHOLD - 10)).toBe(false);
    expect(replyArmed(REPLY_THRESHOLD)).toBe(true);
  });
});

describe('previews and recovery', () => {
  const base = { id: 'm1', conversationId: 'c', senderId: 'me', createdAt: '2026-01-01T00:00:00.000Z' } as const;

  it('summarises each kind of message for a quote', () => {
    expect(replyPreview({ ...base, kind: 'text', text: 'hello' })).toBe('hello');
    expect(replyPreview({ ...base, kind: 'text', text: 'x'.repeat(200) })).toHaveLength(90);
    expect(replyPreview({ ...base, kind: 'voice', durationSec: 75, waveform: [] })).toBe('Voice message 1:15');
  });

  it('marks messages stuck in sending as failed and leaves the rest alone', () => {
    const msgs: Message[] = [
      { ...base, id: 'a', kind: 'text', text: 'a', status: 'sending' },
      { ...base, id: 'b', kind: 'text', text: 'b', status: 'sent' },
    ];
    expect(failStuckMessages(msgs).map((m) => m.status)).toEqual(['failed', 'sent']);
  });

  it('turns metering into a fixed number of bars between 8 and 100', () => {
    const bars = waveformFromMetering(Array.from({ length: 200 }, (_, i) => -60 + (i % 60)), 40);
    expect(bars).toHaveLength(40);
    expect(Math.min(...bars)).toBeGreaterThanOrEqual(8);
    expect(Math.max(...bars)).toBeLessThanOrEqual(100);
    expect(waveformFromMetering([], 5)).toHaveLength(5);
  });
});

describe('message sending', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    jest.useRealTimers();
    setMessageTransport(localTransport);
  });

  it('shows a message as sending at once, then sent, then delivered', async () => {
    setMessageTransport({ send: () => Promise.resolve() });
    const m = useMessageStore.getState().sendMessage('conv-ama', { kind: 'text', text: 'On my way' })!;
    expect(find(m.id).status).toBe('sending');
    await Promise.resolve();
    await Promise.resolve();
    expect(find(m.id).status).toBe('sent');
    jest.advanceTimersByTime(900);
    expect(find(m.id).status).toBe('delivered');
  });

  it('marks a message failed when the transport rejects, and retry delivers it', async () => {
    setMessageTransport({ send: () => Promise.reject(new Error('offline')) });
    const m = useMessageStore.getState().sendMessage('conv-ama', { kind: 'text', text: 'Hello?' })!;
    await Promise.resolve();
    await Promise.resolve();
    expect(find(m.id).status).toBe('failed');

    setMessageTransport({ send: () => Promise.resolve() });
    useMessageStore.getState().retryMessage(m.id);
    expect(find(m.id).status).toBe('sending');
    await Promise.resolve();
    await Promise.resolve();
    expect(find(m.id).status).toBe('sent');
  });

  it('keeps the quoted message on a reply', () => {
    setMessageTransport({ send: () => Promise.resolve() });
    const m = useMessageStore.getState().sendMessage('conv-ama', {
      kind: 'text',
      text: 'Agreed',
      replyTo: { messageId: 'x1', senderId: 'ama', preview: 'Dinner at 7?' },
    })!;
    expect(find(m.id).replyTo?.preview).toBe('Dinner at 7?');
  });

  it('toggles my reaction on a message in the store', () => {
    setMessageTransport({ send: () => Promise.resolve() });
    const m = useMessageStore.getState().sendMessage('conv-ama', { kind: 'text', text: 'Tonight' })!;
    useMessageStore.getState().reactToMessage(m.id, REACTION_EMOJI[0]);
    expect(find(m.id).reactions).toEqual([{ emoji: REACTION_EMOJI[0], userIds: ['me'] }]);
    useMessageStore.getState().reactToMessage(m.id, REACTION_EMOJI[0]);
    expect(find(m.id).reactions).toEqual([]);
    expect(messagesFor(useMessageStore.getState().messages, 'conv-ama').length).toBeGreaterThan(0);
  });
});
