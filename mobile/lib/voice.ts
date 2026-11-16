import * as Speech from 'expo-speech';
import { Platform, Alert } from 'react-native';

// Types for Voice events
type SpeechStartEvent = any;
type SpeechEndEvent = any;
type SpeechResultsEvent = { value?: string[] };
type SpeechErrorEvent = { error?: { code?: string; message?: string } };
type SpeechRecognizedEvent = any;

// Voice module interface
interface VoiceModule {
  isAvailable: () => Promise<boolean>;
  start: (locale: string) => Promise<void>;
  stop: () => Promise<void>;
  cancel: () => Promise<void>;
  destroy: () => Promise<void>;
  isRecognizing: () => Promise<boolean>;
  onSpeechStart: ((e: SpeechStartEvent) => void) | null;
  onSpeechEnd: ((e: SpeechEndEvent) => void) | null;
  onSpeechResults: ((e: SpeechResultsEvent) => void) | null;
  onSpeechPartialResults: ((e: SpeechResultsEvent) => void) | null;
  onSpeechError: ((e: SpeechErrorEvent) => void) | null;
  onSpeechRecognized: ((e: SpeechRecognizedEvent) => void) | null;
}

// Mock Voice for when native module is unavailable (Expo Go)
const MockVoice: VoiceModule = {
  isAvailable: async () => false,
  start: async (_locale: string) => { },
  stop: async () => { },
  cancel: async () => { },
  destroy: async () => { },
  isRecognizing: async () => false,
  onSpeechStart: null,
  onSpeechEnd: null,
  onSpeechResults: null,
  onSpeechPartialResults: null,
  onSpeechError: null,
  onSpeechRecognized: null,
};

// Try to load the real @react-native-voice/voice module
// Falls back to mock if native module is not linked (e.g., Expo Go)
let Voice: VoiceModule = MockVoice;
let isNativeVoiceAvailable = false;

try {
  // Dynamic require to gracefully handle missing native module
  const RNVoice = require('@react-native-voice/voice').default;
  if (RNVoice) {
    Voice = RNVoice;
    isNativeVoiceAvailable = true;
    console.log('[Voice] Native @react-native-voice/voice module loaded successfully');
  }
} catch (e) {
  console.warn('[Voice] @react-native-voice/voice not available, using mock (Expo Go mode)');
  console.warn('[Voice] Voice recognition requires a Development or Production build');
}

import {
  VoiceConfig,
  TTSConfig,
  DEFAULT_VOICE_CONFIG,
  DEFAULT_TTS_CONFIG,
  VoiceError,
  VoiceErrorType,
} from '@/types/voice';

// Wake word patterns
const WAKE_WORD_PATTERNS = [
  /\b(hey\s+)?sous\s*chef\b/i,
  /\b(okay|ok)\s+sous\s*chef\b/i,
  /\bsue\s*chef\b/i, // Common misrecognition
  /\bsous\s*chief\b/i, // Common misrecognition
];

// Premium voice identifiers by platform
// These are high-quality, natural-sounding voices
const PREFERRED_VOICES = {
  ios: [
    'com.apple.voice.premium.en-US.Ava', // Premium Ava - very natural
    'com.apple.voice.premium.en-US.Zoe', // Premium Zoe
    'com.apple.voice.premium.en-US.Samantha', // Premium Samantha
    'com.apple.voice.enhanced.en-US.Ava', // Enhanced Ava
    'com.apple.voice.enhanced.en-US.Samantha', // Enhanced Samantha
    'com.apple.ttsbundle.Samantha-compact', // Compact but decent
    'com.apple.voice.compact.en-US.Samantha', // Fallback
  ],
  android: [
    'en-us-x-tpf-local', // Google high quality female
    'en-us-x-tpc-local', // Google high quality
    'en-us-x-sfg-local', // Google Studio female
    'en-US-language', // Default English
  ],
};

