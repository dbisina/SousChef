import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { feedService } from '@/services/feedService';
import type { FeedSnapshot, NewPostInput } from '@/services/feedService';
import type { Author, Comment, Post } from '@/types/social';
import { ME_ID } from '@/types/social';
import { apiEnabled } from '@/lib/api';
import { currentUserId } from '@/lib/session';
import { uploadFile } from '@/lib/upload';
import { fetchServerFeed, toComment, toPost, toStories } from '@/services/feedServer';
import {
  apiAddComment,
  apiCreatePost,
  apiCreateStory,
  apiJoinCommunity,
  apiLeaveCommunity,
  apiSetCommentLiked,
  apiSetFollowing,
  apiSetPostLiked,
  apiSetPostSaved,
  apiViewStory,
} from '@/services/socialApi';

const EMPTY_FEED = { authors: [], posts: [], reels: [], stories: [], comments: [], communities: [], challenges: [], events: [] };

interface SocialState extends FeedSnapshot {
  likedPostIds: string[];
  savedPostIds: string[];
  likedReelIds: string[];
  savedReelIds: string[];
  likedCommentIds: string[];
  followingIds: string[];
  joinedCommunityIds: string[];
  viewedStoryIds: string[];

  toggleLikePost: (id: string) => void;
  toggleSavePost: (id: string) => void;
  toggleLikeReel: (id: string) => void;
  toggleSaveReel: (id: string) => void;
  toggleLikeComment: (id: string) => void;
  toggleFollow: (authorId: string) => void;
  toggleJoinCommunity: (id: string) => void;
  markStoryViewed: (id: string) => void;
  addComment: (postId: string, text: string, parentId?: string) => Comment | null;
  createPost: (input: NewPostInput) => Post;
  resetSample: () => void;
  /** Server mode: loads the feed and the story row, and who is liked, saved and followed. */
  loadFromServer: () => Promise<void>;
  /** Server mode: shares a photo from the phone as a story (it disappears after 24 hours). Resolves false if it could not be posted. */
  postStory: (photoUri: string) => Promise<boolean>;
  /** Adds people the server told us about (chat members, for example) without touching the rest. */
  mergeAuthors: (authors: Author[]) => void;
}

const flip = (list: string[], id: string): { next: string[]; on: boolean } =>
  list.includes(id)
    ? { next: list.filter((x) => x !== id), on: false }
    : { next: [...list, id], on: true };

