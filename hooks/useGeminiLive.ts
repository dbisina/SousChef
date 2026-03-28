/**
 * React hook for Gemini Live API integration.
 *
 * Provides a simple interface for real-time voice conversation with Gemini
 * during cooking mode or any screen that needs AI assistance.
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import {
  GeminiLiveSession,
  createCookingLiveSession,
  buildCookingSystemContext,
  LiveSessionCallbacks,
} from '@/lib/geminiLive';
import { Recipe } from '@/types';
import { useAuthStore } from '@/stores/authStore';
import { usePantryStore } from '@/stores/pantryStore';
import { useLanguageStore } from '@/stores/languageStore';
import { SUPPORTED_LANGUAGES } from '@/lib/i18n';

interface UseGeminiLiveOptions {
  recipe?: Recipe;
  currentStep?: number;
  onTimerRequested?: (minutes: number, label: string) => void;
  onNextStep?: () => void;
  onPreviousStep?: () => void;
  onAddToPantry?: (items: { name: string; amount: number; unit: string; category: string }[]) => void;
  onAddToCart?: (items: { name: string; amount: number; unit: string }[]) => void;
  onServingsChanged?: (servings: number) => void;
}

interface UseGeminiLiveReturn {
  // State
  isConnected: boolean;
  isListening: boolean;
  isSpeaking: boolean;
  isConnecting: boolean;
  lastTranscript: string;
  lastResponse: string;
  error: string | null;

  // Actions
  connect: () => Promise<void>;
  disconnect: () => void;
  startListening: () => Promise<void>;
  stopListening: () => Promise<void>;
  sendMessage: (text: string) => void;
  sendCameraFrame: (base64: string) => void;
  updateContext: (step: number) => void;
}

export function useGeminiLive(options: UseGeminiLiveOptions = {}): UseGeminiLiveReturn {
  const { user } = useAuthStore();
  const { items: pantryItems } = usePantryStore();
  const { language } = useLanguageStore();

  const [isConnected, setIsConnected] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [lastTranscript, setLastTranscript] = useState('');
  const [lastResponse, setLastResponse] = useState('');
  const [error, setError] = useState<string | null>(null);

  const sessionRef = useRef<GeminiLiveSession | null>(null);
  const currentStepRef = useRef(options.currentStep || 0);

  // Update step ref when it changes
  useEffect(() => {
    currentStepRef.current = options.currentStep || 0;
  }, [options.currentStep]);

  const callbacks: LiveSessionCallbacks = {
    onAudioResponse: (audioBase64) => {
      setIsSpeaking(true);
      sessionRef.current?.playAudioResponse(audioBase64).then(() => {
        setIsSpeaking(false);
      });
    },

    onTextResponse: (text) => {
      setLastResponse((prev) => prev + text);
    },

    onTranscript: (transcript, isFinal) => {
      setLastTranscript(transcript);
    },

    onToolCall: async (name, args) => {
      switch (name) {
        case 'set_timer':
          options.onTimerRequested?.(args.minutes, args.label || 'Timer');
          return { success: true, message: `Timer set for ${args.minutes} minutes` };

        case 'next_step':
          options.onNextStep?.();
          return { success: true, message: 'Moved to next step' };

        case 'previous_step':
          options.onPreviousStep?.();
          return { success: true, message: 'Moved to previous step' };

        case 'add_to_pantry':
          options.onAddToPantry?.(args.items);
          return { success: true, message: `Added ${args.items.length} items to pantry` };

        case 'add_to_shopping_list':
          options.onAddToCart?.(args.items);
          return { success: true, message: `Added ${args.items.length} items to shopping list` };

        case 'adjust_servings':
          options.onServingsChanged?.(args.servings);
          return { success: true, message: `Adjusted to ${args.servings} servings` };

        default:
          return { success: false, message: `Unknown tool: ${name}` };
      }
    },

    onError: (err) => {
      console.error('[GeminiLive] Error:', err);
      setError(err.message);
    },

    onConnected: () => {
      setIsConnected(true);
      setIsConnecting(false);
      setError(null);
    },

    onDisconnected: () => {
      setIsConnected(false);
      setIsListening(false);
      setIsSpeaking(false);
    },

    onInterrupted: () => {
      setIsSpeaking(false);
    },
  };

  const connect = useCallback(async () => {
    if (sessionRef.current?.isConnected()) return;

    setIsConnecting(true);
    setError(null);

    try {
      let systemContext: string;

      if (options.recipe) {
        const langConfig = SUPPORTED_LANGUAGES.find((l) => l.code === language);
        systemContext = buildCookingSystemContext({
          recipeName: options.recipe.title,
          ingredients: options.recipe.ingredients.map(
            (i) => `${i.amount} ${i.unit} ${i.name}`
          ),
          instructions: options.recipe.instructions,
          currentStep: currentStepRef.current,
          userAllergies: user?.allergies,
          userConditions: user?.healthConditions,
          pantryItems: pantryItems.map((p) => p.name),
          language,
          languageName: langConfig?.nativeName,
        });
      } else {
        // General assistant mode
        systemContext = `You are SousChef, a friendly cooking AI assistant. Help the user with cooking questions, pantry management, and meal planning.
${user?.allergies?.length ? `User allergies: ${user.allergies.join(', ')}` : ''}
${user?.healthConditions?.length ? `Health conditions: ${user.healthConditions.join(', ')}` : ''}
${user?.dietaryPreferences?.length ? `Dietary preferences: ${user.dietaryPreferences.join(', ')}` : ''}
Be warm, concise (2-3 sentences), and encouraging.`;
      }

      const session = createCookingLiveSession(systemContext, callbacks);
      await session.connect();
      sessionRef.current = session;
    } catch (err) {
      setIsConnecting(false);
      setError(err instanceof Error ? err.message : 'Connection failed');
    }
  }, [options.recipe, user, pantryItems]);

  const disconnect = useCallback(() => {
    sessionRef.current?.disconnect();
    sessionRef.current = null;
    setIsConnected(false);
    setIsListening(false);
    setIsSpeaking(false);
  }, []);

  const startListening = useCallback(async () => {
    if (!sessionRef.current?.isConnected()) {
      await connect();
    }
    await sessionRef.current?.startRecording();
    setIsListening(true);
    setLastResponse('');
  }, [connect]);

  const stopListening = useCallback(async () => {
    await sessionRef.current?.stopRecording();
    setIsListening(false);
  }, []);

  const sendMessage = useCallback((text: string) => {
    if (!sessionRef.current?.isConnected()) return;
    setLastResponse('');
    sessionRef.current.sendText(text);
  }, []);

  const sendCameraFrame = useCallback((base64: string) => {
    sessionRef.current?.sendCameraFrame(base64);
  }, []);

  const updateContext = useCallback((step: number) => {
    currentStepRef.current = step;
    // Send context update to the session
    if (sessionRef.current?.isConnected() && options.recipe) {
      const instruction = options.recipe.instructions[step];
      sessionRef.current.sendText(
        `[SYSTEM: User moved to step ${step + 1}: "${instruction}". Acknowledge briefly.]`
      );
    }
  }, [options.recipe]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      sessionRef.current?.disconnect();
    };
  }, []);

  return {
    isConnected,
    isListening,
    isSpeaking,
    isConnecting,
    lastTranscript,
    lastResponse,
    error,
    connect,
    disconnect,
    startListening,
    stopListening,
    sendMessage,
    sendCameraFrame,
    updateContext,
  };
}
