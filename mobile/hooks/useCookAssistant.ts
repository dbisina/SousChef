/**
 * The cooking voice assistant when the app is connected to the SousChef server. It replaces Gemini Live (which needed a key on the
 * phone): the phone listens (on-device speech recognition) and speaks (the system voice); commands such as "next" or "set a timer
 * for ten minutes" are handled on the phone, and questions go to the server (`/v1/ai/cook-chat`, which reads the recipe).
 * It has the same shape as `useGeminiLive`, so the cooking screen uses either.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { parseCookCommand } from '@/lib/cookCommands';
import { initializeVoiceRecognition, setupVoiceListeners, speak, startListening as startMic, stopListening as stopMic, stopSpeaking } from '@/lib/voice';
import { apiCookChat } from '@/services/aiToolsApi';
import type { Recipe } from '@/types';

interface Options {
  recipe?: Recipe;
  currentStep?: number;
  onTimerRequested?: (minutes: number, label: string) => void;
  onNextStep?: () => void;
  onPreviousStep?: () => void;
  onServingsChanged?: (servings: number) => void;
}

export interface CookAssistant {
  isConnected: boolean;
  isListening: boolean;
  isSpeaking: boolean;
  isConnecting: boolean;
  lastTranscript: string;
  lastResponse: string;
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  startListening: () => Promise<void>;
  stopListening: () => Promise<void>;
  sendMessage: (text: string) => void;
  sendCameraFrame: (base64: string) => void;
  updateContext: (step: number) => void;
}

const MAX_HISTORY = 6;

export function useCookAssistant(options: Options = {}): CookAssistant {
  const [isConnected, setConnected] = useState(false);
  const [isListening, setListening] = useState(false);
  const [isSpeaking, setSpeaking] = useState(false);
  const [lastTranscript, setTranscript] = useState('');
  const [lastResponse, setResponse] = useState('');
  const [error, setError] = useState<string | null>(null);

  // The handlers read the latest options and step without being re-created (the microphone listener is set up once).
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const stepRef = useRef(options.currentStep ?? 0);
  const history = useRef<{ role: 'user' | 'assistant'; text: string }[]>([]);

  useEffect(() => {
    stepRef.current = options.currentStep ?? 0;
  }, [options.currentStep]);

  const say = useCallback(async (text: string) => {
    setResponse(text);
    setSpeaking(true);
    try {
      await speak(text);
    } finally {
      setSpeaking(false);
    }
  }, []);

  const stepText = (n: number): string | null => {
    const steps = optionsRef.current.recipe?.instructions ?? [];
    const s = steps[n];
    return typeof s === 'string' ? `Step ${n + 1}. ${s}` : null;
  };

  const handle = useCallback(
    async (spoken: string) => {
      const command = parseCookCommand(spoken);
      if (!command) return;
      setTranscript(spoken);
      setError(null);
      const o = optionsRef.current;
      const total = o.recipe?.instructions.length ?? 0;
      switch (command.type) {
        case 'next': {
          if (stepRef.current + 1 >= total) return say('That was the last step. Enjoy your meal.');
          stepRef.current += 1;
          o.onNextStep?.();
          return say(stepText(stepRef.current) ?? 'Next step.');
        }
        case 'previous': {
          if (stepRef.current <= 0) return say('You are on the first step.');
          stepRef.current -= 1;
          o.onPreviousStep?.();
          return say(stepText(stepRef.current) ?? 'Previous step.');
        }
        case 'repeat':
          return say(stepText(stepRef.current) ?? 'There is nothing to repeat yet.');
        case 'timer': {
          o.onTimerRequested?.(command.minutes, command.label);
          const m = command.minutes;
          return say(m < 1 ? `Timer set for ${Math.round(m * 60)} seconds.` : `Timer set for ${m} minute${m === 1 ? '' : 's'}.`);
        }
        case 'servings':
          o.onServingsChanged?.(command.servings);
          return say(`Changed to ${command.servings} servings.`);
        case 'stop':
          await stopSpeaking();
          setSpeaking(false);
          return;
        case 'ask': {
          const id = o.recipe?.id;
          if (!id) return say('Open a recipe first and I can help with it.');
          setResponse('…');
          try {
            const res = await apiCookChat({ recipeId: id, stepIndex: stepRef.current, question: command.question, history: history.current });
            history.current = [...history.current, { role: 'user' as const, text: command.question }, { role: 'assistant' as const, text: res.answer }].slice(-MAX_HISTORY);
            return say(res.answer);
          } catch {
            setError('The kitchen assistant could not be reached.');
            return say('Sorry, I could not reach the kitchen assistant. Try again in a moment.');
          }
        }
      }
    },
    [say],
  );

  const connect = useCallback(async () => {
    setError(null);
    const ok = await initializeVoiceRecognition();
    if (!ok) setError('Voice recognition is not available on this device, but you can still type questions.');
    setupVoiceListeners({
      onSpeechResults: (results) => {
        setListening(false);
        if (results[0]) void handle(results[0]);
      },
      onSpeechEnd: () => setListening(false),
      onSpeechError: (e) => {
        setListening(false);
        if (e.type === 'permission_denied') setError('Allow the microphone to talk to the assistant.');
      },
    });
    setConnected(true);
  }, [handle]);

  const disconnect = useCallback(() => {
    void stopMic();
    void stopSpeaking();
    setListening(false);
    setSpeaking(false);
    setConnected(false);
  }, []);

  const startListening = useCallback(async () => {
    await stopSpeaking();
    setSpeaking(false);
    const ok = await startMic();
    setListening(ok);
    if (!ok) setError('Could not start the microphone.');
  }, []);

  const stopListening = useCallback(async () => {
    await stopMic();
    setListening(false);
  }, []);

  return {
    isConnected,
    isListening,
    isSpeaking,
    isConnecting: false,
    lastTranscript,
    lastResponse,
    error,
    connect,
    disconnect,
    startListening,
    stopListening,
    sendMessage: (text) => void handle(text),
    sendCameraFrame: () => undefined,
    updateContext: (step) => {
      stepRef.current = step;
    },
  };
}
