// Voice command types for hands-free cooking mode

// Supported voice commands
export type VoiceCommandType =
  | 'next_step'
  | 'previous_step'
  | 'read_step'
  | 'read_ingredients'
  | 'set_timer'
  | 'current_step'
  | 'substitute'
  | 'help'
  | 'unknown';

// Voice command examples for help display
export const VOICE_COMMAND_EXAMPLES: Record<VoiceCommandType, string[]> = {
  next_step: ['next', 'continue', 'next step', 'go next'],
  previous_step: ['back', 'previous', 'go back', 'last step'],
  read_step: ['read this', 'repeat', 'read step', 'what does it say'],
  read_ingredients: ['what ingredients', 'list ingredients', 'ingredients', 'what do I need'],
  set_timer: ['set timer 5 minutes', 'timer 10 min', 'start timer for 3 minutes'],
  current_step: ['where am I', 'what step', 'current step', 'which step'],
  substitute: ['substitute for eggs', 'replace butter', 'what can I use instead of'],
  help: ['help', 'what can I say', 'commands'],
  unknown: [],
};

// Parsed voice command result
export interface VoiceParseResult {
  command: VoiceCommandType;
  parameters: VoiceCommandParameters;
  confidence: number; // 0-100
  rawTranscript: string;
}

// Parameters extracted from voice commands
export interface VoiceCommandParameters {
  minutes?: number;
  ingredient?: string;
}

// Voice listening state
export type VoiceListeningState = 'idle' | 'listening' | 'processing' | 'speaking' | 'error';

// Voice state for store
export interface VoiceState {
  isListening: boolean;
  isSpeaking: boolean;
  isProcessing: boolean;
  transcript: string;
  lastCommand: VoiceParseResult | null;
  error: string | null;
  state: VoiceListeningState;
}

// Timer state
export interface CookingTimer {
  id: string;
  name: string;
  totalSeconds: number;
  remainingSeconds: number;
  isRunning: boolean;
  createdAt: Date;
  endTime: Date | null;
}

// Timer store state
export interface TimerState {
  timers: CookingTimer[];
  activeTimerCount: number;
}

// Voice control configuration
export interface VoiceConfig {
  language: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
}

// Default voice config
export const DEFAULT_VOICE_CONFIG: VoiceConfig = {
  language: 'en-US',
  continuous: false,
  interimResults: true,
  maxAlternatives: 1,
};

// TTS configuration
export interface TTSConfig {
  language: string;
  pitch: number;
  rate: number;
}

// Default TTS config
export const DEFAULT_TTS_CONFIG: TTSConfig = {
  language: 'en-US',
  pitch: 1.0,
  rate: 0.9, // Slightly slower for clarity
};

// Voice recognition result from native module
export interface SpeechRecognitionResult {
  value: string[];
  isFinal: boolean;
}

// Voice error types
export type VoiceErrorType =
  | 'permission_denied'
  | 'not_available'
  | 'network_error'
  | 'recognition_error'
  | 'timeout'
  | 'unknown';

export interface VoiceError {
  type: VoiceErrorType;
  message: string;
  code?: string;
}

// Voice feature access result
export interface VoiceAccessResult {
  allowed: boolean;
  reason?: 'feature_locked' | 'limit_reached' | 'not_subscribed';
  usageToday?: number;
  limit?: number | 'unlimited';
  upgradeRequired?: 'free' | 'premium' | 'pro';
}
