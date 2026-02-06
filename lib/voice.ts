import * as Speech from 'expo-speech';
import { Platform, Alert } from 'react-native';
// Mock Voice for Expo Go (Development Client required for real functionality)
const Voice = {
  isAvailable: async () => false,
  start: async (...args: any[]) => { },
  stop: async () => { },
  cancel: async () => { },
  destroy: async (...args: any[]) => { },
  isRecognizing: async () => false,
  onSpeechStart: (e: any) => { },
  onSpeechEnd: (e: any) => { },
  onSpeechResults: (e: any) => { },
  onSpeechPartialResults: (e: any) => { },
  onSpeechError: (e: any) => { },
  onSpeechRecognized: (e: any) => { },
};

// Types for Voice events (mocked)
type SpeechStartEvent = any;
type SpeechEndEvent = any;
type SpeechResultsEvent = { value?: string[] };
type SpeechErrorEvent = { error?: { code?: string; message?: string } };
type SpeechRecognizedEvent = any;

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
    // Check if we are in a compatible environment
    // In Expo Go, Voice.isAvailable will be false with our mock
    const isAvailable = await Voice.isAvailable();

    if (!isAvailable) {
      console.warn('Voice recognition not available on this device (requires Development Build)');
      return false;
    }

    // Initialize premium voice selection
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
  try {
    isWakeWordListening = true;
    wakeWordCallback = onWakeWord;

    const started = await Voice.start('en-US');
    return true;
  } catch (error) {
    console.error('Error starting wake word listening:', error);
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

  try {
    await Voice.stop();
  } catch (error) {
    console.error('Error stopping wake word listening:', error);
  }
};

// Restart wake word listening after a brief pause
const restartWakeWordListening = (): void => {
  if (!isWakeWordListening) return;

  // Clear any existing restart timeout
  if (wakeWordRestartTimeout) {
    clearTimeout(wakeWordRestartTimeout);
  }

  // Restart after a short delay to prevent rapid fire
  wakeWordRestartTimeout = setTimeout(async () => {
    if (isWakeWordListening) {
      try {
        await Voice.start('en-US');
      } catch (error) {
        console.error('Error restarting wake word listening:', error);
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
    await Voice.destroy();
    currentCallbacks = {};
  } catch (error) {
    console.error('Error removing voice listeners:', error);
  }
};

// Start listening for voice input
export const startListening = async (
  config: Partial<VoiceConfig> = {}
): Promise<boolean> => {
  const mergedConfig = { ...DEFAULT_VOICE_CONFIG, ...config };

  try {
    await Voice.start(mergedConfig.language);
    return true;
  } catch (error) {
    console.error('Error starting voice recognition:', error);
    return false;
  }
};

// Stop listening for voice input
export const stopListening = async (): Promise<void> => {
  try {
    await Voice.stop();
  } catch (error) {
    console.error('Error stopping voice recognition:', error);
  }
};

// Cancel voice recognition
export const cancelListening = async (): Promise<void> => {
  try {
    await Voice.cancel();
  } catch (error) {
    console.error('Error canceling voice recognition:', error);
  }
};

// Check if currently listening
export const isListening = async (): Promise<boolean> => {
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
  try {
    // Starting voice recognition will prompt for permissions if not granted
    await Voice.start('en-US');
    await Voice.cancel();
    return true;
  } catch (error) {
    console.error('Error requesting voice permissions:', error);
    return false;
  }
};

// Export Voice module for direct access if needed
export { Voice, Speech };
