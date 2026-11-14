import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useThemeStore, type ThemeOption } from '@/stores/themeStore';
import { SAMPLE } from '@/assets/sample';
import { FONT, Icon, Muted, Rows, Screen, Segmented, ToneBlock, TopBar, USwitch } from '@/components/ui';

function ThemePreview({
  mode,
  label,
  selected,
  onPress,
}: {
  mode: 'light' | 'dark';
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={{ flex: 1, gap: 10 }}
    >
      <ToneBlock
        tone={mode}
        className={`bg-ground ${selected ? 'border-2 border-ink' : ''}`}
        style={{ height: 190, borderRadius: 26, overflow: 'hidden', padding: 12, gap: 8 }}
      >
        <View className="bg-ink" style={{ height: 10, width: '55%', borderRadius: 5 }} />
        <Image source={SAMPLE.salad} style={{ height: 100, width: '100%', borderRadius: 16 }} contentFit="cover" accessible={false} />
        <View className="bg-track" style={{ height: 8, borderRadius: 4 }} />
        <View className="bg-track" style={{ height: 8, width: '70%', borderRadius: 4 }} />
      </ToneBlock>
      <View className="flex-row items-center" style={{ gap: 6 }}>
        {selected ? <Icon name="check" size="sm" /> : null}
        <Text className="text-ink" style={{ fontFamily: FONT.display, fontSize: 15 }}>
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

export default function AppearanceScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { settings, effectiveTheme, updateSetting } = useThemeStore();

  const setTheme = (theme: ThemeOption) => updateSetting('theme', theme);

  return (
    <Screen bare>
      <TopBar variant="compact" title={t('account.appearance.title', 'Appearance')} onBack={() => router.back()} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40, gap: 16 }}>
        <View className="flex-row" style={{ gap: 12 }}>
          <ThemePreview
            mode="light"
            label={t('account.appearance.light', 'Light')}
            selected={effectiveTheme === 'light'}
            onPress={() => setTheme('light')}
          />
          <ThemePreview
            mode="dark"
            label={t('account.appearance.dark', 'Dark')}
            selected={effectiveTheme === 'dark'}
            onPress={() => setTheme('dark')}
          />
        </View>

        <Segmented<ThemeOption>
          value={settings.theme}
          onChange={setTheme}
          options={[
            { value: 'light', label: t('account.appearance.light', 'Light') },
            { value: 'dark', label: t('account.appearance.dark', 'Dark') },
            { value: 'system', label: t('account.appearance.system', 'System') },
          ]}
        />

        <Rows>
          <View className="flex-row items-center" style={{ minHeight: 64, gap: 14 }}>
            <View className="flex-1" style={{ gap: 2 }}>
              <Text className="text-ink" style={{ fontFamily: FONT.display, fontSize: 15 }}>
                {t('account.appearance.compact', 'Compact Mode')}
              </Text>
              <Muted small>{t('account.appearance.compactBody', 'Show more recipes at once')}</Muted>
            </View>
            <USwitch
              label={t('account.appearance.compact', 'Compact Mode')}
              value={settings.compactMode}
              onValueChange={(v) => updateSetting('compactMode', v)}
            />
          </View>
          <View className="flex-row items-center" style={{ minHeight: 64, gap: 14 }}>
            <View className="flex-1" style={{ gap: 2 }}>
              <Text className="text-ink" style={{ fontFamily: FONT.display, fontSize: 15 }}>
                {t('account.appearance.calories', 'Show Calories')}
              </Text>
              <Muted small>{t('account.appearance.caloriesBody', 'Display calorie info on recipes')}</Muted>
            </View>
            <USwitch
              label={t('account.appearance.calories', 'Show Calories')}
              value={settings.showCalories}
              onValueChange={(v) => updateSetting('showCalories', v)}
            />
          </View>
        </Rows>
      </ScrollView>
    </Screen>
  );
}
