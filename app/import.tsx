import React, { useEffect, useState } from 'react';
import { Alert, Keyboard, KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { SAMPLE } from '@/assets/sample';
import { ThinkingPhase } from '@/lib/gemini';
import { detectPlatform } from '@/services/recipeImportService';
import { useAuthStore } from '@/stores/authStore';
import { useWantToCookStore } from '@/stores/wantToCookStore';
import { useShareIntentStore } from '@/stores/shareIntentStore';
import { useSubscription } from '@/hooks/useSubscription';
import {
  Body,
  Check,
  CtaBar,
  Icon,
  LinkText,
  Muted,
  PhotoCard,
  Screen,
  Tag,
  Title,
  TopBar,
  UButton,
  UIconButton,
  UInput,
} from '@/components/ui';

// Friendly label for detected source types (carried over from the old URL import modal).
const SOURCE_LABELS: Record<string, string> = {
  tiktok: 'TikTok',
  instagram: 'Instagram',
  youtube: 'YouTube',
  x: 'X',
  website: 'Web',
  facebook: 'Facebook',
  pinterest: 'Pinterest',
  threads: 'Threads',
  reddit: 'Reddit',
  snapchat: 'Snapchat',
  pdf: 'PDF document',
  json: 'JSON data',
  xml: 'XML/RSS feed',
  text: 'Text file',
  image: 'Image',
  video: 'Video file',
  audio: 'Audio file',
  allrecipes: 'AllRecipes',
  foodnetwork: 'Food Network',
  bonappetit: 'Bon Appétit',
  seriouseats: 'Serious Eats',
  tasty: 'Tasty',
  delish: 'Delish',
  epicurious: 'Epicurious',
  nyt_cooking: 'NYT Cooking',
  bbc_food: 'BBC Food',
  simplyrecipes: 'Simply Recipes',
  food52: 'Food52',
  cookpad: 'Cookpad',
  yummly: 'Yummly',
  budgetbytes: 'Budget Bytes',
};

const STEP_PHASES: ThinkingPhase[] = ['watching', 'reading', 'building'];

type StepState = 'done' | 'active' | 'pending';

function StepRow({ label, state, trailing }: { label: string; state: StepState; trailing?: string }) {
  return (
    <View className="flex-row items-center" style={{ height: 52, gap: 12 }}>
      {state === 'active' ? (
        <View className="border-accent" style={{ width: 26, height: 26, borderRadius: 13, borderWidth: 2 }} />
      ) : (
        <Check checked={state === 'done'} label={label} />
      )}
      <View className="flex-1">
        {state === 'active' ? <Title numberOfLines={1}>{label}</Title> : state === 'pending' ? <Muted numberOfLines={1}>{label}</Muted> : <Body numberOfLines={1}>{label}</Body>}
      </View>
      {trailing ? <Muted small>{trailing}</Muted> : null}
    </View>
  );
}

export default function ImportScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ url?: string }>();
  const { user } = useAuthStore();
  const { subscriptionTier } = useSubscription();
  const sharedURL = useShareIntentStore((s) => s.sharedURL);
  const consumeSharedURL = useShareIntentStore((s) => s.consumeSharedURL);
  const importFromURL = useWantToCookStore((s) => s.importFromURL);
  const fetchWantToCookItems = useWantToCookStore((s) => s.fetchWantToCookItems);
  const isImporting = useWantToCookStore((s) => s.isImporting);
  const importProgress = useWantToCookStore((s) => s.importProgress);
  const error = useWantToCookStore((s) => s.error);
  const setError = useWantToCookStore((s) => s.setError);
  const thinkingPhase = useWantToCookStore((s) => s.thinkingPhase);
  const thinkingNotes = useWantToCookStore((s) => s.thinkingNotes);

  const [url, setUrl] = useState('');

  // Pre-fill from a route param or a pending share-intent URL; clear stale errors.
  useEffect(() => {
    setError(null);
    if (params.url) {
      setUrl(params.url);
    } else if (sharedURL) {
      const shared = consumeSharedURL();
      if (shared) setUrl(shared);
    }
  }, []);

  const handlePaste = async () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    try {
      const text = await Clipboard.getStringAsync();
      if (text) setUrl(text);
    } catch (e) {
      console.error('Failed to paste:', e);
    }
  };

  const close = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)');
  };

  const handleImport = async () => {
    if (!url.trim()) {
      Alert.alert(t('importUi.enterUrl', 'Enter URL'), t('importUi.enterUrlBody', 'Please paste a recipe URL to import.'));
      return;
    }

    if (!user) {
      Alert.alert(
        t('importUi.signIn', 'Sign In Required'),
        t('importUi.signInBody', 'Please sign in to save recipes.')
      );
      return;
    }

    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    Keyboard.dismiss();

    const result = await importFromURL(url.trim(), user.id);

    if (result) {
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      const title = result.importedRecipe?.title || t('importUi.recipeFallback', 'Recipe');
      setUrl('');
      close();
      Alert.alert(
        t('importUi.doneTitle', 'Recipe Imported!'),
        t('importUi.doneBody', '"{{title}}" has been added to your Want to Cook list.', { title }),
        [
          { text: t('importUi.viewRecipes', 'View Recipes'), onPress: () => router.push('/want-to-cook' as Href) },
          { text: t('kitchen.ok', 'OK'), style: 'default' },
        ]
      );
      // Refresh items so the new recipe shows immediately
      fetchWantToCookItems(user.id);
    } else if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  const detected = url ? detectPlatform(url) : null;
  const detectedLabel = detected ? SOURCE_LABELS[detected] ?? null : null;
  const hasUrl = url.trim().length > 0;

  // Steps follow the AI "thinking" phases. While importing with no phase yet, the first step is active.
  const phaseIndex =
    thinkingPhase === 'done'
      ? STEP_PHASES.length
      : STEP_PHASES.indexOf(thinkingPhase) >= 0
        ? STEP_PHASES.indexOf(thinkingPhase)
        : isImporting
          ? 0
          : -1;
  const stepState = (i: number): StepState => {
    if (phaseIndex < 0) return 'pending';
    if (i < phaseIndex) return 'done';
    return i === phaseIndex && isImporting ? 'active' : 'pending';
  };
  const stepLabels = [
    t('importUi.stepWatching', 'Watching video'),
    t('importUi.stepReading', 'Reading recipe…'),
    t('importUi.stepBuilding', 'Building steps & timers'),
  ];
  const stepTrailing = (i: number): string | undefined => {
    const s = stepState(i);
    if (s === 'done') return t('importUi.done', 'Done');
    if (s === 'active' && i === 1 && thinkingNotes.length > 0)
      return t('importUi.notes', '{{n}} notes', { n: thinkingNotes.length });
    return undefined;
  };
  const lastNote = thinkingNotes.length > 0 ? thinkingNotes[thinkingNotes.length - 1] : importProgress;

  const previewTitle = detectedLabel
    ? t('importUi.previewDetected', '{{source}} recipe', { source: detectedLabel })
    : t('importUi.previewEmpty', 'Paste a recipe link');
  const previewSubtitle = detectedLabel
    ? t('importUi.previewDetectedBody', 'Detected from your link')
    : t('importUi.previewEmptyBody', 'TikTok, Instagram, YouTube or any recipe site');

  return (
    <Screen
      bare
      footer={
        <CtaBar fade>
          <UButton
            label={isImporting ? t('importUi.importing', 'Importing...') : t('importUi.import', 'Import Recipe')}
            onPress={handleImport}
            disabled={!hasUrl}
            loading={isImporting}
          />
        </CtaBar>
      }
    >
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <TopBar
          variant="compact"
          title={t('importUi.title', 'Import recipe')}
          left={<UIconButton icon="close" label={t('general.close', 'Close')} onPress={close} />}
        />
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 20, gap: 16, paddingBottom: 150 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <PhotoCard
            source={SAMPLE.phone}
            height={220}
            title={previewTitle}
            subtitle={previewSubtitle}
            topLeft={
              detectedLabel ? (
                <Tag tone="glass" large icon="play" label={detectedLabel} />
              ) : undefined
            }
          />

          <UInput
            icon="link"
            label={t('importUi.urlLabel', 'Recipe URL')}
            placeholder="https://..."
            value={url}
            onChangeText={setUrl}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            returnKeyType="go"
            onSubmitEditing={handleImport}
            editable={!isImporting}
            right={
              <UButton
                size="sm"
                variant="white"
                label={t('importUi.paste', 'Paste')}
                onPress={handlePaste}
                disabled={isImporting}
              />
            }
          />

          <View>
            {STEP_PHASES.map((phase, i) => (
              <StepRow key={phase} label={stepLabels[i]} state={stepState(i)} trailing={stepTrailing(i)} />
            ))}
          </View>

          {isImporting && lastNote ? <Muted small numberOfLines={3}>{lastNote}</Muted> : null}

          {error && !isImporting ? (
            <View className="flex-row items-start" style={{ gap: 8 }}>
              <Icon name="warning" size="sm" color="tag-r-fg" />
              <Body className="flex-1 text-tag-r-fg">{error}</Body>
            </View>
          ) : null}

          {subscriptionTier === 'free' ? (
            <View className="flex-row items-center justify-between">
              <Muted small>{t('importUi.freePlan', 'Free plan')}</Muted>
              <LinkText accent onPress={() => router.push('/subscription' as Href)} style={{ fontSize: 12, paddingVertical: 14 }}>
                {t('importUi.goUnlimited', 'Go unlimited')}
              </LinkText>
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
