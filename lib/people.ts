// Finding a person by id for the feed and chat. People come from the feed store (sample people, or the real ones the
// server has told the app about); the bundled sample people are the fallback.
import { AUTHORS } from '@/data/sample/social';
import { useSocialStore } from '@/stores/socialStore';
import type { Author } from '@/types/social';

export function findAuthor(id: string): Author | undefined {
  return useSocialStore.getState().authors.find((a) => a.id === id) ?? AUTHORS.find((a) => a.id === id);
}
