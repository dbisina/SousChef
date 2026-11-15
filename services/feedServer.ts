// The feed from the SousChef server, shaped the way the feed screens already read it. Used by socialStore when
// EXPO_PUBLIC_API_URL is set.
//
// Two ids need care. The signed-in person is "me" (ME_ID) everywhere in the screens, so their server id is swapped for it
// on the way in. And the screens show a picture from a "photo reference", which is now allowed to be a real address.
import type { Participant, Post as ApiPost, PostComment, Story as ApiStory, StoryGroup } from '../shared/index';
import { apiFeed, apiFollowing, apiStoryTray } from '@/services/socialApi';
import type { FeedSnapshot } from '@/services/feedService';
import { ME_ID, type Author, type Comment, type Post, type Reel, type Story } from '@/types/social';

/** The picture shown when someone has no photo. */
const NO_AVATAR = 'chef';

/** Server ids, with the signed-in person's own id standing for "me". */
export const localId = (id: string, meId: string): string => (id === meId ? ME_ID : id);
/** And back: what the server knows the person by. */
export const serverId = (id: string, meId: string): string => (id === ME_ID ? meId : id);

export function toAuthor(p: Participant, meId: string): Author {
  return { id: localId(p.id, meId), handle: p.handle, displayName: p.displayName, avatar: p.photoUrl ?? NO_AVATAR, ...(p.isVerifiedChef ? { verified: true } : {}) };
}

export function toPost(p: ApiPost, meId: string): Post {
  return {
    id: p.id,
    authorId: localId(p.author.id, meId),
    kind: p.kind,
    photo: p.photoUrl,
    title: p.title,
    caption: p.caption,
    ...(p.meta ? { meta: p.meta } : {}),
    ...(p.recipeId ? { recipeId: p.recipeId } : {}),
    ...(p.communityId ? { communityId: p.communityId } : {}),
    likes: p.likeCount,
    commentCount: p.commentCount,
    saves: p.saveCount,
    createdAt: p.createdAt,
  };
}

/** A video post as a reel. The server has one kind of post; videos are the ones with a video. */
export function toReel(p: ApiPost, meId: string): Reel {
  return {
    id: p.id,
    authorId: localId(p.author.id, meId),
    photo: p.photoUrl,
    title: p.title,
    caption: p.caption,
    likes: p.likeCount,
    commentCount: p.commentCount,
    saves: p.saveCount,
    views: p.viewCount,
    recipePhoto: p.photoUrl,
    recipeTitle: p.title,
    recipeMeta: p.meta ?? '',
    createdAt: p.createdAt,
  };
}

export function toComment(c: PostComment, meId: string): Comment {
  return {
    id: c.id,
    postId: c.postId,
    authorId: localId(c.author.id, meId),
    ...(c.parentId ? { parentId: c.parentId } : {}),
    text: c.deleted ? '' : c.text || (c.voice ? '🎙 Voice note' : ''),
    likes: c.likeCount,
    ...(c.author.id === meId ? { isAuthor: true } : {}),
    createdAt: c.createdAt,
  };
}

export function toStories(groups: StoryGroup[], meId: string): Story[] {
  return groups.flatMap((g) => g.stories.map((s: ApiStory): Story => ({
    id: s.id,
    authorId: localId(s.author.id, meId),
    photo: s.photoUrl,
    segments: g.stories.length,
    ...(s.recipeId ? { recipeId: s.recipeId } : {}),
    createdAt: s.createdAt,
  })));
}

export interface ServerFeed extends Pick<FeedSnapshot, 'authors' | 'posts' | 'reels' | 'stories'> {
  likedPostIds: string[];
  savedPostIds: string[];
  likedReelIds: string[];
  savedReelIds: string[];
  followingIds: string[];
}

/** Everything the home feed needs in one go: posts from people you follow and ones picked for you, and the story row. */
export async function fetchServerFeed(meId: string): Promise<ServerFeed> {
  const [following, forYou, tray, follows] = await Promise.all([
    apiFeed('following', { limit: 30 }),
    apiFeed('for-you', { limit: 30 }),
    apiStoryTray(),
    apiFollowing(meId, { limit: 100 }).catch(() => ({ items: [] as Participant[] })),
  ]);

  const seen = new Set<string>();
  const posts: ApiPost[] = [];
  for (const p of [...following.items, ...forYou.items]) {
    if (seen.has(p.id)) continue;
    seen.add(p.id);
    posts.push(p);
  }
  posts.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const people = new Map<string, Participant>();
  for (const p of posts) people.set(p.author.id, p.author);
  for (const g of tray) people.set(g.author.id, g.author);
  for (const f of follows.items) people.set(f.id, f);

  const videos = posts.filter((p) => p.videoUrl);
  return {
    authors: [...people.values()].map((p) => toAuthor(p, meId)),
    posts: posts.map((p) => toPost(p, meId)),
    reels: videos.map((p) => toReel(p, meId)),
    stories: toStories(tray, meId),
    likedPostIds: posts.filter((p) => p.viewer?.liked).map((p) => p.id),
    savedPostIds: posts.filter((p) => p.viewer?.saved).map((p) => p.id),
    likedReelIds: videos.filter((p) => p.viewer?.liked).map((p) => p.id),
    savedReelIds: videos.filter((p) => p.viewer?.saved).map((p) => p.id),
    followingIds: follows.items.map((f) => f.id),
  };
}
