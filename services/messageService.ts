import { buildConversations, buildMessages } from '@/data/sample/messages';
import { ME_ID } from '@/types/social';
import type { Conversation, Message, PhotoRef, ReplyRef } from '@/types/social';

export interface MessageSnapshot {
  conversations: Conversation[];
  messages: Message[];
}

export type OutgoingMessage = (
  | { kind: 'text'; text: string }
  | { kind: 'recipe-card'; title: string; photo: PhotoRef; meta: string; recipeId?: string }
  | { kind: 'voice'; durationSec: number; waveform: number[]; uri?: string }
) & { replyTo?: ReplyRef };

/**
 * How a message reaches the server. The screen never waits on this: a message is on screen as "sending"
 * the moment it is written, and the transport only moves it to "sent" (or "failed").
 * The local transport below stands in until the WebSocket client exists; it will implement the same interface.
 */
export interface MessageTransport {
  /** Resolves when the server has stored the message; rejects if it could not be delivered. */
  send(message: Message): Promise<void>;
}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export const localTransport: MessageTransport = {
  async send() {
    await wait(350);
  },
};

export interface MessageService {
  seed(now?: Date): MessageSnapshot;
  fetchSnapshot(now?: Date): Promise<MessageSnapshot>;
  buildMessage(conversationId: string, msg: OutgoingMessage, now?: Date): Message;
  /** Short text for the conversation list row. */
  previewFor(msg: Message): string;
}

let counter = 0;

export const localMessageService: MessageService = {
  seed(now = new Date()) {
    return { conversations: buildConversations(now), messages: buildMessages(now) };
  },
  async fetchSnapshot(now) {
    return this.seed(now);
  },
  buildMessage(conversationId, msg, now = new Date()) {
    const base = {
      id: `m-${now.getTime().toString(36)}-${(counter++).toString(36)}`,
      conversationId,
      senderId: ME_ID,
      createdAt: now.toISOString(),
      status: 'sending' as const,
      ...(msg.replyTo ? { replyTo: msg.replyTo } : {}),
    };
    if (msg.kind === 'text') return { ...base, kind: 'text', text: msg.text.trim() };
    if (msg.kind === 'recipe-card') {
      const { replyTo: _r, ...rest } = msg;
      return { ...base, ...rest };
    }
    const { replyTo: _v, ...rest } = msg;
    return { ...base, ...rest };
  },
  previewFor(msg) {
    if (msg.kind === 'text') return msg.text;
    if (msg.kind === 'recipe-card') return 'Sent a recipe';
    const m = Math.floor(msg.durationSec / 60);
    const s = `${msg.durationSec % 60}`.padStart(2, '0');
    return `Voice message · ${m}:${s}`;
  },
};

export const messageService: MessageService = localMessageService;
