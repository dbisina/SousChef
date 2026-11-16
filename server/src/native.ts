// The Rust addon (server/native) is a CommonJS package. Node's ESM loader, used by the built server, cannot see named
// exports of a CommonJS file written like that, so `import { parseVideoLink } from '@souschef/native'` fails at start-up in
// the production bundle (it works in tests, which use a different loader). Load it with `require` once, here.
import { createRequire } from 'node:module';
import type { FeedCandidate, VideoLink } from '@souschef/native';

const addon = createRequire(import.meta.url)('@souschef/native') as typeof import('@souschef/native');

export const { parseVideoLink, rankFeed } = addon;
export type { FeedCandidate, VideoLink };
