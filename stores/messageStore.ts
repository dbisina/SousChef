import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { messageService } from '@/services/messageService';
import type { OutgoingMessage } from '@/services/messageService';
import type { Conversation, ConversationKind, Message } from '@/types/social';

export type ConversationFilter = 'all' | 'friends' | 'groups' | 'orders';

interface MessageState {
  conversations: Conversation[];
  messages: Message[];

  sendMessage: (conversationId: string, msg: OutgoingMessage) => Message | null;
  markRead: (conversationId: string) => void;
  /** Open (or create) a 1:1 conversation with an author. Returns its id. */
  startConversation: (authorId: string, title: string) => string;
  resetSample: () => void;
}

export const useMessageStore = create<MessageState>()(
  persist(
    (set, get) => ({
      ...messageService.seed(),

      sendMessage: (conversationId, msg) => {
        if (msg.kind === 'text' && !msg.text.trim()) return null;
        const message = messageService.buildMessage(conversationId, msg);
        set((s) => ({
          messages: [...s.messages, message],
          conversations: s.conversations.map((c) =>
            c.id === conversationId
              ? { ...c, lastPreview: messageService.previewFor(message), lastAt: message.createdAt }
              : c,
          ),
        }));
        return message;
      },
      markRead: (conversationId) =>
        set((s) => ({
          conversations: s.conversations.map((c) => (c.id === conversationId ? { ...c, unread: 0 } : c)),
        })),
      startConversation: (authorId, title) => {
        const existing = get().conversations.find((c) => c.kind === 'friend' && c.participantIds[0] === authorId);
        if (existing) return existing.id;
        const id = `conv-${authorId}-${Date.now().toString(36)}`;
        const conv: Conversation = {
          id,
          kind: 'friend',
          title,
          participantIds: [authorId],
          lastPreview: '',
          lastAt: new Date().toISOString(),
          unread: 0,
        };
        set((s) => ({ conversations: [conv, ...s.conversations] }));
        return id;
      },
      resetSample: () => set({ ...messageService.seed() }),
    }),
    { name: 'souschef-messages-v1', storage: createJSONStorage(() => AsyncStorage), version: 1 },
  ),
);

const KIND_FOR_FILTER: Record<Exclude<ConversationFilter, 'all'>, ConversationKind[]> = {
  friends: ['friend'],
  groups: ['group', 'community'],
  orders: ['order'],
};

/** Newest first, optionally filtered by chip and search text. */
export function filterConversations(
  conversations: Conversation[],
  filter: ConversationFilter = 'all',
  query = '',
): Conversation[] {
  const q = query.trim().toLowerCase();
  return conversations
    .filter((c) => filter === 'all' || KIND_FOR_FILTER[filter].includes(c.kind))
    .filter((c) => !q || c.title.toLowerCase().includes(q) || c.lastPreview.toLowerCase().includes(q))
    .sort((a, b) => b.lastAt.localeCompare(a.lastAt));
}

/** Oldest first. */
export const messagesFor = (messages: Message[], conversationId: string): Message[] =>
  messages
    .filter((m) => m.conversationId === conversationId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

export const selectUnreadTotal = (s: MessageState) => s.conversations.reduce((n, c) => n + c.unread, 0);
