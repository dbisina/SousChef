// Finding a person by id for the feed and chat: the people the server has told the app about.
import { useSocialStore } from '@/stores/socialStore';
import type { Author } from '@/types/social';

export function findAuthor(id: string): Author | undefined {
  return useSocialStore.getState().authors.find((a) => a.id === id);
}
