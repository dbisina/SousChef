import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { messageService } from '@/services/messageService';
import { apiEnabled } from '@/lib/api';
import type { OutgoingMessage } from '@/services/messageService';
import type { Conversation, ConversationKind, Message } from '@/types/social';
import type { ChatEvent, SendMessageRequest } from '../shared/index';
import type { ChatSocket } from '@/lib/chatSocket';
import { currentUserId } from '@/lib/session';
import { uploadFile } from '@/lib/upload';
import {
  apiConversations,
  apiMarkDelivered,
  apiMarkRead,
  apiMessages,
  apiMessagesAfter,
  apiSendMessage,
  apiStartConversation,
  createChatSocket,
} from '@/services/chatApi';
import { toAuthor } from '@/services/feedServer';
import { toConversation, toMessage } from '@/services/chatServer';
import { useSocialStore } from '@/stores/socialStore';
import { ME_ID } from '@/types/social';

/* Server mode bookkeeping that is not part of what the screens read. */
const seqOf = new Map<string, number>(); // message id -> its number in the conversation
const lastSeq = new Map<string, number>(); // conversation id -> newest number we have
const pendingByClientId = new Map<string, string>(); // the phone's own id for a message -> the id shown while it sends
let live: ChatSocket | null = null;

const remember = (m: { id: string; conversationId: string; seq: number }) => {
  seqOf.set(m.id, m.seq);
  lastSeq.set(m.conversationId, Math.max(lastSeq.get(m.conversationId) ?? 0, m.seq));
};

export type ConversationFilter = 'all' | 'friends' | 'groups' | 'orders';

interface MessageState {
  conversations: Conversation[];
  messages: Message[];

  sendMessage: (conversationId: string, msg: OutgoingMessage) => Message | null;
  markRead: (conversationId: string) => void;
  /** Open (or create) a 1:1 conversation with an author. Returns its id. */
  startConversation: (authorId: string, title: string) => string;
  resetSample: () => void;
  /** Server mode: loads conversations and recent messages, and opens the live connection. */
  loadFromServer: () => Promise<void>;
  /** Server mode: ends the live connection (sign-out). */
  stopLive: () => void;
  /** Server mode: opens (or finds) the chat with a person, returning its id once the server has it. */
  startConversationOnServer: (authorId: string) => Promise<string | null>;
}

