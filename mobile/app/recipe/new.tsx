import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Platform, ScrollView, Text as RNText, View } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import type { ImportedRecipe } from '@shared/index';
import { Body, Chip, ChipRow, CtaBar, Display, Field, H2, Icon, Muted, SectionLabel, Screen, Segmented, UButton, UIconButton } from '@/components/ui';
import { FONT } from '@/components/ui/fonts';
import { FIXED } from '@/stores/themeStore';
import { ApiError, apiEnabled } from '@/lib/api';
import { guestBlocked } from '@/lib/guestPrompt';
import { formatIngredientLine, parseIngredientLines } from '@/lib/ingredientLines';
import { splitSteps } from '@/lib/stepSplit';
import { clearDraft, emptyDraft, loadDraft, saveDraft, type RecipeDraft } from '@/lib/recipeDraft';
import { apiReadRecipeText } from '@/services/aiToolsApi';
import { useAuthStore } from '@/stores/authStore';
import { useRecipeStore } from '@/stores/recipeStore';
import { uploadImage } from '@/lib/cloudinary';
import { showErrorToast, showInfoToast, showSuccessToast } from '@/stores/toastStore';
import type { Cuisine, Difficulty, RecipeCategory } from '@/types';

const STEPS = ['Photo and name', 'Ingredients', 'Method', 'Details'] as const;

const CATEGORIES: RecipeCategory[] = ['breakfast', 'lunch', 'dinner', 'dessert', 'snack', 'appetizer', 'beverage', 'side'];
const CUISINES: Cuisine[] = ['nigerian', 'west-african', 'african', 'american', 'italian', 'mexican', 'chinese', 'japanese', 'indian', 'thai', 'french', 'mediterranean', 'korean', 'vietnamese', 'other'];
const label = (v: string) => v.replace(/-/g, ' ').replace(/^./, (c) => c.toUpperCase());

/** What a draft read from text looks like in the writing form. */
const draftFromImported = (r: ImportedRecipe): RecipeDraft => ({
  ...emptyDraft(),
  title: r.title,
  ingredientsText: r.ingredients.map((i) => formatIngredientLine({ name: i.name, amount: i.amount, unit: i.unit, optional: Boolean(i.optional) })).join('\n'),
  stepsText: r.instructions.join('\n\n'),
  servings: r.servings || 4,
  prepTime: r.prepTime ?? 15,
  cookTime: r.cookTime ?? 30,
  category: r.category ?? 'dinner',
  cuisine: r.cuisine ?? 'other',
  difficulty: r.difficulty ?? 'medium',
  tags: r.tags ?? [],
});

/**
 * Writing a recipe in four short steps: photo and name, ingredients as plain lines, the method as one block, then a quick look
 * at the details. It saves itself as you go, and can start from text you paste or dictate (the keyboard's microphone works
 * in every box).
 */
