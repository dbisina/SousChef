import { AiProviderError, type AiProvider, type AiRequest, type AiResult } from '../src/ai/types';

/** A stand-in AI service. A test says what it answers; the calls it received are kept to look at. */
export class FakeAiProvider implements AiProvider {
  readonly calls: AiRequest[] = [];
  /** What to answer. Return a string (the reply text) or throw. */
  handler: (request: AiRequest) => string | Promise<string> = () => '{}';
  /** Fail every call with this instead of answering. */
  failWith: AiProviderError | null = null;
  tokens = { input: 1000, output: 500 };

  constructor(
    readonly name: string,
    private readonly canSeeImages = false,
  ) {}

  get model(): string {
    return `${this.name}-test`;
  }

  supports(request: AiRequest): boolean {
    if (request.videoUrl && this.name !== 'gemini') return false;
    return !request.images?.length || this.canSeeImages;
  }

  async complete(request: AiRequest): Promise<AiResult> {
    this.calls.push(request);
    if (this.failWith) throw this.failWith;
    const text = await this.handler(request);
    return { text, inputTokens: this.tokens.input, outputTokens: this.tokens.output, provider: this.name, model: this.model };
  }

  reset(): void {
    this.calls.length = 0;
    this.handler = () => '{}';
    this.failWith = null;
    this.tokens = { input: 1000, output: 500 };
  }
}

export interface FakeAi {
  deepseek: FakeAiProvider;
  gemini: FakeAiProvider;
  nebius: FakeAiProvider;
  all: FakeAiProvider[];
  reset(): void;
}

export function makeFakeAi(): FakeAi {
  const deepseek = new FakeAiProvider('deepseek');
  const gemini = new FakeAiProvider('gemini', true);
  const nebius = new FakeAiProvider('nebius');
  const all = [deepseek, gemini, nebius];
  return { deepseek, gemini, nebius, all, reset: () => all.forEach((p) => p.reset()) };
}
