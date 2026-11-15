// Chat. Dates are ISO strings. Messages in a conversation are numbered 1, 2, 3... (`seq`), so a phone that was offline
// asks for "everything after N". A message sent twice with the same `clientId` is stored once.
import type { RecipeAuthor } from './recipe';

/** Who someone is, as shown in a chat or a list. */
export type Participant = RecipeAuthor;

export type ConversationKind = 'direct' | 'group' | 'community';
export type MessageKind = 'text' | 'recipe-card' | 'voice' | 'image';

/** The best-known emoji reactions. Any single emoji is accepted; these are what the app offers first. */
export const QUICK_REACTIONS = ['❤️', '😂', '😮', '😢', '🙏', '👍'] as const;

/* ---------------------------------------------------------------- messages */

interface MessageBase {
  id: string;
  conversationId: string;
  seq: number;
  sender: Participant;
  /** The phone's own id for it, echoed back so it can match the message it sent. */
  clientId: string;
  createdAt: string;
  /** Set when the message was deleted: the content is gone and `kind` is kept. */
  deleted: boolean;
  /** The message this one answers, in short. */
  replyTo: { id: string; senderId: string; preview: string } | null;
  /** Reactions grouped by emoji. */
  reactions: { emoji: string; count: number; mine: boolean }[];
  /** On your own messages: how far it has got. Null on other people's. */
  status: 'sent' | 'delivered' | 'read' | null;
}

export interface TextMessage extends MessageBase {
  kind: 'text';
  text: string;
}
export interface RecipeCardMessage extends MessageBase {
  kind: 'recipe-card';
  recipeId: string | null;
  title: string;
  photoUrl: string | null;
  meta: string;
}
export interface VoiceMessage extends MessageBase {
  kind: 'voice';
  url: string;
  durationSec: number;
  /** Bar heights, 0 to 100. */
  waveform: number[];
}
export interface ImageMessage extends MessageBase {
  kind: 'image';
  url: string;
  caption: string;
}
export type Message = TextMessage | RecipeCardMessage | VoiceMessage | ImageMessage;

/** What the phone sends. Voice and image refer to a finished upload of its own. */
export type SendMessageRequest = { clientId: string; replyToId?: string } & (
  | { kind: 'text'; text: string }
  | { kind: 'recipe-card'; recipeId?: string; title: string; photoUrl?: string; meta: string }
  | { kind: 'voice'; uploadId: string; durationSec: number; waveform: number[] }
  | { kind: 'image'; uploadId: string; caption?: string }
);

export interface MessagePage {
  /** Oldest first. */
  items: Message[];
  /** More messages exist in the direction that was asked for. */
  hasMore: boolean;
}

/* ---------------------------------------------------------------- live events */

/** What the server pushes to connected phones. Anything missed is found again by asking for messages after a number. */
export type ChatEvent =
  /** A new message. `reactions` is empty and `status` null here; fetch the conversation for the full picture. */
  | { type: 'message.new'; message: Message }
  | { type: 'message.deleted'; conversationId: string; messageId: string }
  /** Someone's phone has received (`delivered`) or they have read (`read`) messages up to a number. */
  | { type: 'receipt'; conversationId: string; userId: string; delivered?: number; read?: number }
  | { type: 'reaction'; conversationId: string; messageId: string; userId: string; emoji: string; active: boolean; count: number }
  /** Members or the title changed, or you were added or removed: fetch the conversation again. */
  | { type: 'conversation.updated'; conversationId: string };

/* ---------------------------------------------------------------- conversations */

export interface Conversation {
  id: string;
  kind: ConversationKind;
  /** The group's name, or for a direct chat the other person's name. */
  title: string;
  photoUrl: string | null;
  members: Participant[];
  /** Admin of the group; always false in a direct chat. */
  isAdmin: boolean;
  muted: boolean;
  /** Messages from other people you have not read. */
  unread: number;
  lastSeq: number;
  lastMessage: { id: string; senderId: string; kind: MessageKind; preview: string; at: string } | null;
  lastAt: string | null;
  createdAt: string;
}

export type CreateConversationRequest =
  | { kind: 'direct'; userId: string }
  | { kind: 'group'; title: string; memberIds: string[] };

export interface UpdateConversationRequest {
  title?: string;
}

export interface AddMembersRequest {
  userIds: string[];
}

export interface SeqRequest {
  /** Everything up to and including this message number. */
  seq: number;
}

export interface MuteRequest {
  muted: boolean;
}

export interface Blocked {
  user: Participant;
  at: string;
}
