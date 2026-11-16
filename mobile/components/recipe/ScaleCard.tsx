import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { scaleRecipe, type ScaleNoteRequest, type ScaleRecipeResponse, type ScaleSource } from '@shared/index';
import { Pressable } from '@/components/ui/Pressable';
import { FONT, Muted, Tag, UButton, UCard, useColor } from '@/components/ui';
import { ApiError, apiEnabled } from '@/lib/api';
import { apiSaveScaleNote, apiScaleRecipe } from '@/services/aiToolsApi';
import type { Ingredient } from '@/types';

type Units = 'original' | 'metric' | 'us';
const PRESETS = [2, 4, 6, 10, 20];
/** Same cut-offs as the server: close to the written size, plain multiplication is right and needs no network. */
const CLOSE_LOW = 0.67;
const CLOSE_HIGH = 1.5;

interface Props {
  recipeId: string;
  servings: number;
  ingredients: Ingredient[];
  instructions: string[];
  /** Signed in people can add how they scaled it; the server checks that they wrote or made the recipe. */
  signedIn: boolean;
}

const SOURCE_LABEL: Record<ScaleSource, { key: string; fallback: string }> = {
  creator: { key: 'scale.fromCooks', fallback: 'From cooks who made it' },
  ai: { key: 'scale.aiEstimate', fallback: 'AI estimate' },
  community: { key: 'scale.fromCommunity', fallback: 'Based on other cooks' },
  math: { key: 'scale.mathOnly', fallback: 'Plain maths' },
};

