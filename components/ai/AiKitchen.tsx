import React, { useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import type { PantryScanResponse, TonightResponse } from '../../shared/index';
import { Pressable } from '@/components/ui/Pressable';
import { FONT, Muted, Tag, UButton } from '@/components/ui';
import { apiEnabled } from '@/lib/api';
import { aiErrorText } from '@/lib/aiError';
import { usePantry } from '@/hooks/usePantry';
import { apiPantryScan, apiTonight } from '@/services/aiToolsApi';
import type { PantryCategory } from '@/types';
import { AiCard, AiChip, AiNote } from './AiBits';

const MINUTES = [15, 30, 60];

/** Home: "What can I cook tonight?" One pick from recipes the server ranked by what is in the pantry, with a reason. */
export function TonightCard() {
  const { t } = useTranslation();
  const router = useRouter();
  const [minutes, setMinutes] = useState<number | undefined>();
  const [mood, setMood] = useState('');
  const [out, setOut] = useState<TonightResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (!apiEnabled()) return null;

  const ask = async () => {
    setBusy(true);
    setError('');
    try {
      setOut(await apiTonight({ ...(minutes ? { maxMinutes: minutes } : {}), ...(mood.trim() ? { mood: mood.trim() } : {}) }));
    } catch (err) {
      setError(aiErrorText(err, t('ai.tonightFailed', 'Could not pick a dinner just now.')));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AiCard title={t('ai.tonightTitle', 'What can I cook tonight?')} busy={busy} error={error}>
      <View className="flex-row flex-wrap" style={{ gap: 8 }}>
        <AiChip label={t('ai.anyTime', 'Any time')} on={minutes === undefined} onPress={() => setMinutes(undefined)} />
        {MINUTES.map((m) => <AiChip key={m} label={t('cooking.minutes', '{{count}} min', { count: m })} on={minutes === m} onPress={() => setMinutes(m)} />)}
      </View>
      <TextInput value={mood} onChangeText={setMood} maxLength={60} accessibilityLabel={t('ai.moodLabel', 'Mood or craving')} placeholder={t('ai.moodPlaceholder', 'A mood? (something light, comfort food...)')} className="bg-surface-3 text-ink" style={{ minHeight: 44, borderRadius: 14, paddingHorizontal: 12, fontFamily: FONT.sans, fontSize: 15 }} />
      <UButton size="sm" label={t('ai.tonightGo', 'Pick my dinner')} onPress={ask} disabled={busy} />
      {out ? (
        <Pressable onPress={() => router.push(`/recipe/${out.recipe.id}`)} accessibilityRole="button" style={{ gap: 6 }}>
          <Text className="text-ink" style={{ fontFamily: FONT.display, fontSize: 18 }}>{out.recipe.title}</Text>
          <View className="flex-row flex-wrap" style={{ gap: 8 }}>
            <Tag tone="g" label={t('ai.matchPercent', 'You have {{pct}}%', { pct: out.recipe.matchPercent })} />
            <Tag label={t('cooking.minutes', '{{count}} min', { count: out.recipe.prepTime + out.recipe.cookTime })} />
          </View>
          <Muted>{out.recipe.why}</Muted>
          {out.recipe.missing.length > 0 ? <Muted small>{t('ai.missing', 'You would need: {{list}}', { list: out.recipe.missing.slice(0, 5).join(', ') })}</Muted> : null}
          {!out.aiUsed ? <AiNote>{t('ai.pantryPick', 'Picked by what is in your pantry.')}</AiNote> : null}
        </Pressable>
      ) : null}
    </AiCard>
  );
}

type Found = PantryScanResponse['items'][number];

/** Pantry: photograph a fridge, shelf or shop receipt; tick what is right; only then is anything added. */
export function PantryScanCard() {
  const { t } = useTranslation();
  const { addItem } = usePantry();
  const [found, setFound] = useState<Found[] | null>(null);
  const [kept, setKept] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');
  if (!apiEnabled()) return null;

  const scan = async (kind: 'fridge' | 'receipt') => {
    setError('');
    setDone('');
    const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsMultipleSelection: true, selectionLimit: 4, quality: 0.7 });
    if (picked.canceled || picked.assets.length === 0) return;
    setBusy(true);
    try {
      const res = await apiPantryScan(picked.assets.map((a) => a.uri), kind);
      setFound(res.items);
      setKept(new Set(res.items.map((_, i) => i)));
      if (res.items.length === 0) setError(t('ai.nothingFound', 'Nothing clear enough to list. Try a closer, brighter photo.'));
    } catch (err) {
      setError(aiErrorText(err, t('ai.scanFailed', 'Could not read that photo.')));
    } finally {
      setBusy(false);
    }
  };

  const addKept = async () => {
    if (!found) return;
    setBusy(true);
    try {
      const chosen = found.filter((_, i) => kept.has(i));
      for (const item of chosen) {
        await addItem({ name: item.name, amount: item.amount, unit: item.unit, category: item.category as PantryCategory, ...(item.expiresAt ? { expiryDate: new Date(item.expiresAt) } : {}) });
      }
      setDone(t('ai.added', 'Added {{count}} items to your pantry.', { count: chosen.length }));
      setFound(null);
    } catch (err) {
      setError(aiErrorText(err, t('ai.addFailed', 'Could not add those just now.')));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AiCard title={t('ai.scanTitle', 'Fill your pantry from a photo')} busy={busy} error={error}>
      {!found ? (
        <View className="flex-row flex-wrap" style={{ gap: 8 }}>
          <UButton size="sm" label={t('ai.scanFridge', 'Fridge or shelf')} onPress={() => scan('fridge')} disabled={busy} />
          <UButton size="sm" variant="ghost" label={t('ai.scanReceipt', 'Shop receipt')} onPress={() => scan('receipt')} disabled={busy} />
        </View>
      ) : (
        <View style={{ gap: 6 }}>
          {found.map((item, i) => (
            <Pressable key={`${item.name}-${i}`} onPress={() => setKept((k) => { const n = new Set(k); if (n.has(i)) n.delete(i); else n.add(i); return n; })} accessibilityRole="checkbox" accessibilityState={{ checked: kept.has(i) }} className="flex-row items-center justify-between" style={{ minHeight: 44, gap: 10 }}>
              <Text className="flex-1 text-ink" style={{ fontFamily: FONT.sans, fontSize: 15, opacity: kept.has(i) ? 1 : 0.4 }}>{kept.has(i) ? '☑ ' : '☐ '}{item.name}</Text>
              <Muted small>{item.amount} {item.unit}</Muted>
            </Pressable>
          ))}
          <View className="flex-row" style={{ gap: 8 }}>
            <UButton size="sm" label={t('ai.addN', 'Add {{count}} to pantry', { count: kept.size })} onPress={addKept} disabled={busy || kept.size === 0} />
            <UButton size="sm" variant="ghost" label={t('common.cancel', 'Cancel')} onPress={() => setFound(null)} />
          </View>
        </View>
      )}
      {done ? <Muted>{done}</Muted> : null}
      <AiNote>{t('ai.scanNote', 'Photos are read once and deleted. Check the list: the AI can misread labels.')}</AiNote>
    </AiCard>
  );
}
