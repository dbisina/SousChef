import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useLanguageStore } from '@/stores/languageStore';
import { useThemeColors } from '@/stores/themeStore';
import { SUPPORTED_LANGUAGES } from '@/lib/i18n';
import { Card } from '@/components/ui';
import { showSuccessToast } from '@/stores/toastStore';

export default function LanguageSettingsScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const { t } = useTranslation();
  const { language, setLanguage } = useLanguageStore();
  const [changingTo, setChangingTo] = useState<string | null>(null);

  const handleSelectLanguage = async (code: string) => {
    if (code === language) return;
    setChangingTo(code);
    try {
      await setLanguage(code);
      const langConfig = SUPPORTED_LANGUAGES.find((l) => l.code === code);
      showSuccessToast(
        `${langConfig?.nativeName || code}`,
        t('settings.saved')
      );
    } finally {
      setChangingTo(null);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-neutral-50 dark:bg-neutral-900" edges={['top']}>
      {/* Header */}
      <View className="flex-row items-center px-4 py-3 border-b border-neutral-100 dark:border-neutral-700 bg-white dark:bg-neutral-800">
        <TouchableOpacity onPress={() => router.back()} className="p-2 -ml-2">
          <Ionicons name="arrow-back" size={24} color={colors.icon} />
        </TouchableOpacity>
        <Text className="flex-1 text-lg font-bold text-neutral-900 dark:text-neutral-50 ml-2">
          {t('language.title')}
        </Text>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="p-4">
          {/* Info */}
          <Card className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 mb-6">
            <View className="flex-row items-start">
              <Ionicons name="globe" size={20} color="#6366F1" />
              <Text className="flex-1 text-indigo-700 dark:text-indigo-300 text-sm ml-2">
                {t('language.info')}
              </Text>
            </View>
          </Card>

          {/* Language list */}
          <Card padding="none">
            {SUPPORTED_LANGUAGES.map((lang, index) => {
              const isSelected = language === lang.code;
              const isChanging = changingTo === lang.code;

              return (
                <TouchableOpacity
                  key={lang.code}
                  onPress={() => handleSelectLanguage(lang.code)}
                  disabled={!!changingTo}
                  className={`flex-row items-center px-4 py-3.5 ${
                    index < SUPPORTED_LANGUAGES.length - 1
                      ? 'border-b border-neutral-100 dark:border-neutral-700'
                      : ''
                  } ${isSelected ? 'bg-indigo-50/50 dark:bg-indigo-900/10' : ''}`}
                >
                  <Text className="text-2xl w-10">{lang.flag}</Text>
                  <View className="flex-1 ml-2">
                    <Text
                      className={`font-medium ${
                        isSelected
                          ? 'text-indigo-700 dark:text-indigo-300'
                          : 'text-neutral-900 dark:text-neutral-100'
                      }`}
                    >
                      {lang.nativeName}
                    </Text>
                    <Text className="text-xs text-neutral-500 dark:text-neutral-400">
                      {lang.name}{lang.rtl ? ' (RTL)' : ''}
                    </Text>
                  </View>
                  {isChanging ? (
                    <ActivityIndicator size="small" color={colors.accent} />
                  ) : isSelected ? (
                    <View className="w-6 h-6 rounded-full bg-indigo-500 items-center justify-center">
                      <Ionicons name="checkmark" size={16} color="white" />
                    </View>
                  ) : (
                    <View className="w-6 h-6 rounded-full border-2 border-neutral-300 dark:border-neutral-600" />
                  )}
                </TouchableOpacity>
              );
            })}
          </Card>

          <Text className="text-xs text-neutral-400 dark:text-neutral-500 text-center mt-4 px-4">
            {t('language.note')}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