/** Cook for a different number of people. Small changes are worked out on the phone; big ones ask the server. */
export function ScaleCard({ recipeId, servings, ingredients, instructions, signedIn }: Props) {
  const { t } = useTranslation();
  const spinner = useColor('muted');
  const [target, setTarget] = useState(servings);
  const [units, setUnits] = useState<Units>('original');
  const [result, setResult] = useState<ScaleRecipeResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [noting, setNoting] = useState(false);

  const factor = target / Math.max(1, servings);
  const stale = result !== null && (result.servings !== target);

  const run = async () => {
    setError('');
    if (!apiEnabled() || (factor >= CLOSE_LOW && factor <= CLOSE_HIGH)) {
      const local = scaleRecipe({ servings, ingredients, instructions }, { servings: target, units });
      setResult({
        recipeId,
        fromServings: servings,
        servings: target,
        factor: local.factor,
        source: 'math',
        ingredients: local.ingredients,
        instructions: local.instructions,
        tips: [],
        timeNote: '',
        basedOn: 0,
        note: local.note,
      });
      return;
    }
    setBusy(true);
    try {
      setResult(await apiScaleRecipe(recipeId, { servings: target, units }));
    } catch (err) {
      setError(err instanceof ApiError && err.code === 'limit_reached' ? t('scale.limit', 'You have used today\'s scaling help. Plain maths still works for small changes.') : t('scale.failed', 'Could not scale this just now. Try again in a moment.'));
    } finally {
      setBusy(false);
    }
  };

  const chip = (label: string, on: boolean, onPress: () => void, key: string) => (
    <Pressable key={key} onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: on }} className={on ? 'bg-accent' : 'bg-surface-3'} style={{ minHeight: 40, paddingHorizontal: 14, borderRadius: 20, alignItems: 'center', justifyContent: 'center' }}>
      <Text className={on ? 'text-accent-ink' : 'text-ink'} style={{ fontFamily: FONT.sansMedium, fontSize: 14 }}>{label}</Text>
    </Pressable>
  );

  return (
    <UCard>
      <View style={{ gap: 12 }}>
        <Text className="text-ink" style={{ fontFamily: FONT.display, fontSize: 17 }}>{t('scale.title', 'Cook for a different crowd')}</Text>
        <View className="flex-row items-center" style={{ gap: 12 }}>
          <Pressable onPress={() => setTarget((n) => Math.max(1, n - 1))} accessibilityRole="button" accessibilityLabel={t('scale.fewer', 'Fewer people')} className="bg-surface-3" style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' }}>
            <Text className="text-ink" style={{ fontFamily: FONT.display, fontSize: 22 }}>−</Text>
          </Pressable>
          <Text className="text-ink" style={{ fontFamily: FONT.display, fontSize: 24, minWidth: 40, textAlign: 'center' }} accessibilityLabel={t('cooking.servingsCount', '{{count}} servings', { count: target })}>{target}</Text>
          <Pressable onPress={() => setTarget((n) => Math.min(100, n + 1))} accessibilityRole="button" accessibilityLabel={t('scale.more', 'More people')} className="bg-surface-3" style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' }}>
            <Text className="text-ink" style={{ fontFamily: FONT.display, fontSize: 22 }}>+</Text>
          </Pressable>
          <Muted>{t('scale.people', 'people')}</Muted>
        </View>
        <View className="flex-row flex-wrap" style={{ gap: 8 }}>{PRESETS.map((n) => chip(String(n), target === n, () => setTarget(n), `p${n}`))}</View>
        <View className="flex-row flex-wrap" style={{ gap: 8 }}>
          {chip(t('scale.original', 'As written'), units === 'original', () => setUnits('original'), 'u0')}
          {chip(t('scale.metric', 'Metric'), units === 'metric', () => setUnits('metric'), 'u1')}
          {chip(t('scale.us', 'US cups'), units === 'us', () => setUnits('us'), 'u2')}
        </View>
        <UButton size="sm" label={busy ? t('scale.working', 'Working it out...') : t('scale.go', 'Scale the recipe')} onPress={run} disabled={busy} />
        {busy ? <ActivityIndicator color={spinner} /> : null}
        {error ? <Text className="text-ink" accessibilityRole="alert" style={{ fontFamily: FONT.sans, fontSize: 14 }}>{error}</Text> : null}

        {result && !busy ? (
          <View style={{ gap: 8, opacity: stale ? 0.5 : 1 }}>
            <View className="flex-row items-center justify-between" style={{ gap: 8 }}>
              <Tag tone={result.source === 'math' ? 'default' : 'g'} label={t(SOURCE_LABEL[result.source].key, SOURCE_LABEL[result.source].fallback)} />
              <Muted small>{t('scale.forPeople', 'For {{count}} people', { count: result.servings })}</Muted>
            </View>
            {result.ingredients.map((ing, i) => (
              <View key={`${ing.name}-${i}`} className="flex-row justify-between" style={{ gap: 12 }}>
                <Text className="flex-1 text-ink" style={{ fontFamily: FONT.sans, fontSize: 15 }}>{ing.name}</Text>
                <Text className="text-ink" style={{ fontFamily: FONT.sansSemi, fontSize: 15 }}>{ing.amount} {ing.unit}</Text>
              </View>
            ))}
            {result.timeNote ? <Muted>{result.timeNote}</Muted> : null}
            {result.tips.map((tip, i) => <Muted key={`tip-${i}`}>• {tip}</Muted>)}
            {result.note ? <Muted small>{result.note}</Muted> : null}
            {stale ? <Muted small>{t('scale.stale', 'The number of people changed: scale again.')}</Muted> : null}
          </View>
        ) : null}

        {signedIn && apiEnabled() ? (
          noting ? (
            <ScaleNoteForm recipeId={recipeId} servings={servings} ingredients={ingredients} initialServings={target === servings ? Math.max(1, servings * 2) : target} onDone={() => setNoting(false)} />
          ) : (
            <Pressable onPress={() => setNoting(true)} accessibilityRole="button" style={{ minHeight: 44, justifyContent: 'center' }}>
              <Text className="text-accent" style={{ fontFamily: FONT.sansMedium, fontSize: 14 }}>{t('scale.addNote', 'Cooked it for a different crowd? Add what you used')}</Text>
            </Pressable>
          )
        ) : null}
      </View>
    </UCard>
  );
}

interface NoteProps {
  recipeId: string;
  servings: number;
  ingredients: Ingredient[];
  initialServings: number;
  onDone: () => void;
  /** Hand the numbers back instead of sending them now (used while a post is being written). */
  deferred?: (request: ScaleNoteRequest) => void;
}

