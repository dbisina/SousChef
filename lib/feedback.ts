import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { useFeedbackStore } from '@/stores/feedbackStore';

/* eslint-disable @typescript-eslint/no-require-imports -- Metro needs literal require() calls for bundled assets */
const SOURCES = {
  send: require('@/assets/sounds/send.wav'),
  receive: require('@/assets/sounds/receive.wav'),
  react: require('@/assets/sounds/react.wav'),
  like: require('@/assets/sounds/like.wav'),
  recordStart: require('@/assets/sounds/recordStart.wav'),
  recordStop: require('@/assets/sounds/recordStop.wav'),
} as const;
/* eslint-enable @typescript-eslint/no-require-imports */

export type SoundName = keyof typeof SOURCES;

const players: Partial<Record<SoundName, AudioPlayer>> = {};
let modeReady = false;

/** UI sounds sit under music and follow the phone's silent switch. */
const UI_MODE = {
  playsInSilentMode: false,
  interruptionMode: 'mixWithOthers',
  allowsRecording: false,
  shouldPlayInBackground: false,
  shouldRouteThroughEarpiece: false,
} as const;

async function prepareMode() {
  if (modeReady) return;
  modeReady = true;
  try {
    await setAudioModeAsync(UI_MODE);
  } catch {
    modeReady = false;
  }
}

/** Put the audio session back to UI-sound settings, e.g. after a voice note recording. */
export async function restoreUiAudioMode() {
  try {
    await setAudioModeAsync(UI_MODE);
  } catch {
    // Nothing to restore on platforms without an audio session.
  }
}

function playerFor(name: SoundName): AudioPlayer | null {
  if (Platform.OS === 'web') return null;
  try {
    let p = players[name];
    if (!p) {
      p = createAudioPlayer(SOURCES[name]);
      p.volume = 0.7;
      players[name] = p;
    }
    return p;
  } catch {
    return null;
  }
}

/** Load the sounds ahead of time so the first one is not late. Safe to call repeatedly. */
export function preloadSounds() {
  if (!useFeedbackStore.getState().sounds) return;
  void prepareMode();
  (Object.keys(SOURCES) as SoundName[]).forEach(playerFor);
}

export function playSound(name: SoundName) {
  if (!useFeedbackStore.getState().sounds) return;
  void prepareMode();
  const p = playerFor(name);
  if (!p) return;
  try {
    void p.seekTo(0);
    p.play();
  } catch {
    // A sound that cannot play must never break the action that triggered it.
  }
}

type Tap = 'light' | 'medium' | 'soft' | 'rigid' | 'select' | 'success' | 'warning' | 'error';

export function tap(kind: Tap) {
  if (!useFeedbackStore.getState().haptics || Platform.OS === 'web') return;
  try {
    switch (kind) {
      case 'light':
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        break;
      case 'medium':
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        break;
      case 'soft':
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft);
        break;
      case 'rigid':
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid);
        break;
      case 'select':
        void Haptics.selectionAsync();
        break;
      case 'success':
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        break;
      case 'warning':
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        break;
      case 'error':
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        break;
    }
  } catch {
    // Devices without a haptic engine simply do nothing.
  }
}

/** Named moments. Screens call these, never haptics or sounds directly, so both switches always apply. */
export const feedback = {
  send() {
    tap('light');
    playSound('send');
  },
  receive() {
    tap('soft');
    playSound('receive');
  },
  react() {
    tap('medium');
    playSound('react');
  },
  /** Reaction bar opened by a long press. */
  menuOpen() {
    tap('rigid');
  },
  /** Drag to reply crossed its threshold. */
  replyArmed() {
    tap('select');
  },
  replySent() {
    tap('light');
  },
  like() {
    tap('success');
    playSound('like');
  },
  save() {
    tap('soft');
  },
  follow() {
    tap('medium');
  },
  select() {
    tap('select');
  },
  refresh() {
    tap('light');
  },
  recordStart() {
    tap('medium');
    playSound('recordStart');
  },
  recordStop() {
    tap('light');
    playSound('recordStop');
  },
  recordCancel() {
    tap('warning');
  },
  failed() {
    tap('error');
  },
};
