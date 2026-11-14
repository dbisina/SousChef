import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface FeedbackState {
  /** Interface sounds (send, receive, react, like, recording). Always silent when the phone is on silent. */
  sounds: boolean;
  /** Haptic taps. */
  haptics: boolean;
  setSounds: (on: boolean) => void;
  setHaptics: (on: boolean) => void;
}

export const useFeedbackStore = create<FeedbackState>()(
  persist(
    (set) => ({
      sounds: true,
      haptics: true,
      setSounds: (sounds) => set({ sounds }),
      setHaptics: (haptics) => set({ haptics }),
    }),
    { name: 'souschef-feedback-v1', storage: createJSONStorage(() => AsyncStorage), version: 1 },
  ),
);
