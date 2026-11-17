// The feed from the SousChef server, shaped the way the feed screens already read it. Used by socialStore when
// EXPO_PUBLIC_API_URL is set.
//
// Two ids need care. The signed-in person is "me" (ME_ID) everywhere in the screens, so their server id is swapped for it
// on the way in. And the screens show a picture from a "photo reference", which is now allowed to be a real address.
import type { Challenge as ApiChallenge, CommunityEvent as ApiEvent, CommunitySummary, Participant, Post as ApiPost, PostComment, Story as ApiStory, StoryGroup } from '@shared/index';
import {
  apiChallenges,
  apiCommunityPosts,
  apiDiscoverCommunities,
  apiEvents,
  apiFeed,
  apiFollowing,
  apiMyCommunities,
  apiStoryTray,
} from '@/services/socialApi';
import type { FeedSnapshot } from '@/services/feedService';
import { ME_ID, type Author, type Challenge, type Comment, type Community, type CommunityEvent, type Post, type Reel, type Story } from '@/types/social';

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
    ...(p.recipe ? { cookedWith: { recipeId: p.recipe.id, title: p.recipe.title, authorId: localId(p.recipe.author.id, meId), authorHandle: p.recipe.author.handle ?? '', authorName: p.recipe.author.displayName } } : {}),
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

export function toCommunity(c: CommunitySummary): Community {
  return { id: c.id, name: c.name, photo: c.photoUrl ?? 'family', visibility: c.visibility, memberCount: c.memberCount, memberAvatars: [] };
}

/** "3 days left", "ends today", "ended". */
function endsLabel(endsAt: string, now: number): string {
  const days = Math.ceil((Date.parse(endsAt) - now) / 86_400_000);
  if (days < 0 || Number.isNaN(days)) return 'Ended';
  if (days === 0) return 'Ends today';
  return days === 1 ? '1 day left' : `${days} days left`;
}

export function toChallenge(c: ApiChallenge, now = Date.now()): Challenge {
  return { id: c.id, communityId: c.communityId, title: c.title, photo: c.photoUrl ?? 'plating', entries: c.entries, endsLabel: endsLabel(c.endsAt, now) };
}

export function toEvent(e: ApiEvent): CommunityEvent {
  return { id: e.id, communityId: e.communityId, title: e.title, date: e.startsAt, detail: e.detail };
}

export interface ServerFeed extends Pick<FeedSnapshot, 'authors' | 'posts' | 'reels' | 'stories' | 'communities' | 'challenges' | 'events'> {
  joinedCommunityIds: string[];
  likedPostIds: string[];
  savedPostIds: string[];
  likedReelIds: string[];
  savedReelIds: string[];
  followingIds: string[];
}

/** Everything the home feed needs in one go: posts from people you follow and ones picked for you, and the story row. */
export async function fetchServerFeed(meId: string): Promise<ServerFeed> {
  const [following, forYou, tray, follows, mine, discover] = await Promise.all([
    apiFeed('following', { limit: 30 }),
    apiFeed('for-you', { limit: 30 }),
    apiStoryTray(),
    apiFollowing(meId, { limit: 50 }).catch(() => ({ items: [] as Participant[] })),
    apiMyCommunities().catch(() => [] as CommunitySummary[]),
    apiDiscoverCommunities().catch(() => [] as CommunitySummary[]),
  ]);

  // Communities: the ones you are in first, then others to discover. For the ones you are in: their posts, challenges and events.
  const communities = [...mine, ...discover.filter((d) => !mine.some((m) => m.id === d.id))];
  const inside = mine.slice(0, 8);
  const details = await Promise.all(
    inside.map(async (c) => ({
      posts: await apiCommunityPosts(c.id).then((p) => p.items).catch(() => [] as ApiPost[]),
      challenges: await apiChallenges(c.id).catch(() => [] as ApiChallenge[]),
      events: await apiEvents(c.id).catch(() => [] as ApiEvent[]),
    })),
  );

  const seen = new Set<string>();
  const posts: ApiPost[] = [];
  for (const p of [...following.items, ...forYou.items, ...details.flatMap((d) => d.posts)]) {
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
    communities: communities.map(toCommunity),
    challenges: details.flatMap((d) => d.challenges.filter((c) => c.active)).map((c) => toChallenge(c)),
    events: details.flatMap((d) => d.events).map(toEvent),
    joinedCommunityIds: mine.map((c) => c.id),
    likedPostIds: posts.filter((p) => p.viewer?.liked).map((p) => p.id),
    savedPostIds: posts.filter((p) => p.viewer?.saved).map((p) => p.id),
    likedReelIds: videos.filter((p) => p.viewer?.liked).map((p) => p.id),
    savedReelIds: videos.filter((p) => p.viewer?.saved).map((p) => p.id),
    followingIds: follows.items.map((f) => f.id),
  };
}
