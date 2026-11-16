import React, { useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { REWRITE_GOALS, type CookChatRequest, type RewriteGoal, type RewriteRecipeResponse } from '@shared/index';
import { FONT, Muted, UButton } from '@/components/ui';
import { api, apiEnabled } from '@/lib/api';
import { aiErrorText } from '@/lib/aiError';
import { apiCookChat, apiRewriteRecipe } from '@/services/aiToolsApi';
import type { Recipe } from '@/types';
import { AiCard, AiChip, AiNote } from './AiBits';

type Turn = NonNullable<CookChatRequest['history']>[number];

/** Ask the recipe a question mid-cooking. Keeps the last six turns; the server adds food-safety rules. */
export function CookChatCard({ recipeId, stepIndex }: { recipeId: string; stepIndex?: number }) {
  const { t } = useTranslation();
  const [question, setQuestion] = useState('');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (!apiEnabled()) return null;

  const send = async () => {
    const q = question.trim();
    if (!q || busy) return;
    setBusy(true);
    setError('');
    try {
      const res = await apiCookChat({ recipeId, question: q, ...(stepIndex !== undefined ? { stepIndex } : {}), history: turns.slice(-6) });
      setTurns((prev) => [...prev, { role: 'user' as const, text: q }, { role: 'assistant' as const, text: res.answer }].slice(-12));
      setQuestion('');
    } catch (err) {
      setError(aiErrorText(err, t('ai.chatFailed', 'Could not answer just now.')));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AiCard title={t('ai.chatTitle', 'Ask while you cook')} busy={busy} error={error}>
      {turns.map((turn, i) => (
        <Text key={`t-${i}`} className={turn.role === 'user' ? 'text-muted' : 'text-ink'} style={{ fontFamily: turn.role === 'user' ? FONT.sans : FONT.sansMedium, fontSize: 15, lineHeight: 21 }}>
          {turn.role === 'user' ? `${t('ai.you', 'You')}: ` : ''}{turn.text}
        </Text>
      ))}
      <TextInput value={question} onChangeText={setQuestion} onSubmitEditing={send} returnKeyType="send" maxLength={300} accessibilityLabel={t('ai.chatPlaceholder', 'Ask about this recipe')} placeholder={t('ai.chatPlaceholder', 'Ask about this recipe')} className="bg-surface-3 text-ink" style={{ minHeight: 44, borderRadius: 14, paddingHorizontal: 12, fontFamily: FONT.sans, fontSize: 15 }} />
      <UButton size="sm" label={t('ai.ask', 'Ask')} onPress={send} disabled={busy || !question.trim()} />
      <AiNote>{t('ai.chatNote', 'Cooking help only. It cannot tell you a food is safe for an allergy or a medical condition.')}</AiNote>
    </AiCard>
  );
}

const GOAL_LABEL: Record<RewriteGoal, string> = {
  vegan: 'Vegan',
  vegetarian: 'Vegetarian',
  'gluten-free': 'Gluten-free',
  'low-sodium': 'Low salt',
  'under-500-kcal': 'Under 500 kcal',
  'high-protein': 'High protein',
};

/** Rewrite a recipe for a goal. Shows a draft to look over; saving makes a private draft recipe, never replaces the original. */
export function RewriteCard({ recipe }: { recipe: Recipe }) {
  const { t } = useTranslation();
  const router = useRouter();
  const [goal, setGoal] = useState<RewriteGoal | null>(null);
  const [out, setOut] = useState<RewriteRecipeResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (!apiEnabled()) return null;

  const run = async (g: RewriteGoal) => {
    setGoal(g);
    setBusy(true);
    setError('');
    setOut(null);
    try {
      setOut(await apiRewriteRecipe({ recipeId: recipe.id, goal: g }));
    } catch (err) {
      setError(aiErrorText(err, t('ai.rewriteFailed', 'Could not rewrite this just now.')));
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (!out) return;
    setBusy(true);
    try {
      const created = await api().post<{ id: string }>('/v1/recipes', {
        title: out.draft.title,
        description: recipe.description,
        imageUrl: recipe.imageURL,
        category: recipe.category,
        cuisine: recipe.cuisine,
        difficulty: recipe.difficulty,
        prepTime: recipe.prepTime,
        cookTime: recipe.cookTime,
        servings: recipe.servings,
        ingredients: out.draft.ingredients.map((i) => ({ name: i.name, amount: i.amount, unit: i.unit, optional: i.optional })),
        instructions: out.draft.instructions,
        dietaryFlags: out.draft.dietaryFlags,
        status: 'draft',
      });
      router.push(`/recipe/${created.id}`);
    } catch (err) {
      setError(aiErrorText(err, t('ai.saveFailed', 'Could not save the draft.')));
    } finally {
      setBusy(false);
    }
  };

  const verdict = out ? (out.meetsGoal === true ? t('ai.meets', 'Looks like it meets the goal') : out.meetsGoal === false ? t('ai.notMeets', 'Does not clearly meet the goal: look it over') : t('ai.cannotCheck', 'We cannot check this one for you')) : '';

  return (
    <AiCard title={t('ai.rewriteTitle', 'Make it...')} busy={busy} error={error}>
      <View className="flex-row flex-wrap" style={{ gap: 8 }}>
        {REWRITE_GOALS.map((g) => <AiChip key={g} label={t(`ai.goal.${g}`, GOAL_LABEL[g])} on={goal === g} onPress={() => run(g)} />)}
      </View>
      {out ? (
        <View style={{ gap: 6 }}>
          <Text className="text-ink" style={{ fontFamily: FONT.display, fontSize: 16 }}>{out.draft.title}</Text>
          <Muted>{verdict} · {out.draft.caloriesPerServing} kcal · {out.draft.protein} g {t('ai.protein', 'protein')}</Muted>
          {out.draft.ingredients.map((i, n) => <Text key={`${i.name}-${n}`} className="text-ink" style={{ fontFamily: FONT.sans, fontSize: 14 }}>{i.amount} {i.unit} {i.name}</Text>)}
          {out.notes.map((n, i) => <Muted key={`n-${i}`} small>• {n}</Muted>)}
          <UButton size="sm" label={t('ai.saveDraft', 'Save as my private draft')} onPress={save} disabled={busy} />
        </View>
      ) : null}
      <AiNote>{t('ai.rewriteNote', 'A draft only: nothing changes until you save it. Check labels and allergies yourself.')}</AiNote>
    </AiCard>
  );
}
