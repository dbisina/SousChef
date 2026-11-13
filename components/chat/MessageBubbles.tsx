import React from 'react';
import { Pressable, Text as RNText, View } from 'react-native';
import { FONT } from '@/components/ui/fonts';
import { useTranslation } from 'react-i18next';
import { SAMPLE } from '@/assets/sample';
import { BarChart, Icon, Muted, PhotoCard, Tag, Title } from '@/components/ui';
import type { RecipeCardMessage, VoiceMessage } from '@/types/social';

export const formatDuration = (sec: number): string => `${Math.floor(sec / 60)}:${`${sec % 60}`.padStart(2, '0')}`;

interface RecipeProps {
  message: RecipeCardMessage;
  side: 'me' | 'them';
  onCook: () => void;
  onAddToPlan: () => void;
}

/** Shared recipe card inside a chat (Chat.html a.card): photo, title, meta, Cook this / Add to plan. */
export function RecipeCardBubble({ message, side, onCook, onAddToPlan }: RecipeProps) {
  const { t } = useTranslation();
  return (
    <View
      className="bg-surface"
      style={{ padding: 8, borderRadius: 24, width: 250, alignSelf: side === 'me' ? 'flex-end' : 'flex-start' }}
    >
      <Pressable accessibilityRole="button" accessibilityLabel={message.title} onPress={onCook}>
        <PhotoCard source={SAMPLE[message.photo]} height={130} radius={18} fade="none" />
        <View style={{ paddingTop: 10, paddingHorizontal: 6, paddingBottom: 4, gap: 2 }}>
          <Title numberOfLines={2}>{message.title}</Title>
          <Muted small>{message.meta}</Muted>
        </View>
      </Pressable>
      <View className="flex-row" style={{ gap: 6, paddingTop: 6, paddingHorizontal: 4, paddingBottom: 4 }}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('chat.cookThis', 'Cook this')} onPress={onCook} hitSlop={8}>
          <Tag tone="k" label={t('chat.cookThis', 'Cook this')} />
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={t('chat.addToPlan', 'Add to plan')} onPress={onAddToPlan} hitSlop={8}>
          <Tag label={t('chat.addToPlan', 'Add to plan')} />
        </Pressable>
      </View>
    </View>
  );
}

/** Voice note bubble (Chat.html .bub with play + .vbar). Playback is not wired in the preview. */
export function VoiceBubble({ message, side }: { message: VoiceMessage; side: 'me' | 'them' }) {
  const { t } = useTranslation();
  const me = side === 'me';
  const dur = formatDuration(message.durationSec);
  return (
    <View
      accessible
      accessibilityLabel={t('chat.voiceMessage', 'Voice message, {{duration}}', { duration: dur })}
      className={`flex-row items-center ${me ? 'bg-ink' : 'bg-surface-3'}`}
      style={{
        alignSelf: me ? 'flex-end' : 'flex-start',
        width: 230,
        gap: 10,
        paddingVertical: 10,
        paddingHorizontal: 14,
        borderRadius: 22,
        borderBottomRightRadius: me ? 6 : 22,
        borderBottomLeftRadius: me ? 22 : 6,
      }}
    >
      <View className="items-center justify-center bg-paper" style={{ width: 32, height: 32, borderRadius: 16 }}>
        <Icon name="play" size="sm" color="night" filled />
      </View>
      <View className="flex-1">
        <BarChart height={26} data={message.waveform.slice(0, 14).map((h) => ({ value: h / 100, tone: me ? 'dim' : 'default' }))} />
      </View>
      <RNText className={me ? 'text-ink-inverse' : 'text-muted'} style={{ fontFamily: FONT.sans, fontSize: 12 }}>
        {dur}
      </RNText>
    </View>
  );
}
