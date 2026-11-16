import React, { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Muted, UButton } from '@/components/ui';
import { apiEnabled } from '@/lib/api';
import { aiErrorText } from '@/lib/aiError';
import { apiSearchIntent } from '@/services/aiToolsApi';
import type { RecipeFilters } from '@/types';

/** Turns "light chicken dinner under 30 minutes, no nuts" into the filters the browse screen already has. */
export function SmartSearchButton({ text, filters, onApply }: { text: string; filters: RecipeFilters; onApply: (filters: RecipeFilters, searchText: string) => void }) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  // Short searches work fine as plain keywords; the helper is for whole sentences.
  if (!apiEnabled() || text.trim().split(/\s+/).length < 3) return null;

  const run = async () => {
    setBusy(true);
    setMessage('');
    try {
      const { filters: f } = await apiSearchIntent(text.trim());
      const next: RecipeFilters = { ...filters };
      if (f.category) next.category = f.category as RecipeFilters['category'];
      if (f.cuisine) next.cuisine = f.cuisine as RecipeFilters['cuisine'];
      if (f.difficulty) next.difficulty = f.difficulty as RecipeFilters['difficulty'];
      if (f.maxPrepTime) next.maxPrepTime = f.maxPrepTime;
      if (f.dietaryFlags?.length) next.dietaryFlags = f.dietaryFlags;
      if (f.excludeAllergens?.length) next.excludeAllergens = f.excludeAllergens;
      onApply(next, f.q ?? '');
      setMessage(t('ai.searchApplied', 'Filters set from your words. Change them below if they are off.'));
    } catch (err) {
      setMessage(aiErrorText(err, t('ai.searchFailed', 'Could not read that just now. Plain search still works.')));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ gap: 6 }}>
      <UButton size="sm" variant="ghost" label={busy ? t('ai.searchWorking', 'Reading...') : t('ai.searchGo', 'Understand my words')} onPress={run} disabled={busy} />
      {message ? <Muted small accessibilityRole="alert">{message}</Muted> : null}
    </View>
  );
}
