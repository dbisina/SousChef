import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useLanguageStore } from '@/stores/languageStore';
import { SUPPORTED_LANGUAGES } from '@/lib/i18n';
import { Check, FONT, Muted, Rows, Screen, TopBar, UInput, useColor } from '@/components/ui';
import { showSuccessToast } from '@/stores/toastStore';

function RowSpinner() {
  const accent = useColor('accent');
  return <ActivityIndicator size="small" color={accent} />;
}

export default function LanguageSettingsScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { language, setLanguage } = useLanguageStore();
  const [changingTo, setChangingTo] = useState<string | null>(null);
  const [query, setQuery] = useState('');

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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return SUPPORTED_LANGUAGES;
    return SUPPORTED_LANGUAGES.filter(
      (l) => l.nativeName.toLowerCase().includes(q) || l.name.toLowerCase().includes(q)
    );
  }, [query]);

  return (
    <Screen bare>
      <TopBar variant="compact" title={t('language.title')} onBack={() => router.back()} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40, gap: 12 }}
      >
        <UInput
          icon="search"
          label={t('account.language.search', 'Search languages')}
          placeholder={t('account.language.searchPlaceholder', 'Search {{n}} languages', { n: SUPPORTED_LANGUAGES.length })}
          value={query}
          onChangeText={setQuery}
          autoCorrect={false}
          returnKeyType="search"
        />

        <Rows>
          {filtered.map((lang) => {
            const isSelected = language === lang.code;
            const isChanging = changingTo === lang.code;
            return (
              <Pressable
                key={lang.code}
                accessibilityRole="button"
                accessibilityLabel={`${lang.nativeName} (${lang.name})`}
                accessibilityState={{ selected: isSelected }}
                disabled={!!changingTo}
                onPress={() => handleSelectLanguage(lang.code)}
                style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
              >
                <View className="flex-row items-center" style={{ minHeight: 64, gap: 14 }}>
                  <View className="flex-1" style={{ gap: 2 }}>
                    <Text className="text-ink" style={{ fontFamily: FONT.display, fontSize: 15 }}>
                      {lang.nativeName}
                    </Text>
                    {lang.name !== lang.nativeName ? (
                      <Muted small>
                        {lang.name}
                        {lang.rtl ? ' (RTL)' : ''}
                      </Muted>
                    ) : null}
                  </View>
                  {isChanging ? (
                    <RowSpinner />
                  ) : (
                    <View pointerEvents="none">
                      <Check checked={isSelected} label={lang.nativeName} />
                    </View>
                  )}
                </View>
              </Pressable>
            );
          })}
        </Rows>

        <Muted small center>
          {t('language.note')}
        </Muted>
      </ScrollView>
    </Screen>
  );
}
