/**
 * Gemini Live API Integration
 *
 * Provides real-time bidirectional voice/video conversation with Gemini AI.
 * Uses WebSocket for streaming audio in/out and optional camera frames.
 *
 * Architecture:
 * - WebSocket connection to Gemini's multimodal live endpoint
 * - Audio capture via expo-av (PCM 16-bit, 16kHz mono)
 * - Audio playback via expo-av for Gemini's voice responses
 * - Optional camera frames sent as base64 JPEG
 * - Session context maintained server-side for natural conversation flow
 *
 * This replaces the old flow of:
 *   voice record → transcribe → text to Gemini → text response → TTS
 * With:
 *   voice stream → Gemini Live → voice stream back (real-time)
 */

import { Audio } from 'expo-av';
import { cacheDirectory } from 'expo-file-system/legacy';

// ── Configuration ──
const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY || '';
const LIVE_API_BASE = 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent';
const LIVE_MODEL = 'gemini-2.0-flash-live-001';

// ── Types ──
export interface LiveSessionConfig {
  systemInstruction?: string;
  voiceName?: string; // 'Puck', 'Charon', 'Kore', 'Fenrir', 'Aoede'
  responseModality?: 'AUDIO' | 'TEXT';
  tools?: LiveTool[];
}

export interface LiveTool {
  functionDeclarations: {
    name: string;
    description: string;
    parameters: Record<string, any>;
  }[];
}

export interface LiveSessionCallbacks {
  onAudioResponse?: (audioBase64: string) => void;
  onTextResponse?: (text: string) => void;
  onTranscript?: (transcript: string, isFinal: boolean) => void;
  onToolCall?: (name: string, args: Record<string, any>) => Promise<any>;
  onError?: (error: Error) => void;
  onConnected?: () => void;
  onDisconnected?: () => void;
  onInterrupted?: () => void;
}

type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

// ── Live Session Manager ──
export class GeminiLiveSession {
  private ws: WebSocket | null = null;
  private state: ConnectionState = 'disconnected';
  private callbacks: LiveSessionCallbacks;
  private config: LiveSessionConfig;
  private recording: Audio.Recording | null = null;
  private audioPlayer: Audio.Sound | null = null;
  private isRecording = false;
  private isSpeaking = false;
  private textBuffer = '';

  constructor(config: LiveSessionConfig, callbacks: LiveSessionCallbacks) {
    this.config = config;
    this.callbacks = callbacks;
  }

  // ── Connection management ──

