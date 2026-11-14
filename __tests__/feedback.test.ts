const mockImpact = jest.fn();
const mockSelection = jest.fn();
const mockNotification = jest.fn();
const mockPlay = jest.fn();
const mockSeekTo = jest.fn();

jest.mock('expo-haptics', () => ({
  impactAsync: (...a: unknown[]) => mockImpact(...a),
  selectionAsync: (...a: unknown[]) => mockSelection(...a),
  notificationAsync: (...a: unknown[]) => mockNotification(...a),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Soft: 'soft', Heavy: 'heavy', Rigid: 'rigid' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
}));

jest.mock('expo-audio', () => ({
  createAudioPlayer: jest.fn(() => ({ play: mockPlay, seekTo: mockSeekTo, volume: 1 })),
  setAudioModeAsync: jest.fn(() => Promise.resolve()),
}));

import { feedback } from '@/lib/feedback';
import { useFeedbackStore } from '@/stores/feedbackStore';

beforeEach(() => {
  jest.clearAllMocks();
  useFeedbackStore.setState({ sounds: true, haptics: true });
});

describe('feedback', () => {
  it('taps and plays a sound when a message is sent', () => {
    feedback.send();
    expect(mockImpact).toHaveBeenCalledWith('light');
    expect(mockPlay).toHaveBeenCalledTimes(1);
  });

  it('stays silent but still taps when sounds are off', () => {
    useFeedbackStore.setState({ sounds: false });
    feedback.send();
    expect(mockImpact).toHaveBeenCalledTimes(1);
    expect(mockPlay).not.toHaveBeenCalled();
  });

  it('plays the sound but does not tap when haptics are off', () => {
    useFeedbackStore.setState({ haptics: false });
    feedback.react();
    expect(mockImpact).not.toHaveBeenCalled();
    expect(mockPlay).toHaveBeenCalledTimes(1);
  });

  it('does nothing at all when both are off', () => {
    useFeedbackStore.setState({ sounds: false, haptics: false });
    feedback.send();
    feedback.like();
    feedback.replyArmed();
    expect(mockImpact).not.toHaveBeenCalled();
    expect(mockNotification).not.toHaveBeenCalled();
    expect(mockSelection).not.toHaveBeenCalled();
    expect(mockPlay).not.toHaveBeenCalled();
  });

  it('uses a selection tick when drag to reply arms', () => {
    feedback.replyArmed();
    expect(mockSelection).toHaveBeenCalledTimes(1);
  });
});
