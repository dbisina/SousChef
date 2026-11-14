import { RecordingPresets, type RecordingOptions } from 'expo-audio';
import { create } from 'zustand';

/**
 * Speech settings for voice notes: mono, 16 kHz, 24 kbps AAC. 24 kbps is 3 KB a second, so about 180 KB a
 * minute and about 540 KB at the 3 minute cap, before container overhead. (The design note said about 120 KB a
 * minute; that would need 16 kbps, which sounds poor in plain AAC. Measure real recordings before relying
 * on either number.) Metering feeds the waveform.
 */
export const VOICE_RECORDING_OPTIONS: RecordingOptions = {
  ...RecordingPresets.LOW_QUALITY,
  isMeteringEnabled: true,
  sampleRate: 16000,
  numberOfChannels: 1,
  bitRate: 24000,
};

interface PlaybackState {
  /** The voice note currently playing. Starting another one pauses this one. */
  activeId: string | null;
  setActive: (id: string | null) => void;
}

export const useVoicePlaybackStore = create<PlaybackState>((set) => ({
  activeId: null,
  setActive: (activeId) => set({ activeId }),
}));
