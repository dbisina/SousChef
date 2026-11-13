import React, { useState, useEffect, useMemo, useRef } from 'react';
import { View, Text, ScrollView, Alert, Pressable, ActivityIndicator, useWindowDimensions } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Image } from 'expo-image';
import { Ingredient } from '@/types';
import { useRecipe } from '@/hooks/useRecipes';
import { usePortionAnalysis, useCookingTips } from '@/hooks/useAI';
import { useRemainingUsage } from '@/hooks/useSubscription';
import { useVoiceControl, useCookingTimers, useVoiceCommandHandler, useRemainingVoiceUses } from '@/hooks/useVoice';
import { CameraCapture, PortionAnalysisResult, PortionAnalysisLoading } from '@/components/camera';
import { IngredientList, ActionBar } from '@/components/recipe';
import {
  Chip,
  Dot,
  FONT,
  H1,
  H2,
  Icon,
  Muted,
  PhotoCard,
  Ring,
  Screen,
  SectionLabel,
  Stepper,
  Tag,
  UBadge,
  UButton,
  UCard,
  UIconButton,
  USwitch,
  useColor,
} from '@/components/ui';
import { Paywall } from '@/components/subscription';
import { VoiceOverlay, TimerDisplay } from '@/components/voice';
import { formatInstructionForSpeech } from '@/services/voiceService';
import { useGeminiLive } from '@/hooks/useGeminiLive';
import { useGamificationStore } from '@/stores/gamificationStore';

type CookingStage = 'prep' | 'cooking' | 'done';

/** Pull "4-5 minutes" / "10 mins" out of a step so we can offer a one-tap timer. */
const suggestMinutes = (instruction: string): number | null => {
  const m = instruction.match(/(\d+)(?:\s*(?:-|–|to)\s*(\d+))?\s*(?:minutes?|mins?)\b/i);
  if (!m) return null;
  const n = parseInt(m[2] ?? m[1], 10);
  return n > 0 && n <= 240 ? n : null;
};

interface HeroProps {
  source: { uri: string };
  height: number;
  left?: React.ReactNode;
  center?: React.ReactNode;
  right?: React.ReactNode;
  children?: React.ReactNode;
}

/** Cook.html hero: photo with darkened top/bottom, rounded bottom corners, glass controls on top. */
function Hero({ source, height, left, center, right, children }: HeroProps) {
  const insets = useSafeAreaInsets();
  const top = Math.max(insets.top, 20) + 38;
  return (
    <View style={{ borderBottomLeftRadius: 36, borderBottomRightRadius: 36, overflow: 'hidden' }}>
      <PhotoCard source={source} height={height} radius={0} fade="both">
        <View
          pointerEvents="box-none"
          style={{ position: 'absolute', top, left: 20, right: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, zIndex: 2 }}
        >
          {left}
          {center}
          <View className="flex-row items-center" style={{ gap: 8 }}>
            {right}
          </View>
        </View>
        {children}
      </PhotoCard>
    </View>
  );
}

/** Icon button with a small remaining-uses count in the corner. */
function BadgedButton({ count, children }: { count?: number | 'unlimited'; children: React.ReactNode }) {
  return (
    <View>
      {children}
      {typeof count === 'number' && count > 0 ? (
        <View pointerEvents="none" style={{ position: 'absolute', top: -4, right: -4 }}>
          <UBadge count={count} />
        </View>
      ) : null}
    </View>
  );
}

