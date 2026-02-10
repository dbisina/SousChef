import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  Animated,
  StyleSheet,
  Dimensions,
  useColorScheme,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { VoiceListeningState, VoiceParseResult, VOICE_COMMAND_EXAMPLES } from '@/types/voice';
import { VoiceButton } from './VoiceButton';
import { useThemeColors } from '@/stores/themeStore';

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
}

const { width } = Dimensions.get('window');

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
}) => {
  const waveAnim = useRef(new Animated.Value(0)).current;
  const colors = useThemeColors();
  const colorScheme = useColorScheme();

  // Wave animation while listening
  useEffect(() => {
    if (isListening) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(waveAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(waveAnim, {
            toValue: 0,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      waveAnim.setValue(0);
    }
  }, [isListening]);

  // Get status message
  const getStatusMessage = () => {
    if (error) return error;
    if (isSpeaking) return 'Speaking...';
    if (isProcessing) return 'Understanding...';
    if (isListening) return 'Listening... speak now';
    return 'Tap the microphone to start';
  };

  // Get command feedback
  const getCommandFeedback = () => {
    if (!lastCommand || lastCommand.command === 'unknown') return null;

    const commandLabels: Record<string, string> = {
      next_step: 'Going to next step',
      previous_step: 'Going back',
      read_step: 'Reading step',
      read_ingredients: 'Reading ingredients',
      set_timer: `Setting timer for ${lastCommand.parameters.minutes} minutes`,
      current_step: 'Announcing position',
      substitute: `Finding substitute for ${lastCommand.parameters.ingredient}`,
      help: 'Listing commands',
    };

    return commandLabels[lastCommand.command] || null;
  };

  const commandFeedback = getCommandFeedback();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <BlurView intensity={80} tint={colorScheme === 'dark' ? 'dark' : 'light'} style={[styles.container, colorScheme === 'dark' && styles.containerDark]}>
        {/* Close button */}
        <TouchableOpacity
          onPress={onClose}
          className="absolute top-16 right-6 p-2"
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="close" size={28} color={colors.icon} />
        </TouchableOpacity>

        {/* Main content */}
        <View className="flex-1 items-center justify-center px-8">
          {/* Sound wave visualization */}
          {isListening && (
            <View className="flex-row items-center justify-center h-16 mb-8">
              {[...Array(5)].map((_, i) => (
                <Animated.View
                  key={i}
                  style={[
                    styles.waveLine,
                    {
                      height: 20 + i * 8,
                      opacity: waveAnim.interpolate({
                        inputRange: [0, 0.5, 1],
                        outputRange: [0.3, 1, 0.3],
                      }),
                      transform: [
                        {
                          scaleY: waveAnim.interpolate({
                            inputRange: [0, 0.5, 1],
                            outputRange: [0.5, 1.5, 0.5],
                          }),
                        },
                      ],
                    },
                  ]}
                />
              ))}
            </View>
          )}

          {/* Voice button */}
          <VoiceButton
            isListening={isListening}
            isSpeaking={isSpeaking}
            isProcessing={isProcessing}
            state={state}
            onPress={onToggleListening}
            size="large"
            showLabel={false}
          />

          {/* Transcript display */}
          <View className="mt-8 min-h-[60px] items-center">
            {transcript ? (
              <Text className="text-xl text-neutral-900 dark:text-neutral-100 text-center font-medium">
                "{transcript}"
              </Text>
            ) : (
              <Text className="text-lg text-neutral-500 dark:text-neutral-400 text-center">
                {getStatusMessage()}
              </Text>
            )}
          </View>

          {/* Command feedback */}
          {commandFeedback && (
            <View className="mt-4 bg-secondary-100 px-4 py-2 rounded-full">
              <Text className="text-secondary-700 font-medium">
                {commandFeedback}
              </Text>
            </View>
          )}

          {/* Error display */}
          {error && (
            <View className="mt-4 bg-red-100 px-4 py-2 rounded-lg">
              <Text className="text-red-600 text-center">{error}</Text>
            </View>
          )}

          {/* Command hints */}
          <View className="mt-12 w-full">
            <Text className="text-sm text-neutral-500 dark:text-neutral-400 text-center mb-3">
              Try saying:
            </Text>
            <View className="flex-row flex-wrap justify-center gap-2">
              {(isWakeWordMode
                ? ['SousChef next', 'SousChef back', 'SousChef read', 'SousChef timer 5 minutes']
                : ['Next', 'Back', 'Read this', 'Timer 5 minutes']
              ).map((hint) => (
                <View
                  key={hint}
                  className="bg-neutral-100 dark:bg-neutral-800 px-3 py-1.5 rounded-full"
                >
                  <Text className="text-neutral-600 dark:text-neutral-400 text-sm">"{hint}"</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Hands-free mode toggle */}
          {onToggleWakeWordMode && (
            <TouchableOpacity
              onPress={onToggleWakeWordMode}
              className={`mt-8 flex-row items-center px-5 py-3 rounded-xl ${
                isWakeWordMode ? 'bg-green-100' : 'bg-neutral-100 dark:bg-neutral-800'
              }`}
            >
              <Ionicons
                name={isWakeWordMode ? 'radio' : 'radio-outline'}
                size={24}
                color={isWakeWordMode ? '#22C55E' : colors.textMuted}
              />
              <View className="ml-3">
                <Text className={`font-semibold ${isWakeWordMode ? 'text-green-800' : 'text-neutral-700 dark:text-neutral-300'}`}>
                  {isWakeWordMode ? 'Hands-Free Mode Active' : 'Enable Hands-Free Mode'}
                </Text>
                <Text className={`text-xs ${isWakeWordMode ? 'text-green-600' : 'text-neutral-500 dark:text-neutral-400'}`}>
                  {isWakeWordMode ? 'Listening for "SousChef"' : 'Say "SousChef" to activate'}
                </Text>
              </View>
              {isWakeWordListening && (
                <View className="ml-auto w-3 h-3 rounded-full bg-green-500" />
              )}
            </TouchableOpacity>
          )}
        </View>

        {/* Help button */}
        <TouchableOpacity
          onPress={() => {/* Could trigger help command */}}
          className="absolute bottom-12 left-1/2 -ml-16 flex-row items-center bg-white dark:bg-neutral-800 px-4 py-2 rounded-full shadow-sm"
        >
          <Ionicons name="help-circle-outline" size={20} color={colors.textMuted} />
          <Text className="text-neutral-500 dark:text-neutral-400 ml-2">Say "Help" for commands</Text>
        </TouchableOpacity>
      </BlurView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
  },
  containerDark: {
    backgroundColor: 'rgba(23, 23, 23, 0.9)',
  },
  waveLine: {
    width: 4,
    backgroundColor: '#FF6B35',
    marginHorizontal: 4,
    borderRadius: 2,
  },
});