// Selected voice cache
let selectedVoice: Speech.Voice | null = null;
let voicesInitialized = false;

// Voice recognition event listeners
type VoiceEventCallback = {
  onSpeechStart?: () => void;
  onSpeechEnd?: () => void;
  onSpeechResults?: (results: string[]) => void;
  onSpeechPartialResults?: (results: string[]) => void;
  onSpeechError?: (error: VoiceError) => void;
  onSpeechRecognized?: () => void;
  onWakeWordDetected?: (transcript: string) => void;
};

// Wake word listening state
let isWakeWordListening = false;
let wakeWordCallback: ((transcript: string) => void) | null = null;
let wakeWordRestartTimeout: ReturnType<typeof setTimeout> | null = null;

let currentCallbacks: VoiceEventCallback = {};

// Initialize voice recognition
export const initializeVoiceRecognition = async (): Promise<boolean> => {
  try {
    // If native module wasn't loaded, voice recognition isn't available
    if (!isNativeVoiceAvailable) {
      console.warn('[Voice] Native voice module not loaded. Voice features disabled.');
      console.warn('[Voice] To enable voice: build with EAS (eas build) instead of Expo Go.');
      return false;
    }

    // Check if the device supports voice recognition
    const isAvailable = await Voice.isAvailable();

    if (!isAvailable) {
      console.warn('[Voice] Voice recognition not available on this device');
      return false;
    }

    console.log('[Voice] Voice recognition initialized successfully');

    // Initialize premium voice selection for TTS
    await initializePremiumVoice();

    return true;
  } catch (error) {
    console.error('Error initializing voice recognition:', error);
    return false;
  }
};

// Initialize and select the best available voice
export const initializePremiumVoice = async (): Promise<void> => {
  if (voicesInitialized) return;

  try {
    const voices = await Speech.getAvailableVoicesAsync();
    const preferredIds = Platform.OS === 'ios'
      ? PREFERRED_VOICES.ios
      : PREFERRED_VOICES.android;

    // Find the first preferred voice that's available
    for (const preferredId of preferredIds) {
      const found = voices.find(
        (v) =>
          v.identifier.includes(preferredId) ||
          v.identifier === preferredId ||
          (v.name && v.name.toLowerCase().includes(preferredId.toLowerCase()))
      );
      if (found) {
        selectedVoice = found;
        console.log('Selected premium voice:', found.name || found.identifier);
        break;
      }
    }

    // Fallback: find any high-quality English voice
    if (!selectedVoice) {
      const englishVoices = voices.filter(
        (v) => v.language.startsWith('en') && v.quality === 'Enhanced'
      );
      if (englishVoices.length > 0) {
        selectedVoice = englishVoices[0];
        console.log('Selected enhanced voice:', selectedVoice.name || selectedVoice.identifier);
      }
    }

    // Final fallback: any English voice
    if (!selectedVoice) {
      const anyEnglish = voices.find((v) => v.language.startsWith('en'));
      if (anyEnglish) {
        selectedVoice = anyEnglish;
        console.log('Selected fallback voice:', selectedVoice.name || selectedVoice.identifier);
      }
    }

    voicesInitialized = true;
  } catch (error) {
    console.error('Error initializing premium voice:', error);
    voicesInitialized = true;
  }
};

// Get the selected voice identifier
export const getSelectedVoice = (): Speech.Voice | null => {
  return selectedVoice;
};

