// Conversations and messages from the SousChef server, shaped the way the chat screens already read them.
// The signed-in person is "me" (ME_ID) in the screens, so their server id is swapped for it on the way in.
import type { Conversation as ApiConversation, Message as ApiMessage } from '../shared/index';
import { localId } from '@/services/feedServer';
import { ME_ID, type Conversation, type ConversationKind, type Message } from '@/types/social';

const KIND: Record<ApiConversation['kind'], ConversationKind> = { direct: 'friend', group: 'group', community: 'community' };

export function toConversation(c: ApiConversation, meId: string, onlineIds: ReadonlySet<string> = new Set()): Conversation {
  const others = c.members.filter((m) => m.id !== meId);
  return {
    id: c.id,
    kind: KIND[c.kind],
    title: c.title,
    participantIds: others.map((m) => m.id),
    ...(c.photoUrl ? { photo: c.photoUrl } : {}),
    lastPreview: c.lastMessage?.preview ?? '',
    lastAt: c.lastAt ?? c.createdAt,
    unread: c.unread,
    ...(c.kind === 'direct' ? { online: others.some((m) => onlineIds.has(m.id)) } : {}),
  };
}

export function toMessage(m: ApiMessage, meId: string): Message {
  const base = {
    id: m.id,
    conversationId: m.conversationId,
    senderId: localId(m.sender.id, meId),
    createdAt: m.createdAt,
    ...(m.sender.id === meId && m.status ? { status: m.status } : {}),
  };
  if (m.deleted) return { ...base, kind: 'text', text: '' };
  switch (m.kind) {
    case 'text':
      return { ...base, kind: 'text', text: m.text };
    case 'recipe-card':
      return { ...base, kind: 'recipe-card', ...(m.recipeId ? { recipeId: m.recipeId } : {}), title: m.title, photo: m.photoUrl ?? 'bowl', meta: m.meta };
    case 'voice':
      return { ...base, kind: 'voice', durationSec: m.durationSec, waveform: m.waveform, url: m.url };
    case 'image':
      // The screens have no picture bubble yet: show it as a line of text, with the caption.
      return { ...base, kind: 'text', text: m.caption ? `📷 ${m.caption}` : '📷 Photo' };
  }
}

export { ME_ID };
