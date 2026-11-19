// Conversations and messages against the enplace server, plus the live connection. The chat screens use these when
// EXPO_PUBLIC_API_URL is set. A message is sent with a `clientId`, so sending it again after a bad connection is safe.
import type {
  Blocked,
  ChatEvent,
  Conversation,
  CreateConversationRequest,
  Message,
  MessagePage,
  Page,
  SendMessageRequest,
  ToggleResponse,
} from '@shared/index';
import { api, apiUrl } from '@/lib/api';
import { ChatSocket, type ChatSocketOptions } from '@/lib/chatSocket';

export async function apiConversations(): Promise<Conversation[]> {
  const out: Conversation[] = [];
  let cursor: string | undefined;
  for (let i = 0; i < 4; i++) {
    const page = await api().get<Page<Conversation>>('/v1/conversations', { query: { limit: 50, cursor } });
    out.push(...page.items);
    if (!page.nextCursor) break;
    cursor = page.nextCursor;
  }
  return out;
}

/** Opens a chat (or returns the one that already exists between the same two people). */
export function apiStartConversation(request: CreateConversationRequest): Promise<Conversation> {
  return api().post<Conversation>('/v1/conversations', request);
}

/** The newest messages, or with `afterSeq` everything the phone missed, oldest first. */
export function apiMessages(conversationId: string, opts: { afterSeq?: number; beforeSeq?: number; limit?: number } = {}): Promise<MessagePage> {
  return api().get<MessagePage>(`/v1/conversations/${conversationId}/messages`, { query: opts });
}

/** Everything after `seq`, following pages until the server says there is no more. */
export async function apiMessagesAfter(conversationId: string, seq: number): Promise<Message[]> {
  const out: Message[] = [];
  let after = seq;
  for (let i = 0; i < 20; i++) {
    const page = await apiMessages(conversationId, { afterSeq: after, limit: 100 });
    out.push(...page.items);
    const last = page.items.at(-1);
    if (!page.hasMore || !last) break;
    after = last.seq;
  }
  return out;
}

export function apiSendMessage(conversationId: string, message: SendMessageRequest): Promise<Message> {
  return api().post<Message>(`/v1/conversations/${conversationId}/messages`, message);
}

export async function apiDeleteMessage(conversationId: string, messageId: string): Promise<void> {
  await api().delete(`/v1/conversations/${conversationId}/messages/${messageId}`);
}

export async function apiMarkRead(conversationId: string, seq: number): Promise<void> {
  await api().post(`/v1/conversations/${conversationId}/read`, { seq });
}

export async function apiMarkDelivered(conversationId: string, seq: number): Promise<void> {
  await api().post(`/v1/conversations/${conversationId}/delivered`, { seq });
}

export async function apiSetReaction(conversationId: string, messageId: string, emoji: string, on: boolean): Promise<ToggleResponse> {
  const path = `/v1/conversations/${conversationId}/messages/${messageId}/reactions/${encodeURIComponent(emoji)}`;
  return on ? api().put<ToggleResponse>(path) : api().delete<ToggleResponse>(path);
}

export async function apiMute(conversationId: string, muted: boolean): Promise<void> {
  await api().put(`/v1/conversations/${conversationId}/mute`, { muted });
}

export async function apiBlocked(): Promise<Blocked[]> {
  return (await api().get<{ items: Blocked[] }>('/v1/me/blocks')).items;
}

export async function apiSetBlocked(userId: string, blocked: boolean): Promise<void> {
  if (blocked) await api().put(`/v1/me/blocks/${userId}`);
  else await api().delete(`/v1/me/blocks/${userId}`);
}

/** The server's live address: the same host, ws or wss. */
export const liveUrl = (): string => `${apiUrl().replace(/^http/i, 'ws').replace(/\/$/, '')}/v1/ws`;

/** A live connection using the app's sign-in. Call `start()` after sign-in and `stop()` on sign-out. */
export function createChatSocket(handlers: Pick<ChatSocketOptions, 'onEvent' | 'onTyping' | 'onPresence' | 'onResync' | 'onState'> & { createSocket?: ChatSocketOptions['createSocket'] }): ChatSocket {
  return new ChatSocket({ url: liveUrl(), getToken: () => api().accessToken(), ...handlers });
}

export type { ChatEvent };
