import { useEffect, useCallback, useRef, useState } from 'react';
import { AppState, AppStateStatus, Vibration } from 'react-native';
import { useVoiceStore } from '@/stores/voiceStore';
import { useSubscriptionStore } from '@/stores/subscriptionStore';
import {
  initializeVoiceRecognition,
  setupVoiceListeners,
  removeVoiceListeners,
  startListening,
  stopListening,
  speak,
  stopSpeaking,
  speakWithInterrupt,
  formatTimeForSpeech,
  startWakeWordListening,
  stopWakeWordListening,
  isWakeWordListeningActive,
  speakGreeting,
  speakConfirmation,
  speakWithStyle,
} from '@/lib/voice';
import {
  parseVoiceCommand,
  formatIngredientsForSpeech,
  formatInstructionForSpeech,
  formatCurrentStepSpeech,
  formatTimerSetSpeech,
  formatTimerDoneSpeech,
  getVoiceHelpSpeech,
  isValidCommand,
} from '@/services/voiceService';
import { VoiceParseResult, CookingTimer, VoiceAccessResult } from '@/types/voice';
import { Ingredient } from '@/types';
import { TIER_FEATURES } from '@/types/subscription';
import {
  canUseVoice,
  recordVoiceUsage,
  getRemainingVoiceUses,
} from '@/services/subscriptionService';

