import React, { useEffect, useRef } from 'react';
import {
  TouchableOpacity,
  View,
  Text,
  Animated,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { VoiceListeningState } from '@/types/voice';
import { useThemeColors } from '@/stores/themeStore';

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

export const VoiceButton: React.FC<VoiceButtonProps> = ({
  isListening,
  isSpeaking,
  isProcessing,
  state,
  onPress,
  disabled = false,
  size = 'medium',
  showLabel = true,
}) => {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const colors = useThemeColors();

  // Pulse animation when listening
  useEffect(() => {
    if (isListening) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isListening]);

  // Rotate animation when processing
  useEffect(() => {
    if (isProcessing) {
      Animated.loop(
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        })
      ).start();
    } else {
      rotateAnim.setValue(0);
    }
  }, [isProcessing]);

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  // Size configurations
  const sizeConfig = {
    small: { button: 40, icon: 20, ring: 48 },
    medium: { button: 56, icon: 28, ring: 68 },
    large: { button: 72, icon: 36, ring: 88 },
  };

  const config = sizeConfig[size];

  // Get icon name based on state
  const getIcon = () => {
    if (isProcessing) return 'sync';
    if (isSpeaking) return 'volume-high';
    if (isListening) return 'mic';
    return 'mic-outline';
  };

  // Get background color based on state
  const getBackgroundColor = () => {
    if (disabled) return '#D4D4D4';
    if (isListening) return colors.accent;
    if (isSpeaking) return '#22C55E';
    if (isProcessing) return '#F59E0B';
    return '#FFFFFF';
  };

  // Get icon color based on state
  const getIconColor = () => {
    if (disabled) return colors.textMuted;
    if (isListening || isSpeaking || isProcessing) return '#FFFFFF';
    return colors.accent;
  };

  // Get status text
  const getStatusText = () => {
    if (isListening) return 'Listening...';
    if (isProcessing) return 'Processing...';
    if (isSpeaking) return 'Speaking...';
    return 'Tap to speak';
  };

  return (
    <View className="items-center">
      {/* Pulse ring for listening state */}
      {isListening && (
        <Animated.View
          style={[
            styles.pulseRing,
            {
              width: config.ring,
              height: config.ring,
              borderRadius: config.ring / 2,
              transform: [{ scale: pulseAnim }],
            },
          ]}
        />
      )}

      {/* Main button */}
      <TouchableOpacity
        onPress={onPress}
        disabled={disabled || isProcessing}
        activeOpacity={0.8}
        style={[
          styles.button,
          {
            width: config.button,
            height: config.button,
            borderRadius: config.button / 2,
            backgroundColor: getBackgroundColor(),
          },
        ]}
      >
        <Animated.View
          style={
            isProcessing
              ? { transform: [{ rotate: spin }] }
              : undefined
          }
        >
          <Ionicons name={getIcon()} size={config.icon} color={getIconColor()} />
        </Animated.View>
      </TouchableOpacity>

      {/* Status label */}
      {showLabel && (
        <Text className="text-xs text-neutral-500 dark:text-neutral-400 mt-2">{getStatusText()}</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
    borderWidth: 2,
    borderColor: '#FF6B35',
  },
  pulseRing: {
    position: 'absolute',
    backgroundColor: 'rgba(255, 107, 53, 0.2)',
    borderWidth: 2,
    borderColor: 'rgba(255, 107, 53, 0.4)',
  },
});