export default function CookingModeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t } = useTranslation();
  const { height: windowHeight } = useWindowDimensions();
  const spinner = useColor('muted');
  const { recipe, isLoading } = useRecipe(id);
  const { tips, fetchTips } = useCookingTips();
  const { result: portionResult, isAnalyzing, analyzeImage, clear: clearPortionResult, accessDenied } = usePortionAnalysis();
  const { remainingPortion } = useRemainingUsage();
  const streak = useGamificationStore((s) => s.streak.currentStreak);

  // Voice control hooks
  const {
    isInitialized: voiceInitialized,
    isListening,
    isSpeaking,
    isProcessing,
    transcript,
    lastCommand,
    error: voiceError,
    state: voiceState,
    accessDenied: voiceAccessDenied,
    isWakeWordMode,
    isWakeWordListening,
    toggleListening,
    speakText,
    checkVoiceAccess,
    enableWakeWordMode,
    disableWakeWordMode,
  } = useVoiceControl();

  const { timers, createTimer, pauseTimer, resumeTimer, removeTimer, formatTime } = useCookingTimers();

  const remainingVoice = useRemainingVoiceUses();

  const [stage, setStage] = useState<CookingStage>('prep');
  const [currentStep, setCurrentStep] = useState(0);
  const [checkedIngredients, setCheckedIngredients] = useState<Set<string>>(new Set());
  const [showCamera, setShowCamera] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [showVoiceOverlay, setShowVoiceOverlay] = useState(false);
  const [paywallFeature, setPaywallFeature] = useState<'Portion Analysis' | 'Voice Hands-Free'>('Portion Analysis');
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [servings, setServings] = useState(4);
  const [useLiveAI, setUseLiveAI] = useState(false);
  const [cookedMinutes, setCookedMinutes] = useState(0);
  const startedAt = useRef<number | null>(null);

  // Gemini Live API — real-time voice conversation
  const geminiLive = useGeminiLive({
    recipe: recipe || undefined,
    currentStep,
    onTimerRequested: (minutes, label) => {
      createTimer(label, minutes);
    },
    onNextStep: handleNextStepFromAI,
    onPreviousStep: handlePrevStepFromAI,
    onServingsChanged: (s) => setServings(s),
  });

  function handleNextStepFromAI() {
    if (recipe && currentStep < recipe.instructions.length - 1) {
      setCurrentStep((prev) => prev + 1);
    }
  }

  function handlePrevStepFromAI() {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  }

  // Notify Gemini Live when step changes
  useEffect(() => {
    if (useLiveAI && geminiLive.isConnected) {
      geminiLive.updateContext(currentStep);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep, useLiveAI, geminiLive.isConnected]);

  useEffect(() => {
    if (recipe) {
      setServings(recipe.servings);
      fetchTips(recipe);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recipe]);

  // Cleanup wake word mode and Gemini Live on unmount
  useEffect(() => {
    return () => {
      if (isWakeWordMode) {
        disableWakeWordMode();
      }
      geminiLive.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isWakeWordMode]);

  const handleToggleIngredient = (name: string) => {
    const newChecked = new Set(checkedIngredients);
    if (newChecked.has(name)) {
      newChecked.delete(name);
    } else {
      newChecked.add(name);
    }
    setCheckedIngredients(newChecked);
  };

  const handleNextStep = () => {
    if (recipe && currentStep < recipe.instructions.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      if (startedAt.current) {
        setCookedMinutes(Math.max(1, Math.round((Date.now() - startedAt.current) / 60000)));
      }
      setStage('done');
    }
  };

  const handlePrevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleStartCooking = () => {
    startedAt.current = Date.now();
    setStage('cooking');
    setCurrentStep(0);
  };

  // Handle voice command for reading step
  useEffect(() => {
    if (lastCommand?.command === 'read_step' && recipe && stage === 'cooking') {
      const text = formatInstructionForSpeech(
        recipe.instructions[currentStep],
        currentStep + 1,
        recipe.instructions.length
      );
      speakText(text);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastCommand]);

  // Voice command handler
  useVoiceCommandHandler(
    currentStep,
    recipe?.instructions.length || 0,
    recipe?.ingredients || [],
    handleNextStep,
    handlePrevStep
  );

  const handleCapture = async (imageUri: string) => {
    setCapturedImage(imageUri);
    setShowCamera(false);
    if (recipe) {
      const result = await analyzeImage(imageUri, recipe);
      // If access was denied, show the paywall
      if (!result && accessDenied) {
        setPaywallFeature('Portion Analysis');
        setShowPaywall(true);
      }
    }
  };

  const handleVoicePress = async () => {
    // Check access first
    const access = await checkVoiceAccess();
    if (!access.allowed) {
      setPaywallFeature('Voice Hands-Free');
      setShowPaywall(true);
      return;
    }
    setShowVoiceOverlay(true);
  };

  const handleToggleVoiceListening = async () => {
    const started = await toggleListening();
    // If it failed and we have access denied, show paywall
    if (!started && voiceAccessDenied) {
      setPaywallFeature('Voice Hands-Free');
      setShowPaywall(true);
    }
  };

  const handleToggleHandsFreeMode = async () => {
    // Check access first
    const access = await checkVoiceAccess();
    if (!access.allowed) {
      setPaywallFeature('Voice Hands-Free');
      setShowPaywall(true);
      return;
    }

    if (isWakeWordMode) {
      await disableWakeWordMode();
    } else {
      await enableWakeWordMode();
    }
  };

  const handleExit = () => {
    Alert.alert(
      t('cooking.leaveTitle', 'Leaving the Kitchen?'),
      t('cooking.leaveBody', "Are you sure you want to exit? We'll lose your place in this recipe, and you'll have to start over later!"),
      [
        { text: t('cooking.keepCooking', 'Keep Cooking'), style: 'cancel' },
        { text: t('cooking.exit', 'Exit'), style: 'destructive', onPress: () => router.back() },
      ]
    );
  };

  const adjustServings = (next: number) => {
    setServings(Math.max(1, next));
  };

  // Scale ingredients based on servings
  const scaledIngredients = useMemo(() => {
    if (!recipe) return [];
    const scale = servings / recipe.servings;
    return recipe.ingredients.map((ingredient): Ingredient => ({
      ...ingredient,
      amount: Math.round(ingredient.amount * scale * 100) / 100, // Round to 2 decimal places
      calories: ingredient.calories ? Math.round(ingredient.calories * scale) : 0,
    }));
  }, [recipe, servings]);

  if (isLoading || !recipe) {
    return (
      <Screen tone="dark" bare>
        <View className="flex-1 items-center justify-center" style={{ gap: 12 }}>
          <ActivityIndicator color={spinner} />
          <Muted>{t('cooking.loadingRecipe', 'Loading recipe...')}</Muted>
        </View>
      </Screen>
    );
  }

  const photo = { uri: recipe.imageURL };
  const totalSteps = recipe.instructions.length;
  const instruction = recipe.instructions[currentStep] ?? '';
  const mainTimer = timers[0];
  const extraTimers = timers.slice(1);
  const suggested = suggestMinutes(instruction);
  const quickMinutes = Array.from(new Set([...(suggested ? [suggested] : []), 5, 10]));
  const voiceUsable = voiceInitialized && remainingVoice !== 0;

  const closeButton = (
    <UIconButton icon="close" label={t('cooking.exitCooking', 'Exit cooking')} tone="glassDark" onPress={handleExit} />
  );
  const cameraButton = (
    <BadgedButton count={remainingPortion}>
      <UIconButton
        icon="camera"
        label={t('cooking.portionAnalysis', 'Portion analysis')}
        tone="glassDark"
        onPress={() => setShowCamera(true)}
      />
    </BadgedButton>
  );
  const voiceButton = voiceInitialized ? (
    <BadgedButton count={remainingVoice}>
      <UIconButton
        icon="mic"
        label={t('cooking.voiceControl', 'Voice control')}
        tone={isListening || isWakeWordMode ? 'accent' : 'glassDark'}
        onPress={handleVoicePress}
      />
      {isWakeWordListening ? (
        <View pointerEvents="none" style={{ position: 'absolute', bottom: 0, right: 0 }}>
          <Dot />
        </View>
      ) : null}
    </BadgedButton>
  ) : null;

  return (
    <Screen tone="dark" bare>
      {/* ───────── Prep ───────── */}
      {stage === 'prep' && (
        <>
          <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 150 }}>
            <Hero
              source={photo}
              height={260}
              left={closeButton}
              center={<Tag large tone="glassDark" label={t('cooking.preparation', 'Preparation')} />}
              right={
                <>
                  {voiceButton}
                  {cameraButton}
                </>
              }
            />

            <View style={{ paddingHorizontal: 20, paddingTop: 24, gap: 18 }}>
              <H1 style={{ fontSize: 30, lineHeight: 33 }}>{recipe.title}</H1>

              {/* Servings */}
              <UCard>
                <View className="flex-row items-center justify-between">
                  <Text className="text-ink" style={{ fontFamily: FONT.display, fontSize: 17 }}>
                    {t('cooking.servings', 'Servings')}
                  </Text>
                  <Stepper value={servings} onChange={adjustServings} min={1} label={t('cooking.servings', 'Servings')} />
                </View>
              </UCard>

              {/* Voice hint with hands-free toggle */}
              {voiceUsable ? (
                <UCard>
                  <View className="flex-row items-center" style={{ gap: 12 }}>
                    <View className="items-center justify-center bg-accent" style={{ width: 44, height: 44, borderRadius: 22 }}>
                      <Icon name="mic" color="accent-ink" />
                    </View>
                    <View className="flex-1" style={{ gap: 2 }}>
                      <Text className="text-ink" style={{ fontFamily: FONT.display, fontSize: 15 }}>
                        {isWakeWordMode
                          ? t('cooking.handsFreeActive', 'Hands-Free Mode Active')
                          : t('cooking.voiceAvailable', 'Voice Control Available')}
                      </Text>
                      <Muted small>
                        {isWakeWordMode
                          ? t('cooking.sayWake', 'Say “SousChef” followed by a command')
                          : t('cooking.enableHandsFree', 'Enable hands-free or tap the mic to use voice')}
                      </Muted>
                    </View>
                    <USwitch
                      value={isWakeWordMode}
                      onValueChange={handleToggleHandsFreeMode}
                      label={t('cooking.handsFree', 'Hands-Free')}
                    />
                  </View>
                  {isWakeWordListening ? (
                    <View className="flex-row items-center" style={{ gap: 8, marginTop: 12 }}>
                      <Dot />
                      <Muted small>{t('cooking.listeningForWake', 'Listening for “SousChef”...')}</Muted>
                    </View>
                  ) : null}
                </UCard>
              ) : null}

              {/* Tips */}
              {tips.length > 0 ? (
                <UCard>
                  <View style={{ gap: 8 }}>
                    <SectionLabel>{t('cooking.cookingTips', 'Cooking Tips')}</SectionLabel>
                    {tips.map((tip, idx) => (
                      <View key={idx} className="flex-row" style={{ gap: 10 }}>
                        <View className="bg-accent" style={{ width: 6, height: 6, borderRadius: 3, marginTop: 7 }} />
                        <Text className="flex-1 text-ink" style={{ fontFamily: FONT.sans, fontSize: 14, lineHeight: 20 }}>
                          {tip}
                        </Text>
                      </View>
                    ))}
                  </View>
                </UCard>
              ) : null}

              {/* Ingredients checklist */}
              <View style={{ gap: 10 }}>
                <View className="flex-row items-center justify-between" style={{ gap: 8 }}>
                  <H2 style={{ flexShrink: 1 }}>{t('cooking.gatherIngredients', 'Gather Your Ingredients')}</H2>
                  {servings !== recipe.servings ? (
                    <Tag tone="o" label={t('cooking.scaledFor', 'Scaled for {{count}}', { count: servings })} />
                  ) : null}
                </View>
                <UCard>
                  <IngredientList
                    ingredients={scaledIngredients}
                    checkedItems={checkedIngredients}
                    onToggleItem={handleToggleIngredient}
                    showCalories
                  />
                </UCard>
              </View>

              {/* Captured image preview (shown during and after analysis) */}
              {capturedImage && !portionResult && !accessDenied ? (
                <View style={{ gap: 10 }}>
                  <H2>
                    {isAnalyzing
                      ? t('cooking.analyzingPhoto', 'Analyzing Your Photo...')
                      : t('cooking.capturedPhoto', 'Captured Photo')}
                  </H2>
                  <Image source={{ uri: capturedImage }} style={{ width: '100%', height: 190, borderRadius: 30 }} contentFit="cover" />
                </View>
              ) : null}

              {/* Portion analysis result */}
              {portionResult && capturedImage ? (
                <View style={{ gap: 10, height: 640 }}>
                  <H2>{t('cooking.portionAnalysisTitle', 'Portion Analysis')}</H2>
                  <PortionAnalysisResult
                    imageUri={capturedImage}
                    analysis={portionResult}
                    onClose={() => {
                      setCapturedImage(null);
                      clearPortionResult();
                    }}
                  />
                </View>
              ) : null}

              {/* Access denied message */}
              {accessDenied && capturedImage && !portionResult ? (
                <UCard>
                  <View style={{ gap: 10 }}>
                    <View className="flex-row items-center" style={{ gap: 8 }}>
                      <Icon name="lock" size="sm" />
                      <Text className="text-ink" style={{ fontFamily: FONT.display, fontSize: 15 }}>
                        {t('cooking.upgradeRequired', 'Upgrade Required')}
                      </Text>
                    </View>
                    <Muted>
                      {accessDenied.reason === 'limit_reached'
                        ? t('cooking.portionLimit', "You've reached your daily limit of {{limit}} portion analyses.", {
                            limit: accessDenied.limit,
                          })
                        : t('cooking.portionPremium', 'Portion analysis is a premium feature.')}
                    </Muted>
                    <UButton
                      label={t('cooking.upgrade', 'Upgrade to Continue')}
                      variant="accent"
                      size="sm"
                      onPress={() => {
                        setPaywallFeature('Portion Analysis');
                        setShowPaywall(true);
                      }}
                    />
                  </View>
                </UCard>
              ) : null}

              {/* Live AI toggle */}
              <UCard>
                <View className="flex-row items-center" style={{ gap: 12 }}>
                  <View className="flex-1" style={{ gap: 2 }}>
                    <Text className="text-ink" style={{ fontFamily: FONT.display, fontSize: 15 }}>
                      {t('cooking.geminiLive', 'Gemini Live AI')}
                    </Text>
                    <Muted small>{t('cooking.geminiLiveDesc', 'Real-time voice conversation while cooking')}</Muted>
                  </View>
                  <USwitch value={useLiveAI} onValueChange={setUseLiveAI} label={t('cooking.geminiLive', 'Gemini Live AI')} />
                </View>
              </UCard>
            </View>
          </ScrollView>

          <ActionBar>
            <UButton
              label={useLiveAI ? t('cooking.startWithAI', 'Start Cooking with AI') : t('cooking.startCooking', 'Start Cooking')}
              variant="accent"
              icon="play"
              onPress={() => {
                handleStartCooking();
                if (useLiveAI) {
                  geminiLive.connect();
                }
              }}
              style={{ flex: 1 }}
            />
          </ActionBar>
        </>
      )}

      {/* ───────── Cooking ───────── */}
      {stage === 'cooking' && (
        <>
          <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 150 }}>
            <Hero
              source={photo}
              height={300}
              left={closeButton}
              center={
                <Tag
                  large
                  tone="glassDark"
                  label={t('cooking.stepOf', 'Step {{current}} of {{total}}', { current: currentStep + 1, total: totalSteps })}
                />
              }
              right={
                <>
                  {voiceButton}
                  {cameraButton}
                </>
              }
            >
              <View
                pointerEvents="none"
                className="flex-row"
                style={{ position: 'absolute', left: 22, right: 22, bottom: 22, gap: 5 }}
              >
                {recipe.instructions.map((_, i) => (
                  <View key={i} className="flex-1 overflow-hidden" style={{ height: 6, borderRadius: 3 }}>
                    <View
                      className={i < currentStep ? 'bg-paper' : i === currentStep ? 'bg-accent' : 'bg-paper'}
                      style={{ height: 6, opacity: i > currentStep ? 0.3 : 1 }}
                    />
                  </View>
                ))}
              </View>
            </Hero>

            <View className="items-center" style={{ paddingHorizontal: 20, paddingTop: 24, gap: 18 }}>
              <View className="items-center" style={{ gap: 10 }}>
                <H1 center style={{ fontSize: 30, lineHeight: 33 }}>
                  {t('cooking.stepNumber', 'Step {{n}}', { n: currentStep + 1 })}
                </H1>
                <Text
                  className="text-muted text-center"
                  style={{ fontFamily: FONT.sans, fontSize: 17, lineHeight: 25 }}
                >
                  {instruction}
                </Text>
              </View>

              {/* Timer ring */}
              {mainTimer ? (
                <Pressable
                  onPress={() => (mainTimer.isRunning ? pauseTimer(mainTimer.id) : resumeTimer(mainTimer.id))}
                  onLongPress={() => removeTimer(mainTimer.id)}
                  accessibilityRole="button"
                  accessibilityLabel={t('cooking.timerToggle', '{{name}} timer, {{time}} remaining. Tap to pause or resume, hold to remove.', {
                    name: mainTimer.name,
                    time: formatTime(mainTimer.remainingSeconds),
                  })}
                >
                  <Ring
                    size={190}
                    thickness={11}
                    value={mainTimer.totalSeconds > 0 ? (mainTimer.totalSeconds - mainTimer.remainingSeconds) / mainTimer.totalSeconds : 0}
                    color="accent"
                  >
                    <View className="items-center">
                      <Text
                        className="text-ink"
                        style={{ fontFamily: FONT.display, fontSize: 42, lineHeight: 44, letterSpacing: -0.84 }}
                      >
                        {mainTimer.remainingSeconds <= 0 ? t('cooking.timerDone', 'Done!') : formatTime(mainTimer.remainingSeconds)}
                      </Text>
                      <Muted small>
                        {mainTimer.remainingSeconds <= 0
                          ? mainTimer.name
                          : mainTimer.isRunning
                          ? t('cooking.remaining', 'remaining')
                          : t('cooking.paused', 'paused')}
                      </Muted>
                    </View>
                  </Ring>
                </Pressable>
              ) : (
                <View className="items-center" style={{ gap: 10 }}>
                  <SectionLabel>{t('cooking.startTimer', 'Start a timer')}</SectionLabel>
                  <View className="flex-row flex-wrap justify-center" style={{ gap: 8 }}>
                    {quickMinutes.map((m) => (
                      <Chip
                        key={m}
                        icon="clock"
                        label={t('cooking.minutes', '{{count}} min', { count: m })}
                        on={m === suggested}
                        onPress={() => createTimer(t('cooking.stepTimer', 'Step {{n}}', { n: currentStep + 1 }), m)}
                      />
                    ))}
                  </View>
                </View>
              )}

              {extraTimers.length > 0 ? (
                <View style={{ alignSelf: 'stretch', marginHorizontal: -20 }}>
                  <TimerDisplay
                    timers={extraTimers}
                    onPause={pauseTimer}
                    onResume={resumeTimer}
                    onRemove={removeTimer}
                    formatTime={formatTime}
                    compact
                  />
                </View>
              ) : null}

              {/* Gemini Live AI conversation */}
              {useLiveAI && geminiLive.isConnected ? (
                <View style={{ alignSelf: 'stretch', gap: 12 }}>
                  {geminiLive.lastResponse ? (
                    <UCard>
                      <View style={{ gap: 6 }}>
                        <SectionLabel>{t('cooking.souschefAI', 'SousChef AI')}</SectionLabel>
                        <Text className="text-ink" style={{ fontFamily: FONT.sans, fontSize: 14, lineHeight: 20 }}>
                          {geminiLive.lastResponse}
                        </Text>
                      </View>
                    </UCard>
                  ) : null}

                  <View className="flex-row items-center justify-center" style={{ gap: 12 }}>
                    <UIconButton
                      icon="mic"
                      size={56}
                      tone={geminiLive.isListening ? 'white' : 'accent'}
                      label={
                        geminiLive.isListening
                          ? t('cooking.stopListening', 'Stop listening')
                          : t('cooking.talkToAI', 'Tap to talk to AI')
                      }
                      onPress={async () => {
                        if (geminiLive.isListening) {
                          await geminiLive.stopListening();
                        } else {
                          await geminiLive.startListening();
                        }
                      }}
                    />
                    <Muted small>
                      {geminiLive.isListening
                        ? t('cooking.listeningDots', 'Listening...')
                        : geminiLive.isSpeaking
                        ? t('cooking.speaking', 'Speaking...')
                        : t('cooking.talkToAI', 'Tap to talk to AI')}
                    </Muted>
                  </View>
                </View>
              ) : null}

              {/* Voice hint */}
              {!useLiveAI && voiceUsable ? (
                <View className="items-center" style={{ gap: 4 }}>
                  <Pressable
                    onPress={handleVoicePress}
                    accessibilityRole="button"
                    accessibilityLabel={t('cooking.voiceControl', 'Voice control')}
                    className="flex-row items-center"
                    style={{ minHeight: 44, gap: 10 }}
                  >
                    <View className="items-center justify-center bg-accent" style={{ width: 36, height: 36, borderRadius: 18 }}>
                      <Icon name="mic" size="sm" color="accent-ink" />
                    </View>
                    <Muted>
                      {isWakeWordMode
                        ? t('cooking.sayWakeNext', 'Say “SousChef, next step”')
                        : t('cooking.sayNext', 'Say “Next step”')}
                    </Muted>
                  </Pressable>
                  {!isWakeWordMode ? (
                    <Pressable onPress={handleToggleHandsFreeMode} accessibilityRole="button" style={{ minHeight: 44, justifyContent: 'center' }}>
                      <Text className="text-accent-text" style={{ fontFamily: FONT.sansMedium, fontSize: 13 }}>
                        {t('cooking.enableHandsFreeLink', 'Enable hands-free mode')}
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              ) : null}

              {/* Quick ingredient reference */}
              <Pressable
                onPress={() => setStage('prep')}
                accessibilityRole="button"
                className="flex-row items-center"
                style={{ minHeight: 44, gap: 8 }}
              >
                <Icon name="grid" size="sm" color="muted" />
                <Text className="text-muted" style={{ fontFamily: FONT.sansMedium, fontSize: 13 }}>
                  {t('cooking.viewIngredients', 'View Ingredients')}
                </Text>
              </Pressable>
            </View>
          </ScrollView>

          <ActionBar>
            <UButton
              label={t('cooking.prev', 'Prev')}
              variant="ghost"
              onPress={handlePrevStep}
              disabled={currentStep === 0}
              style={{ width: 120 }}
            />
            <UButton
              label={currentStep < totalSteps - 1 ? t('cooking.nextStep', 'Next Step') : t('cooking.finish', 'Finish')}
              variant="accent"
              onPress={handleNextStep}
              style={{ flex: 1 }}
            />
          </ActionBar>
        </>
      )}

      {/* ───────── Done (CookDone.html) ───────── */}
      {stage === 'done' && (
        <>
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
            <PhotoCard source={photo} height={windowHeight} radius={0} fade="both" />
          </View>
          <View
            className="flex-row items-center justify-between"
            style={{ paddingTop: 58, paddingHorizontal: 20, paddingBottom: 14 }}
          >
            <Tag
              large
              tone="glassDark"
              label={t('cooking.stepsDone', '{{total}} of {{total}} steps', { total: totalSteps })}
            />
            <UIconButton
              icon="close"
              label={t('cooking.close', 'Close')}
              tone="glassDark"
              onPress={() => router.push('/(tabs)')}
            />
          </View>

          <View style={{ position: 'absolute', left: 24, right: 24, bottom: 176, gap: 14 }}>
            <Text
              className="text-paper"
              style={{ fontFamily: FONT.display, fontSize: 44, lineHeight: 48, letterSpacing: -1.32 }}
            >
              {t('cooking.greatJob', 'Great job,\nChef.')}
            </Text>
            <Text className="text-paper" style={{ fontFamily: FONT.sans, fontSize: 15, opacity: 0.85 }}>
              {cookedMinutes > 0
                ? t('cooking.cookedIn', '{{title}} · cooked in {{count}} min', { title: recipe.title, count: cookedMinutes })
                : recipe.title}
            </Text>
            <View className="flex-row flex-wrap" style={{ gap: 8 }}>
              {streak > 0 ? (
                <Tag large tone="glassDark" icon="flame" label={t('cooking.dayStreak', '{{count}} day streak', { count: streak })} />
              ) : null}
              <Tag large tone="glassDark" label={t('cooking.servingsCount', '{{count}} servings', { count: servings })} />
            </View>
          </View>

          <ActionBar vertical fade={false}>
            <UButton
              label={t('cooking.shareCreation', 'Share Your Creation')}
              variant="accent"
              icon="camera"
              onPress={() => setShowCamera(true)}
            />
            <UButton label={t('cooking.backHome', 'Back to Home')} variant="ghost" onPress={() => router.push('/(tabs)')} />
          </ActionBar>
        </>
      )}

      {/* Camera modal */}
      <CameraCapture
        visible={showCamera}
        onClose={() => setShowCamera(false)}
        onCapture={handleCapture}
        title={t('cooking.portionAnalysisTitle', 'Portion Analysis')}
        description={t('cooking.photoIngredients', 'Take a photo of your ingredients')}
      />

      {/* Voice overlay modal */}
      <VoiceOverlay
        visible={showVoiceOverlay}
        onClose={() => setShowVoiceOverlay(false)}
        isListening={isListening}
        isSpeaking={isSpeaking}
        isProcessing={isProcessing}
        state={voiceState}
        transcript={transcript}
        lastCommand={lastCommand}
        error={voiceError}
        onToggleListening={handleToggleVoiceListening}
        isWakeWordMode={isWakeWordMode}
        isWakeWordListening={isWakeWordListening}
        onToggleWakeWordMode={handleToggleHandsFreeMode}
      />

      {/* Loading overlay for portion analysis */}
      {isAnalyzing ? (
        <View className="bg-ground" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 20 }}>
          <PortionAnalysisLoading />
        </View>
      ) : null}

      <Paywall
        visible={showPaywall}
        onClose={() => setShowPaywall(false)}
        feature={paywallFeature}
        requiredTier={
          paywallFeature === 'Voice Hands-Free'
            ? voiceAccessDenied?.upgradeRequired || 'premium'
            : accessDenied?.upgradeRequired || 'premium'
        }
      />
    </Screen>
  );
}
