import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { PlateCheckResponse, ScaleNoteRequest } from '../../shared/index';
import { Pressable } from '@/components/ui/Pressable';
import { FONT, Muted, UButton } from '@/components/ui';
import { ScaleNoteForm } from '@/components/recipe/ScaleCard';
import { apiEnabled } from '@/lib/api';
import { aiErrorText } from '@/lib/aiError';
import { useRecipe } from '@/hooks/useRecipes';
import { apiPlateCheck, apiSuggestCaption } from '@/services/aiToolsApi';
import { AiCard, AiNote } from './AiBits';

interface Props {
  /** A photo from the phone (file or content address). Nothing shows for the sample photos. */
  photo: string;
  recipeId?: string;
  /** Fills the caption box; the person can still edit it. */
  onCaption: (caption: string) => void;
  /** The cook's own scaling numbers, held until the post is published. */
  onScaleNote: (request: ScaleNoteRequest | null) => void;
  hasScaleNote: boolean;
}

/** On the new-post screen: write a caption from the photo, check the plate, and say how you scaled the recipe. */
export function PostAiHelpers({ photo, recipeId, onCaption, onScaleNote, hasScaleNote }: Props) {
  const { t } = useTranslation();
  const real = /^(file|content):/i.test(photo);
  const { recipe: fetched } = useRecipe(recipeId ?? '');
  const recipe = recipeId && fetched && fetched.id === recipeId ? fetched : null; // the store keeps one "current" recipe, so make sure it is this one
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [plate, setPlate] = useState<PlateCheckResponse | null>(null);
  const [noting, setNoting] = useState(false);
  if (!apiEnabled() || (!real && !(recipeId && recipe))) return null;

  const caption = async () => {
    setBusy(true);
    setError('');
    try {
      const res = await apiSuggestCaption(photo);
      onCaption([res.caption, res.tags.map((tag) => `#${tag.replace(/^#/, '')}`).join(' ')].filter(Boolean).join('\n\n'));
    } catch (err) {
      setError(aiErrorText(err, t('ai.captionFailed', 'Could not write a caption just now.')));
    } finally {
      setBusy(false);
    }
  };

  const check = async () => {
    setBusy(true);
    setError('');
    try {
      setPlate(await apiPlateCheck(photo, recipeId));
    } catch (err) {
      setError(aiErrorText(err, t('ai.plateFailed', 'Could not look at that photo just now.')));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AiCard title={t('ai.postTitle', 'AI helpers')} busy={busy} error={error}>
      {real ? (
        <View className="flex-row flex-wrap" style={{ gap: 8 }}>
          <UButton size="sm" label={t('ai.captionGo', 'Suggest a caption')} onPress={caption} disabled={busy} />
          <UButton size="sm" variant="ghost" label={t('ai.plateGo', 'Check my plate')} onPress={check} disabled={busy} />
        </View>
      ) : null}
      {plate ? (
        <View style={{ gap: 4 }}>
          <Text className="text-ink" style={{ fontFamily: FONT.sansMedium, fontSize: 15 }}>{plate.praise}</Text>
          {plate.tip ? <Muted>{plate.tip}</Muted> : null}
          <AiNote>{plate.note}</AiNote>
        </View>
      ) : null}
      {recipeId && recipe ? (
        noting ? (
          <ScaleNoteForm recipeId={recipeId} servings={recipe.servings} ingredients={recipe.ingredients} initialServings={Math.max(1, recipe.servings * 2)} onDone={() => setNoting(false)} deferred={(req) => onScaleNote(req)} />
        ) : (
          <Pressable onPress={() => setNoting(true)} accessibilityRole="button" style={{ minHeight: 44, justifyContent: 'center' }}>
            <Text className="text-accent" style={{ fontFamily: FONT.sansMedium, fontSize: 14 }}>
              {hasScaleNote ? t('scale.noteReady', 'Your scaling numbers will be shared. Tap to change') : t('scale.postStep', 'Cooked it for a different crowd? Add how you scaled it')}
            </Text>
          </Pressable>
        )
      ) : null}
    </AiCard>
  );
}
