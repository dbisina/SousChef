// Recording a voice note for a chat message. Tap to start, tap to stop; the file, its length and a waveform come back.
import { Audio } from 'expo-av';

/** The server accepts voice notes up to 1 MB, about five minutes of speech; stop a little before that. */
export const MAX_VOICE_SEC = 240;
const BARS = 40;

/** Turns the loudness readings taken while recording (decibels, about -60 quiet to 0 loud) into up to 40 bars of 0 to 100. */
export function toWaveform(dbSamples: number[]): number[] {
  if (dbSamples.length === 0) return Array.from({ length: 12 }, () => 20);
  const bars = Math.min(BARS, dbSamples.length);
  const out: number[] = [];
  for (let i = 0; i < bars; i++) {
    const from = Math.floor((i * dbSamples.length) / bars);
    const to = Math.max(from + 1, Math.floor(((i + 1) * dbSamples.length) / bars));
    const slice = dbSamples.slice(from, to);
    const db = slice.reduce((a, b) => a + b, 0) / slice.length;
    const level = Math.min(1, Math.max(0, (db + 60) / 60)); // -60 dB (silence) to 0 dB (loud)
    out.push(Math.round(8 + level * 92)); // never a flat line
  }
  return out;
}

export interface VoiceNote {
  uri: string;
  durationSec: number;
  waveform: number[];
}

export class VoiceRecorder {
  private recording: Audio.Recording | null = null;
  private samples: number[] = [];

  get active(): boolean {
    return this.recording !== null;
  }

  /** Asks for the microphone if needed. False when the person said no. */
  async start(onAutoStop?: () => void): Promise<boolean> {
    if (this.recording) return true;
    const permission = await Audio.requestPermissionsAsync();
    if (!permission.granted) return false;
    await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
    this.samples = [];
    const { recording } = await Audio.Recording.createAsync({ ...Audio.RecordingOptionsPresets.HIGH_QUALITY, isMeteringEnabled: true }, (status) => {
      if (status.isRecording && typeof status.metering === 'number') this.samples.push(status.metering);
      if (status.isRecording && status.durationMillis >= MAX_VOICE_SEC * 1000) onAutoStop?.();
    }, 100);
    this.recording = recording;
    return true;
  }

  /** Stops and returns the note, or null if nothing was recorded. */
  async stop(): Promise<VoiceNote | null> {
    const recording = this.recording;
    if (!recording) return null;
    this.recording = null;
    try {
      const status = await recording.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
      const uri = recording.getURI();
      const durationSec = Math.max(1, Math.round((status.durationMillis ?? 0) / 1000));
      return uri ? { uri, durationSec, waveform: toWaveform(this.samples) } : null;
    } catch {
      return null;
    }
  }

  /** Throws the recording away. */
  async cancel(): Promise<void> {
    const recording = this.recording;
    this.recording = null;
    try {
      await recording?.stopAndUnloadAsync();
    } catch {
      // already stopped
    }
  }
}

let playing: Audio.Sound | null = null;

/** Plays a voice note from the server (stopping any other one first). Resolves when it ends or cannot play. */
export async function playVoiceNote(url: string): Promise<void> {
  try {
    await playing?.unloadAsync();
    const { sound } = await Audio.Sound.createAsync({ uri: url }, { shouldPlay: true });
    playing = sound;
    await new Promise<void>((resolve) => {
      sound.setOnPlaybackStatusUpdate((status) => {
        if (!status.isLoaded || status.didJustFinish) resolve();
      });
    });
    await sound.unloadAsync();
    if (playing === sound) playing = null;
  } catch {
    // a note that will not play simply does not play
  }
}
