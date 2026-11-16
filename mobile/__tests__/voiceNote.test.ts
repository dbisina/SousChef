// Recording and playing voice notes, with a stand-in for the audio library.
jest.mock('expo-av', () => {
  const statusCallbacks: ((s: object) => void)[] = [];
  const recording = { stopAndUnloadAsync: jest.fn(async () => ({ durationMillis: 4200 })), getURI: jest.fn(() => 'file:///note.m4a') };
  const sound = { unloadAsync: jest.fn(async () => undefined), setOnPlaybackStatusUpdate: jest.fn((cb: (st: object) => void) => { setTimeout(() => cb({ isLoaded: true, didJustFinish: true }), 0); }) };
  const Audio = {
    requestPermissionsAsync: jest.fn(),
    setAudioModeAsync: jest.fn(async () => undefined),
    RecordingOptionsPresets: { HIGH_QUALITY: { quality: 'high' } },
    Recording: { createAsync: jest.fn(async (_o: object, cb: (st: object) => void) => { statusCallbacks.push(cb); return { recording }; }) },
    Sound: { createAsync: jest.fn(async () => ({ sound })) },
  };
  return { Audio, __test: { statusCallbacks, recording, sound } };
});

import { MAX_VOICE_SEC, VoiceRecorder, playVoiceNote, toWaveform } from '@/lib/voiceNote';

const expoAv = jest.requireMock('expo-av') as { Audio: Record<string, any>; __test: { statusCallbacks: ((s: object) => void)[]; recording: Record<string, jest.Mock>; sound: Record<string, jest.Mock> } };
const mockAudio = expoAv.Audio;
const mockStatusCallbacks = expoAv.__test.statusCallbacks;
const mockRecording = expoAv.__test.recording;
const mockSound = expoAv.__test.sound;

beforeEach(() => {
  jest.clearAllMocks();
  mockStatusCallbacks.length = 0;
  mockAudio.requestPermissionsAsync.mockResolvedValue({ granted: true });
});

describe('the waveform', () => {
  it('turns loudness readings into bars between a floor and 100', () => {
    const bars = toWaveform([-60, -30, 0]);
    expect(bars).toEqual([8, 54, 100]);
  });

  it('squeezes a long recording into at most 40 bars, and never returns a flat or empty strip', () => {
    expect(toWaveform(Array.from({ length: 500 }, (_, i) => -60 + (i % 60)))).toHaveLength(40);
    const silent = toWaveform([]);
    expect(silent.length).toBeGreaterThan(0);
    expect(Math.min(...silent)).toBeGreaterThan(0);
    expect(toWaveform([-200, 50])).toEqual([8, 100]); // out-of-range readings are clamped
  });
});

describe('recording', () => {
  it('does not start without the microphone', async () => {
    mockAudio.requestPermissionsAsync.mockResolvedValue({ granted: false });
    const r = new VoiceRecorder();
    expect(await r.start()).toBe(false);
    expect(r.active).toBe(false);
    expect(await r.stop()).toBeNull();
  });

  it('records, collects loudness while it goes, and returns the file, length and waveform', async () => {
    const r = new VoiceRecorder();
    expect(await r.start()).toBe(true);
    expect(r.active).toBe(true);
    mockStatusCallbacks[0]?.({ isRecording: true, metering: -40, durationMillis: 100 });
    mockStatusCallbacks[0]?.({ isRecording: true, metering: -10, durationMillis: 200 });
    const note = await r.stop();
    expect(note).toMatchObject({ uri: 'file:///note.m4a', durationSec: 4 });
    expect(note?.waveform).toHaveLength(2);
    expect(r.active).toBe(false);
    expect(await r.stop()).toBeNull(); // stopping twice is harmless
  });

  it('asks to be stopped when a note reaches the length the server allows', async () => {
    const stop = jest.fn();
    await new VoiceRecorder().start(stop);
    mockStatusCallbacks[0]?.({ isRecording: true, metering: -20, durationMillis: (MAX_VOICE_SEC - 1) * 1000 });
    expect(stop).not.toHaveBeenCalled();
    mockStatusCallbacks[0]?.({ isRecording: true, metering: -20, durationMillis: MAX_VOICE_SEC * 1000 });
    expect(stop).toHaveBeenCalled();
  });

  it('gives back nothing when the recording cannot be saved, and can be thrown away', async () => {
    const r = new VoiceRecorder();
    await r.start();
    mockRecording.stopAndUnloadAsync.mockRejectedValueOnce(new Error('disk'));
    expect(await r.stop()).toBeNull();
    await r.start();
    await r.cancel();
    expect(r.active).toBe(false);
  });
});

describe('playing', () => {
  it('plays a note to the end and lets go of it', async () => {
    await playVoiceNote('https://m.test/note.m4a');
    expect(mockAudio.Sound.createAsync).toHaveBeenCalledWith({ uri: 'https://m.test/note.m4a' }, { shouldPlay: true });
    expect(mockSound.unloadAsync).toHaveBeenCalled();
  });

  it('does not throw when a note will not play', async () => {
    mockAudio.Sound.createAsync.mockRejectedValueOnce(new Error('bad file'));
    await expect(playVoiceNote('https://m.test/broken.m4a')).resolves.toBeUndefined();
  });
});