export const useMessageStore = create<MessageState>()(
  persist(
    (set, get) => ({
      ...(apiEnabled() ? { conversations: [], messages: [] } : messageService.seed()),

      sendMessage: (conversationId, msg) => {
        if (msg.kind === 'text' && !msg.text.trim()) return null;
        if (apiEnabled() && msg.kind === 'voice' && !msg.uri) return null; // nothing recorded to send
        const message = messageService.buildMessage(conversationId, msg);
        if (apiEnabled()) {
          const meId = currentUserId() ?? '';
          pendingByClientId.set(message.id, message.id);
          const request = async (): Promise<SendMessageRequest> => {
            const clientId = message.id;
            if (msg.kind === 'text') return { clientId, kind: 'text', text: msg.text.trim() };
            if (msg.kind === 'recipe-card') {
              return { clientId, kind: 'recipe-card', ...(msg.recipeId ? { recipeId: msg.recipeId } : {}), title: msg.title, ...(/^https?:/i.test(msg.photo) ? { photoUrl: msg.photo } : {}), meta: msg.meta };
            }
            const file = await uploadFile(msg.uri as string, 'voice');
            return { clientId, kind: 'voice', uploadId: file.id, durationSec: msg.durationSec, waveform: msg.waveform };
          };
          request()
            .then((body) => apiSendMessage(conversationId, body))
            .then((saved) => {
              remember(saved);
              pendingByClientId.delete(message.id);
              set((s) => ({ messages: s.messages.map((m) => (m.id === message.id ? toMessage(saved, meId) : m)) }));
            })
            .catch(() => {
              // Not sent: take it back off the screen rather than pretend.
              pendingByClientId.delete(message.id);
              set((s) => ({ messages: s.messages.filter((m) => m.id !== message.id) }));
            });
        }
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
      markRead: (conversationId) => {
        const seq = lastSeq.get(conversationId);
        if (apiEnabled() && seq) apiMarkRead(conversationId, seq).catch(() => undefined);
        set((s) => ({
          conversations: s.conversations.map((c) => (c.id === conversationId ? { ...c, unread: 0 } : c)),
        }));
      },
      startConversationOnServer: async (authorId) => {
        try {
          const meId = currentUserId() ?? '';
          const created = await apiStartConversation({ kind: 'direct', userId: authorId });
          useSocialStore.getState().mergeAuthors(created.members.map((m) => toAuthor(m, meId)));
          const mapped = toConversation(created, meId, live?.onlineIds);
          set((s) => ({ conversations: s.conversations.some((c) => c.id === mapped.id) ? s.conversations : [mapped, ...s.conversations] }));
          return created.id;
        } catch {
          return null;
        }
      },
      stopLive: () => {
        live?.stop();
        live = null;
        seqOf.clear();
        lastSeq.clear();
        pendingByClientId.clear();
        set({ conversations: [], messages: [] });
      },
      loadFromServer: async () => {
        const meId = currentUserId();
        if (!apiEnabled() || !meId) return;
        try {
          const convs = await apiConversations();
          useSocialStore.getState().mergeAuthors(convs.flatMap((c) => c.members.map((m) => toAuthor(m, meId))));
          const online = live?.onlineIds;
          // The newest messages of the busiest conversations; the rest load when opened.
          const pages = await Promise.all(convs.slice(0, 20).map((c) => apiMessages(c.id, { limit: 30 }).catch(() => ({ items: [], hasMore: false }))));
          const items = pages.flatMap((p) => p.items);
          items.forEach(remember);
          for (const c of convs) lastSeq.set(c.id, Math.max(lastSeq.get(c.id) ?? 0, c.lastSeq));
          set({ conversations: convs.map((c) => toConversation(c, meId, online)), messages: items.map((m) => toMessage(m, meId)) });
        } catch {
          // Offline: what is on the phone stays.
        }
        if (!live) {
          live = createChatSocket({
            onEvent: (event) => handleEvent(event, set, get),
            onPresence: (userId, online) =>
              set((s) => ({ conversations: s.conversations.map((c) => (c.kind === 'friend' && c.participantIds[0] === userId ? { ...c, online } : c)) })),
            // After a reconnect: ask for what was missed in every conversation we know.
            onResync: () => void catchUp(set, get),
          });
          live.start();
        }
      },
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
    { name: apiEnabled() ? 'souschef-messages-server-v1' : 'souschef-messages-v1', storage: createJSONStorage(() => AsyncStorage), version: 1 },
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

type SetFn = (fn: (s: { conversations: Conversation[]; messages: Message[] }) => Partial<{ conversations: Conversation[]; messages: Message[] }>) => void;
type GetFn = () => { conversations: Conversation[]; messages: Message[]; loadFromServer: () => Promise<void> };

/** Something happened on the server; bring the screens up to date. */
function handleEvent(event: ChatEvent, set: SetFn, get: GetFn): void {
  const meId = currentUserId();
  if (!meId) return;
  switch (event.type) {
    case 'message.new': {
      const m = event.message;
      remember(m);
      const shown = toMessage(m, meId);
      const mine = m.sender.id === meId;
      const pending = pendingByClientId.get(m.clientId);
      if (pending) pendingByClientId.delete(m.clientId);
      set((s) => {
        if (s.messages.some((x) => x.id === m.id)) return {};
        const replaced = pending ? s.messages.map((x) => (x.id === pending ? shown : x)) : [...s.messages, shown];
        const known = s.conversations.some((c) => c.id === m.conversationId);
        return {
          messages: replaced,
          conversations: s.conversations.map((c) =>
            c.id === m.conversationId ? { ...c, lastPreview: previewOf(shown), lastAt: m.createdAt, unread: mine ? c.unread : c.unread + 1 } : c,
          ),
          ...(known ? {} : {}),
        };
      });
      if (!get().conversations.some((c) => c.id === m.conversationId)) void get().loadFromServer(); // a chat we have not seen yet
      if (!mine) live?.ack(m.conversationId, m.seq);
      return;
    }
    case 'message.deleted':
      set((s) => ({ messages: s.messages.map((m) => (m.id === event.messageId ? ({ ...m, kind: 'text', text: '' } as Message) : m)) }));
      return;
    case 'receipt': {
      // The other person has got (or read) our messages up to a number.
      const level = event.read !== undefined ? ('read' as const) : ('delivered' as const);
      const upTo = event.read ?? event.delivered ?? 0;
      set((s) => ({
        messages: s.messages.map((m) =>
          m.conversationId === event.conversationId && m.senderId === ME_ID && (seqOf.get(m.id) ?? Infinity) <= upTo && m.status !== 'read' ? { ...m, status: level } : m,
        ),
      }));
      return;
    }
    case 'conversation.updated':
      void get().loadFromServer();
      return;
    default:
      return; // reactions and game updates are not shown in the chat screens
  }
}

const previewOf = (m: Message): string => messageService.previewFor(m);

/** After a reconnect: ask for everything missed in each conversation, and apply it like live events. */
async function catchUp(set: SetFn, get: GetFn): Promise<void> {
  const meId = currentUserId();
  if (!meId) return;
  for (const c of get().conversations.slice(0, 20)) {
    try {
      const missed = await apiMessagesAfter(c.id, lastSeq.get(c.id) ?? 0);
      for (const m of missed) handleEvent({ type: 'message.new', message: m }, set, get);
      const last = missed.at(-1);
      if (last) apiMarkDelivered(c.id, last.seq).catch(() => undefined);
    } catch {
      // Try again at the next reconnect.
    }
  }
}

export const selectUnreadTotal = (s: MessageState) => s.conversations.reduce((n, c) => n + c.unread, 0);
