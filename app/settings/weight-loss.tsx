import React, { useState, useMemo } from 'react';
import { ScrollView, Text as RNText, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/authStore';
import {
  Chip,
  ChipRow,
  CtaBar,
  Field,
  Icon,
  Muted,
  ProgressBar,
  Screen,
  SectionLabel,
  Segmented,
  Tag,
  Tile,
  Title,
  TopBar,
  UButton,
  UCard,
  FONT,
} from '@/components/ui';
import { showSuccessToast, showErrorToast } from '@/stores/toastStore';
import { ACTIVITY_MULTIPLIERS } from '@/types/weightLoss';

const ACTIVITY_LEVELS = [
  { id: 'sedentary', key: 'weightGoal.sedentary', label: 'Sedentary' },
  { id: 'light', key: 'weightGoal.light', label: 'Light' },
  { id: 'moderate', key: 'weightGoal.moderate', label: 'Moderate' },
  { id: 'active', key: 'weightGoal.active', label: 'Active' },
  { id: 'very-active', key: 'weightGoal.veryActive', label: 'Very Active' },
] as const;

const DEFICIT_OPTIONS = [
  { value: 250, description: '~0.5 lb' },
  { value: 500, description: '~1 lb' },
  { value: 750, description: '~1.5 lb' },
];

// Rough average BMR estimate (Mifflin-St Jeor simplified)
const estimateBMR = (weightLbs: number): number => {
  // Simplified: using average height/age assumptions
  // BMR ~ 10 * weight(kg) + 625 (simplified for demo)
  const weightKg = weightLbs * 0.453592;
  return Math.round(10 * weightKg + 625);
};

type ActivityLevelKey = keyof typeof ACTIVITY_MULTIPLIERS;

export default function WeightLossScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { user, updateUserProfile, isLoading } = useAuthStore();

  const existing = (user as any)?.weightLossGoal;

  const [currentWeight, setCurrentWeight] = useState<string>(existing?.currentWeight?.toString() || '');
  const [targetWeight, setTargetWeight] = useState<string>(existing?.targetWeight?.toString() || '');
  const [unit, setUnit] = useState<'lbs' | 'kg'>(existing?.unit || 'lbs');
  const [activityLevel, setActivityLevel] = useState<ActivityLevelKey>(existing?.activityLevel || 'moderate');
  const [deficit, setDeficit] = useState<number>(existing?.dailyCalorieDeficit || 500);

  const weightNum = parseFloat(currentWeight) || 0;
  const weightInLbs = unit === 'kg' ? weightNum * 2.20462 : weightNum;

  const bmr = useMemo(() => estimateBMR(weightInLbs), [weightInLbs]);
  const tdee = useMemo(() => Math.round(bmr * ACTIVITY_MULTIPLIERS[activityLevel]), [bmr, activityLevel]);
  const calorieTarget = useMemo(() => Math.max(1200, tdee - deficit), [tdee, deficit]);

  const startDate = existing?.startDate;
  const daysOnPlan = startDate ? Math.floor((Date.now() - startDate) / (1000 * 60 * 60 * 24)) : 0;
  const pace = DEFICIT_OPTIONS.find((o) => o.value === deficit)?.description ?? '';

  const handleSave = async () => {
    if (!currentWeight || !targetWeight) {
      showErrorToast(
        t('weightGoal.missingBody', 'Please enter both your current and target weight.'),
        t('weightGoal.missingTitle', 'Missing Info')
      );
      return;
    }

    try {
      await updateUserProfile({
        weightLossGoal: {
          currentWeight: parseFloat(currentWeight),
          targetWeight: parseFloat(targetWeight),
          startWeight: existing?.startWeight || parseFloat(currentWeight),
          unit,
          activityLevel,
          dailyCalorieTarget: calorieTarget,
          dailyCalorieDeficit: deficit,
          startDate: existing?.startDate || Date.now(),
        },
      } as any);
      showSuccessToast(
        t('weightGoal.savedBody', 'Your weight loss goals have been saved!'),
        t('weightGoal.savedTitle', 'Goals Updated')
      );
      router.back();
    } catch {
      showErrorToast(
        t('weightGoal.saveErrBody', 'Could not save your goals. Please try again.'),
        t('weightGoal.saveErrTitle', 'Save Problem')
      );
    }
  };

  return (
    <Screen
      bare
      footer={
        <CtaBar fade>
          <UButton
            variant="accent"
            label={t('weightGoal.save', 'Save Goals')}
            loading={isLoading}
            onPress={handleSave}
          />
        </CtaBar>
      }
    >
      <TopBar variant="compact" title={t('weightGoal.title', 'Weight Goals')} onBack={() => router.back()} />

      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, gap: 16, paddingBottom: 150 }}
      >
        <UCard tone="black" style={{ borderRadius: 30, padding: 20, gap: 12 }}>
          <View className="flex-row items-center justify-between">
            <SectionLabel>{t('weightGoal.dailyTarget', 'Daily target')}</SectionLabel>
            <Tag label={`−${deficit} cal`} />
          </View>
          <RNText
            accessibilityLabel={weightNum > 0 ? `${calorieTarget} cal` : undefined}
            className="text-ink"
            style={{ fontFamily: FONT.display, fontSize: 48, lineHeight: 48, letterSpacing: -1.44 }}
          >
            {weightNum > 0 ? calorieTarget.toLocaleString() : '—'}{' '}
            <RNText className="text-muted" style={{ fontSize: 16, letterSpacing: 0 }}>
              cal
            </RNText>
          </RNText>
          <ProgressBar value={weightNum > 0 && tdee > 0 ? calorieTarget / tdee : 0} label={t('weightGoal.dailyTarget', 'Daily target')} />
          <Muted small>
            {weightNum > 0
              ? t('weightGoal.tdee', 'Estimated TDEE {{tdee}} · {{pace}} a week', { tdee: tdee.toLocaleString(), pace })
              : t('weightGoal.enterWeight', 'Enter your current weight to see your target')}
          </Muted>
        </UCard>

        <View className="flex-row" style={{ gap: 12 }}>
          <View className="flex-1">
            <Field
              label={t('weightGoal.current', 'Current weight')}
              value={currentWeight}
              onChangeText={setCurrentWeight}
              keyboardType="decimal-pad"
              placeholder={unit === 'lbs' ? '185' : '84'}
            />
          </View>
          <View className="flex-1">
            <Field
              label={t('weightGoal.target', 'Target weight')}
              value={targetWeight}
              onChangeText={setTargetWeight}
              keyboardType="decimal-pad"
              placeholder={unit === 'lbs' ? '165' : '75'}
            />
          </View>
        </View>

        <View style={{ gap: 10 }}>
          <View className="flex-row items-center justify-between" style={{ gap: 12 }}>
            <Title>{t('weightGoal.activity', 'Activity level')}</Title>
            <View style={{ width: 132 }}>
              <Segmented<'lbs' | 'kg'>
                value={unit}
                onChange={setUnit}
                options={[
                  { value: 'lbs', label: 'lbs' },
                  { value: 'kg', label: 'kg' },
                ]}
              />
            </View>
          </View>
          <View style={{ marginHorizontal: -20 }}>
            <ChipRow>
              {ACTIVITY_LEVELS.map((level) => (
                <Chip
                  key={level.id}
                  label={t(level.key, level.label)}
                  on={activityLevel === level.id}
                  onPress={() => setActivityLevel(level.id as ActivityLevelKey)}
                />
              ))}
            </ChipRow>
          </View>
        </View>

        <View style={{ gap: 10 }}>
          <Title>{t('weightGoal.pace', 'Weekly pace')}</Title>
          <View className="flex-row" style={{ gap: 10 }}>
            {DEFICIT_OPTIONS.map((option) => (
              <View key={option.value} className="flex-1">
                <Tile
                  value={option.value}
                  label={option.description}
                  selected={deficit === option.value}
                  accessibilityLabel={t('weightGoal.paceOption', '{{cal}} cal deficit, {{pace}} a week', {
                    cal: option.value,
                    pace: option.description,
                  })}
                  onPress={() => setDeficit(option.value)}
                />
              </View>
            ))}
          </View>
        </View>

        <View style={{ gap: 10 }}>
          <Title>{t('weightGoal.progress', 'Progress')}</Title>
          {existing ? (
            <View className="flex-row" style={{ gap: 10 }}>
              <View className="flex-1">
                <Tile value={daysOnPlan} label={t('weightGoal.daysOnPlan', 'Days on plan')} />
              </View>
              <View className="flex-1">
                <Tile
                  value={
                    existing.startWeight
                      ? Math.max(0, existing.startWeight - (parseFloat(currentWeight) || existing.startWeight)).toFixed(1)
                      : '0'
                  }
                  label={t('weightGoal.lost', '{{unit}} lost', { unit })}
                />
              </View>
              <View className="flex-1">
                <Tile
                  value={
                    targetWeight
                      ? Math.max(0, (parseFloat(currentWeight) || 0) - parseFloat(targetWeight)).toFixed(1)
                      : '0'
                  }
                  label={t('weightGoal.toGo', '{{unit}} to go', { unit })}
                />
              </View>
            </View>
          ) : (
            <UCard>
              <View className="items-center" style={{ paddingVertical: 8, gap: 8 }}>
                <Icon name="trend" size="lg" color="muted" />
                <Muted small center>
                  {t('weightGoal.saveToTrack', 'Save your goals to start tracking progress')}
                </Muted>
              </View>
            </UCard>
          )}
        </View>
      </ScrollView>
    </Screen>
  );
}
