import React from 'react';
import { View, Text, Modal, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { VoiceListeningState, VoiceParseResult } from '@/types/voice';
import { VoiceButton } from './VoiceButton';
import { Dot, Glass, Muted, SectionLabel, Tag, ToneScope, UIconButton, USwitch, FONT } from '@/components/ui';

interface VoiceOverlayProps {
  visible: boolean;
  onClose: () => void;
  isListening: boolean;
  isSpeaking: boolean;
  isProcessing: boolean;
  state: VoiceListeningState;
  transcript: string;
  lastCommand: VoiceParseResult | null;
  error: string | null;
  onToggleListening: () => void;
  isWakeWordMode?: boolean;
  isWakeWordListening?: boolean;
  onToggleWakeWordMode?: () => void;
  /** Recipe photo shown blurred and dimmed behind the overlay (Voice.html). */
  backdrop?: string;
}

// Dark voice assistant (Voice.html): orange pulsing mic, big quoted transcript, "Try saying" chips.
export const VoiceOverlay: React.FC<VoiceOverlayProps> = ({
  visible,
  onClose,
  isListening,
  isSpeaking,
  isProcessing,
  state,
  transcript,
  lastCommand,
  error,
  onToggleListening,
  isWakeWordMode = false,
  isWakeWordListening = false,
  onToggleWakeWordMode,
  backdrop,
}) => {
  const { t } = useTranslation();

  const statusTag = isSpeaking
    ? t('cooking.speaking', 'Speaking...')
    : isProcessing
    ? t('cooking.understanding', 'Understanding...')
    : isListening
    ? t('cooking.listening', 'Listening')
    : t('cooking.voiceReady', 'Ready');

  const statusMessage = error
    ? error
    : isSpeaking
    ? t('cooking.speaking', 'Speaking...')
    : isProcessing
    ? t('cooking.understanding', 'Understanding...')
    : isListening
    ? t('cooking.listeningSpeak', 'Listening... speak now')
    : t('cooking.tapMic', 'Tap the microphone to start');

  const getCommandFeedback = () => {
    if (!lastCommand || lastCommand.command === 'unknown') return null;

    const commandLabels: Record<string, string> = {
      next_step: t('cooking.cmdNext', 'Going to next step'),
      previous_step: t('cooking.cmdBack', 'Going back'),
      read_step: t('cooking.cmdRead', 'Reading step'),
      read_ingredients: t('cooking.cmdIngredients', 'Reading ingredients'),
      set_timer: t('cooking.cmdTimer', 'Setting timer for {{minutes}} minutes', {
        minutes: lastCommand.parameters.minutes,
      }),
      current_step: t('cooking.cmdPosition', 'Announcing position'),
      substitute: t('cooking.cmdSubstitute', 'Finding substitute for {{ingredient}}', {
        ingredient: lastCommand.parameters.ingredient,
      }),
      help: t('cooking.cmdHelp', 'Listing commands'),
    };

    return commandLabels[lastCommand.command] || null;
  };

  const commandFeedback = getCommandFeedback();

  const hints = isWakeWordMode
    ? [
        t('cooking.hintWakeNext', '“SousChef next”'),
        t('cooking.hintWakeBack', '“SousChef back”'),
        t('cooking.hintWakeRead', '“SousChef read”'),
        t('cooking.hintWakeTimer', '“SousChef timer 5 minutes”'),
      ]
    : [
        t('cooking.hintNext', '“Next step”'),
        t('cooking.hintBack', '“Go back”'),
        t('cooking.hintRead', '“Read this step”'),
        t('cooking.hintTimer', '“Timer 5 minutes”'),
      ];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <ToneScope tone="dark">
        {backdrop ? (
          <View pointerEvents="none" style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]}>
            <Image
              source={{ uri: backdrop }}
              blurRadius={28}
              contentFit="cover"
              style={[StyleSheet.absoluteFill, { transform: [{ scale: 1.2 }] }]}
            />
            <View className="bg-night" style={[StyleSheet.absoluteFill, { opacity: 0.65 }]} />
          </View>
        ) : null}
        {/* Header */}
        <View
          className="flex-row items-center justify-between"
          style={{ paddingTop: 58, paddingBottom: 14, paddingHorizontal: 20 }}
        >
          <UIconButton icon="close" label={t('cooking.close', 'Close')} tone="glassDark" onPress={onClose} />
          <Tag label={statusTag} tone="glassDark" large />
          <View style={{ width: 46 }} />
        </View>

        <View className="flex-1 items-center" style={{ paddingHorizontal: 20, gap: 24 }}>
          <View style={{ marginTop: 30 }}>
            <VoiceButton
              isListening={isListening}
              isSpeaking={isSpeaking}
              isProcessing={isProcessing}
              state={state}
              onPress={onToggleListening}
              size="large"
              showLabel={false}
            />
          </View>

          {/* Transcript / status */}
          <View className="items-center" style={{ minHeight: 70, gap: 12 }}>
            {transcript ? (
              <Text
                className="text-ink text-center"
                style={{ fontFamily: FONT.display, fontSize: 26, lineHeight: 33, letterSpacing: -0.52 }}
              >
                {`“${transcript}”`}
              </Text>
            ) : (
              <Text
                className={error ? 'text-tag-r-fg text-center' : 'text-muted text-center'}
                style={{ fontFamily: FONT.display, fontSize: 20, lineHeight: 26 }}
              >
                {statusMessage}
              </Text>
            )}
            {commandFeedback ? <Tag label={commandFeedback} tone="o" large /> : null}
            {error && transcript ? (
              <Text className="text-tag-r-fg text-center" style={{ fontFamily: FONT.sans, fontSize: 13 }}>
                {error}
              </Text>
            ) : null}
          </View>

          {/* Try saying */}
          <View style={{ alignSelf: 'stretch', gap: 12, marginTop: 10 }}>
            <SectionLabel>{t('cooking.trySaying', 'Try saying')}</SectionLabel>
            <View className="flex-row flex-wrap" style={{ gap: 8 }}>
              {hints.map((hint) => (
                <Glass
                  key={hint}
                  dark
                  style={{ height: 42, borderRadius: 21, paddingHorizontal: 18, justifyContent: 'center' }}
                >
                  <Text className="text-paper" numberOfLines={1} style={{ fontFamily: FONT.sansMedium, fontSize: 13 }}>
                    {hint}
                  </Text>
                </Glass>
              ))}
            </View>
          </View>

          {/* Hands-free toggle */}
          {onToggleWakeWordMode ? (
            <View
              className="flex-row items-center bg-surface"
              style={{ alignSelf: 'stretch', borderRadius: 24, padding: 14, gap: 12 }}
            >
              <View className="flex-1" style={{ gap: 2 }}>
                <View className="flex-row items-center" style={{ gap: 8 }}>
                  <Text className="text-ink" style={{ fontFamily: FONT.display, fontSize: 15 }}>
                    {isWakeWordMode
                      ? t('cooking.handsFreeActive', 'Hands-Free Mode Active')
                      : t('cooking.handsFreeEnable', 'Enable Hands-Free Mode')}
                  </Text>
                  {isWakeWordListening ? <Dot /> : null}
                </View>
                <Muted small>
                  {isWakeWordMode
                    ? t('cooking.handsFreeListening', 'Listening for “SousChef”')
                    : t('cooking.handsFreeHint', 'Say “SousChef” to activate')}
                </Muted>
              </View>
              <USwitch
                value={isWakeWordMode}
                onValueChange={onToggleWakeWordMode}
                label={t('cooking.handsFreeEnable', 'Enable Hands-Free Mode')}
              />
            </View>
          ) : null}
        </View>

        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 40, alignItems: 'center' }}>
          <Muted small center>
            {t('cooking.sayHelp', 'Say “Help” for all commands')}
          </Muted>
        </View>
      </ToneScope>
    </Modal>
  );
};
