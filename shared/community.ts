// Communities: groups around a shared interest, each with a chat room, posts, challenges and events. Dates are ISO strings.
import type { Participant } from './chat';

export type CommunityVisibility = 'public' | 'private';
export type CommunityRole = 'owner' | 'admin' | 'member';

export interface CommunitySummary {
  id: string;
  name: string;
  description: string;
  photoUrl: string | null;
  visibility: CommunityVisibility;
  memberCount: number;
  createdAt: string;
}

export interface Community extends CommunitySummary {
  /** The community's chat room. Only members can open it. */
  conversationId: string | null;
  /** Your place in it; null when you are not in it or not signed in. */
  viewer: { status: 'member' | 'pending'; role: CommunityRole } | null;
}

export interface CreateCommunityRequest {
  name: string;
  description?: string;
  visibility: CommunityVisibility;
  /** A finished `avatar` upload. */
  photoUploadId?: string;
}

export interface UpdateCommunityRequest {
  name?: string;
  description?: string;
  visibility?: CommunityVisibility;
  photoUploadId?: string;
}

export interface JoinCommunityResponse {
  /** `pending` when the community is private and an admin has to approve. */
  status: 'member' | 'pending';
}

export interface CommunityMember {
  user: Participant;
  role: CommunityRole;
  status: 'member' | 'pending';
  joinedAt: string;
}

export interface SetRoleRequest {
  role: 'admin' | 'member';
}

export interface Challenge {
  id: string;
  communityId: string;
  title: string;
  description: string;
  photoUrl: string | null;
  endsAt: string;
  /** Posts entered so far. */
  entries: number;
  active: boolean;
}

export interface CreateChallengeRequest {
  title: string;
  description?: string;
  /** A finished `avatar` upload. */
  photoUploadId?: string;
  endsAt: string;
}

export interface CommunityEvent {
  id: string;
  communityId: string;
  title: string;
  detail: string;
  startsAt: string;
}

export interface CreateEventRequest {
  title: string;
  detail?: string;
  startsAt: string;
}
