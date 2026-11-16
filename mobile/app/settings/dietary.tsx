import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/authStore';
import { Chip, CtaBar, H2, Muted, Screen, TopBar, UButton } from '@/components/ui';
import { showSuccessToast, showErrorToast } from '@/stores/toastStore';

const HEALTH_CONDITIONS = [
  { id: 'diabetic-type1', label: 'Type 1 Diabetes' },
  { id: 'diabetic-type2', label: 'Type 2 Diabetes' },
  { id: 'heart-disease', label: 'Heart Disease' },
  { id: 'high-blood-pressure', label: 'High Blood Pressure' },
  { id: 'high-cholesterol', label: 'High Cholesterol' },
  { id: 'gerd', label: 'GERD / Acid Reflux' },
  { id: 'ibs', label: 'IBS' },
  { id: 'celiac', label: 'Celiac Disease' },
  { id: 'kidney-disease', label: 'Kidney Disease' },
  { id: 'gout', label: 'Gout' },
  { id: 'pcos', label: 'PCOS' },
];

const DIETARY_OPTIONS = [
  { id: 'vegetarian', label: 'Vegetarian' },
  { id: 'vegan', label: 'Vegan' },
  { id: 'gluten-free', label: 'Gluten-Free' },
  { id: 'dairy-free', label: 'Dairy-Free' },
  { id: 'keto', label: 'Keto' },
  { id: 'paleo', label: 'Paleo' },
  { id: 'low-carb', label: 'Low Carb' },
  { id: 'halal', label: 'Halal' },
  { id: 'kosher', label: 'Kosher' },
  { id: 'pescatarian', label: 'Pescatarian' },
  { id: 'whole30', label: 'Whole30' },
  { id: 'low-fodmap', label: 'Low FODMAP' },
  { id: 'anti-inflammatory', label: 'Anti-Inflammatory' },
  { id: 'low-sodium', label: 'Low Sodium' },
  { id: 'mediterranean-diet', label: 'Mediterranean' },
];

const ALLERGY_OPTIONS = [
  { id: 'nuts', label: 'Tree Nuts' },
  { id: 'peanuts', label: 'Peanuts' },
  { id: 'shellfish', label: 'Shellfish' },
  { id: 'fish', label: 'Fish' },
  { id: 'eggs', label: 'Eggs' },
  { id: 'soy', label: 'Soy' },
  { id: 'wheat', label: 'Wheat' },
  { id: 'sesame', label: 'Sesame' },
  { id: 'milk', label: 'Milk / Lactose' },
  { id: 'corn', label: 'Corn' },
  { id: 'mustard', label: 'Mustard' },
  { id: 'celery', label: 'Celery' },
  { id: 'lupin', label: 'Lupin' },
  { id: 'mollusks', label: 'Mollusks' },
  { id: 'sulfites', label: 'Sulfites' },
  { id: 'gluten', label: 'Gluten' },
];

const toggleIn = (list: string[], id: string) =>
  list.includes(id) ? list.filter((x) => x !== id) : [...list, id];

export default function DietaryPreferencesScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { user, updateUserProfile, isLoading } = useAuthStore();

  const [selectedConditions, setSelectedConditions] = useState<string[]>(user?.healthConditions || []);
  const [selectedDiets, setSelectedDiets] = useState<string[]>(user?.dietaryPreferences || []);
  const [selectedAllergies, setSelectedAllergies] = useState<string[]>(user?.allergies || []);

  const handleSave = async () => {
    try {
      await updateUserProfile({
        dietaryPreferences: selectedDiets,
        allergies: selectedAllergies,
        healthConditions: selectedConditions,
      });
      showSuccessToast(
        t('account.dietary.savedBody', "All set! We've updated your dietary preferences."),
        t('account.dietary.saved', 'Preferences Saved')
      );
      router.back();
    } catch (error) {
      showErrorToast(
        t('account.dietary.saveFailed', "Hmm, we couldn't save your preferences. Want to try again?"),
        t('account.dietary.saveProblem', 'Save Problem')
      );
    }
  };

  const group = (
    options: { id: string; label: string }[],
    selected: string[],
    setSelected: React.Dispatch<React.SetStateAction<string[]>>
  ) => (
    <View className="flex-row flex-wrap" style={{ gap: 8 }}>
      {options.map((o) => (
        <Chip
          key={o.id}
          label={o.label}
          on={selected.includes(o.id)}
          onPress={() => setSelected((prev) => toggleIn(prev, o.id))}
        />
      ))}
    </View>
  );

  return (
    <Screen
      bare
      footer={
        <CtaBar fade>
          <UButton label={t('account.dietary.save', 'Save Preferences')} onPress={handleSave} loading={isLoading} />
        </CtaBar>
      }
    >
      <TopBar variant="compact" title={t('account.dietary.title', 'Dietary Preferences')} onBack={() => router.back()} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 150, gap: 14 }}>
        <Muted>
          {t('account.dietary.intro', 'We use these to recommend recipes and filter out ingredients you avoid.')}
        </Muted>

        <H2>{t('account.dietary.diet', 'Diet')}</H2>
        {group(DIETARY_OPTIONS, selectedDiets, setSelectedDiets)}

        <H2>{t('account.dietary.allergies', 'Allergies')}</H2>
        {group(ALLERGY_OPTIONS, selectedAllergies, setSelectedAllergies)}

        <H2>{t('account.dietary.conditions', 'Health Conditions')}</H2>
        <Muted small>
          {t(
            'account.dietary.conditionsHint',
            'Medical conditions help us flag recipes that may not be safe for you and generate condition-appropriate meal plans.'
          )}
        </Muted>
        {group(HEALTH_CONDITIONS, selectedConditions, setSelectedConditions)}
      </ScrollView>
    </Screen>
  );
}
