/** One web search result. */
export interface WebHit {
  url: string;
  title: string;
}

/** Searches the web for pages about a query. Throws when the service is down, unfunded or refuses. */
export type WebSearch = (query: string) => Promise<WebHit[]>;

const clean = (hits: { url?: unknown; title?: unknown }[]): WebHit[] =>
  hits
    .filter((h): h is { url: string; title?: unknown } => typeof h.url === 'string' && /^https:\/\//i.test(h.url))
    .map((h) => ({ url: h.url, title: typeof h.title === 'string' ? h.title : '' }));

/** Tavily: a search built for AI (https://tavily.com). */
export function tavilySearch(apiKey: string, request: typeof fetch = fetch): WebSearch {
  return async (query) => {
    const res = await request('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ query, max_results: 6, search_depth: 'basic', include_answer: false }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new Error(`tavily ${res.status}`);
    const body = (await res.json()) as { results?: { url?: unknown; title?: unknown }[] };
    return clean(body.results ?? []);
  };
}

/** Brave Search (https://brave.com/search/api). */
export function braveSearch(apiKey: string, request: typeof fetch = fetch): WebSearch {
  return async (query) => {
    const res = await request(`https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=6&safesearch=moderate`, {
      headers: { accept: 'application/json', 'x-subscription-token': apiKey },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new Error(`brave ${res.status}`);
    const body = (await res.json()) as { web?: { results?: { url?: unknown; title?: unknown }[] } };
    return clean(body.web?.results ?? []);
  };
}

/** Tries each search in turn; the first one that answers with at least one result wins. Throws if none did. */
export function firstWorking(searches: WebSearch[]): WebSearch {
  return async (query) => {
    let last: unknown = new Error('no web search is set up');
    for (const search of searches) {
      try {
        const hits = await search(query);
        if (hits.length > 0) return hits;
      } catch (err) {
        last = err;
      }
    }
    throw last;
  };
}
