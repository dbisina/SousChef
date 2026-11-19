// Feeds, posts, comments, follows, stories and reports against the enplace server. The feed screens use these when
// EXPO_PUBLIC_API_URL is set. Every list comes back in pages: pass `nextCursor` as `cursor` for the next one.
import type {
  Challenge as ApiChallenge,
  Community as ApiCommunity,
  CommunityEvent as ApiEvent,
  CommunitySummary,
  JoinCommunityResponse,
  CreatePostCommentRequest,
  CreatePostRequest,
  CreateReportRequest,
  CreateStoryRequest,
  FeedPreferences,
  FollowToggle,
  Page,
  Participant,
  Post,
  PostComment,
  Story,
  StoryGroup,
  ToggleResponse,
  UserProfile,
} from '@shared/index';
import { api } from '@/lib/api';

export type FeedKind = 'following' | 'for-you' | 'discover';

/** One page of a feed. `for-you` and `discover` also work signed out. */
export function apiFeed(kind: FeedKind, opts: { limit?: number; cursor?: string } = {}): Promise<Page<Post>> {
  return api().get<Page<Post>>(`/v1/feed/${kind}`, { query: { limit: opts.limit ?? 20, cursor: opts.cursor } });
}

export const apiPost = (id: string): Promise<Post> => api().get<Post>(`/v1/posts/${id}`);
export const apiCreatePost = (request: CreatePostRequest): Promise<Post> => api().post<Post>('/v1/posts', request);
export const apiDeletePost = (id: string): Promise<void> => api().delete(`/v1/posts/${id}`);
export const apiUserPosts = (userId: string, opts: { limit?: number; cursor?: string } = {}): Promise<Page<Post>> =>
  api().get<Page<Post>>(`/v1/users/${userId}/posts`, { query: { limit: opts.limit ?? 20, cursor: opts.cursor } });
export const apiSavedPosts = (opts: { limit?: number; cursor?: string } = {}): Promise<Page<Post>> =>
  api().get<Page<Post>>('/v1/me/saved-posts', { query: { limit: opts.limit ?? 20, cursor: opts.cursor } });

/** Counts a view; fire and forget, a failure changes nothing. */
export async function apiViewPost(id: string): Promise<void> {
  try {
    await api().post(`/v1/posts/${id}/view`);
  } catch {
    // counting views must never get in the way
  }
}

/** Like, unlike, save, unsave: repeating one is harmless, and the answer is the new count. */
export function apiSetPostLiked(id: string, on: boolean): Promise<ToggleResponse> {
  return on ? api().put<ToggleResponse>(`/v1/posts/${id}/like`) : api().delete<ToggleResponse>(`/v1/posts/${id}/like`);
}
export function apiSetPostSaved(id: string, on: boolean): Promise<ToggleResponse> {
  return on ? api().put<ToggleResponse>(`/v1/posts/${id}/save`) : api().delete<ToggleResponse>(`/v1/posts/${id}/save`);
}

export const apiComments = (postId: string, opts: { limit?: number; cursor?: string } = {}): Promise<Page<PostComment>> =>
  api().get<Page<PostComment>>(`/v1/posts/${postId}/comments`, { query: { limit: opts.limit ?? 20, cursor: opts.cursor } });
export const apiReplies = (postId: string, commentId: string, opts: { limit?: number; cursor?: string } = {}): Promise<Page<PostComment>> =>
  api().get<Page<PostComment>>(`/v1/posts/${postId}/comments/${commentId}/replies`, { query: { limit: opts.limit ?? 20, cursor: opts.cursor } });
export const apiAddComment = (postId: string, request: CreatePostCommentRequest): Promise<PostComment> =>
  api().post<PostComment>(`/v1/posts/${postId}/comments`, request);
export const apiDeleteComment = (postId: string, commentId: string): Promise<void> => api().delete(`/v1/posts/${postId}/comments/${commentId}`);
export function apiSetCommentLiked(postId: string, commentId: string, on: boolean): Promise<ToggleResponse> {
  const path = `/v1/posts/${postId}/comments/${commentId}/like`;
  return on ? api().put<ToggleResponse>(path) : api().delete<ToggleResponse>(path);
}

/* ---------------------------------------------------------------- people */

