import { AiProviderError, type AiProvider, type AiRequest, type AiResult } from './types';

// The two kinds of AI service this server talks to, written against their public HTTP APIs with plain `fetch`.
// Nothing here has been run against the live services yet (that needs API keys), so the request and response shapes
// are tested with an injected `fetch`, and model names and prices come from configuration.

const retryable = (status: number): boolean => status === 408 || status === 429 || status >= 500;

async function post(request: typeof fetch, url: string, headers: Record<string, string>, body: unknown): Promise<unknown> {
  let res: Response;
  try {
    res = await request(url, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body), signal: AbortSignal.timeout(60_000) });
  } catch (err) {
    throw new AiProviderError(`could not reach the AI service: ${(err as Error).message}`, true);
  }
  if (!res.ok) {
    const detail = (await res.text().catch(() => '')).slice(0, 300);
    throw new AiProviderError(`the AI service answered ${res.status}: ${detail}`, retryable(res.status), res.status);
  }
  try {
    return await res.json();
  } catch {
    throw new AiProviderError('the AI service sent something that is not JSON', true, res.status);
  }
}

/* ------------------------------------------------------------------ Google Gemini */

interface GeminiPart {
  text?: string;
  inlineData?: { mimeType: string; data: string };
  fileData?: { fileUri: string; mimeType?: string };
}

export class GeminiProvider implements AiProvider {
  readonly name = 'gemini';
  constructor(
    private readonly settings: { apiKey: string; model: string; baseUrl?: string },
    private readonly request: typeof fetch = fetch,
  ) {}

  get model(): string {
    return this.settings.model;
  }

  supports(req: AiRequest): boolean {
    // A video link is only understood for YouTube; images by address are not fetched here, only inline data.
    if (req.videoUrl && !/^https:\/\/(www\.|m\.)?(youtube\.com|youtu\.be)\//.test(req.videoUrl)) return false;
    return !req.images?.some((i) => !i.base64);
  }

  async complete(req: AiRequest): Promise<AiResult> {
    const parts: GeminiPart[] = [{ text: req.prompt }];
    for (const image of req.images ?? []) parts.push({ inlineData: { mimeType: image.mimeType, data: image.base64 as string } });
    if (req.videoUrl) parts.push({ fileData: { fileUri: req.videoUrl } });

    const base = this.settings.baseUrl ?? 'https://generativelanguage.googleapis.com/v1beta';
    const data = (await post(this.request, `${base}/models/${encodeURIComponent(this.settings.model)}:generateContent`, { 'x-goog-api-key': this.settings.apiKey }, {
      ...(req.system ? { systemInstruction: { parts: [{ text: req.system }] } } : {}),
      contents: [{ role: 'user', parts }],
      generationConfig: {
        ...(req.json ? { responseMimeType: 'application/json' } : {}),
        ...(req.maxOutputTokens ? { maxOutputTokens: req.maxOutputTokens } : {}),
        ...(req.temperature !== undefined ? { temperature: req.temperature } : {}),
      },
    })) as {
      candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
      promptFeedback?: { blockReason?: string };
      usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
    };

    if (data.promptFeedback?.blockReason) throw new AiProviderError(`the request was blocked: ${data.promptFeedback.blockReason}`, false);
    const text = (data.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? '').join('');
    if (!text) throw new AiProviderError(`the AI service gave no answer (${data.candidates?.[0]?.finishReason ?? 'unknown'})`, true);
    return { text, inputTokens: data.usageMetadata?.promptTokenCount ?? 0, outputTokens: data.usageMetadata?.candidatesTokenCount ?? 0, provider: this.name, model: this.settings.model };
  }
}

/* ------------------------------------------------------------------ OpenAI-style chat services (DeepSeek, Nebius) */

export class OpenAiCompatibleProvider implements AiProvider {
  constructor(
    readonly name: string,
    private readonly settings: { apiKey: string; baseUrl: string; model: string; images: boolean },
    private readonly request: typeof fetch = fetch,
  ) {}

  get model(): string {
    return this.settings.model;
  }

  supports(req: AiRequest): boolean {
    if (req.videoUrl) return false;
    return !req.images?.length || this.settings.images;
  }

  async complete(req: AiRequest): Promise<AiResult> {
    const content = req.images?.length
      ? [
          { type: 'text', text: req.prompt },
          ...req.images.map((i) => ({ type: 'image_url', image_url: { url: i.url ?? `data:${i.mimeType};base64,${i.base64}` } })),
        ]
      : req.prompt;
    const data = (await post(this.request, `${this.settings.baseUrl.replace(/\/+$/, '')}/chat/completions`, { authorization: `Bearer ${this.settings.apiKey}` }, {
      model: this.settings.model,
      messages: [...(req.system ? [{ role: 'system', content: req.system }] : []), { role: 'user', content }],
      ...(req.json ? { response_format: { type: 'json_object' } } : {}),
      ...(req.maxOutputTokens ? { max_tokens: req.maxOutputTokens } : {}),
      ...(req.temperature !== undefined ? { temperature: req.temperature } : {}),
    })) as { choices?: { message?: { content?: string | null } }[]; usage?: { prompt_tokens?: number; completion_tokens?: number } };

    const text = data.choices?.[0]?.message?.content ?? '';
    if (!text) throw new AiProviderError('the AI service gave no answer', true);
    return { text, inputTokens: data.usage?.prompt_tokens ?? 0, outputTokens: data.usage?.completion_tokens ?? 0, provider: this.name, model: this.settings.model };
  }
}