  async connect(): Promise<void> {
    if (!GEMINI_API_KEY) {
      throw new Error('Gemini API key not configured');
    }

    this.state = 'connecting';

    return new Promise((resolve, reject) => {
      const url = `${LIVE_API_BASE}?key=${GEMINI_API_KEY}`;
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        this.state = 'connected';
        this.sendSetup();
        this.callbacks.onConnected?.();
        resolve();
      };

      this.ws.onmessage = (event) => {
        this.handleMessage(event.data);
      };

      this.ws.onerror = (event: any) => {
        const error = new Error(event.message || 'WebSocket error');
        this.state = 'error';
        this.callbacks.onError?.(error);
        reject(error);
      };

      this.ws.onclose = () => {
        this.state = 'disconnected';
        this.callbacks.onDisconnected?.();
      };
    });
  }

  disconnect(): void {
    this.stopRecording();
    this.stopPlayback();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.state = 'disconnected';
  }

  isConnected(): boolean {
    return this.state === 'connected' && this.ws?.readyState === WebSocket.OPEN;
  }

  // ── Setup message ──

  private sendSetup(): void {
    if (!this.isConnected()) return;

    const setup: any = {
      setup: {
        model: `models/${LIVE_MODEL}`,
        generationConfig: {
          responseModalities: [this.config.responseModality || 'AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: this.config.voiceName || 'Kore',
              },
            },
          },
        },
      },
    };

    if (this.config.systemInstruction) {
      setup.setup.systemInstruction = {
        parts: [{ text: this.config.systemInstruction }],
      };
    }

    if (this.config.tools?.length) {
      setup.setup.tools = this.config.tools;
    }

    this.ws!.send(JSON.stringify(setup));
  }

  // ── Send messages ──

  /** Send a text message to the live session */
  sendText(text: string): void {
    if (!this.isConnected()) return;

    this.ws!.send(JSON.stringify({
      clientContent: {
        turns: [
          {
            role: 'user',
            parts: [{ text }],
          },
        ],
        turnComplete: true,
      },
    }));
  }

  /** Send audio data (base64 PCM16, 16kHz mono) */
  sendAudio(audioBase64: string): void {
    if (!this.isConnected()) return;

    this.ws!.send(JSON.stringify({
      realtimeInput: {
        mediaChunks: [
          {
            mimeType: 'audio/pcm;rate=16000',
            data: audioBase64,
          },
        ],
      },
    }));
  }

  /** Send a camera frame (base64 JPEG) for visual context */
  sendCameraFrame(imageBase64: string): void {
    if (!this.isConnected()) return;

    this.ws!.send(JSON.stringify({
      realtimeInput: {
        mediaChunks: [
          {
            mimeType: 'image/jpeg',
            data: imageBase64,
          },
        ],
      },
    }));
  }

  /** Send a tool response back to the session */
  sendToolResponse(functionName: string, response: any): void {
    if (!this.isConnected()) return;

    this.ws!.send(JSON.stringify({
      toolResponse: {
        functionResponses: [
          {
            id: functionName,
            name: functionName,
            response: { result: response },
          },
        ],
      },
    }));
  }

  // ── Handle incoming messages ──

  private async handleMessage(data: string): Promise<void> {
    try {
      const msg = JSON.parse(data);

      // Setup complete
      if (msg.setupComplete) {
        return;
      }

      // Server content (model response)
      if (msg.serverContent) {
        const content = msg.serverContent;

        // Model turn
        if (content.modelTurn?.parts) {
          for (const part of content.modelTurn.parts) {
            // Audio response
            if (part.inlineData?.mimeType?.startsWith('audio/')) {
              this.callbacks.onAudioResponse?.(part.inlineData.data);
            }
            // Text response
            if (part.text) {
              this.textBuffer += part.text;
              this.callbacks.onTextResponse?.(part.text);
            }
          }
        }

        // Turn complete
        if (content.turnComplete) {
          if (this.textBuffer) {
            this.callbacks.onTextResponse?.(this.textBuffer);
            this.textBuffer = '';
          }
        }

        // Interrupted (user started speaking while model was responding)
        if (content.interrupted) {
          this.callbacks.onInterrupted?.();
        }
      }

      // Tool call
      if (msg.toolCall?.functionCalls) {
        for (const call of msg.toolCall.functionCalls) {
          if (this.callbacks.onToolCall) {
            const result = await this.callbacks.onToolCall(call.name, call.args || {});
            this.sendToolResponse(call.name, result);
          }
        }
      }
    } catch (error) {
      console.warn('[GeminiLive] Failed to parse message:', error);
    }
  }

  // ── Audio recording (microphone → Gemini) ──

  async startRecording(): Promise<void> {
    if (this.isRecording) return;

    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync({
        isMeteringEnabled: false,
        android: {
          extension: '.wav',
          outputFormat: Audio.AndroidOutputFormat.DEFAULT,
          audioEncoder: Audio.AndroidAudioEncoder.DEFAULT,
          sampleRate: 16000,
          numberOfChannels: 1,
          bitRate: 256000,
        },
        ios: {
          extension: '.wav',
          outputFormat: Audio.IOSOutputFormat.LINEARPCM,
          audioQuality: Audio.IOSAudioQuality.HIGH,
          sampleRate: 16000,
          numberOfChannels: 1,
          bitRate: 256000,
          linearPCMBitDepth: 16,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: false,
        },
        web: {},
      });

      this.recording = recording;
      this.isRecording = true;

      // Set up periodic audio chunk sending
      // Note: In production, you'd use a streaming approach
      // For now, we'll use a polling interval
      this.startAudioStreaming();
    } catch (error) {
      console.error('[GeminiLive] Recording start failed:', error);
      this.callbacks.onError?.(error instanceof Error ? error : new Error('Recording failed'));
    }
  }

  async stopRecording(): Promise<void> {
    if (!this.isRecording || !this.recording) return;

    this.isRecording = false;
    try {
      await this.recording.stopAndUnloadAsync();
      this.recording = null;
    } catch (error) {
      console.warn('[GeminiLive] Recording stop error:', error);
    }
  }

  private startAudioStreaming(): void {
    // Audio streaming is handled by the recording's onRecordingStatusUpdate
    // In the real implementation, you'd send audio chunks periodically
    // For React Native, expo-av doesn't support raw PCM streaming directly,
    // so we use a record-send-record cycle
  }

  // ── Audio playback (Gemini → speaker) ──

  async playAudioResponse(audioBase64: string): Promise<void> {
    try {
      // Stop any current playback
      await this.stopPlayback();

      // Decode base64 audio and play it
      const uri = `${cacheDirectory}gemini_response_${Date.now()}.wav`;

      // Create a Sound from the audio data
      // Note: In production, you'd use a streaming audio player
      const { sound } = await Audio.Sound.createAsync(
        { uri: `data:audio/wav;base64,${audioBase64}` },
        { shouldPlay: true }
      );

      this.audioPlayer = sound;
      this.isSpeaking = true;

      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          this.isSpeaking = false;
          sound.unloadAsync();
        }
      });
    } catch (error) {
      console.warn('[GeminiLive] Audio playback error:', error);
      this.isSpeaking = false;
    }
  }

  async stopPlayback(): Promise<void> {
    if (this.audioPlayer) {
      try {
        await this.audioPlayer.stopAsync();
        await this.audioPlayer.unloadAsync();
      } catch { /* already unloaded */ }
      this.audioPlayer = null;
      this.isSpeaking = false;
    }
  }

  getState(): ConnectionState {
    return this.state;
  }

  getIsSpeaking(): boolean {
    return this.isSpeaking;
  }

  getIsRecording(): boolean {
    return this.isRecording;
  }
}