export default function NewRecipeScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const createRecipe = useRecipeStore((s) => s.createRecipe);

  const [mode, setMode] = useState<'loading' | 'start' | 'write'>('loading');
  const [draft, setDraft] = useState<RecipeDraft>(emptyDraft());
  const [resumed, setResumed] = useState(false);
  const [pasted, setPasted] = useState('');
  const [reading, setReading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [tagsText, setTagsText] = useState('');
  const loaded = useRef(false);

  const patch = useCallback((p: Partial<RecipeDraft>) => setDraft((d) => ({ ...d, ...p })), []);

  // Pick up where the person left off.
  useEffect(() => {
    let alive = true;
    (async () => {
      const saved = user ? await loadDraft(user.id) : null;
      if (!alive) return;
      if (saved) {
        setDraft(saved);
        setTagsText(saved.tags.join(', '));
        setResumed(true);
        setMode('write');
      } else {
        setMode('start');
      }
      loaded.current = true;
    })();
    return () => {
      alive = false;
    };
  }, [user]);

  // Save after every change (a moment after typing stops).
  useEffect(() => {
    if (!loaded.current || !user || mode !== 'write') return;
    const timer = setTimeout(() => void saveDraft(user.id, draft), 400);
    return () => clearTimeout(timer);
  }, [draft, mode, user]);

  const ingredients = useMemo(() => parseIngredientLines(draft.ingredientsText), [draft.ingredientsText]);
  const steps = useMemo(() => splitSteps(draft.stepsText), [draft.stepsText]);

  const pickPhoto = async (camera: boolean) => {
    if (camera) {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        showInfoToast(t('recipeNew.cameraNeeded', 'Allow the camera to take a photo, or choose one from your gallery.'));
        return;
      }
    }
    const options = { allowsEditing: true, aspect: [16, 9] as [number, number], quality: 0.8 };
    const result = camera ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync({ ...options, mediaTypes: ImagePicker.MediaTypeOptions.Images });
    if (!result.canceled && result.assets[0]) patch({ imageUri: result.assets[0].uri });
  };

  const readText = async () => {
    if (guestBlocked()) return;
    if (pasted.trim().length < 20) {
      showInfoToast(t('recipeNew.pasteMore', 'Paste or write the recipe first: what goes in and what to do.'));
      return;
    }
    setReading(true);
    try {
      const recipe = await apiReadRecipeText(pasted);
      const next = draftFromImported(recipe);
      setDraft(next);
      setTagsText(next.tags.join(', '));
      setMode('write');
      showSuccessToast(t('recipeNew.filled', 'Filled in for you. Check it and add a photo.'));
    } catch (err) {
      const msg = err instanceof ApiError && err.status === 409 ? t('recipeNew.limit', "You've used today's imports. You can still write it step by step.") : err instanceof ApiError && err.status === 400 ? t('recipeNew.noRecipe', "We couldn't find both ingredients and steps in that. Add them and try again, or write it step by step.") : t('recipeNew.readFailed', "We couldn't read that. Try again, or write it step by step.");
      showErrorToast(msg, t('recipeNew.problem', 'Recipe problem'));
    } finally {
      setReading(false);
    }
  };

  const startOver = async () => {
    if (user) await clearDraft(user.id);
    setDraft(emptyDraft());
    setTagsText('');
    setResumed(false);
    setPasted('');
    setMode('start');
  };

  const close = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)'));

  const canNext = [draft.title.trim().length >= 2, ingredients.length >= 1, steps.length >= 1, true][draft.step] ?? true;

  const publish = async () => {
    if (!user) {
      showInfoToast(t('recipeNew.signIn', 'Sign in so we can save your recipe to your cookbook.'));
      return;
    }
    if (guestBlocked()) return;
    if (!draft.imageUri) {
      patch({ step: 0 });
      showInfoToast(t('recipeNew.needPhoto', 'Add a photo of your dish, then publish.'));
      return;
    }
    setPublishing(true);
    try {
      const imageAddress = apiEnabled() ? draft.imageUri : await uploadImage(draft.imageUri, `souschef/recipes/${user.id}`);
      const tags = tagsText.split(',').map((x) => x.trim().toLowerCase()).filter(Boolean);
      await createRecipe(
        {
          title: draft.title.trim(),
          description: (steps[0] ?? '').slice(0, 140),
          category: draft.category as RecipeCategory,
          cuisine: draft.cuisine as Cuisine,
          difficulty: draft.difficulty,
          prepTime: Math.max(0, draft.prepTime),
          cookTime: Math.max(0, draft.cookTime),
          servings: Math.max(1, draft.servings),
          ingredients: ingredients.map((i) => ({ name: i.name, amount: i.amount, unit: i.unit, optional: i.optional })),
          instructions: steps,
          tags,
        },
        imageAddress,
        user.id,
        user.displayName,
        user.role === 'chef' || user.role === 'admin',
      );
      await clearDraft(user.id);
      showSuccessToast(t('recipeNew.done', 'Your recipe is in your cookbook.'), t('recipeNew.great', 'Published'));
      router.replace('/(tabs)');
    } catch {
      showErrorToast(t('recipeNew.publishFailed', "We couldn't publish that. Your recipe is saved here, so try again."), t('recipeNew.problem', 'Recipe problem'));
    } finally {
      setPublishing(false);
    }
  };

  const header = (title: string, sub?: string) => (
    <View style={{ paddingTop: Math.max(insets.top, 20) + 8, paddingHorizontal: 20, paddingBottom: 12, gap: 10 }}>
      <View className="flex-row items-center justify-between">
        <UIconButton icon="close" label={t('recipeNew.close', 'Close')} onPress={close} />
        {mode === 'write' ? (
          <UButton size="sm" variant="ghost" label={t('recipeNew.startOver', 'Start over')} onPress={() => void startOver()} />
        ) : null}
      </View>
      <Display size={28}>{title}</Display>
      {sub ? <Muted>{sub}</Muted> : null}
    </View>
  );

  if (mode === 'loading') {
    return (
      <Screen bare>
        {header(t('recipeNew.title', 'Write a recipe'))}
        <View className="items-center" style={{ paddingTop: 40 }}>
          <ActivityIndicator />
        </View>
      </Screen>
    );
  }

  /* ---------------------------------------------------------- how do you want to start */
  if (mode === 'start') {
    return (
      <Screen bare footer={undefined}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 48 }}>
            {header(t('recipeNew.startTitle', 'How do you want to start?'), t('recipeNew.startSub', 'The quickest way is to paste or say the recipe. We fill the form in and you just check it.'))}
            <View style={{ paddingHorizontal: 20, gap: 14 }}>
              <Field
                label={t('recipeNew.pasteLabel', 'Paste or say your recipe')}
                value={pasted}
                onChangeText={setPasted}
                placeholder={t('recipeNew.pastePlaceholder', 'Moi moi: 2 cups beans, 2 peppers, 1 onion. Blend, steam for an hour...')}
                multiline
              />
              <UButton variant="accent" label={reading ? t('recipeNew.reading', 'Reading it...') : t('recipeNew.make', 'Fill in my recipe')} loading={reading} onPress={() => void readText()} />
              <Muted small>{t('recipeNew.micHint', 'Tip: tap the microphone on your keyboard to say it instead of typing.')}</Muted>

              <SectionLabel>{t('recipeNew.or', 'Or start from')}</SectionLabel>
              <UButton variant="ghost" label={t('recipeNew.link', 'A link to a video or website')} onPress={() => router.replace('/import' as Href)} />
              <UButton variant="ghost" label={t('recipeNew.cookbook', 'A photo of a cookbook page')} onPress={() => router.replace('/cookbook-library' as Href)} />
              <UButton variant="ghost" label={t('recipeNew.blank', 'Write it step by step')} onPress={() => setMode('write')} />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Screen>
    );
  }

  /* ---------------------------------------------------------- the four steps */
  const last = draft.step === STEPS.length - 1;
  const next = () => {
    if (!canNext) {
      showInfoToast([t('recipeNew.needTitle', 'Give it a name first.'), t('recipeNew.needIngredient', 'Add at least one ingredient.'), t('recipeNew.needStep', 'Add at least one step.')][draft.step] ?? '');
      return;
    }
    if (last) void publish();
    else patch({ step: draft.step + 1 });
  };

  return (
    <Screen
      bare
      footer={
        <CtaBar fade>
          {draft.step > 0 ? <UButton variant="ghost" label={t('recipeNew.back', 'Back')} onPress={() => patch({ step: draft.step - 1 })} /> : null}
          <UButton
            variant="accent"
            label={last ? t('recipeNew.publish', 'Publish recipe') : t('recipeNew.next', 'Next')}
            loading={publishing}
            disabled={publishing}
            onPress={next}
            style={{ flex: 1 }}
          />
        </CtaBar>
      }
    >
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 190 }}>
          {header(STEPS[draft.step]!, t('recipeNew.stepOf', 'Step {{n}} of {{total}}', { n: draft.step + 1, total: STEPS.length }))}
          <View className="flex-row" style={{ gap: 6, paddingHorizontal: 20, paddingBottom: 14 }} accessibilityRole="progressbar" accessibilityLabel={t('recipeNew.stepOf', 'Step {{n}} of {{total}}', { n: draft.step + 1, total: STEPS.length })}>
            {STEPS.map((s, i) => (
              <View key={s} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i <= draft.step ? FIXED.accent : FIXED.placeholder, opacity: i <= draft.step ? 1 : 0.35 }} />
            ))}
          </View>

          <View style={{ paddingHorizontal: 20, gap: 16 }}>
            {resumed && draft.step === 0 ? <Muted small>{t('recipeNew.resumed', 'Welcome back: your recipe is right where you left it.')}</Muted> : null}

            {draft.step === 0 ? (
              <>
                <View className="bg-surface-3 overflow-hidden" style={{ height: 190, borderRadius: 28 }}>
                  {draft.imageUri ? <Image source={{ uri: draft.imageUri }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} contentFit="cover" /> : (
                    <View className="flex-1 items-center justify-center" style={{ gap: 6 }}>
                      <Icon name="image" size="lg" color="muted" />
                      <Muted>{t('recipeNew.photoHint', 'A photo of your dish')}</Muted>
                    </View>
                  )}
                  <View className="flex-row" style={{ position: 'absolute', right: 12, bottom: 12, gap: 8 }}>
                    <UIconButton icon="image" tone="glass" label={t('recipeNew.gallery', 'Choose from gallery')} onPress={() => void pickPhoto(false)} />
                    <UIconButton icon="camera" tone="glass" label={t('recipeNew.camera', 'Take photo')} onPress={() => void pickPhoto(true)} />
                  </View>
                </View>
                <Field
                  label={t('recipeNew.name', 'What is it called?')}
                  value={draft.title}
                  onChangeText={(v) => patch({ title: v })}
                  placeholder={t('recipeNew.namePlaceholder', "e.g., Grandma's Sunday roast")}
                  returnKeyType="next"
                />
              </>
            ) : null}

            {draft.step === 1 ? (
              <>
                <Field
                  label={t('recipeNew.ingredientsLabel', 'One ingredient per line')}
                  value={draft.ingredientsText}
                  onChangeText={(v) => patch({ ingredientsText: v })}
                  placeholder={'2 cups rice\n1 tbsp oil\n3 tomatoes\nsalt to taste'}
                  multiline
                />
                <Muted small>{t('recipeNew.ingredientsHint', 'Write them the way you would say them. You can paste a whole list.')}</Muted>
                {ingredients.length > 0 ? (
                  <View style={{ gap: 6 }}>
                    <SectionLabel>{t('recipeNew.understood', '{{n}} ingredients', { n: ingredients.length })}</SectionLabel>
                    {ingredients.map((i, idx) => (
                      <RNText key={`${i.name}-${idx}`} className="text-ink" style={{ fontFamily: FONT.sans, fontSize: 14 }}>
                        {i.amount > 0 ? <RNText style={{ fontFamily: FONT.sansSemi }}>{`${Math.round(i.amount * 100) / 100} ${i.unit} `}</RNText> : null}
                        {i.name}
                        {i.optional ? ' (optional)' : ''}
                      </RNText>
                    ))}
                  </View>
                ) : null}
              </>
            ) : null}

            {draft.step === 2 ? (
              <>
                <Field
                  label={t('recipeNew.methodLabel', 'What do you do?')}
                  value={draft.stepsText}
                  onChangeText={(v) => patch({ stepsText: v })}
                  placeholder={t('recipeNew.methodPlaceholder', 'Fry the onions. Add the tomatoes and cook for 10 minutes. Stir in the rice...')}
                  multiline
                />
                <Muted small>{t('recipeNew.methodHint', 'Write it all in one go, or one step per line. We split it into steps for you.')}</Muted>
                {steps.length > 0 ? (
                  <View style={{ gap: 8 }}>
                    <SectionLabel>{t('recipeNew.stepsFound', '{{n}} steps', { n: steps.length })}</SectionLabel>
                    {steps.map((s, idx) => (
                      <View key={`${idx}-${s.slice(0, 12)}`} className="flex-row" style={{ gap: 10 }}>
                        <RNText className="text-muted" style={{ fontFamily: FONT.sansSemi, fontSize: 14, width: 22 }}>{`${idx + 1}.`}</RNText>
                        <Body style={{ flex: 1 }}>{s}</Body>
                      </View>
                    ))}
                  </View>
                ) : null}
              </>
            ) : null}

            {draft.step === 3 ? (
              <>
                <Muted>{t('recipeNew.detailsHint', 'We guessed these. Change anything that is not right, then publish.')}</Muted>
                <View className="flex-row" style={{ gap: 10 }}>
                  <View className="flex-1">
                    <Field label={t('recipeNew.servings', 'Servings')} keyboardType="number-pad" value={String(draft.servings)} onChangeText={(v) => patch({ servings: parseInt(v, 10) || 1 })} />
                  </View>
                  <View className="flex-1">
                    <Field label={t('recipeNew.prep', 'Prep (min)')} keyboardType="number-pad" value={String(draft.prepTime)} onChangeText={(v) => patch({ prepTime: parseInt(v, 10) || 0 })} />
                  </View>
                  <View className="flex-1">
                    <Field label={t('recipeNew.cook', 'Cook (min)')} keyboardType="number-pad" value={String(draft.cookTime)} onChangeText={(v) => patch({ cookTime: parseInt(v, 10) || 0 })} />
                  </View>
                </View>
                <SectionLabel>{t('recipeNew.category', 'Meal')}</SectionLabel>
                <View style={{ marginHorizontal: -20 }}>
                  <ChipRow>
                    {CATEGORIES.map((c) => (
                      <Chip key={c} label={label(c)} on={draft.category === c} onPress={() => patch({ category: c })} />
                    ))}
                  </ChipRow>
                </View>
                <SectionLabel>{t('recipeNew.cuisine', 'Cuisine')}</SectionLabel>
                <View style={{ marginHorizontal: -20 }}>
                  <ChipRow>
                    {CUISINES.map((c) => (
                      <Chip key={c} label={label(c)} on={draft.cuisine === c} onPress={() => patch({ cuisine: c })} />
                    ))}
                  </ChipRow>
                </View>
                <SectionLabel>{t('recipeNew.difficulty', 'How hard is it?')}</SectionLabel>
                <Segmented<Difficulty>
                  value={draft.difficulty}
                  onChange={(v) => patch({ difficulty: v })}
                  options={[
                    { value: 'easy', label: t('recipeNew.easy', 'Easy') },
                    { value: 'medium', label: t('recipeNew.medium', 'Medium') },
                    { value: 'hard', label: t('recipeNew.hard', 'Hard') },
                  ]}
                />
                <Field label={t('recipeNew.tags', 'Tags (optional, separated by commas)')} value={tagsText} onChangeText={setTagsText} autoCapitalize="none" placeholder="spicy, party, vegan" />
                {!draft.imageUri ? <H2>{t('recipeNew.noPhotoYet', 'You still need a photo (step 1).')}</H2> : null}
              </>
            ) : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
