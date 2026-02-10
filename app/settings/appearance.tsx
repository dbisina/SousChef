import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  useColorScheme,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore, useThemeColors, type ThemeOption, type AccentColor } from '@/stores/themeStore';
import { Card } from '@/components/ui';

const THEME_OPTIONS: { id: ThemeOption; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: 'light', label: 'Light', icon: 'sunny' },
  { id: 'dark', label: 'Dark', icon: 'moon' },
  { id: 'system', label: 'System', icon: 'phone-portrait' },
];

const ACCENT_COLORS: { id: AccentColor; label: string; color: string }[] = [
  { id: 'orange', label: 'Orange', color: '#FF6B35' },
  { id: 'blue', label: 'Blue', color: '#3B82F6' },
  { id: 'green', label: 'Green', color: '#22C55E' },
  { id: 'purple', label: 'Purple', color: '#8B5CF6' },
  { id: 'pink', label: 'Pink', color: '#EC4899' },
];

export default function AppearanceScreen() {
  const router = useRouter();
  const systemColorScheme = useColorScheme();
  const { settings, effectiveTheme, updateSetting } = useThemeStore();
  const colors = useThemeColors();

  return (
    <SafeAreaView className="flex-1 bg-neutral-50 dark:bg-neutral-900" edges={['top']}>
      {/* Header */}
      <View className="flex-row items-center px-4 py-3 border-b border-neutral-100 dark:border-neutral-700 bg-white dark:bg-neutral-800">
        <TouchableOpacity onPress={() => router.back()} className="p-2 -ml-2">
          <Ionicons name="arrow-back" size={24} color={colors.icon} />
        </TouchableOpacity>
        <Text className="flex-1 text-lg font-bold text-neutral-900 dark:text-neutral-50 ml-2">
          Appearance
        </Text>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="p-4">
          {/* Theme */}
          <Text className="text-sm font-medium text-neutral-500 dark:text-neutral-400 uppercase mb-3">
            Theme
          </Text>
          <Card padding="none" className="mb-6">
            {THEME_OPTIONS.map((option, index) => (
              <TouchableOpacity
                key={option.id}
                onPress={() => updateSetting('theme', option.id)}
                className={`flex-row items-center justify-between px-4 py-4 ${
                  index < THEME_OPTIONS.length - 1 ? 'border-b border-neutral-100 dark:border-neutral-700' : ''
                }`}
              >
                <View className="flex-row items-center">
                  <View className="w-10 h-10 rounded-full bg-neutral-100 dark:bg-neutral-700 items-center justify-center">
                    <Ionicons name={option.icon} size={20} color={colors.icon} />
                  </View>
                  <View className="ml-3">
                    <Text className="font-medium text-neutral-900 dark:text-neutral-100">{option.label}</Text>
                    {option.id === 'system' && (
                      <Text className="text-xs text-neutral-500 dark:text-neutral-400">
                        Currently: {systemColorScheme === 'dark' ? 'Dark' : 'Light'}
                      </Text>
                    )}
                  </View>
                </View>
                <View
                  className={`w-6 h-6 rounded-full border-2 items-center justify-center ${
                    settings.theme === option.id
                      ? ''
                      : 'border-neutral-300 dark:border-neutral-600'
                  }`}
                  style={settings.theme === option.id ? { backgroundColor: colors.accent, borderColor: colors.accent, borderWidth: 2 } : undefined}
                >
                  {settings.theme === option.id && (
                    <Ionicons name="checkmark" size={14} color="white" />
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </Card>

          {/* Accent Color */}
          <Text className="text-sm font-medium text-neutral-500 dark:text-neutral-400 uppercase mb-3">
            Accent Color
          </Text>
          <Card className="mb-6">
            <View className="flex-row justify-between">
              {ACCENT_COLORS.map((color) => (
                <TouchableOpacity
                  key={color.id}
                  onPress={() => updateSetting('accentColor', color.id)}
                  className="items-center"
                >
                  <View
                    className={`w-12 h-12 rounded-full items-center justify-center ${
                      settings.accentColor === color.id ? 'border-2 border-neutral-900 dark:border-neutral-100' : ''
                    }`}
                    style={{ backgroundColor: color.color }}
                  >
                    {settings.accentColor === color.id && (
                      <Ionicons name="checkmark" size={20} color="white" />
                    )}
                  </View>
                  <Text className="text-xs text-neutral-600 dark:text-neutral-400 mt-1">{color.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </Card>

          {/* Display Options */}
          <Text className="text-sm font-medium text-neutral-500 dark:text-neutral-400 uppercase mb-3">
            Display Options
          </Text>
          <Card padding="none">
            <TouchableOpacity
              onPress={() => updateSetting('compactMode', !settings.compactMode)}
              className="flex-row items-center justify-between px-4 py-4 border-b border-neutral-100 dark:border-neutral-700"
            >
              <View className="flex-row items-center flex-1">
                <View className="w-10 h-10 rounded-full bg-neutral-100 dark:bg-neutral-700 items-center justify-center">
                  <Ionicons name="grid" size={20} color={colors.icon} />
                </View>
                <View className="ml-3 flex-1">
                  <Text className="font-medium text-neutral-900 dark:text-neutral-100">Compact Mode</Text>
                  <Text className="text-sm text-neutral-500 dark:text-neutral-400">Show more recipes at once</Text>
                </View>
              </View>
              <View
                className={`w-12 h-7 rounded-full justify-center ${
                  settings.compactMode ? '' : 'bg-neutral-300 dark:bg-neutral-600'
                }`}
                style={settings.compactMode ? { backgroundColor: colors.accent } : undefined}
              >
                <View
                  className={`w-5 h-5 rounded-full bg-white mx-1 ${
                    settings.compactMode ? 'self-end mr-1' : 'self-start ml-1'
                  }`}
                />
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => updateSetting('showCalories', !settings.showCalories)}
              className="flex-row items-center justify-between px-4 py-4"
            >
              <View className="flex-row items-center flex-1">
                <View className="w-10 h-10 rounded-full bg-neutral-100 dark:bg-neutral-700 items-center justify-center">
                  <Ionicons name="flame" size={20} color={colors.icon} />
                </View>
                <View className="ml-3 flex-1">
                  <Text className="font-medium text-neutral-900 dark:text-neutral-100">Show Calories</Text>
                  <Text className="text-sm text-neutral-500 dark:text-neutral-400">Display calorie info on recipes</Text>
                </View>
              </View>
              <View
                className={`w-12 h-7 rounded-full justify-center ${
                  settings.showCalories ? '' : 'bg-neutral-300 dark:bg-neutral-600'
                }`}
                style={settings.showCalories ? { backgroundColor: colors.accent } : undefined}
              >
                <View
                  className={`w-5 h-5 rounded-full bg-white mx-1 ${
                    settings.showCalories ? 'self-end mr-1' : 'self-start ml-1'
                  }`}
                />
              </View>
            </TouchableOpacity>
          </Card>

          {/* Preview */}
          <Text className="text-sm font-medium text-neutral-500 dark:text-neutral-400 uppercase mb-3 mt-6">
            Preview
          </Text>
          <Card
            className={`${effectiveTheme === 'dark' ? 'bg-neutral-800' : 'bg-white'}`}
          >
            <View className="flex-row items-center">
              <View
                className="w-16 h-16 rounded-xl"
                style={{ backgroundColor: ACCENT_COLORS.find((c) => c.id === settings.accentColor)?.color }}
              />
              <View className="flex-1 ml-3">
                <Text
                  className={`font-semibold ${
                    effectiveTheme === 'dark' ? 'text-white' : 'text-neutral-900'
                  }`}
                >
                  Sample Recipe
                </Text>
                <Text
                  className={`text-sm ${
                    effectiveTheme === 'dark' ? 'text-neutral-400' : 'text-neutral-500'
                  }`}
                >
                  30 min • Easy
                </Text>
                {settings.showCalories && (
                  <Text
                    className="text-sm mt-1"
                    style={{ color: ACCENT_COLORS.find((c) => c.id === settings.accentColor)?.color }}
                  >
                    450 calories
                  </Text>
                )}
              </View>
            </View>
          </Card>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
