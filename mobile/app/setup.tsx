import React, { useState } from 'react';
import { Text as RNText, View } from 'react-native';
import { Pressable } from '@/components/ui/Pressable';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/authStore';
import { useSetupStore } from '@/stores/setupStore';
import { showErrorToast } from '@/stores/toastStore';
import {
  Chip,
  CtaBar,
  FONT,
  H1,
  Dim,
  LinkText,
  Muted,
  ProgressBar,
  Screen,
  Title,
  TopBar,
  UButton,
  UIconButton,
} from '@/components/ui';

// Ids match app/settings/dietary.tsx so both screens read/write the same user fields.
const DIETS = [
  { id: 'vegetarian', key: 'vegetarian', label: 'Vegetarian' },
  { id: 'halal', key: 'halal', label: 'Halal' },
  { id: 'gluten-free', key: 'glutenFree', label: 'Gluten-free' },
];

const CONDITIONS = [
  { id: 'diabetic-type2', key: 'diabetes2', label: 'Type 2 diabetes' },
  { id: 'high-blood-pressure', key: 'bloodPressure', label: 'High blood pressure' },
  { id: 'high-cholesterol', key: 'cholesterol', label: 'High cholesterol' },
  { id: 'weight', key: 'weight', label: 'Weight' },
];

const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

export default function SetupScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const updateUserProfile = useAuthStore((s) => s.updateUserProfile);
  const markSetupDone = useSetupStore((s) => s.markSetupDone);

  const [diets, setDiets] = useState<string[]>(user?.dietaryPreferences ?? []);
  const [conditions, setConditions] = useState<string[]>(user?.healthConditions ?? []);
  const [saving, setSaving] = useState(false);

  const finish = () => {
    markSetupDone();
    router.replace('/(tabs)');
  };

  const onContinue = async () => {
    setSaving(true);
    try {
      if (user && !user.id.startsWith('guest-')) {
        await updateUserProfile({ dietaryPreferences: diets, healthConditions: conditions });
      }
      finish();
    } catch {
      showErrorToast(
        t('welcome.setup.saveError', 'We couldn’t save your choices. You can set them later in Settings.'),
        t('welcome.setup.saveErrorTitle', 'Save problem')
      );
      setSaving(false);
    }
  };

  const onBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/auth/login');
  };

  const offeredDietIds = DIETS.map((d) => d.id);
  const hasOfferedDiet = diets.some((d) => offeredDietIds.includes(d));

  return (
    <Screen
      scroll
      bottomSpace={140}
      footer={
        <CtaBar fade>
          <UButton
            label={t('welcome.setup.continue', 'Continue')}
            onPress={onContinue}
            loading={saving}
          />
        </CtaBar>
      }
    >
      <TopBar
          variant="compact"
          left={<UIconButton icon="back" label={t('welcome.back', 'Back')} onPress={onBack} />}
          title={<Muted small>{t('welcome.setup.step', 'Step 2 of 3')}</Muted>}
          right={
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('welcome.skip', 'Skip')}
              onPress={finish}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              style={{ minHeight: 44, justifyContent: 'center' }}
            >
              <LinkText>{t('welcome.skip', 'Skip')}</LinkText>
            </Pressable>
          }
        />

      <ProgressBar value={0.66} label={t('welcome.setup.step', 'Step 2 of 3')} />

      <H1>
        <Dim>{t('welcome.setup.line1', 'Let’s set up')}</Dim>
        {'\n'}
        {t('welcome.setup.line2', 'your kitchen')}
      </H1>

      <View style={{ gap: 8 }}>
        <RNText className="text-muted" style={{ fontFamily: FONT.sansMedium, fontSize: 12, paddingStart: 4 }}>
          {t('welcome.setup.dietLabel', 'How do you eat?')}
        </RNText>
        <View className="flex-row flex-wrap" style={{ gap: 8 }}>
          <Chip
            label={t('welcome.setup.everything', 'Everything')}
            on={!hasOfferedDiet}
            onPress={() => setDiets((prev) => prev.filter((d) => !offeredDietIds.includes(d)))}
          />
          {DIETS.map((d) => (
            <Chip
              key={d.id}
              label={t(`welcome.setup.diet.${d.key}`, d.label)}
              on={diets.includes(d.id)}
              onPress={() => setDiets((prev) => toggle(prev, d.id))}
            />
          ))}
        </View>
      </View>

      <View style={{ gap: 8 }}>
        <RNText className="text-muted" style={{ fontFamily: FONT.sansMedium, fontSize: 12, paddingStart: 4 }}>
          {t('welcome.setup.conditionsLabel', 'Anything to track? (private, optional)')}
        </RNText>
        <View className="flex-row flex-wrap" style={{ gap: 8 }}>
          {CONDITIONS.map((c) => (
            <Chip
              key={c.id}
              label={t(`welcome.setup.condition.${c.key}`, c.label)}
              outlined={conditions.includes(c.id)}
              onPress={() => setConditions((prev) => toggle(prev, c.id))}
            />
          ))}
        </View>
      </View>
    </Screen>
  );
}