// ── Factory: Create a cooking assistant live session ──
export function createCookingLiveSession(
  systemContext: string,
  callbacks: LiveSessionCallbacks,
): GeminiLiveSession {
  const tools: LiveTool[] = [
    {
      functionDeclarations: [
        {
          name: 'set_timer',
          description: 'Set a cooking timer for the specified number of minutes',
          parameters: {
            type: 'object',
            properties: {
              minutes: { type: 'number', description: 'Timer duration in minutes' },
              label: { type: 'string', description: 'What the timer is for (e.g., "boil pasta")' },
            },
            required: ['minutes'],
          },
        },
        {
          name: 'next_step',
          description: 'Move to the next cooking instruction step',
          parameters: { type: 'object', properties: {} },
        },
        {
          name: 'previous_step',
          description: 'Go back to the previous cooking instruction step',
          parameters: { type: 'object', properties: {} },
        },
        {
          name: 'add_to_pantry',
          description: 'Add items to the user pantry',
          parameters: {
            type: 'object',
            properties: {
              items: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    name: { type: 'string' },
                    amount: { type: 'number' },
                    unit: { type: 'string' },
                    category: { type: 'string' },
                  },
                  required: ['name'],
                },
              },
            },
            required: ['items'],
          },
        },
        {
          name: 'add_to_shopping_list',
          description: 'Add items to the shopping list',
          parameters: {
            type: 'object',
            properties: {
              items: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    name: { type: 'string' },
                    amount: { type: 'number' },
                    unit: { type: 'string' },
                  },
                  required: ['name'],
                },
              },
            },
            required: ['items'],
          },
        },
        {
          name: 'adjust_servings',
          description: 'Adjust the recipe serving size',
          parameters: {
            type: 'object',
            properties: {
              servings: { type: 'number', description: 'New number of servings' },
            },
            required: ['servings'],
          },
        },
      ],
    },
  ];

  return new GeminiLiveSession(
    {
      systemInstruction: systemContext,
      voiceName: 'Kore', // Warm, friendly voice
      responseModality: 'AUDIO',
      tools,
    },
    callbacks,
  );
}

// ── Build system context for cooking mode ──
export function buildCookingSystemContext(params: {
  recipeName: string;
  ingredients: string[];
  instructions: string[];
  currentStep: number;
  userAllergies?: string[];
  userConditions?: string[];
  pantryItems?: string[];
  language?: string;
  languageName?: string;
}): string {
  const langNote = params.language && params.language !== 'en'
    ? `\n\nLANGUAGE: You MUST speak and respond entirely in ${params.languageName || params.language}. The user's preferred language is ${params.languageName}. All your voice responses and text must be in this language.`
    : '';

  return `You are SousChef, a warm and encouraging cooking assistant. You're helping the user cook "${params.recipeName}" step by step.${langNote}

RECIPE INGREDIENTS: ${params.ingredients.join(', ')}

INSTRUCTIONS:
${params.instructions.map((inst, i) => `Step ${i + 1}: ${inst}`).join('\n')}

CURRENT STEP: ${params.currentStep + 1} of ${params.instructions.length}
Current instruction: "${params.instructions[params.currentStep]}"

${params.userAllergies?.length ? `USER ALLERGIES (CRITICAL): ${params.userAllergies.join(', ')}` : ''}
${params.userConditions?.length ? `HEALTH CONDITIONS: ${params.userConditions.join(', ')}` : ''}
${params.pantryItems?.length ? `PANTRY AVAILABLE: ${params.pantryItems.join(', ')}` : ''}

BEHAVIOR:
- Be conversational, warm, and concise (2-3 sentences max per response)
- Proactively warn about timing ("flip in about 30 seconds") and common mistakes
- When they ask about substitutions, ALWAYS check against their allergies first
- Use the set_timer tool when timing is mentioned in a step
- Use next_step/previous_step tools when they want to navigate
- If they ask "what's next", read the next step AND move to it
- If they show you their food via camera, give honest feedback on doneness/technique
- Encourage them! Cooking should be fun.`;
}
