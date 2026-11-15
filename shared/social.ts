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
  /** Set for a post made inside a community. */
  communityId: string | null;
  challengeId: string | null;
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
  /** Post inside a community you are a member of. */
  communityId?: string;
  /** Enter one of that community's running challenges. */
  challengeId?: string;
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

/* ---------------------------------------------------------------- stories */

export interface Story {
  id: string;
  author: Participant;
  photoUrl: string;
  recipeId: string | null;
  createdAt: string;
  /** When it disappears: 24 hours after it was posted. */
  expiresAt: string;
  /** Shown to the author only; null for everyone else. */
  viewCount: number | null;
  /** Whether the signed-in person has seen it; null when nobody is signed in. */
  seen: boolean | null;
}

export interface CreateStoryRequest {
  /** A finished `story` upload. */
  photoUploadId: string;
  recipeId?: string;
}

/** One person's active stories, oldest first, as the row of circles at the top of the feed. */
export interface StoryGroup {
  author: Participant;
  stories: Story[];
  hasUnseen: boolean;
  latestAt: string;
}

export interface StoryViewer {
  user: Participant;
  at: string;
}

/* ---------------------------------------------------------------- reports and moderation */

export const REPORT_TARGETS = ['post', 'comment', 'user', 'story', 'message'] as const;
export type ReportTarget = (typeof REPORT_TARGETS)[number];

export const REPORT_REASONS = ['spam', 'abuse', 'inappropriate', 'misinformation', 'other'] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export interface CreateReportRequest {
  targetType: ReportTarget;
  targetId: string;
  reason: ReportReason;
  details?: string;
}

export type ReportStatus = 'open' | 'actioned' | 'dismissed';

/** What staff do with a reported thing. `hide` takes it down; `restore` puts a hidden post back; `dismiss` closes the report with no change. */
export type ReportAction = 'hide' | 'restore' | 'dismiss';

/** A report as staff see it, with a snapshot of what was reported. */
export interface AdminReport {
  id: string;
  /** Null when the automatic check raised it. */
  reporter: Participant | null;
  /** Raised by the automatic check, not a person. */
  auto: boolean;
  targetType: ReportTarget;
  targetId: string;
  reason: ReportReason;
  details: string;
  status: ReportStatus;
  resolution: string | null;
  createdAt: string;
  resolvedAt: string | null;
  /** How many people reported this same thing. */
  reportCount: number;
  /** A short description of the thing itself, or null if it no longer exists. */
  target: { summary: string; authorId: string | null; hidden: boolean } | null;
}
