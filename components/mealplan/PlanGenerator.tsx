import React, { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, Text as RNText, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { SAMPLE } from '@/assets/sample';
import {
  AvatarStack,
  Chip,
  CtaBar,
  LinkText,
  Muted,
  Rows,
  Screen,
  Stepper,
  Tag,
  Title,
  TopBar,
  UButton,
  UIconButton,
  USwitch,
  FONT,
} from '@/components/ui';
import { MealPlanPreferences, MealType, DEFAULT_MEAL_PLAN_PREFERENCES } from '@/types/mealplan';

interface PlanGeneratorProps {
  visible: boolean;
  onClose: () => void;
  onGenerate: (preferences: MealPlanPreferences) => void;
  isGenerating: boolean;
  expiringItemsCount: number;
  userDietaryPreferences?: string[];
  userAllergies?: string[];
  /** Opens dietary settings (the design's "Edit" link). */
  onEditDietary?: () => void;
}

const DAY_OPTIONS = [3, 5, 7, 14];
const MEAL_OPTIONS: { type: MealType; key: string; label: string }[] = [
  { type: 'breakfast', key: 'plan.breakfast', label: 'Breakfast' },
  { type: 'lunch', key: 'plan.lunch', label: 'Lunch' },
  { type: 'dinner', key: 'plan.dinner', label: 'Dinner' },
  { type: 'snack', key: 'plan.snack', label: 'Snack' },
];

export const PlanGenerator: React.FC<PlanGeneratorProps> = ({
  visible,
  onClose,
  onGenerate,
  isGenerating,
  expiringItemsCount,
  userDietaryPreferences = [],
  userAllergies = [],
  onEditDietary,
}) => {
  const { t } = useTranslation();

  const buildInitial = (): MealPlanPreferences => ({
    ...DEFAULT_MEAL_PLAN_PREFERENCES,
    dietaryRestrictions: [
      ...new Set([
        ...DEFAULT_MEAL_PLAN_PREFERENCES.dietaryRestrictions,
        ...userDietaryPreferences,
        ...userAllergies.map((a) => `no ${a}`),
      ]),
    ],
  });
  const [preferences, setPreferences] = useState<MealPlanPreferences>(buildInitial);

  // Re-seed the restrictions when the profile changes after mount.
  const dietKey = `${userDietaryPreferences.join('|')}#${userAllergies.join('|')}`;
  useEffect(() => {
    setPreferences((p) => ({ ...p, dietaryRestrictions: buildInitial().dietaryRestrictions }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dietKey]);

  const toggleMeal = (mealType: MealType) => {
    const current = preferences.mealsToInclude;
    if (current.includes(mealType)) {
      if (current.length <= 1) return; // keep at least one meal type
      setPreferences({ ...preferences, mealsToInclude: current.filter((m) => m !== mealType) });
    } else {
      setPreferences({ ...preferences, mealsToInclude: [...current, mealType] });
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <Screen
        bare
        footer={
          <CtaBar fade>
            <UButton
              variant="accent"
              label={t('plan.generate', 'Generate Meal Plan')}
              loading={isGenerating}
              onPress={() => onGenerate(preferences)}
            />
          </CtaBar>
        }
      >
        <TopBar
          variant="compact"
          title={t('planGen.title', 'New Meal Plan')}
          left={<UIconButton icon="close" label={t('planGen.cancel', 'Cancel')} onPress={onClose} />}
        />
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 20, gap: 16, paddingBottom: 150 }}
          showsVerticalScrollIndicator={false}
        >
          {expiringItemsCount > 0 ? (
            <View className="flex-row items-center" style={{ gap: 12 }}>
              <AvatarStack
                size={44}
                people={[
                  { name: 'Spinach', source: SAMPLE.spinach },
                  { name: 'Chicken', source: SAMPLE.chicken },
                  { name: 'Eggs', source: SAMPLE.eggs },
                ]}
              />
              <View className="flex-1">
                <Title>{t('planGen.expiring', '{{n}} items expiring', { n: expiringItemsCount })}</Title>
                <Muted small>{t('planGen.expiringHint', "They'll be used first")}</Muted>
              </View>
            </View>
          ) : null}

          <View className="flex-row items-center justify-between" style={{ gap: 12 }}>
            <View className="flex-1">
              <Title>{t('planGen.servings', 'Servings per meal')}</Title>
              <Muted small>{t('planGen.servingsHint', 'How many are you cooking for?')}</Muted>
            </View>
            <Stepper
              label={t('planGen.servings', 'Servings per meal')}
              value={preferences.servingsPerMeal}
              min={1}
              max={10}
              onChange={(v) => setPreferences({ ...preferences, servingsPerMeal: v })}
            />
          </View>

          <View style={{ gap: 10 }}>
            <Title>{t('planGen.days', 'Days to plan')}</Title>
            <View className="flex-row flex-wrap" style={{ gap: 8 }}>
              {DAY_OPTIONS.map((n) => (
                <Chip
                  key={n}
                  label={t('planGen.daysN', '{{n}} days', { n })}
                  on={preferences.daysToGenerate === n}
                  onPress={() => setPreferences({ ...preferences, daysToGenerate: n })}
                />
              ))}
            </View>
          </View>

          <View style={{ gap: 10 }}>
            <Title>{t('planGen.meals', 'Meals')}</Title>
            <View className="flex-row flex-wrap" style={{ gap: 8 }}>
              {MEAL_OPTIONS.map((m) => (
                <Chip
                  key={m.type}
                  label={t(m.key, m.label)}
                  outlined={preferences.mealsToInclude.includes(m.type)}
                  onPress={() => toggleMeal(m.type)}
                />
              ))}
            </View>
          </View>

          {preferences.dietaryRestrictions.length > 0 ? (
            <View style={{ gap: 10 }}>
              <View className="flex-row items-center justify-between">
                <Title>{t('planGen.dietary', 'Dietary')}</Title>
                {onEditDietary ? (
                  <Pressable
                    accessibilityRole="link"
                    accessibilityLabel={t('planGen.edit', 'Edit')}
                    onPress={onEditDietary}
                    hitSlop={12}
                    style={{ minHeight: 44, justifyContent: 'center' }}
                  >
                    <LinkText>{t('planGen.edit', 'Edit')}</LinkText>
                  </Pressable>
                ) : null}
              </View>
              <View className="flex-row flex-wrap" style={{ gap: 6 }}>
                {preferences.dietaryRestrictions.map((r) => (
                  <Tag key={r} large tone={/^no /i.test(r) ? 'r' : 'g'} label={r.charAt(0).toUpperCase() + r.slice(1)} />
                ))}
              </View>
            </View>
          ) : null}

          <Rows>
            <SwitchRow
              label={t('planGen.prioritize', 'Prioritize expiring items')}
              value={preferences.prioritizeExpiring}
              onChange={(v) => setPreferences({ ...preferences, prioritizeExpiring: v })}
            />
            <SwitchRow
              label={t('planGen.overlap', 'Maximize ingredient overlap')}
              value={preferences.maximizeOverlap}
              onChange={(v) => setPreferences({ ...preferences, maximizeOverlap: v })}
            />
            <SwitchRow
              label={t('planGen.budget', 'Budget-friendly')}
              value={preferences.budgetFriendly}
              onChange={(v) => setPreferences({ ...preferences, budgetFriendly: v })}
            />
          </Rows>
        </ScrollView>
      </Screen>
    </Modal>
  );
};

function SwitchRow({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View className="flex-row items-center" style={{ minHeight: 64, gap: 14 }}>
      <RNText className="flex-1 text-ink" style={{ fontFamily: FONT.display, fontSize: 15 }}>
        {label}
      </RNText>
      <USwitch label={label} value={value} onValueChange={onChange} />
    </View>
  );
}
