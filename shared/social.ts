// People, posts, comments and feeds. Dates are ISO strings.
import type { Page } from './recipe';
import type { Participant } from './chat';

export const POST_KINDS = ['recipe', 'made-this', 'video', 'plan'] as const;
export type PostKind = (typeof POST_KINDS)[number];

export interface Post {
  id: string;
  author: Participant;
  kind: PostKind;
  title: string;
  caption: string;
  /** A short line such as "35 min · Easy". */
  meta: string | null;
  photoUrl: string;
  videoUrl: string | null;
  recipeId: string | null;
  likeCount: number;
  commentCount: number;
  saveCount: number;
  viewCount: number;
  createdAt: string;
  /** What the signed-in person has done with it; null when nobody is signed in. */
  viewer: { liked: boolean; saved: boolean } | null;
}

export interface CreatePostRequest {
  kind: PostKind;
  title: string;
  caption?: string;
  meta?: string;
  recipeId?: string;
  /** A finished `made_post` upload. */
  photoUploadId: string;
  /** A finished `post_video` upload, for a video post. */
  videoUploadId?: string;
}

export interface PostComment {
  id: string;
  postId: string;
  author: Participant;
  /** Null for a top-level comment. */
  parentId: string | null;
  /** Empty for a voice comment or a deleted one. */
  text: string;
  voice: { url: string; durationSec: number } | null;
  likeCount: number;
  replyCount: number;
  createdAt: string;
  deleted: boolean;
  viewer: { liked: boolean } | null;
}

/** Text, a voice note, or both. A reply names the top-level comment it answers. */
export interface CreatePostCommentRequest {
  parentId?: string;
  text?: string;
  /** A finished `voice` upload. */
  voice?: { uploadId: string; durationSec: number };
}

export interface UserProfile extends Participant {
  bio: string;
  followerCount: number;
  followingCount: number;
  recipeCount: number;
  postCount: number;
  createdAt: string;
  /** How you relate to them; null when nobody is signed in or it is your own profile. */
  viewer: { following: boolean; followedBy: boolean; blocked: boolean } | null;
}

export interface FollowToggle {
  following: boolean;
  followerCount: number;
}

export type PostPage = Page<Post>;