/** Lets a cook tell the app what they really used. Other people's scaling gets better from it. */
export function ScaleNoteForm({ recipeId, servings, ingredients, initialServings, onDone, deferred }: NoteProps) {
  const { t } = useTranslation();
  const [people, setPeople] = useState(String(initialServings));
  const factor = (Number(people) || servings) / Math.max(1, servings);
  const suggested = useMemo(() => ingredients.map((i) => Math.round(i.amount * factor * 100) / 100), [ingredients, factor]);
  const [used, setUsed] = useState<Record<number, string>>({});
  const [tip, setTip] = useState('');
  const [pan, setPan] = useState('');
  const [minutes, setMinutes] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const submit = async () => {
    const n = Math.round(Number(people));
    if (!Number.isFinite(n) || n < 1 || n > 100 || n === servings) {
      setMessage(t('scale.pickSize', 'Say how many people you cooked for (a different number from the recipe).'));
      return;
    }
    // Only amounts the cook typed in are sent; the rest are left for the server to work out.
    const amounts: ScaleNoteRequest['amounts'] = [];
    ingredients.forEach((ing, i) => {
      const value = Number((used[i] ?? '').replace(',', '.'));
      if (used[i] && Number.isFinite(value) && value > 0) amounts.push({ name: ing.name, amount: value, unit: ing.unit });
    });
    if (amounts.length === 0) {
      setMessage(t('scale.typeSome', 'Type at least one amount you used.'));
      return;
    }
    const request: ScaleNoteRequest = {
      servings: n,
      amounts,
      ...(tip.trim() ? { tip: tip.trim() } : {}),
      ...(pan.trim() ? { panNote: pan.trim() } : {}),
      ...(Number(minutes) > 0 ? { cookTimeMin: Math.round(Number(minutes)) } : {}),
    };
    // While writing a post the numbers are kept and sent once the post exists (only then may the server accept them).
    if (deferred) {
      deferred(request);
      setMessage(t('scale.willShare', 'Saved. Your numbers are shared when you post.'));
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      await apiSaveScaleNote(recipeId, request);
      setMessage(t('scale.thanks', 'Thank you. This helps everyone who cooks it at that size.'));
      setTimeout(onDone, 1200);
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : t('scale.noteFailed', 'Could not save that just now.'));
    } finally {
      setBusy(false);
    }
  };

  const field = (value: string, onChange: (v: string) => void, placeholder: string, numeric = false, label?: string) => (
    <TextInput value={value} onChangeText={onChange} placeholder={placeholder} accessibilityLabel={label ?? placeholder} keyboardType={numeric ? 'decimal-pad' : 'default'} className="bg-surface-3 text-ink" style={{ minHeight: 44, borderRadius: 14, paddingHorizontal: 12, fontFamily: FONT.sans, fontSize: 15 }} />
  );

  return (
    <View style={{ gap: 8 }}>
      <Text className="text-ink" style={{ fontFamily: FONT.sansSemi, fontSize: 15 }}>{t('scale.noteTitle', 'What did you use?')}</Text>
      {field(people, setPeople, t('scale.noteHowMany', 'People you cooked for'), true)}
      {ingredients.map((ing, i) => (
        <View key={`${ing.name}-${i}`} className="flex-row items-center" style={{ gap: 8 }}>
          <Text className="flex-1 text-ink" style={{ fontFamily: FONT.sans, fontSize: 14 }}>{ing.name} ({ing.unit})</Text>
          <View style={{ width: 110 }}>{field(used[i] ?? '', (v) => setUsed((u) => ({ ...u, [i]: v })), String(suggested[i]), true, `${ing.name} ${ing.unit}`)}</View>
        </View>
      ))}
      {field(pan, setPan, t('scale.notePan', 'Pan or pot size (optional)'))}
      {field(minutes, setMinutes, t('scale.noteMinutes', 'Total cooking minutes (optional)'), true)}
      {field(tip, setTip, t('scale.noteTip', 'A tip for others (optional)'))}
      {message ? <Muted accessibilityRole="alert">{message}</Muted> : null}
      <View className="flex-row" style={{ gap: 8 }}>
        <UButton size="sm" label={busy ? t('scale.saving', 'Saving...') : t('scale.save', 'Share my numbers')} onPress={submit} disabled={busy} />
        <UButton size="sm" variant="ghost" label={t('common.cancel', 'Cancel')} onPress={onDone} />
      </View>
    </View>
  );
}