export const useSocialStore = create<SocialState>()(
  persist(
    (set, get) => ({
      ...(apiEnabled() ? EMPTY_FEED : feedService.seed()),
      likedPostIds: [],
      savedPostIds: [],
      likedReelIds: [],
      savedReelIds: [],
      likedCommentIds: [],
      followingIds: [],
      joinedCommunityIds: [],
      viewedStoryIds: [],

      toggleLikePost: (id) => {
        const wantOn = !get().likedPostIds.includes(id);
        if (apiEnabled()) syncToggle(() => apiSetPostLiked(id, wantOn), (count) => set((s) => ({ posts: s.posts.map((p) => (p.id === id ? { ...p, likes: count } : p)) })), () => void get().loadFromServer());
        set((s) => {
          const { next, on } = flip(s.likedPostIds, id);
          return {
            likedPostIds: next,
            posts: s.posts.map((p) => (p.id === id ? { ...p, likes: Math.max(0, p.likes + (on ? 1 : -1)) } : p)),
          };
        });
      },
      toggleSavePost: (id) => {
        const wantOn = !get().savedPostIds.includes(id);
        if (apiEnabled()) syncToggle(() => apiSetPostSaved(id, wantOn), (count) => set((s) => ({ posts: s.posts.map((p) => (p.id === id ? { ...p, saves: count } : p)) })), () => void get().loadFromServer());
        set((s) => {
          const { next, on } = flip(s.savedPostIds, id);
          return {
            savedPostIds: next,
            posts: s.posts.map((p) => (p.id === id ? { ...p, saves: Math.max(0, p.saves + (on ? 1 : -1)) } : p)),
          };
        });
      },
      toggleLikeReel: (id) => {
        const wantOn = !get().likedReelIds.includes(id);
        if (apiEnabled()) syncToggle(() => apiSetPostLiked(id, wantOn), (count) => set((s) => ({ reels: s.reels.map((r) => (r.id === id ? { ...r, likes: count } : r)) })), () => void get().loadFromServer());
        set((s) => {
          const { next, on } = flip(s.likedReelIds, id);
          return {
            likedReelIds: next,
            reels: s.reels.map((r) => (r.id === id ? { ...r, likes: Math.max(0, r.likes + (on ? 1 : -1)) } : r)),
          };
        });
      },
      toggleSaveReel: (id) => {
        const wantOn = !get().savedReelIds.includes(id);
        if (apiEnabled()) syncToggle(() => apiSetPostSaved(id, wantOn), (count) => set((s) => ({ reels: s.reels.map((r) => (r.id === id ? { ...r, saves: count } : r)) })), () => void get().loadFromServer());
        set((s) => {
          const { next, on } = flip(s.savedReelIds, id);
          return {
            savedReelIds: next,
            reels: s.reels.map((r) => (r.id === id ? { ...r, saves: Math.max(0, r.saves + (on ? 1 : -1)) } : r)),
          };
        });
      },
      toggleLikeComment: (id) => {
        const wantOn = !get().likedCommentIds.includes(id);
        const postId = get().comments.find((c) => c.id === id)?.postId;
        if (apiEnabled() && postId) syncToggle(() => apiSetCommentLiked(postId, id, wantOn), (count) => set((s) => ({ comments: s.comments.map((c) => (c.id === id ? { ...c, likes: count } : c)) })), () => void get().loadFromServer());
        set((s) => {
          const { next, on } = flip(s.likedCommentIds, id);
          return {
            likedCommentIds: next,
            comments: s.comments.map((c) => (c.id === id ? { ...c, likes: Math.max(0, c.likes + (on ? 1 : -1)) } : c)),
          };
        });
      },
      toggleFollow: (authorId) => {
        if (apiEnabled() && authorId !== ME_ID) {
          const wantOn = !get().followingIds.includes(authorId);
          apiSetFollowing(authorId, wantOn).catch(() => void get().loadFromServer());
        }
        set((s) => ({ followingIds: flip(s.followingIds, authorId).next }));
      },
      toggleJoinCommunity: (id) => {
        if (apiEnabled()) {
          const wantOn = !get().joinedCommunityIds.includes(id);
          // A private community may only answer "pending" until an admin approves; the reload then shows the truth.
          (wantOn ? apiJoinCommunity(id).then(() => undefined) : apiLeaveCommunity(id)).then(() => get().loadFromServer(), () => void get().loadFromServer());
        }
        set((s) => {
          const { next, on } = flip(s.joinedCommunityIds, id);
          return {
            joinedCommunityIds: next,
            communities: s.communities.map((c) =>
              c.id === id ? { ...c, memberCount: Math.max(0, c.memberCount + (on ? 1 : -1)) } : c,
            ),
          };
        });
      },
      markStoryViewed: (id) => {
        if (apiEnabled() && !get().viewedStoryIds.includes(id)) void apiViewStory(id);
        set((s) => (s.viewedStoryIds.includes(id) ? s : { viewedStoryIds: [...s.viewedStoryIds, id] }));
      },

      addComment: (postId, text, parentId) => {
        if (!text.trim()) return null;
        const comment = feedService.buildComment(postId, text, parentId);
        if (apiEnabled()) {
          // Shown at once; swapped for the server's copy (with its real id) when it answers.
          const meId = currentUserId() ?? '';
          apiAddComment(postId, { text: text.trim(), ...(parentId ? { parentId } : {}) })
            .then((saved) => set((s) => ({ comments: s.comments.map((c) => (c.id === comment.id ? toComment(saved, meId) : c)) })))
            .catch(() =>
              set((s) => ({
                comments: s.comments.filter((c) => c.id !== comment.id),
                posts: s.posts.map((p) => (p.id === postId ? { ...p, commentCount: Math.max(0, p.commentCount - 1) } : p)),
              })),
            );
        }
        set((s) => ({
          comments: [...s.comments, comment],
          posts: s.posts.map((p) => (p.id === postId ? { ...p, commentCount: p.commentCount + 1 } : p)),
        }));
        return comment;
      },
      createPost: (input) => {
        const post = feedService.buildPost(input);
        if (apiEnabled()) {
          // Shown at once. A photo from the phone is uploaded first; if anything fails the post is taken back off the feed.
          const meId = currentUserId() ?? '';
          const upload = /^(file|content):/i.test(input.photo) ? uploadFile(input.photo, 'made_post') : Promise.reject(new Error('Choose a photo from your phone'));
          upload
            .then((photo) =>
              apiCreatePost({
                kind: input.kind,
                title: input.title ?? (input.caption.slice(0, 40) || 'Post'),
                caption: input.caption,
                photoUploadId: photo.id,
                ...(input.recipeId ? { recipeId: input.recipeId } : {}),
                ...(input.communityId ? { communityId: input.communityId } : {}),
              }),
            )
            .then((saved) => set((s) => ({ posts: s.posts.map((p) => (p.id === post.id ? toPost(saved, meId) : p)) })))
            .catch(() => set((s) => ({ posts: s.posts.filter((p) => p.id !== post.id) })));
        }
        set((s) => ({ posts: [post, ...s.posts] }));
        return post;
      },
      postStory: async (photoUri) => {
        const meId = currentUserId();
        if (!apiEnabled() || !meId) return false;
        try {
          const file = await uploadFile(photoUri, 'story');
          const story = await apiCreateStory({ photoUploadId: file.id });
          const [mine] = toStories([{ author: story.author, stories: [story], hasUnseen: false, latestAt: story.createdAt }], meId);
          if (mine) set((s) => ({ stories: [mine, ...s.stories.filter((x) => x.id !== mine.id)] }));
          return true;
        } catch {
          return false;
        }
      },
      mergeAuthors: (authors) =>
        set((s) => {
          const known = new Set(s.authors.map((a) => a.id));
          const fresh = authors.filter((a) => !known.has(a.id));
          return fresh.length === 0 ? s : { authors: [...s.authors, ...fresh] };
        }),
      loadFromServer: async () => {
        const meId = currentUserId();
        if (!apiEnabled() || !meId) return;
        try {
          const feed = await fetchServerFeed(meId);
          set((s) => ({ ...s, ...feed }));
        } catch {
          // Offline: what is on the phone stays.
        }
      },
      resetSample: () =>
        set({
          ...feedService.seed(),
          likedPostIds: [],
          savedPostIds: [],
          likedReelIds: [],
          savedReelIds: [],
          likedCommentIds: [],
          followingIds: [],
          joinedCommunityIds: [],
          viewedStoryIds: [],
        }),
    }),
    {
      name: apiEnabled() ? 'souschef-social-server-v1' : 'souschef-social-v1',
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
    },
  ),
);

