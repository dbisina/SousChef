import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Switch,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useVoiceStore } from '@/stores/voiceStore';
import { useThemeColors } from '@/stores/themeStore';
import { Card } from '@/components/ui';

export default function VoiceSettingsScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const { voiceEnabled, isWakeWordMode, setVoiceEnabled, setWakeWordMode } = useVoiceStore();

  return (
    <SafeAreaView className="flex-1 bg-neutral-50 dark:bg-neutral-900" edges={['top']}>
      {/* Header */}
      <View className="flex-row items-center px-4 py-3 border-b border-neutral-100 dark:border-neutral-700 bg-white dark:bg-neutral-800">
        <TouchableOpacity onPress={() => router.back()} className="p-2 -ml-2">
          <Ionicons name="arrow-back" size={24} color={colors.icon} />
        </TouchableOpacity>
        <Text className="flex-1 text-lg font-bold text-neutral-900 dark:text-neutral-50 ml-2">
          Voice Commands
        </Text>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="p-4">
          {/* Master toggle */}
          <Card className="mb-4">
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center flex-1">
                <View className="w-10 h-10 rounded-full items-center justify-center" style={{ backgroundColor: colors.accent + '20' }}>
                  <Ionicons name="mic" size={20} color={colors.accent} />
                </View>
                <View className="ml-3 flex-1">
                  <Text className="font-semibold text-neutral-900 dark:text-neutral-100">Voice Commands</Text>
                  <Text className="text-sm text-neutral-500 dark:text-neutral-400">
                    Enable hands-free voice control during cooking
                  </Text>
                </View>
              </View>
              <Switch
                value={voiceEnabled}
                onValueChange={setVoiceEnabled}
                trackColor={{ false: '#D4D4D4', true: colors.accent + '80' }}
                thumbColor={voiceEnabled ? colors.accent : '#F5F5F5'}
              />
            </View>
          </Card>

          {/* Voice Features */}
          <Text className="text-sm font-medium text-neutral-500 dark:text-neutral-400 uppercase mb-3">
            Features
          </Text>
          <Card padding="none" className="mb-6">
            <View
              className="flex-row items-center justify-between px-4 py-4 border-b border-neutral-100 dark:border-neutral-700"
              style={{ opacity: voiceEnabled ? 1 : 0.5 }}
            >
              <View className="flex-row items-center flex-1">
                <View
                  className="w-10 h-10 rounded-full items-center justify-center"
                  style={{ backgroundColor: '#3B82F615' }}
                >
                  <Ionicons name="radio-outline" size={20} color="#3B82F6" />
                </View>
                <View className="ml-3 flex-1">
                  <Text className="font-medium text-neutral-900 dark:text-neutral-100">Wake Word Mode</Text>
                  <Text className="text-sm text-neutral-500 dark:text-neutral-400">
                    Say "Hey Chef" to activate voice commands
                  </Text>
                </View>
              </View>
              <Switch
                value={isWakeWordMode}
                onValueChange={setWakeWordMode}
                disabled={!voiceEnabled}
                trackColor={{ false: '#D4D4D4', true: colors.accent + '80' }}
                thumbColor={isWakeWordMode ? colors.accent : '#F5F5F5'}
              />
            </View>
          </Card>

          {/* Info Section */}
          <Text className="text-sm font-medium text-neutral-500 dark:text-neutral-400 uppercase mb-3">
            Available Commands
          </Text>
          <Card className="mb-4">
            <VoiceCommandInfo command="Next step" description="Go to the next instruction" />
            <VoiceCommandInfo command="Previous step" description="Go back one instruction" />
            <VoiceCommandInfo command="Set timer [X] minutes" description="Start a cooking timer" />
            <VoiceCommandInfo command="Read step" description="Read the current step aloud" />
            <VoiceCommandInfo command="What's next?" description="Preview the upcoming step" isLast />
          </Card>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

interface VoiceCommandInfoProps {
  command: string;
  description: string;
  isLast?: boolean;
}

const VoiceCommandInfo: React.FC<VoiceCommandInfoProps> = ({ command, description, isLast }) => (
  <View className={`flex-row items-center py-3 ${!isLast ? 'border-b border-neutral-100 dark:border-neutral-700' : ''}`}>
    <View className="bg-neutral-100 dark:bg-neutral-700 px-3 py-1.5 rounded-lg mr-3">
      <Text className="text-sm font-mono font-semibold text-neutral-700 dark:text-neutral-300">"{command}"</Text>
    </View>
    <Text className="flex-1 text-sm text-neutral-500 dark:text-neutral-400">{description}</Text>
  </View>
);
