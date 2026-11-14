import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { feedService } from '@/services/feedService';
import type { FeedSnapshot, NewPostInput } from '@/services/feedService';
import type { Comment, Post } from '@/types/social';

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
}

const flip = (list: string[], id: string): { next: string[]; on: boolean } =>
  list.includes(id)
    ? { next: list.filter((x) => x !== id), on: false }
    : { next: [...list, id], on: true };

export const useSocialStore = create<SocialState>()(
  persist(
    (set) => ({
      ...feedService.seed(),
      likedPostIds: [],
      savedPostIds: [],
      likedReelIds: [],
      savedReelIds: [],
      likedCommentIds: [],
      followingIds: [],
      joinedCommunityIds: [],
      viewedStoryIds: [],

      toggleLikePost: (id) =>
        set((s) => {
          const { next, on } = flip(s.likedPostIds, id);
          return {
            likedPostIds: next,
            posts: s.posts.map((p) => (p.id === id ? { ...p, likes: Math.max(0, p.likes + (on ? 1 : -1)) } : p)),
          };
        }),
      toggleSavePost: (id) =>
        set((s) => {
          const { next, on } = flip(s.savedPostIds, id);
          return {
            savedPostIds: next,
            posts: s.posts.map((p) => (p.id === id ? { ...p, saves: Math.max(0, p.saves + (on ? 1 : -1)) } : p)),
          };
        }),
      toggleLikeReel: (id) =>
        set((s) => {
          const { next, on } = flip(s.likedReelIds, id);
          return {
            likedReelIds: next,
            reels: s.reels.map((r) => (r.id === id ? { ...r, likes: Math.max(0, r.likes + (on ? 1 : -1)) } : r)),
          };
        }),
      toggleSaveReel: (id) =>
        set((s) => {
          const { next, on } = flip(s.savedReelIds, id);
          return {
            savedReelIds: next,
            reels: s.reels.map((r) => (r.id === id ? { ...r, saves: Math.max(0, r.saves + (on ? 1 : -1)) } : r)),
          };
        }),
      toggleLikeComment: (id) =>
        set((s) => {
          const { next, on } = flip(s.likedCommentIds, id);
          return {
            likedCommentIds: next,
            comments: s.comments.map((c) => (c.id === id ? { ...c, likes: Math.max(0, c.likes + (on ? 1 : -1)) } : c)),
          };
        }),
      toggleFollow: (authorId) => set((s) => ({ followingIds: flip(s.followingIds, authorId).next })),
      toggleJoinCommunity: (id) =>
        set((s) => {
          const { next, on } = flip(s.joinedCommunityIds, id);
          return {
            joinedCommunityIds: next,
            communities: s.communities.map((c) =>
              c.id === id ? { ...c, memberCount: Math.max(0, c.memberCount + (on ? 1 : -1)) } : c,
            ),
          };
        }),
      markStoryViewed: (id) =>
        set((s) => (s.viewedStoryIds.includes(id) ? s : { viewedStoryIds: [...s.viewedStoryIds, id] })),

      addComment: (postId, text, parentId) => {
        if (!text.trim()) return null;
        const comment = feedService.buildComment(postId, text, parentId);
        set((s) => ({
          comments: [...s.comments, comment],
          posts: s.posts.map((p) => (p.id === postId ? { ...p, commentCount: p.commentCount + 1 } : p)),
        }));
        return comment;
      },
      createPost: (input) => {
        const post = feedService.buildPost(input);
        set((s) => ({ posts: [post, ...s.posts] }));
        return post;
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
      name: 'souschef-social-v1',
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
    },
  ),
);

/* Selectors. Pure functions of state: pass to useSocialStore(sel) for scalars,
   or select the raw arrays and derive with useMemo (avoid returning fresh arrays
   from a selector). */
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
