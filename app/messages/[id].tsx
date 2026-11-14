import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Text as RNText, TextInput, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown, ZoomIn, ZoomOut } from 'react-native-reanimated';
import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Pressable } from '@/components/ui/Pressable';
import { Bubble, Icon, Muted, Screen, Title, UIconButton, useTokens } from '@/components/ui';
import { FONT } from '@/components/ui/fonts';
import { ConversationAvatar, authorById } from '@/components/chat/ConversationAvatar';
import { MessageActions, type Anchor } from '@/components/chat/MessageActions';
import { MessageFrame } from '@/components/chat/MessageFrame';
import { RecipeCardBubble, VoiceBubble } from '@/components/chat/MessageBubbles';
import { replyPreview, toReplyRef } from '@/lib/chatLogic';
import { feedback, preloadSounds } from '@/lib/feedback';
import { messagesFor, useMessageStore } from '@/stores/messageStore';
import { useToastStore } from '@/stores/toastStore';
import { ME_ID, type Message } from '@/types/social';

const dayKey = (iso: string) => new Date(iso).toDateString();

const clock = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true });

type Item = { type: 'day'; key: string; label: string } | { type: 'msg'; key: string; message: Message };

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const tokens = useTokens();
  const listRef = useRef<FlatList<Item>>(null);
  const inputRef = useRef<TextInput>(null);
  const mountedAt = useRef(Date.now());
  const notifiedFailed = useRef(new Set<string>());

  const conversation = useMessageStore((s) => s.conversations.find((c) => c.id === id));
  const allMessages = useMessageStore((s) => s.messages);
  const showToast = useToastStore((s) => s.showToast);
  const sendMessage = useMessageStore((s) => s.sendMessage);
  const retryMessage = useMessageStore((s) => s.retryMessage);
  const reactToMessage = useMessageStore((s) => s.reactToMessage);
  const markRead = useMessageStore((s) => s.markRead);

  const [draft, setDraft] = useState('');
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [menu, setMenu] = useState<{ message: Message; anchor: Anchor } | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);

  const thread = useMemo(() => messagesFor(allMessages, id ?? ''), [allMessages, id]);
  const unread = conversation?.unread ?? 0;

  useEffect(() => {
    if (id && unread > 0) markRead(id);
  }, [id, unread, markRead]);

  useEffect(() => {
    preloadSounds();
  }, []);

  // One error tap per message that fails.
  useEffect(() => {
    for (const m of thread) {
      if (m.status === 'failed' && !notifiedFailed.current.has(m.id)) {
        notifiedFailed.current.add(m.id);
        feedback.failed();
      }
    }
  }, [thread]);

  const soon = () => showToast(t('chat.comingSoon', 'Coming soon'), { type: 'info' });
  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/messages'));

  const nameFor = useCallback(
    (senderId: string) =>
      senderId === ME_ID ? t('chat.you', 'You') : (authorById(senderId)?.displayName ?? conversation?.title ?? ''),
    [conversation?.title, t],
  );

  // Newest first, because the list is inverted (it opens on the latest message and grows upward).
  const items = useMemo<Item[]>(() => {
    const chronological: Item[] = [];
    let lastDay = '';
    for (const m of thread) {
      const d = dayKey(m.createdAt);
      if (d !== lastDay) {
        lastDay = d;
        const today = d === new Date().toDateString();
        chronological.push({
          type: 'day',
          key: `day-${d}`,
          label: today
            ? t('chat.today', 'Today')
            : new Date(m.createdAt).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }),
        });
      }
      chronological.push({ type: 'msg', key: m.id, message: m });
    }
    return chronological.reverse();
  }, [thread, t]);

  const lastMineId = useMemo(() => [...thread].reverse().find((m) => m.senderId === ME_ID)?.id, [thread]);

  const jumpTo = useCallback(
    (messageId: string) => {
      const index = items.findIndex((i) => i.type === 'msg' && i.message.id === messageId);
      if (index < 0) return;
      feedback.select();
      listRef.current?.scrollToIndex({ index, viewPosition: 0.5, animated: true });
      setHighlightId(messageId);
      setTimeout(() => setHighlightId((cur) => (cur === messageId ? null : cur)), 1500);
    },
    [items],
  );

  if (!conversation) {
    return (
      <Screen>
        <View style={{ paddingTop: Math.max(insets.top, 20) + 14, gap: 24 }}>
          <UIconButton icon="back" label={t('chat.back', 'Back')} onPress={goBack} />
          <Muted center>{t('chat.notFound', 'This conversation is not available')}</Muted>
        </View>
      </Screen>
    );
  }

  const author = authorById(conversation.participantIds[0] ?? '');
  const subtitle =
    conversation.kind === 'friend'
      ? (conversation.online ?? author?.online)
        ? t('chat.online', 'online')
        : ''
      : conversation.kind === 'order'
        ? t('chat.orderUpdates', 'Order updates')
        : t('chat.members', '{{count}} people', { count: conversation.participantIds.length + 1 });

  const hasText = draft.trim().length > 0;

  const send = () => {
    const text = draft.trim();
    if (!text) return;
    sendMessage(conversation.id, { kind: 'text', text, replyTo: replyTo ? toReplyRef(replyTo) : undefined });
    feedback.send();
    setDraft('');
    setReplyTo(null);
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
  };

  const startReply = (m: Message) => {
    setReplyTo(m);
    setTimeout(() => inputRef.current?.focus(), 60);
  };

  const tickFor = (m: Message): string | undefined => {
    if (m.senderId !== ME_ID || !m.status) return undefined;
    if (m.status === 'failed') return t('chat.failed', 'Not sent. Tap to retry');
    if (m.status === 'sending') return t('chat.sending', 'Sending');
    if (m.id !== lastMineId) return undefined;
    if (m.status === 'read') return t('chat.read', 'Read {{time}}', { time: clock(m.createdAt) });
    return m.status === 'delivered' ? t('chat.delivered', 'Delivered') : t('chat.sent', 'Sent');
  };

  const content = (m: Message, side: 'me' | 'them') => {
    if (m.kind === 'text') {
      return (
        <Bubble side={side} inFrame>
          {m.text}
        </Bubble>
      );
    }
    if (m.kind === 'recipe-card') {
      const open = () =>
        m.recipeId ? router.push({ pathname: '/recipe/[id]', params: { id: m.recipeId } }) : undefined;
      return (
        <RecipeCardBubble message={m} side={side} onCook={open} onAddToPlan={() => router.push('/(tabs)/mealplan')} />
      );
    }
    return <VoiceBubble message={m} side={side} />;
  };

  const renderItem = ({ item }: { item: Item }) => {
    if (item.type === 'day') {
      return (
        <Muted small center>
          {item.label}
        </Muted>
      );
    }
    const m = item.message;
    const side = m.senderId === ME_ID ? 'me' : 'them';
    return (
      <MessageFrame
        message={m}
        side={side}
        tick={tickFor(m)}
        failed={m.status === 'failed'}
        highlighted={highlightId === m.id}
        isNew={new Date(m.createdAt).getTime() >= mountedAt.current}
        quote={
          m.replyTo
            ? { name: nameFor(m.replyTo.senderId), preview: m.replyTo.preview, onPress: () => jumpTo(m.replyTo!.messageId) }
            : undefined
        }
        onReply={() => startReply(m)}
        onOpenMenu={(anchor) => setMenu({ message: m, anchor })}
        onToggleReaction={(emoji) => {
          feedback.react();
          reactToMessage(m.id, emoji);
        }}
        onRetry={() => retryMessage(m.id)}
      >
        {content(m, side)}
      </MessageFrame>
    );
  };

  const menuSide = menu?.message.senderId === ME_ID ? 'me' : 'them';
  const myEmoji = menu?.message.reactions?.find((r) => r.userIds.includes(ME_ID))?.emoji;

  return (
    <Screen bare>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View
          className="flex-row items-center justify-between border-b border-divider"
          style={{ paddingTop: Math.max(insets.top, 20) + 14, paddingBottom: 12, paddingHorizontal: 20, gap: 10 }}
        >
          <View className="flex-row items-center flex-1" style={{ gap: 10, minWidth: 0 }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('chat.back', 'Back')}
              onPress={goBack}
              style={{ width: 36, height: 46, alignItems: 'center', justifyContent: 'center' }}
            >
              <Icon name="back" size="md" color="ink" />
            </Pressable>
            <ConversationAvatar conversation={conversation} size={40} showPresence={false} />
            <View className="flex-1" style={{ minWidth: 0 }}>
              <Title numberOfLines={1}>{conversation.title}</Title>
              {subtitle ? (
                conversation.kind === 'friend' ? (
                  <RNText className="text-tag-g-fg" style={{ fontFamily: FONT.sans, fontSize: 12 }}>
                    {subtitle}
                  </RNText>
                ) : (
                  <Muted small>{subtitle}</Muted>
                )
              ) : null}
            </View>
          </View>
          <UIconButton icon="camera" label={t('chat.videoCall', 'Video call')} onPress={soon} />
        </View>

        <FlatList
          ref={listRef}
          data={items}
          inverted
          keyExtractor={(i) => i.key}
          renderItem={renderItem}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          ListEmptyComponent={
            <View style={{ transform: [{ scaleY: -1 }] }}>
              <Muted center>{t('chat.noMessages', 'No messages yet. Say hello.')}</Muted>
            </View>
          }
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 14 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          initialNumToRender={20}
          windowSize={9}
          onScrollToIndexFailed={({ index, averageItemLength }) => {
            listRef.current?.scrollToOffset({ offset: index * averageItemLength, animated: true });
            setTimeout(() => listRef.current?.scrollToIndex({ index, viewPosition: 0.5, animated: true }), 140);
          }}
          style={{ flex: 1 }}
        />

        {replyTo ? (
          <Animated.View
            entering={FadeInDown.duration(180)}
            exiting={FadeOutDown.duration(140)}
            style={{
              marginHorizontal: 12,
              marginTop: 4,
              paddingVertical: 8,
              paddingLeft: 16,
              paddingRight: 6,
              borderRadius: 20,
              backgroundColor: tokens['surface-2'],
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <View style={{ flex: 1, gap: 1, minWidth: 0 }}>
              <RNText numberOfLines={1} style={{ fontFamily: FONT.display, fontSize: 12, color: tokens.muted }}>
                {t('chat.replyingTo', 'Replying to {{name}}', { name: nameFor(replyTo.senderId) })}
              </RNText>
              <RNText numberOfLines={1} style={{ fontFamily: FONT.sans, fontSize: 13, color: tokens.ink }}>
                {replyPreview(replyTo)}
              </RNText>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('chat.cancelReply', 'Cancel reply')}
              onPress={() => setReplyTo(null)}
              hitSlop={8}
              style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' }}
            >
              <Icon name="close" size="sm" color="muted" />
            </Pressable>
          </Animated.View>
        ) : null}

        <View
          className="flex-row items-center"
          style={{ paddingHorizontal: 12, paddingTop: 8, paddingBottom: Math.max(insets.bottom, 30), gap: 8 }}
        >
          <UIconButton icon="plus" label={t('chat.attach', 'Attach')} onPress={soon} />
          <View className="flex-1 bg-surface-2 justify-center" style={{ height: 48, borderRadius: 24, paddingHorizontal: 18 }}>
            <TextInput
              ref={inputRef}
              accessibilityLabel={t('chat.message', 'Message')}
              placeholder={t('chat.message', 'Message')}
              placeholderTextColor={tokens.subtle}
              selectionColor={tokens.accent}
              value={draft}
              onChangeText={setDraft}
              onSubmitEditing={send}
              returnKeyType="send"
              className="text-ink"
              style={{ fontFamily: FONT.sans, fontSize: 15, height: '100%' }}
            />
          </View>
          <View style={{ width: 46, height: 46 }}>
            {hasText ? (
              <Animated.View
                key="send"
                entering={ZoomIn.duration(170)}
                exiting={ZoomOut.duration(110)}
                style={{ position: 'absolute' }}
              >
                <UIconButton tone="black" icon="send" label={t('chat.send', 'Send')} onPress={send} />
              </Animated.View>
            ) : (
              <Animated.View
                key="mic"
                entering={ZoomIn.duration(170)}
                exiting={ZoomOut.duration(110)}
                style={{ position: 'absolute' }}
              >
                <UIconButton tone="black" icon="mic" label={t('chat.record', 'Record voice note')} onPress={soon} />
              </Animated.View>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>

      <MessageActions
        visible={!!menu}
        anchor={menu?.anchor ?? null}
        side={menuSide}
        myEmoji={myEmoji}
        canCopy={menu?.message.kind === 'text'}
        onClose={() => setMenu(null)}
        onReact={(emoji) => menu && reactToMessage(menu.message.id, emoji)}
        onReply={() => menu && startReply(menu.message)}
        onCopy={() => {
          if (menu?.message.kind === 'text') {
            void Clipboard.setStringAsync(menu.message.text);
            showToast(t('chat.copied', 'Copied'), { type: 'success' });
          }
        }}
      >
        {menu ? (
          <View style={{ width: menu.anchor.width }}>{content(menu.message, menuSide)}</View>
        ) : null}
      </MessageActions>
    </Screen>
  );
}