// Set up voice event listeners
export const setupVoiceListeners = (callbacks: VoiceEventCallback): void => {
  currentCallbacks = callbacks;

  if (!isNativeVoiceAvailable) {
    console.warn('[Voice] Cannot setup listeners - native module not available');
    return;
  }

  Voice.onSpeechStart = (event: SpeechStartEvent) => {
    currentCallbacks.onSpeechStart?.();
  };

  Voice.onSpeechEnd = (event: SpeechEndEvent) => {
    currentCallbacks.onSpeechEnd?.();

    // If in wake word mode, restart listening after a short delay
    if (isWakeWordListening) {
      restartWakeWordListening();
    }
  };

  Voice.onSpeechResults = (event: SpeechResultsEvent) => {
    const results = event.value || [];

    // Check for wake word in results
    if (isWakeWordListening && results.length > 0) {
      const transcript = results[0].toLowerCase();
      const wakeWordMatch = checkForWakeWord(transcript);

      if (wakeWordMatch) {
        // Extract command after wake word
        const command = extractCommandAfterWakeWord(transcript);
        currentCallbacks.onWakeWordDetected?.(command);
        wakeWordCallback?.(command);
        return;
      }
    }

    currentCallbacks.onSpeechResults?.(results);
  };

  Voice.onSpeechPartialResults = (event: SpeechResultsEvent) => {
    const results = event.value || [];

    // Check for wake word in partial results for faster response
    if (isWakeWordListening && results.length > 0) {
      const transcript = results[0].toLowerCase();
      if (checkForWakeWord(transcript)) {
        // Wake word detected in partial results - wait for full results
        return;
      }
    }

    currentCallbacks.onSpeechPartialResults?.(results);
  };

  Voice.onSpeechError = (event: SpeechErrorEvent) => {
    const error = mapVoiceError(event);

    // If in wake word mode and got a timeout/no-match error, restart
    if (isWakeWordListening && (error.type === 'timeout' || error.type === 'recognition_error')) {
      restartWakeWordListening();
      return;
    }

    currentCallbacks.onSpeechError?.(error);
  };

  Voice.onSpeechRecognized = (event: SpeechRecognizedEvent) => {
    currentCallbacks.onSpeechRecognized?.();
  };
};

// Check if transcript contains wake word
const checkForWakeWord = (transcript: string): boolean => {
  return WAKE_WORD_PATTERNS.some((pattern) => pattern.test(transcript));
};

// Extract the command portion after the wake word
const extractCommandAfterWakeWord = (transcript: string): string => {
  // Remove wake word patterns and get the remaining command
  let command = transcript;

  for (const pattern of WAKE_WORD_PATTERNS) {
    command = command.replace(pattern, '').trim();
  }

  return command;
};

// Start wake word listening mode (continuous listening)
export const startWakeWordListening = async (
  onWakeWord: (command: string) => void
): Promise<boolean> => {
  if (!isNativeVoiceAvailable) {
    console.warn('[Voice] Cannot start wake word listening - native module not available');
    return false;
  }

  try {
    isWakeWordListening = true;
    wakeWordCallback = onWakeWord;

    await Voice.start('en-US');
    console.log('[Voice] Wake word listening started');
    return true;
  } catch (error) {
    console.error('[Voice] Error starting wake word listening:', error);
    isWakeWordListening = false;
    wakeWordCallback = null;
    return false;
  }
};

// Stop wake word listening mode
export const stopWakeWordListening = async (): Promise<void> => {
  isWakeWordListening = false;
  wakeWordCallback = null;

  if (wakeWordRestartTimeout) {
    clearTimeout(wakeWordRestartTimeout);
    wakeWordRestartTimeout = null;
  }

  if (!isNativeVoiceAvailable) return;

  try {
    await Voice.stop();
  } catch (error) {
    console.error('[Voice] Error stopping wake word listening:', error);
  }
};

// Restart wake word listening after a brief pause
const restartWakeWordListening = (): void => {
  if (!isWakeWordListening || !isNativeVoiceAvailable) return;

  // Clear any existing restart timeout
  if (wakeWordRestartTimeout) {
    clearTimeout(wakeWordRestartTimeout);
  }

  // Restart after a short delay to prevent rapid fire
  wakeWordRestartTimeout = setTimeout(async () => {
    if (isWakeWordListening && isNativeVoiceAvailable) {
      try {
        await Voice.start('en-US');
      } catch (error) {
        console.error('[Voice] Error restarting wake word listening:', error);
        // Try again after a longer delay
        wakeWordRestartTimeout = setTimeout(() => restartWakeWordListening(), 2000);
      }
    }
  }, 500);
};

