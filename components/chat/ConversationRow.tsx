import React from 'react';
import { Pressable, Text as RNText, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Muted, Title, UBadge } from '@/components/ui';
import { FONT } from '@/components/ui/fonts';
import { timeAgo } from '@/lib/timeAgo';
import type { Conversation } from '@/types/social';
import { ConversationAvatar } from './ConversationAvatar';

interface Props {
  conversation: Conversation;
  onPress: () => void;
}

/** Messages list row (Messages.html .rows > a): avatar, title + preview, time + unread badge. */
export function ConversationRow({ conversation: c, onPress }: Props) {
  const { t } = useTranslation();
  const unread = c.unread > 0;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('messages.openConversation', 'Open conversation with {{name}}', { name: c.title })}
      accessibilityHint={unread ? t('messages.unreadCount', '{{count}} unread', { count: c.unread }) : undefined}
      onPress={onPress}
      style={({ pressed }) => ({ minHeight: 64, justifyContent: 'center', opacity: pressed ? 0.7 : 1 })}
    >
      <View className="flex-row items-center" style={{ gap: 14 }}>
      <ConversationAvatar conversation={c} />
      <View className="flex-1" style={{ minWidth: 0, gap: 3 }}>
        <Title numberOfLines={1}>{c.title}</Title>
        {unread ? (
          <RNText className="text-ink" numberOfLines={1} style={{ fontFamily: FONT.sansMedium, fontSize: 12, lineHeight: 17 }}>
            {c.lastPreview}
          </RNText>
        ) : (
          <Muted small numberOfLines={1}>
            {c.lastPreview}
          </Muted>
        )}
      </View>
      <View style={{ alignItems: 'flex-end', gap: 6 }}>
        <Muted small>{timeAgo(c.lastAt)}</Muted>
        {unread ? <UBadge count={c.unread} /> : null}
      </View>
      </View>
    </Pressable>
  );
}