/* Selectors. Pure functions of state: pass to useSocialStore(sel) for scalars,
   or select the raw arrays and derive with useMemo (avoid returning fresh arrays
   from a selector). */
/** Runs a like/save/follow on the server; `onCount` gets the real count back, `onFail` puts the screen right. */
function syncToggle(request: () => Promise<{ count: number }>, onCount: (count: number) => void, onFail: () => void): void {
  request().then((r) => onCount(r.count)).catch(onFail);
}

export const selectPost = (id: string) => (s: SocialState) => s.posts.find((p) => p.id === id);
export const selectReel = (id: string) => (s: SocialState) => s.reels.find((r) => r.id === id);
export const selectAuthor = (id: string) => (s: SocialState) => s.authors.find((a) => a.id === id);
export const selectIsFollowing = (authorId: string) => (s: SocialState) => s.followingIds.includes(authorId);
export const selectIsPostLiked = (id: string) => (s: SocialState) => s.likedPostIds.includes(id);
export const selectIsPostSaved = (id: string) => (s: SocialState) => s.savedPostIds.includes(id);
export const selectIsReelLiked = (id: string) => (s: SocialState) => s.likedReelIds.includes(id);
export const selectIsReelSaved = (id: string) => (s: SocialState) => s.savedReelIds.includes(id);
export const selectCommentsFor = (comments: Comment[], postId: string): Comment[] =>
  comments.filter((c) => c.postId === postId);