// Check if wake word listening is active
export const isWakeWordListeningActive = (): boolean => {
  return isWakeWordListening;
};

// Remove voice event listeners
export const removeVoiceListeners = async (): Promise<void> => {
  try {
    await stopWakeWordListening();
    if (isNativeVoiceAvailable) {
      await Voice.destroy();
    }
    currentCallbacks = {};
  } catch (error) {
    console.error('[Voice] Error removing voice listeners:', error);
  }
};

// Start listening for voice input
export const startListening = async (
  config: Partial<VoiceConfig> = {}
): Promise<boolean> => {
  if (!isNativeVoiceAvailable) {
    console.warn('[Voice] Cannot start listening - native module not available');
    return false;
  }

  const mergedConfig = { ...DEFAULT_VOICE_CONFIG, ...config };

  try {
    await Voice.start(mergedConfig.language);
    return true;
  } catch (error) {
    console.error('[Voice] Error starting voice recognition:', error);
    return false;
  }
};

// Stop listening for voice input
export const stopListening = async (): Promise<void> => {
  if (!isNativeVoiceAvailable) return;

  try {
    await Voice.stop();
  } catch (error) {
    console.error('[Voice] Error stopping voice recognition:', error);
  }
};

// Cancel voice recognition
export const cancelListening = async (): Promise<void> => {
  if (!isNativeVoiceAvailable) return;

  try {
    await Voice.cancel();
  } catch (error) {
    console.error('[Voice] Error canceling voice recognition:', error);
  }
};

// Check if currently listening
export const isCurrentlyListening = async (): Promise<boolean> => {
  if (!isNativeVoiceAvailable) return false;

  try {
    return await Voice.isRecognizing();
  } catch (error) {
    return false;
  }
};

// Map voice errors to our error type
const mapVoiceError = (event: SpeechErrorEvent): VoiceError => {
  const errorCode = event.error?.code || '';
  const errorMessage = event.error?.message || 'Unknown error';

  let type: VoiceErrorType = 'unknown';

  // Map common error codes
  if (errorCode.includes('permission') || errorCode === '9') {
    type = 'permission_denied';
  } else if (errorCode.includes('network') || errorCode === '2') {
    type = 'network_error';
  } else if (errorCode.includes('not_available') || errorCode === '1') {
    type = 'not_available';
  } else if (errorCode === '6' || errorCode === '7') {
    type = 'timeout';
  } else if (errorCode === '5' || errorCode === '11') {
    type = 'recognition_error';
  }

  return {
    type,
    message: errorMessage,
    code: errorCode,
  };
};

// ==================== TEXT-TO-SPEECH ====================

// Speak text aloud with premium voice
export const speak = async (
  text: string,
  config: Partial<TTSConfig> = {}
): Promise<void> => {
  const mergedConfig = { ...DEFAULT_TTS_CONFIG, ...config };

  // Ensure premium voice is initialized
  if (!voicesInitialized) {
    await initializePremiumVoice();
  }

  return new Promise((resolve) => {
    const options: Speech.SpeechOptions = {
      language: mergedConfig.language,
      pitch: mergedConfig.pitch,
      rate: mergedConfig.rate,
      onDone: () => resolve(),
      onStopped: () => resolve(),
      onError: (error) => {
        console.error('TTS error:', error);
        resolve();
      },
    };

    // Use selected premium voice if available
    if (selectedVoice) {
      options.voice = selectedVoice.identifier;
    }

    Speech.speak(text, options);
  });
};

// Speak with a specific voice style
export type VoiceStyle = 'friendly' | 'professional' | 'excited' | 'calm';

