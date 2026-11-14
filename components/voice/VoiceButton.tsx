import React, { useEffect, useRef } from 'react';
import { Pressable, View, Text, Animated } from 'react-native';
import { useTranslation } from 'react-i18next';
import { VoiceListeningState } from '@/types/voice';
import { Icon, useTokens, FONT } from '@/components/ui';
import type { IconName } from '@/components/ui';

interface VoiceButtonProps {
  isListening: boolean;
  isSpeaking: boolean;
  isProcessing: boolean;
  state: VoiceListeningState;
  onPress: () => void;
  disabled?: boolean;
  size?: 'small' | 'medium' | 'large';
  showLabel?: boolean;
}

// Orange mic, pulsing rings while listening (Voice.html .ring stack)
export const VoiceButton: React.FC<VoiceButtonProps> = ({
  isListening,
  isSpeaking,
  isProcessing,
  onPress,
  disabled = false,
  size = 'medium',
  showLabel = true,
}) => {
  const { t } = useTranslation();
  const tokens = useTokens();
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  // Pulse animation when listening
  useEffect(() => {
    if (!isListening) {
      pulseAnim.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.12, duration: 700, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [isListening, pulseAnim]);

  // Rotate animation when processing
  useEffect(() => {
    if (!isProcessing) {
      rotateAnim.setValue(0);
      return;
    }
    const loop = Animated.loop(Animated.timing(rotateAnim, { toValue: 1, duration: 1000, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [isProcessing, rotateAnim]);

  const spin = rotateAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  // button = core circle; mid/outer = halo rings (design: 104 / 164 / 220)
  const sizeConfig = {
    small: { button: 44, icon: 20, mid: 52, outer: 52 },
    medium: { button: 56, icon: 24, mid: 72, outer: 88 },
    large: { button: 104, icon: 28, mid: 164, outer: 220 },
  } as const;
  const config = sizeConfig[size];

  const icon: IconName = isProcessing ? 'refresh' : isSpeaking ? 'chat' : 'mic';
  const bg = disabled ? tokens.track : tokens.accent;
  const fg = disabled ? tokens.muted : tokens['accent-ink'];

  const label = isListening
    ? t('cooking.listening', 'Listening')
    : isProcessing
    ? t('cooking.processing', 'Processing...')
    : isSpeaking
    ? t('cooking.speaking', 'Speaking...')
    : t('cooking.tapToSpeak', 'Tap to speak');

  const halo = size !== 'small' && !disabled;

  return (
    <View className="items-center" style={{ gap: 8 }}>
      <View style={{ width: config.outer, height: config.outer, alignItems: 'center', justifyContent: 'center' }}>
        {halo ? (
          <Animated.View
            pointerEvents="none"
            style={{
              position: 'absolute',
              width: config.outer,
              height: config.outer,
              borderRadius: config.outer / 2,
              backgroundColor: tokens.accent,
              opacity: 0.1,
              transform: [{ scale: isListening ? pulseAnim : 1 }],
            }}
          />
        ) : null}
        {halo ? (
          <Animated.View
            pointerEvents="none"
            style={{
              position: 'absolute',
              width: config.mid,
              height: config.mid,
              borderRadius: config.mid / 2,
              backgroundColor: tokens.accent,
              opacity: 0.2,
              transform: [{ scale: isListening ? pulseAnim : 1 }],
            }}
          />
        ) : null}
        <Pressable
          onPress={onPress}
          disabled={disabled || isProcessing}
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityState={{ disabled: disabled || isProcessing, busy: isProcessing }}
          hitSlop={size === 'small' ? 4 : 0}
          style={({ pressed }) => ({
            width: config.button,
            height: config.button,
            borderRadius: config.button / 2,
            backgroundColor: bg,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <Animated.View style={isProcessing ? { transform: [{ rotate: spin }] } : undefined}>
            <Icon name={icon} size={config.icon} color={fg} />
          </Animated.View>
        </Pressable>
      </View>

      {showLabel ? (
        <Text className="text-muted" style={{ fontFamily: FONT.sans, fontSize: 12 }}>
          {label}
        </Text>
      ) : null}
    </View>
  );
};
