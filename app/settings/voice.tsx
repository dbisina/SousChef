import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useVoiceStore } from '@/stores/voiceStore';
import { SAMPLE } from '@/assets/sample';
import {
  FONT,
  Muted,
  PhotoCard,
  Rows,
  Screen,
  SectionLabel,
  Tag,
  TopBar,
  USwitch,
} from '@/components/ui';

export default function VoiceSettingsScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { voiceEnabled, isWakeWordMode, setVoiceEnabled, setWakeWordMode } = useVoiceStore();

  const quote = (s: string) => `“${s}”`;

  return (
    <Screen bare>
      <TopBar variant="compact" title={t('account.voice.title', 'Voice Commands')} onBack={() => router.back()} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40, gap: 14 }}>
        <PhotoCard
          source={SAMPLE.chef}
          height={190}
          topLeft={<Tag tone="glassDark" large icon="mic" label={t('account.voice.handsFree', 'Hands-free')} />}
          topRight={
            <USwitch
              label={t('account.voice.control', 'Voice control')}
              value={voiceEnabled}
              onValueChange={setVoiceEnabled}
            />
          }
          title={t('account.voice.hero', 'Cook without touching the screen')}
          titleSize={20}
        />

        <Rows>
          <View className="flex-row items-center" style={{ minHeight: 64, gap: 14, opacity: voiceEnabled ? 1 : 0.5 }}>
            <View className="flex-1" style={{ gap: 2 }}>
              <Text className="text-ink" style={{ fontFamily: FONT.display, fontSize: 15 }}>
                {t('account.voice.wakeWord', 'Wake word')}
              </Text>
              <Muted small>{t('account.voice.wakeWordBody', 'Say “Hey Chef” to start listening')}</Muted>
            </View>
            <USwitch
              label={t('account.voice.wakeWordMode', 'Wake word mode')}
              value={isWakeWordMode}
              onValueChange={setWakeWordMode}
              disabled={!voiceEnabled}
            />
          </View>
        </Rows>

        <SectionLabel>{t('account.voice.commands', 'Commands')}</SectionLabel>
        <Rows>
          <CommandRow command={quote(t('account.voice.cmdNext', 'Next'))} description={t('account.voice.cmdNextBody', 'Go to the next step')} />
          <CommandRow command={quote(t('account.voice.cmdBack', 'Back'))} description={t('account.voice.cmdBackBody', 'Go back one step')} />
          <CommandRow command={quote(t('account.voice.cmdTimer', 'Timer'))} description={t('account.voice.cmdTimerBody', 'Start a cooking timer')} />
          <CommandRow command={quote(t('account.voice.cmdRead', 'Read'))} description={t('account.voice.cmdReadBody', 'Read the step aloud')} />
        </Rows>
      </ScrollView>
    </Screen>
  );
}

const CommandRow: React.FC<{ command: string; description: string }> = ({ command, description }) => (
  <View className="flex-row items-center" style={{ minHeight: 64, gap: 14 }}>
    <Text className="text-ink" style={{ width: 110, fontFamily: FONT.display, fontSize: 15 }}>
      {command}
    </Text>
    <View className="flex-1">
      <Muted>{description}</Muted>
    </View>
  </View>
);
