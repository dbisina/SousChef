import { AiProviderError } from './types';

/** Makes one picture from a text description. Throws AiProviderError when the service is down, out of quota or refuses. */
export type ImageGenerator = (prompt: string) => Promise<{ bytes: Buffer; mime: string }>;

/**
 * Gemini's image model (the paid key only: pictures cost money, so a free key is never used). Without billing on the key
 * Google answers 429 and this throws, which the callers turn into "pictures are resting" rather than an error.
 */
export function geminiImageGenerator(apiKey: string, model: string, request: typeof fetch = fetch): ImageGenerator {
  return async (prompt) => {
    const res = await request(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseModalities: ['IMAGE'] } }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) throw new AiProviderError(`image model answered ${res.status}`, res.status >= 500, res.status);
    const body = (await res.json()) as { candidates?: { content?: { parts?: { inlineData?: { data?: string; mimeType?: string } }[] } }[] };
    const part = body.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
    if (!part?.inlineData?.data) throw new AiProviderError('the image model returned no picture', true);
    const bytes = Buffer.from(part.inlineData.data, 'base64');
    if (bytes.byteLength < 2_000) throw new AiProviderError('the image model returned an empty picture', true);
    return { bytes, mime: part.inlineData.mimeType ?? 'image/png' };
  };
}
