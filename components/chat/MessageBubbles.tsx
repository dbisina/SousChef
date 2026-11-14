import React from 'react';
import { View } from 'react-native';
import { Pressable } from '@/components/ui/Pressable';
import { useTranslation } from 'react-i18next';
import { SAMPLE } from '@/assets/sample';
import { Muted, PhotoCard, Tag, Title } from '@/components/ui';
import { useToastStore } from '@/stores/toastStore';
import { VoicePlayer } from './VoicePlayer';
import type { RecipeCardMessage, VoiceMessage } from '@/types/social';

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

/** Voice note bubble (Chat.html .bub with play + waveform): real playback for recorded notes. */
export function VoiceBubble({ message, side }: { message: VoiceMessage; side: 'me' | 'them' }) {
  const { t } = useTranslation();
  const showToast = useToastStore((s) => s.showToast);
  const me = side === 'me';
  return (
    <View
      className={me ? 'bg-ink' : 'bg-surface-3'}
      style={{
        alignSelf: me ? 'flex-end' : 'flex-start',
        width: 240,
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 22,
        borderBottomRightRadius: me ? 6 : 22,
        borderBottomLeftRadius: me ? 22 : 6,
      }}
    >
      <VoicePlayer
        id={message.id}
        uri={message.uri}
        durationSec={message.durationSec}
        waveform={message.waveform}
        me={me}
        onNoAudio={() => showToast(t('chat.sampleVoice', 'This is a sample voice note with no audio'), { type: 'info' })}
      />
    </View>
  );
}