export const apiProfile = (userId: string): Promise<UserProfile> => api().get<UserProfile>(`/v1/users/${userId}`);
export function apiSetFollowing(userId: string, on: boolean): Promise<FollowToggle> {
  return on ? api().put<FollowToggle>(`/v1/users/${userId}/follow`) : api().delete<FollowToggle>(`/v1/users/${userId}/follow`);
}
export const apiFollowers = (userId: string, opts: { limit?: number; cursor?: string } = {}): Promise<Page<Participant>> =>
  api().get<Page<Participant>>(`/v1/users/${userId}/followers`, { query: { limit: opts.limit ?? 30, cursor: opts.cursor } });
export const apiFollowing = (userId: string, opts: { limit?: number; cursor?: string } = {}): Promise<Page<Participant>> =>
  api().get<Page<Participant>>(`/v1/users/${userId}/following`, { query: { limit: opts.limit ?? 30, cursor: opts.cursor } });
export async function apiSearchPeople(q: string, limit = 20): Promise<Participant[]> {
  if (q.trim().length < 2) return [];
  return (await api().get<{ items: Participant[] }>('/v1/users/search', { query: { q: q.trim(), limit } })).items;
}

/* ---------------------------------------------------------------- communities */

export const apiMyCommunities = async (): Promise<CommunitySummary[]> => (await api().get<Page<CommunitySummary>>('/v1/me/communities', { query: { limit: 30 } })).items;
export const apiDiscoverCommunities = async (): Promise<CommunitySummary[]> => (await api().get<Page<CommunitySummary>>('/v1/communities', { query: { limit: 20 } })).items;
export const apiCommunity = (id: string): Promise<ApiCommunity> => api().get<ApiCommunity>(`/v1/communities/${id}`);
export const apiCommunityPosts = (id: string, limit = 20): Promise<Page<Post>> => api().get<Page<Post>>(`/v1/communities/${id}/posts`, { query: { limit } });
export const apiChallenges = async (id: string): Promise<ApiChallenge[]> => (await api().get<{ items: ApiChallenge[] }>(`/v1/communities/${id}/challenges`)).items;
export const apiEvents = async (id: string): Promise<ApiEvent[]> => (await api().get<{ items: ApiEvent[] }>(`/v1/communities/${id}/events`)).items;
export const apiJoinCommunity = (id: string): Promise<JoinCommunityResponse> => api().post<JoinCommunityResponse>(`/v1/communities/${id}/join`);
export const apiLeaveCommunity = (id: string): Promise<void> => api().delete(`/v1/communities/${id}/membership`);

/* ---------------------------------------------------------------- stories and reports */

export const apiStoryTray = async (): Promise<StoryGroup[]> => (await api().get<{ groups: StoryGroup[] }>('/v1/stories')).groups;
export const apiUserStories = async (userId: string): Promise<StoryGroup | null> => (await api().get<{ group: StoryGroup | null }>(`/v1/users/${userId}/stories`)).group;
export const apiCreateStory = (request: CreateStoryRequest): Promise<Story> => api().post<Story>('/v1/stories', request);
export const apiDeleteStory = (id: string): Promise<void> => api().delete(`/v1/stories/${id}`);
export async function apiViewStory(id: string): Promise<void> {
  try {
    await api().post(`/v1/stories/${id}/view`);
  } catch {
    // seen-marks are a nicety
  }
}

/** Reporting the same thing twice counts once; the server takes it down on its own once enough people report it. */
export const apiReport = (request: CreateReportRequest): Promise<void> => api().post('/v1/reports', request);

export interface HandleCheck {
  handle: string;
  available: boolean;
  reason?: 'invalid' | 'taken';
}
/** Is a username well formed and free (or already yours)? */
export const apiHandleAvailable = (handle: string): Promise<HandleCheck> =>
  api().get<HandleCheck>(`/v1/users/handle-available?handle=${encodeURIComponent(handle)}`);

/* ---------------------------------------------------------------- feed learning */

/** Whether the feed may learn from what this person does. */
export const apiFeedPreferences = (): Promise<FeedPreferences> => api().get<FeedPreferences>('/v1/me/feed-preferences');
export const apiSetFeedPreferences = (personalised: boolean): Promise<FeedPreferences> => api().put<FeedPreferences>('/v1/me/feed-preferences', { personalised });
