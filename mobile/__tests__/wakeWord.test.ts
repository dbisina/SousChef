jest.mock('expo-speech', () => ({ speak: jest.fn(), stop: jest.fn(), getAvailableVoicesAsync: jest.fn(async () => []), isSpeakingAsync: jest.fn(async () => false) }));

import { checkForWakeWord, extractCommandAfterWakeWord } from '@/lib/voice';

describe('hands-free wake word', () => {
  it('wakes on the app name, as one word or as speech recognition splits it', () => {
    for (const heard of ['enplace', 'en place', 'hey enplace', 'okay on place next step', 'On place, set a timer for ten minutes', 'hey in place']) {
      expect(checkForWakeWord(heard)).toBe(true);
    }
  });

  it('still wakes on the old name', () => {
    expect(checkForWakeWord('hey sous chef')).toBe(true);
    expect(checkForWakeWord('sue chef next')).toBe(true);
  });

  it('does not wake on ordinary cooking talk', () => {
    expect(checkForWakeWord('keep the pan in place')).toBe(false);
    expect(checkForWakeWord('add the onions and place the lid on')).toBe(false);
    expect(checkForWakeWord('next step')).toBe(false);
  });

  it('keeps what comes after the wake word as the command', () => {
    expect(extractCommandAfterWakeWord('enplace next step')).toBe('next step');
    expect(extractCommandAfterWakeWord('hey en place set a timer')).toBe('set a timer');
  });
});
