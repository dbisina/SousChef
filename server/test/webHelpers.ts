import type { HttpResponse, Requester } from '../src/imports/net';

interface Page {
  status: number;
  headers: Record<string, string>;
  chunks: Buffer[];
}

/** A pretend internet: a test says what each address answers, and every address asked for is remembered. */
export class FakeWeb {
  private readonly pages = new Map<string, Page>();
  /** Every address requested, in order. */
  readonly requested: string[] = [];

  page(url: string, html: string, status = 200, contentType = 'text/html; charset=utf-8'): this {
    // Sent in small pieces, as a real connection would.
    const buf = Buffer.from(html);
    const chunks: Buffer[] = [];
    for (let i = 0; i < buf.length; i += 4096) chunks.push(buf.subarray(i, i + 4096));
    this.pages.set(url, { status, headers: { 'content-type': contentType }, chunks });
    return this;
  }

  json(url: string, value: unknown): this {
    return this.page(url, JSON.stringify(value), 200, 'application/json');
  }

  redirect(url: string, to: string, status = 302): this {
    this.pages.set(url, { status, headers: { location: to }, chunks: [] });
    return this;
  }

  reset(): void {
    this.pages.clear();
    this.requested.length = 0;
  }

  readonly requester: Requester = async (url): Promise<HttpResponse> => {
    this.requested.push(url.toString());
    const found = this.pages.get(url.toString());
    const page = found ?? { status: 404, headers: { 'content-type': 'text/plain' }, chunks: [Buffer.from('not found')] };
    return {
      status: page.status,
      headers: page.headers,
      body: (async function* () {
        for (const c of page.chunks) yield c;
      })(),
    };
  };
}
