import React, { useEffect, useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text as RNText, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Bubble, Muted, Screen, Title, UIconButton, useTokens } from '@/components/ui';
import { FONT } from '@/components/ui/fonts';
import { ConversationAvatar, authorById } from '@/components/chat/ConversationAvatar';
import { RecipeCardBubble, VoiceBubble } from '@/components/chat/MessageBubbles';
import { messagesFor, useMessageStore } from '@/stores/messageStore';
import { ME_ID, type Message } from '@/types/social';

const dayKey = (iso: string) => new Date(iso).toDateString();

const clock = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true });

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const tokens = useTokens();
  const scroller = useRef<ScrollView>(null);

  const conversation = useMessageStore((s) => s.conversations.find((c) => c.id === id));
  const allMessages = useMessageStore((s) => s.messages);
  const sendMessage = useMessageStore((s) => s.sendMessage);
  const markRead = useMessageStore((s) => s.markRead);
  const [draft, setDraft] = useState('');

  const thread = useMemo(() => messagesFor(allMessages, id ?? ''), [allMessages, id]);
  const unread = conversation?.unread ?? 0;

  useEffect(() => {
    if (id && unread > 0) markRead(id);
  }, [id, unread, markRead]);

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/messages'));

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

  const send = () => {
    if (!draft.trim()) return;
    sendMessage(conversation.id, { kind: 'text', text: draft });
    setDraft('');
    requestAnimationFrame(() => scroller.current?.scrollToEnd({ animated: true }));
  };

  const tickFor = (m: Message): string | undefined => {
    if (m.senderId !== ME_ID || !m.status) return undefined;
    if (m.status === 'read') return t('chat.read', 'Read {{time}}', { time: clock(m.createdAt) });
    return m.status === 'delivered' ? t('chat.delivered', 'Delivered') : t('chat.sent', 'Sent');
  };

  const renderMessage = (m: Message) => {
    const side = m.senderId === ME_ID ? 'me' : 'them';
    if (m.kind === 'text') {
      return (
        <Bubble key={m.id} side={side} tick={tickFor(m)}>
          {m.text}
        </Bubble>
      );
    }
    if (m.kind === 'recipe-card') {
      const open = () =>
        m.recipeId ? router.push({ pathname: '/recipe/[id]', params: { id: m.recipeId } }) : undefined;
      return (
        <RecipeCardBubble
          key={m.id}
          message={m}
          side={side}
          onCook={open}
          onAddToPlan={() => router.push('/(tabs)/mealplan')}
        />
      );
    }
    return <VoiceBubble key={m.id} message={m} side={side} />;
  };

  let lastDay = '';
  const items: React.ReactNode[] = [];
  for (const m of thread) {
    const d = dayKey(m.createdAt);
    if (d !== lastDay) {
      lastDay = d;
      const today = d === new Date().toDateString();
      items.push(
        <Muted key={`day-${d}`} small center>
          {today
            ? t('chat.today', 'Today')
            : new Date(m.createdAt).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
        </Muted>,
      );
    }
    items.push(renderMessage(m));
  }

  return (
    <Screen bare>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View
          className="flex-row items-center justify-between border-b border-divider"
          style={{ paddingTop: Math.max(insets.top, 20) + 14, paddingBottom: 12, paddingHorizontal: 20, gap: 10 }}
        >
          <View className="flex-row items-center flex-1" style={{ gap: 10, minWidth: 0 }}>
            <View style={{ marginLeft: -8 }}>
              <UIconButton icon="back" label={t('chat.back', 'Back')} onPress={goBack} size={44} tone="default" />
            </View>
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
          <UIconButton icon="camera" label={t('chat.videoCall', 'Video call')} disabled />
        </View>

        <ScrollView
          ref={scroller}
          className="flex-1"
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 14, paddingBottom: 16, gap: 8 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => scroller.current?.scrollToEnd({ animated: false })}
        >
          {items.length ? items : <Muted center>{t('chat.noMessages', 'No messages yet. Say hello.')}</Muted>}
        </ScrollView>

        <View
          className="flex-row items-center"
          style={{ paddingHorizontal: 12, paddingTop: 8, paddingBottom: Math.max(insets.bottom, 30), gap: 8 }}
        >
          <UIconButton icon="plus" label={t('chat.attach', 'Attach')} disabled />
          <View className="flex-1 bg-surface-2 justify-center" style={{ height: 48, borderRadius: 24, paddingHorizontal: 18 }}>
            <TextInput
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
          {draft.trim() ? (
            <UIconButton tone="black" icon="send" label={t('chat.send', 'Send')} onPress={send} />
          ) : (
            <UIconButton tone="black" icon="mic" label={t('chat.record', 'Record voice note')} disabled />
          )}
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
