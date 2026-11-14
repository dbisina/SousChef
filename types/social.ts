import type { SampleName } from '@/assets/sample';

/** Photo reference: a key of SAMPLE in assets/sample/index.ts. */
export type PhotoRef = SampleName;

export interface Author {
  id: string;
  handle: string;
  displayName: string;
  avatar: PhotoRef;
  verified?: boolean;
  online?: boolean;
}

export type PostKind = 'recipe' | 'made-this' | 'video' | 'plan';

export interface Post {
  id: string;
  authorId: string;
  kind: PostKind;
  photo: PhotoRef;
  title: string;
  caption: string;
  /** e.g. "35 min · Easy" */
  meta?: string;
  recipeId?: string;
  communityId?: string;
  likes: number;
  commentCount: number;
  saves: number;
  createdAt: string;
}

export interface Reel {
  id: string;
  authorId: string;
  photo: PhotoRef;
  title: string;
  caption: string;
  likes: number;
  commentCount: number;
  saves: number;
  views: number;
  recipePhoto: PhotoRef;
  recipeTitle: string;
  recipeMeta: string;
  createdAt: string;
}

export interface Story {
  id: string;
  authorId: string;
  photo: PhotoRef;
  /** Bars shown in the progress strip. */
  segments: number;
  recipeId?: string;
  createdAt: string;
}

export interface Comment {
  id: string;
  postId: string;
  authorId: string;
  parentId?: string;
  text: string;
  likes: number;
  isAuthor?: boolean;
  createdAt: string;
}

export interface Challenge {
  id: string;
  communityId: string;
  title: string;
  photo: PhotoRef;
  entries: number;
  endsLabel: string;
}

export interface CommunityEvent {
  id: string;
  communityId: string;
  title: string;
  /** ISO date */
  date: string;
  detail: string;
}

export interface Community {
  id: string;
  name: string;
  photo: PhotoRef;
  visibility: 'public' | 'private';
  memberCount: number;
  memberAvatars: PhotoRef[];
}

export type MessageKind = 'text' | 'recipe-card' | 'voice';

/** sending: shown on screen, not yet confirmed. failed: tap to retry. */
export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read' | 'failed';

export interface MessageReaction {
  emoji: string;
  /** 'me' for the current user, else an Author id. */
  userIds: string[];
}

/** Quote of the message being replied to; stored so the quote survives if the original scrolls out of memory. */
export interface ReplyRef {
  messageId: string;
  senderId: string;
  preview: string;
}

interface MessageBase {
  id: string;
  conversationId: string;
  /** 'me' for the current user, else an Author id. */
  senderId: string;
  createdAt: string;
  status?: MessageStatus;
  replyTo?: ReplyRef;
  reactions?: MessageReaction[];
}
export interface TextMessage extends MessageBase {
  kind: 'text';
  text: string;
}
export interface RecipeCardMessage extends MessageBase {
  kind: 'recipe-card';
  recipeId?: string;
  title: string;
  photo: PhotoRef;
  meta: string;
}
export interface VoiceMessage extends MessageBase {
  kind: 'voice';
  durationSec: number;
  /** Bar heights, 0..100. */
  waveform: number[];
  /** Local file (or, later, a server URL) of the recording. Sample notes have none. */
  uri?: string;
}
export type Message = TextMessage | RecipeCardMessage | VoiceMessage;

export type ConversationKind = 'friend' | 'group' | 'order' | 'community';

export interface Conversation {
  id: string;
  kind: ConversationKind;
  title: string;
  /** Participant Author ids (excluding me). */
  participantIds: string[];
  /** Cover for communities and orders. */
  photo?: PhotoRef;
  lastPreview: string;
  lastAt: string;
  unread: number;
  online?: boolean;
  orderId?: string;
  communityId?: string;
}

export const ME_ID = 'me';