export const speakWithStyle = async (
  text: string,
  style: VoiceStyle = 'friendly'
): Promise<void> => {
  const styleConfigs: Record<VoiceStyle, Partial<TTSConfig>> = {
    friendly: { pitch: 1.05, rate: 0.95 },
    professional: { pitch: 1.0, rate: 0.9 },
    excited: { pitch: 1.15, rate: 1.05 },
    calm: { pitch: 0.95, rate: 0.85 },
  };

  await speak(text, styleConfigs[style]);
};

// Speak a greeting (used when wake word is detected)
export const speakGreeting = async (): Promise<void> => {
  const greetings = [
    "I'm listening!",
    "Yes, chef?",
    "How can I help?",
    "Ready!",
    "What do you need?",
  ];
  const greeting = greetings[Math.floor(Math.random() * greetings.length)];
  await speakWithStyle(greeting, 'friendly');
};

// Speak a confirmation
export const speakConfirmation = async (action: string): Promise<void> => {
  const confirmations: Record<string, string[]> = {
    next: ["Moving on!", "Next step!", "Got it!"],
    back: ["Going back!", "Previous step!", "Sure!"],
    timer: ["Timer set!", "Starting timer!", "You got it!"],
    read: ["", "", ""], // No confirmation needed, will read the content
  };

  const phrases = confirmations[action] || ["Done!"];
  if (phrases[0]) {
    const phrase = phrases[Math.floor(Math.random() * phrases.length)];
    await speakWithStyle(phrase, 'friendly');
  }
};

// Stop speaking
export const stopSpeaking = async (): Promise<void> => {
  await Speech.stop();
};

// Check if currently speaking
export const isSpeaking = async (): Promise<boolean> => {
  return await Speech.isSpeakingAsync();
};

// Get available voices (useful for settings)
export const getAvailableVoices = async (): Promise<Speech.Voice[]> => {
  return await Speech.getAvailableVoicesAsync();
};

// Speak with interruption (stops any current speech first)
export const speakWithInterrupt = async (
  text: string,
  config: Partial<TTSConfig> = {}
): Promise<void> => {
  const speaking = await isSpeaking();
  if (speaking) {
    await stopSpeaking();
    // Small delay to ensure previous speech is fully stopped
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  await speak(text, config);
};

// Format time for TTS (e.g., "5 minutes and 30 seconds")
export const formatTimeForSpeech = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;

  if (mins === 0) {
    return `${secs} second${secs !== 1 ? 's' : ''}`;
  } else if (secs === 0) {
    return `${mins} minute${mins !== 1 ? 's' : ''}`;
  } else {
    return `${mins} minute${mins !== 1 ? 's' : ''} and ${secs} second${secs !== 1 ? 's' : ''}`;
  }
};

// Format step number for TTS
export const formatStepForSpeech = (stepNumber: number, totalSteps: number): string => {
  return `Step ${stepNumber} of ${totalSteps}`;
};

// Check permissions for voice features
export const checkVoicePermissions = async (): Promise<{
  microphone: boolean;
  speechRecognition: boolean;
}> => {
  if (!isNativeVoiceAvailable) {
    return { microphone: false, speechRecognition: false };
  }

  // On iOS, Voice.isAvailable() implicitly checks permissions
  // On Android, we may need to check separately
  const available = await Voice.isAvailable();

  return {
    microphone: available || false,
    speechRecognition: available || false,
  };
};

// Request voice permissions (platform specific)
export const requestVoicePermissions = async (): Promise<boolean> => {
  if (!isNativeVoiceAvailable) {
    console.warn('[Voice] Cannot request permissions - native module not available');
    return false;
  }

  try {
    // Starting voice recognition will prompt for permissions if not granted
    await Voice.start('en-US');
    await Voice.cancel();
    return true;
  } catch (error) {
    console.error('[Voice] Error requesting voice permissions:', error);
    return false;
  }
};

// Export Voice module for direct access if needed
export { Voice, Speech, isNativeVoiceAvailable };