// Voice control hook for cooking mode
export const useVoiceControl = () => {
  const {
    isListening,
    isSpeaking,
    isProcessing,
    transcript,
    lastCommand,
    error,
    state,
    isWakeWordMode,
    isWakeWordListening,
    setListening,
    setSpeaking,
    setProcessing,
    setTranscript,
    setLastCommand,
    setError,
    setWakeWordMode,
    setWakeWordListening,
    reset,
  } = useVoiceStore();

  const { subscriptionTier } = useSubscriptionStore();
  const [isInitialized, setIsInitialized] = useState(false);
  const [accessDenied, setAccessDenied] = useState<VoiceAccessResult | null>(null);
  const appStateRef = useRef(AppState.currentState);
  const wakeWordCallbackRef = useRef<((command: string) => void) | null>(null);

  // Initialize voice recognition
  useEffect(() => {
    const init = async () => {
      const available = await initializeVoiceRecognition();
      setIsInitialized(available);

      if (available) {
        setupVoiceListeners({
          onSpeechStart: () => {
            setListening(true);
            setTranscript('');
          },
          onSpeechEnd: () => {
            setListening(false);
          },
          onSpeechResults: async (results) => {
            const text = results[0] || '';
            setTranscript(text);

            if (text) {
              setProcessing(true);
              const command = await parseVoiceCommand(text);
              setLastCommand(command);
            }
          },
          onSpeechPartialResults: (results) => {
            const text = results[0] || '';
            setTranscript(text);
          },
          onSpeechError: (voiceError) => {
            setError(voiceError.message);
            setListening(false);
          },
          onWakeWordDetected: async (commandText) => {
            // Wake word detected! Provide audio feedback
            setWakeWordListening(false);
            Vibration.vibrate(100);

            // Speak greeting
            await speakGreeting();

            // If there's a command after the wake word, process it
            if (commandText && commandText.trim()) {
              setProcessing(true);
              const command = await parseVoiceCommand(commandText);
              setLastCommand(command);
            } else {
              // No command after wake word, switch to active listening mode
              // The user will speak their command next
              await startListening();
            }

            // Call the registered callback if any
            wakeWordCallbackRef.current?.(commandText);
          },
        });
      }
    };

    init();

    // Handle app state changes (stop listening when backgrounded)
    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      removeVoiceListeners();
      subscription.remove();
    };
  }, []);

  // Handle app state changes
  const handleAppStateChange = async (nextAppState: AppStateStatus) => {
    if (
      appStateRef.current === 'active' &&
      nextAppState.match(/inactive|background/)
    ) {
      // App going to background, stop all listening
      stopListening();
      stopSpeaking();
      // Also stop wake word listening if active
      if (isWakeWordListeningActive()) {
        await stopWakeWordListening();
        setWakeWordListening(false);
      }
    } else if (
      appStateRef.current.match(/inactive|background/) &&
      nextAppState === 'active'
    ) {
      // App coming back to foreground
      // If wake word mode was enabled, restart it
      const { isWakeWordMode: wakeMode } = useVoiceStore.getState();
      if (wakeMode) {
        const started = await startWakeWordListening(() => {});
        setWakeWordListening(started);
      }
    }
    appStateRef.current = nextAppState;
  };

  // Check voice access
  const checkVoiceAccess = useCallback(async (): Promise<VoiceAccessResult> => {
    const result = await canUseVoice(subscriptionTier);

    if (!result.allowed) {
      setAccessDenied({
        allowed: false,
        reason: result.reason,
        usageToday: result.currentUsage,
        limit: result.limit,
        upgradeRequired: result.upgradeRequired,
      });
    } else {
      setAccessDenied(null);
    }

    return {
      allowed: result.allowed,
      reason: result.reason,
      usageToday: result.currentUsage,
      limit: result.limit,
      upgradeRequired: result.upgradeRequired,
    };
  }, [subscriptionTier]);

  // Start listening for voice commands
  const startVoiceListening = useCallback(async (): Promise<boolean> => {
    if (!isInitialized) {
      setError('Voice recognition not available');
      return false;
    }

    // Check subscription access
    const access = await checkVoiceAccess();
    if (!access.allowed) {
      return false;
    }

    // Haptic feedback
    Vibration.vibrate(50);

    const started = await startListening();
    if (!started) {
      setError('Failed to start voice recognition');
      return false;
    }

    return true;
  }, [isInitialized, checkVoiceAccess]);

  // Stop listening
  const stopVoiceListening = useCallback(async () => {
    await stopListening();
    setListening(false);
  }, []);

  // Toggle listening
  const toggleListening = useCallback(async (): Promise<boolean> => {
    if (isListening) {
      await stopVoiceListening();
      return false;
    } else {
      return await startVoiceListening();
    }
  }, [isListening, startVoiceListening, stopVoiceListening]);

  // Speak text (for TTS output)
  const speakText = useCallback(
    async (text: string, interrupt: boolean = true) => {
      setSpeaking(true);
      if (interrupt) {
        await speakWithInterrupt(text);
      } else {
        await speak(text);
      }
      setSpeaking(false);
    },
    []
  );

  // Record usage after successful command
  const recordUsage = useCallback(async () => {
    await recordVoiceUsage();
  }, []);

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Enable wake word mode (hands-free listening for "SousChef")
  const enableWakeWordMode = useCallback(
    async (onWakeWord?: (command: string) => void): Promise<boolean> => {
      if (!isInitialized) {
        setError('Voice recognition not available');
        return false;
      }

      // Check subscription access
      const access = await checkVoiceAccess();
      if (!access.allowed) {
        return false;
      }

      // Store the callback
      wakeWordCallbackRef.current = onWakeWord || null;

      // Enable wake word mode in store
      setWakeWordMode(true);

      // Start continuous listening for wake word
      const started = await startWakeWordListening(async (command) => {
        // This is handled by the onWakeWordDetected callback in setupVoiceListeners
      });

      if (started) {
        setWakeWordListening(true);
        // Notify user that hands-free mode is active
        await speakWithStyle("Hands-free mode activated. Say 'SousChef' followed by your command.", 'friendly');
      } else {
        setWakeWordMode(false);
        setError('Failed to start wake word listening');
      }

      return started;
    },
    [isInitialized, checkVoiceAccess]
  );

  // Disable wake word mode
  const disableWakeWordMode = useCallback(async () => {
    wakeWordCallbackRef.current = null;
    setWakeWordMode(false);
    setWakeWordListening(false);
    await stopWakeWordListening();
  }, []);

  // Toggle wake word mode
  const toggleWakeWordMode = useCallback(
    async (onWakeWord?: (command: string) => void): Promise<boolean> => {
      if (isWakeWordMode) {
        await disableWakeWordMode();
        return false;
      } else {
        return await enableWakeWordMode(onWakeWord);
      }
    },
    [isWakeWordMode, enableWakeWordMode, disableWakeWordMode]
  );

  return {
    // State
    isInitialized,
    isListening,
    isSpeaking,
    isProcessing,
    transcript,
    lastCommand,
    error,
    state,
    accessDenied,
    isWakeWordMode,
    isWakeWordListening,

    // Actions
    startListening: startVoiceListening,
    stopListening: stopVoiceListening,
    toggleListening,
    speakText,
    checkVoiceAccess,
    recordUsage,
    clearError,
    reset,

    // Wake word actions
    enableWakeWordMode,
    disableWakeWordMode,
    toggleWakeWordMode,
  };
};

