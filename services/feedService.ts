import {
  AUTHORS,
  CHALLENGES,
  COMMUNITIES,
  CURRENT_USER,
  buildComments,
  buildEvents,
  buildPosts,
  buildReels,
  buildStories,
} from '@/data/sample/social';
import { ME_ID } from '@/types/social';
import type {
  Author,
  Challenge,
  Comment,
  Community,
  CommunityEvent,
  PhotoRef,
  Post,
  PostKind,
  Reel,
  Story,
} from '@/types/social';

export interface FeedSnapshot {
  authors: Author[];
  posts: Post[];
  reels: Reel[];
  stories: Story[];
  comments: Comment[];
  communities: Community[];
  challenges: Challenge[];
  events: CommunityEvent[];
}

export interface NewPostInput {
  kind: PostKind;
  photo: PhotoRef;
  caption: string;
  title?: string;
  recipeId?: string;
  communityId?: string;
}

/** Feed data source. Swap the local implementation for a backend later. */
export interface FeedService {
  /** Synchronous snapshot used to seed the persisted store. */
  seed(now?: Date): FeedSnapshot;
  fetchSnapshot(now?: Date): Promise<FeedSnapshot>;
  buildPost(input: NewPostInput, now?: Date): Post;
  buildComment(postId: string, text: string, parentId?: string, now?: Date): Comment;
}

let counter = 0;
const uid = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${(counter++).toString(36)}`;

export const localFeedService: FeedService = {
  seed(now = new Date()) {
    return {
      authors: AUTHORS,
      posts: buildPosts(now),
      reels: buildReels(now),
      stories: buildStories(now),
      comments: buildComments(now),
      communities: COMMUNITIES,
      challenges: CHALLENGES,
      events: buildEvents(now),
    };
  },
  async fetchSnapshot(now) {
    return this.seed(now);
  },
  buildPost(input, now = new Date()) {
    return {
      id: uid('post'),
      authorId: ME_ID,
      kind: input.kind,
      photo: input.photo,
      title: input.title ?? input.caption.slice(0, 40),
      caption: input.caption,
      recipeId: input.recipeId,
      communityId: input.communityId,
      likes: 0,
      commentCount: 0,
      saves: 0,
      createdAt: now.toISOString(),
    };
  },
  buildComment(postId, text, parentId, now = new Date()) {
    return {
      id: uid('c'),
      postId,
      authorId: ME_ID,
      parentId,
      text: text.trim(),
      likes: 0,
      createdAt: now.toISOString(),
    };
  },
};

export const feedService: FeedService = localFeedService;
export { CURRENT_USER };
