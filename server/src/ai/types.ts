/** What the AI is being asked to do. Each task has its own route (which models, in what order). */
export const AI_TASKS = ['extract_recipe', 'extract_recipe_from_frames', 'substitute', 'moderate', 'judge_plate', 'meal_plan', 'scale_recipe', 'game_content'] as const;
export type AiTask = (typeof AI_TASKS)[number];

export interface AiImage {
  /** A web address the model can fetch, or base64 data with its type. */
  url?: string;
  base64?: string;
  mimeType: string;
}

export interface AiRequest {
  task: AiTask;
  system?: string;
  prompt: string;
  images?: AiImage[];
  /** A YouTube link for a model that can watch it (Gemini). */
  videoUrl?: string;
  /** Ask for a JSON answer. */
  json?: boolean;
  maxOutputTokens?: number;
  temperature?: number;
  /** Personal content (health numbers, private chats, receipts). Only providers allowed to see private data may serve it. */
  private?: boolean;
}

export interface AiResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
  provider: string;
  model: string;
}

/** One AI service. */
export interface AiProvider {
  readonly name: string;
  readonly model: string;
  /** False when the provider cannot take private requests right now (for example no funded key). Default: yes. */
  readonly allowsPrivate?: boolean;
  /** Safe-to-show facts about the provider's keys, for the staff dashboard (never a whole key). */
  describe?(): { funded: boolean; freeKeys: { key: string; resting: boolean }[] };
  /** Can this provider handle the request (images, video)? */
  supports(request: AiRequest): boolean;
  complete(request: AiRequest): Promise<AiResult>;
}

/** A failure from a provider. `retryable` ones (overloaded, rate limited, unreachable) move on to the next provider. */
export class AiProviderError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'AiProviderError';
  }
}
