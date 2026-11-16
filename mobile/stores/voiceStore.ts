import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  VoiceState,
  VoiceListeningState,
  VoiceParseResult,
  CookingTimer,
  TimerState,
} from '@/types/voice';

// Generate unique ID for timers
const generateTimerId = (): string => {
  return `timer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

interface VoiceStoreState extends VoiceState, TimerState {
  // Settings (persisted)
  voiceEnabled: boolean;

  // Wake word state
  isWakeWordMode: boolean;
  isWakeWordListening: boolean;

  // Settings actions
  setVoiceEnabled: (enabled: boolean) => void;

  // Voice state setters
  setListening: (isListening: boolean) => void;
  setSpeaking: (isSpeaking: boolean) => void;
  setProcessing: (isProcessing: boolean) => void;
  setTranscript: (transcript: string) => void;
  setLastCommand: (command: VoiceParseResult | null) => void;
  setError: (error: string | null) => void;
  setState: (state: VoiceListeningState) => void;
  reset: () => void;

  // Wake word actions
  setWakeWordMode: (enabled: boolean) => void;
  setWakeWordListening: (isListening: boolean) => void;

  // Timer actions
  addTimer: (name: string, minutes: number) => string;
  removeTimer: (timerId: string) => void;
  pauseTimer: (timerId: string) => void;
  resumeTimer: (timerId: string) => void;
  updateTimerRemaining: (timerId: string, remainingSeconds: number) => void;
  clearAllTimers: () => void;
  getTimer: (timerId: string) => CookingTimer | undefined;
}

const initialVoiceState: VoiceState = {
  isListening: false,
  isSpeaking: false,
  isProcessing: false,
  transcript: '',
  lastCommand: null,
  error: null,
  state: 'idle',
};

const initialTimerState: TimerState = {
  timers: [],
  activeTimerCount: 0,
};

export const useVoiceStore = create<VoiceStoreState>()(
  persist(
    (set, get) => ({
  ...initialVoiceState,
  ...initialTimerState,

  // Settings (persisted)
  voiceEnabled: true,

  // Wake word state
  isWakeWordMode: false,
  isWakeWordListening: false,

  // Settings actions
  setVoiceEnabled: (enabled) => set({ voiceEnabled: enabled }),

  // Voice state setters
  setListening: (isListening) =>
    set({
      isListening,
      state: isListening ? 'listening' : 'idle',
      error: null,
    }),

  setSpeaking: (isSpeaking) =>
    set({
      isSpeaking,
      state: isSpeaking ? 'speaking' : 'idle',
    }),

  setProcessing: (isProcessing) =>
    set({
      isProcessing,
      state: isProcessing ? 'processing' : 'idle',
    }),

  setTranscript: (transcript) => set({ transcript }),

  setLastCommand: (lastCommand) =>
    set({
      lastCommand,
      isProcessing: false,
      state: 'idle',
    }),

  setError: (error) =>
    set({
      error,
      isListening: false,
      isProcessing: false,
      state: error ? 'error' : 'idle',
    }),

  setState: (state) => set({ state }),

  reset: () =>
    set({
      ...initialVoiceState,
      isWakeWordMode: false,
      isWakeWordListening: false,
    }),

  // Wake word actions
  setWakeWordMode: (enabled) =>
    set({
      isWakeWordMode: enabled,
      // Reset listening state when mode changes
      isWakeWordListening: false,
    }),

  setWakeWordListening: (isListening) =>
    set({
      isWakeWordListening: isListening,
      state: isListening ? 'listening' : 'idle',
    }),

  // Timer actions
  addTimer: (name, minutes) => {
    const id = generateTimerId();
    const totalSeconds = minutes * 60;
    const now = new Date();
    const endTime = new Date(now.getTime() + totalSeconds * 1000);

    const newTimer: CookingTimer = {
      id,
      name,
      totalSeconds,
      remainingSeconds: totalSeconds,
      isRunning: true,
      createdAt: now,
      endTime,
    };

    set((state) => ({
      timers: [...state.timers, newTimer],
      activeTimerCount: state.activeTimerCount + 1,
    }));

    return id;
  },

  removeTimer: (timerId) => {
    set((state) => {
      const timer = state.timers.find((t) => t.id === timerId);
      const wasRunning = timer?.isRunning || false;

      return {
        timers: state.timers.filter((t) => t.id !== timerId),
        activeTimerCount: wasRunning
          ? Math.max(0, state.activeTimerCount - 1)
          : state.activeTimerCount,
      };
    });
  },

  pauseTimer: (timerId) => {
    set((state) => {
      const timerIndex = state.timers.findIndex((t) => t.id === timerId);
      if (timerIndex === -1) return state;

      const timer = state.timers[timerIndex];
      if (!timer.isRunning) return state;

      const updatedTimers = [...state.timers];
      updatedTimers[timerIndex] = {
        ...timer,
        isRunning: false,
        endTime: null,
      };

      return {
        timers: updatedTimers,
        activeTimerCount: Math.max(0, state.activeTimerCount - 1),
      };
    });
  },

  resumeTimer: (timerId) => {
    set((state) => {
      const timerIndex = state.timers.findIndex((t) => t.id === timerId);
      if (timerIndex === -1) return state;

      const timer = state.timers[timerIndex];
      if (timer.isRunning || timer.remainingSeconds <= 0) return state;

      const endTime = new Date(Date.now() + timer.remainingSeconds * 1000);

      const updatedTimers = [...state.timers];
      updatedTimers[timerIndex] = {
        ...timer,
        isRunning: true,
        endTime,
      };

      return {
        timers: updatedTimers,
        activeTimerCount: state.activeTimerCount + 1,
      };
    });
  },

  updateTimerRemaining: (timerId, remainingSeconds) => {
    set((state) => {
      const timerIndex = state.timers.findIndex((t) => t.id === timerId);
      if (timerIndex === -1) return state;

      const updatedTimers = [...state.timers];
      const timer = updatedTimers[timerIndex];

      // If timer completed
      if (remainingSeconds <= 0) {
        updatedTimers[timerIndex] = {
          ...timer,
          remainingSeconds: 0,
          isRunning: false,
          endTime: null,
        };

        return {
          timers: updatedTimers,
          activeTimerCount: Math.max(0, state.activeTimerCount - 1),
        };
      }

      updatedTimers[timerIndex] = {
        ...timer,
        remainingSeconds,
      };

      return { timers: updatedTimers };
    });
  },

  clearAllTimers: () =>
    set({
      timers: [],
      activeTimerCount: 0,
    }),

  getTimer: (timerId) => {
    return get().timers.find((t) => t.id === timerId);
  },
}),
    {
      name: 'voice-settings',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        voiceEnabled: state.voiceEnabled,
        isWakeWordMode: state.isWakeWordMode,
      }),
    }
  )
);

// Selectors
export const selectVoiceState = (state: VoiceStoreState): VoiceState => ({
  isListening: state.isListening,
  isSpeaking: state.isSpeaking,
  isProcessing: state.isProcessing,
  transcript: state.transcript,
  lastCommand: state.lastCommand,
  error: state.error,
  state: state.state,
});

export const selectWakeWordState = (state: VoiceStoreState) => ({
  isWakeWordMode: state.isWakeWordMode,
  isWakeWordListening: state.isWakeWordListening,
});

export const selectTimerState = (state: VoiceStoreState): TimerState => ({
  timers: state.timers,
  activeTimerCount: state.activeTimerCount,
});

export const selectActiveTimers = (state: VoiceStoreState): CookingTimer[] => {
  return state.timers.filter((t) => t.isRunning);
};

export const selectCompletedTimers = (state: VoiceStoreState): CookingTimer[] => {
  return state.timers.filter((t) => !t.isRunning && t.remainingSeconds <= 0);
};
