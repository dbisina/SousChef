import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { localTransport, messageService } from '@/services/messageService';
import type { MessageTransport, OutgoingMessage } from '@/services/messageService';
import { failStuckMessages, toggleReaction } from '@/lib/chatLogic';
import { ME_ID } from '@/types/social';
import type { Conversation, ConversationKind, Message, MessageStatus } from '@/types/social';

export type ConversationFilter = 'all' | 'friends' | 'groups' | 'orders';

interface MessageState {
  conversations: Conversation[];
  messages: Message[];

  /** Writes the message at once as "sending", then hands it to the transport. Returns the message, or null if empty. */
  sendMessage: (conversationId: string, msg: OutgoingMessage) => Message | null;
  /** Tap on a failed message. */
  retryMessage: (messageId: string) => void;
  /** Toggle (or replace) my reaction on a message. */
  reactToMessage: (messageId: string, emoji: string) => void;
  markRead: (conversationId: string) => void;
  /** Open (or create) a 1:1 conversation with an author. Returns its id. */
  startConversation: (authorId: string, title: string) => string;
  /** Messages left "sending" when the app closed can never be confirmed: mark them failed. */
  failStuck: () => void;
  resetSample: () => void;
}

let transport: MessageTransport = localTransport;
/** Swap the transport (the WebSocket client in production, a fake in tests). */
export const setMessageTransport = (t: MessageTransport) => {
  transport = t;
};

const setStatus = (messages: Message[], id: string, status: MessageStatus): Message[] =>
  messages.map((m) => (m.id === id ? { ...m, status } : m));

export const useMessageStore = create<MessageState>()(
  persist(
    (set, get) => {
      const deliver = (message: Message) => {
        transport
          .send(message)
          .then(() => {
            set((s) => ({ messages: setStatus(s.messages, message.id, 'sent') }));
            // Local simulation: the server will report delivery. Remove once the WebSocket client exists.
            setTimeout(() => {
              const current = get().messages.find((m) => m.id === message.id);
              if (current?.status === 'sent') set((s) => ({ messages: setStatus(s.messages, message.id, 'delivered') }));
            }, 800);
          })
          .catch(() => {
            set((s) => ({ messages: setStatus(s.messages, message.id, 'failed') }));
          });
      };

      return {
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
          deliver(message);
          return message;
        },
        retryMessage: (messageId) => {
          const message = get().messages.find((m) => m.id === messageId);
          if (!message || message.status !== 'failed') return;
          set((s) => ({ messages: setStatus(s.messages, messageId, 'sending') }));
          deliver({ ...message, status: 'sending' });
        },
        reactToMessage: (messageId, emoji) =>
          set((s) => ({
            messages: s.messages.map((m) =>
              m.id === messageId ? { ...m, reactions: toggleReaction(m.reactions, emoji, ME_ID) } : m,
            ),
          })),
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
        failStuck: () => set((s) => ({ messages: failStuckMessages(s.messages) })),
        resetSample: () => set({ ...messageService.seed() }),
      };
    },
    {
      name: 'souschef-messages-v1',
      storage: createJSONStorage(() => AsyncStorage),
      // v2: messages may carry status 'sending' | 'failed', replyTo and reactions. Older data stays valid as is.
      version: 2,
      migrate: (persisted) => persisted as MessageState,
      onRehydrateStorage: () => (state) => {
        state?.failStuck();
      },
    },
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