// Cooking timers hook
export const useCookingTimers = () => {
  const {
    timers,
    activeTimerCount,
    addTimer,
    removeTimer,
    pauseTimer,
    resumeTimer,
    updateTimerRemaining,
    clearAllTimers,
    getTimer,
  } = useVoiceStore();

  const intervalRefs = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map());
  const { speakText } = useVoiceControl();

  // Start interval for a timer
  const startTimerInterval = useCallback(
    (timerId: string) => {
      // Clear existing interval if any
      const existingInterval = intervalRefs.current.get(timerId);
      if (existingInterval) {
        clearInterval(existingInterval);
      }

      const interval = setInterval(() => {
        const timer = getTimer(timerId);
        if (!timer || !timer.isRunning) {
          clearInterval(interval);
          intervalRefs.current.delete(timerId);
          return;
        }

        const newRemaining = timer.remainingSeconds - 1;
        updateTimerRemaining(timerId, newRemaining);

        // Timer completed
        if (newRemaining <= 0) {
          clearInterval(interval);
          intervalRefs.current.delete(timerId);

          // Announce completion
          speakText(formatTimerDoneSpeech(timer.name));

          // Vibrate
          Vibration.vibrate([0, 500, 200, 500, 200, 500]);
        }
      }, 1000);

      intervalRefs.current.set(timerId, interval);
    },
    [getTimer, updateTimerRemaining, speakText]
  );

  // Create a new timer
  const createTimer = useCallback(
    (name: string, minutes: number): string => {
      const timerId = addTimer(name, minutes);
      startTimerInterval(timerId);
      return timerId;
    },
    [addTimer, startTimerInterval]
  );

  // Pause a timer
  const pause = useCallback(
    (timerId: string) => {
      const interval = intervalRefs.current.get(timerId);
      if (interval) {
        clearInterval(interval);
        intervalRefs.current.delete(timerId);
      }
      pauseTimer(timerId);
    },
    [pauseTimer]
  );

  // Resume a timer
  const resume = useCallback(
    (timerId: string) => {
      resumeTimer(timerId);
      startTimerInterval(timerId);
    },
    [resumeTimer, startTimerInterval]
  );

  // Remove a timer
  const remove = useCallback(
    (timerId: string) => {
      const interval = intervalRefs.current.get(timerId);
      if (interval) {
        clearInterval(interval);
        intervalRefs.current.delete(timerId);
      }
      removeTimer(timerId);
    },
    [removeTimer]
  );

  // Clear all timers
  const clearAll = useCallback(() => {
    intervalRefs.current.forEach((interval) => clearInterval(interval));
    intervalRefs.current.clear();
    clearAllTimers();
  }, [clearAllTimers]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      intervalRefs.current.forEach((interval) => clearInterval(interval));
      intervalRefs.current.clear();
    };
  }, []);

  // Resume running timers on mount
  useEffect(() => {
    timers.forEach((timer) => {
      if (timer.isRunning && !intervalRefs.current.has(timer.id)) {
        startTimerInterval(timer.id);
      }
    });
  }, []);

  // Format remaining time for display
  const formatTime = useCallback((seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, []);

  return {
    timers,
    activeTimerCount,
    createTimer,
    pauseTimer: pause,
    resumeTimer: resume,
    removeTimer: remove,
    clearAllTimers: clearAll,
    formatTime,
  };
};

// Voice command handler for cooking mode
export const useVoiceCommandHandler = (
  currentStep: number,
  totalSteps: number,
  ingredients: Ingredient[],
  onNextStep: () => void,
  onPrevStep: () => void,
  onSubstitute?: (ingredient: string) => void
) => {
  const { lastCommand, speakText, recordUsage, isWakeWordMode } = useVoiceControl();
  const { createTimer } = useCookingTimers();
  const [handledCommandId, setHandledCommandId] = useState<string | null>(null);

  // Handle voice commands
  useEffect(() => {
    if (!lastCommand || !isValidCommand(lastCommand)) return;

    // Avoid handling same command twice
    const commandId = `${lastCommand.command}_${lastCommand.rawTranscript}_${Date.now()}`;
    if (handledCommandId === commandId) return;

    const handleCommand = async () => {
      setHandledCommandId(commandId);

      // Record usage for valid commands
      await recordUsage();

      switch (lastCommand.command) {
        case 'next_step':
          // Provide quick audio confirmation in wake word mode
          if (isWakeWordMode) {
            await speakConfirmation('next');
          }
          onNextStep();
          break;

        case 'previous_step':
          if (isWakeWordMode) {
            await speakConfirmation('back');
          }
          onPrevStep();
          break;

        case 'read_step':
          // This should be handled by the cooking screen with the actual instruction text
          // The cooking screen will call speakText with the instruction
          break;

        case 'read_ingredients':
          const ingredientText = formatIngredientsForSpeech(ingredients);
          speakText(ingredientText);
          break;

        case 'current_step':
          const stepText = formatCurrentStepSpeech(currentStep + 1, totalSteps);
          speakText(stepText);
          break;

        case 'set_timer':
          if (lastCommand.parameters.minutes) {
            const timerName = `Step ${currentStep + 1}`;
            createTimer(timerName, lastCommand.parameters.minutes);
            // speakConfirmation already provides feedback for timers
            if (isWakeWordMode) {
              await speakConfirmation('timer');
            } else {
              speakText(formatTimerSetSpeech(lastCommand.parameters.minutes, timerName));
            }
          }
          break;

        case 'substitute':
          if (lastCommand.parameters.ingredient && onSubstitute) {
            onSubstitute(lastCommand.parameters.ingredient);
          }
          break;

        case 'help':
          speakText(getVoiceHelpSpeech());
          break;

        case 'unknown':
          speakText("I didn't understand that. Say 'help' for available commands.");
          break;
      }
    };

    handleCommand();
  }, [lastCommand]);

  return { lastCommand };
};

// Hook for remaining voice uses
export const useRemainingVoiceUses = () => {
  const { subscriptionTier } = useSubscriptionStore();
  const [remaining, setRemaining] = useState<number | 'unlimited'>(0);

  useEffect(() => {
    const fetchRemaining = async () => {
      const result = await getRemainingVoiceUses(subscriptionTier);
      setRemaining(result);
    };

    fetchRemaining();
  }, [subscriptionTier]);

  return remaining;
};
