import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Image } from 'expo-image';
import { Pressable } from '@/components/ui/Pressable';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import {
  Body,
  CtaBar,
  H1,
  H2,
  Icon,
  Muted,
  PhotoCard,
  Screen,
  Sheet,
  Tag,
  Title,
  TopBar,
  UButton,
  UCard,
  UIconButton,
  useTokens,
} from '@/components/ui';
import { Paywall } from '@/components/subscription';
import { samplePhoto } from '@/components/play/samplePhoto';
import { useNow } from '@/components/play/useNow';
import { HINT_COST, secondsLeft } from '@/lib/mysteryKitchen';
import { useSubscription } from '@/hooks/useSubscription';
import { apiStepImage } from '@/services/playApi';
import { usePlayStore } from '@/stores/playStore';
import * as ImagePicker from 'expo-image-picker';
import { ApiError, apiEnabled } from '@/lib/api';

const clock = (sec: number): string => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;

/** The picture of one cooking step: made on request for paid plans, a locked preview for everyone else. */
function StepPicture({ code, index, paid, onUnlock }: { code: string; index: number; paid: boolean; onUnlock: () => void }) {
  const { t } = useTranslation();
  const tk = useTokens();
  const [state, setState] = useState<{ loading: boolean; url?: string; error?: 'upgrade' | 'resting' }>({ loading: paid });

  useEffect(() => {
    if (!paid) {
      setState({ loading: false });
      return;
    }
    let cancelled = false;
    setState({ loading: true });
    apiStepImage(code, index)
      .then((r) => !cancelled && setState({ loading: false, url: r.url }))
      .catch((err) => !cancelled && setState({ loading: false, error: err instanceof ApiError && err.code === 'upgrade_required' ? 'upgrade' : 'resting' }));
    return () => {
      cancelled = true;
    };
  }, [code, index, paid]);

  if (state.url) {
    return <Image source={{ uri: state.url }} contentFit="cover" transition={200} accessibilityIgnoresInvertColors style={{ width: '100%', height: 210, borderRadius: 24 }} />;
  }
  if (state.loading) {
    return (
      <View className="items-center justify-center" style={{ height: 210, borderRadius: 24, backgroundColor: tk['surface-2'], gap: 10 }}>
        <ActivityIndicator />
        <Muted small>{t('play.mk.drawing', 'Drawing this step…')}</Muted>
      </View>
    );
  }
  if (paid && state.error === 'resting') {
    return (
      <View className="items-center justify-center" style={{ height: 120, borderRadius: 24, backgroundColor: tk['surface-2'], paddingHorizontal: 20 }}>
        <Muted center>{t('play.mk.pictureResting', 'Step pictures are resting right now. The words below still tell you what to do.')}</Muted>
      </View>
    );
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('play.mk.unlockPictures', 'Unlock step pictures with Premium')}
      onPress={onUnlock}
      style={{ height: 150, borderRadius: 24, backgroundColor: tk['surface-2'], alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 24, borderWidth: 1.5, borderColor: tk.line }}
    >
      <Icon name="lock" />
      <Title center>{t('play.mk.picturesLocked', 'See how each step should look')}</Title>
      <Muted small center>{t('play.mk.picturesPremium', 'A picture for every step is a Premium feature.')}</Muted>
    </Pressable>
  );
}

export default function MysteryRoundScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const tk = useTokens();
  const { isSubscribed } = useSubscription();
  const round = usePlayStore((s) => s.round);
  const unlockHint = usePlayStore((s) => s.useHint);
  const submitPlate = usePlayStore((s) => s.submitPlate);
  const leaveRound = usePlayStore((s) => s.leaveRound);
  const refreshRound = usePlayStore((s) => s.refreshRound);
  const [menuOpen, setMenuOpen] = useState(false);
  const [paywall, setPaywall] = useState(false);
  /** Page one is the shopping list; then one cooking step per page. */
  const [stage, setStage] = useState<'shop' | 'cook'>('shop');
  const [stepIndex, setStepIndex] = useState(0);
  const [got, setGot] = useState<Set<string>>(new Set());

  // With the server on, handing in a plate means taking a photo of it for the judge.
  const handIn = async () => {
    setMenuOpen(false);
    if (!apiEnabled()) return submitPlate();
    const options = { mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7 };
    // No camera (or no permission for it): pick a photo of the plate instead of doing nothing.
    const shot = await ImagePicker.launchCameraAsync(options).catch(() => ImagePicker.launchImageLibraryAsync(options));
    const uri = !shot.canceled ? shot.assets[0]?.uri : undefined;
    if (uri) submitPlate(undefined, uri);
  };

  const phase = round?.phase;
  const now = useNow(phase === 'cooking');
  const left = round ? secondsLeft(round, now) : 0;

  useEffect(() => {
    if (!phase || phase === 'lobby') router.replace(phase === 'lobby' ? '/play/mystery/lobby' : '/(tabs)/play');
    else if (phase === 'reveal') router.replace('/play/mystery/reveal');
  }, [phase, router]);

  // Time is up: the plate is submitted for you.
  const expired = phase === 'cooking' && round?.startedAt != null && left <= 0;
  useEffect(() => {
    if (expired) submitPlate();
  }, [expired, submitPlate]);

  // Real photos of the ingredients are found just after the game starts: look again a few times until they have arrived.
  const code = round?.roomCode;
  const missingPhotos = !!round && round.secret.ingredients.some((i) => !i.photo);
  useEffect(() => {
    if (!code || !missingPhotos || !apiEnabled()) return;
    let tries = 0;
    const timer = setInterval(() => {
      tries += 1;
      void refreshRound(code);
      if (tries >= 6) clearInterval(timer);
    }, 5000);
    return () => clearInterval(timer);
  }, [code, missingPhotos, refreshRound]);

  const steps = round?.secret.steps ?? [];
  // The ingredients this step uses: the basket items its words mention.
  const used = useMemo(() => {
    const text = (steps[stepIndex] ?? '').toLowerCase();
    return (round?.secret.ingredients ?? []).filter((i) => text.includes(i.label.toLowerCase()));
  }, [round?.secret.ingredients, steps, stepIndex]);

  if (!round || round.phase !== 'cooking') {
    return <Screen tone="dark" />;
  }

  const hints = round.secret.hints.slice(0, round.hintsUnlocked);
  const hintsLeft = round.secret.hints.length - round.hintsUnlocked;
  const leave = () => {
    setMenuOpen(false);
    leaveRound();
    router.replace('/(tabs)/play');
  };
  const toggleGot = (label: string) =>
    setGot((s) => {
      const next = new Set(s);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  const lastStep = stepIndex >= steps.length - 1;
  const shop = stage === 'shop' || steps.length === 0;

  const topBar = (
    <TopBar
      variant="compact"
      left={<Tag large icon="clock" label={clock(left)} />}
      title=""
      right={<UIconButton icon="more" label={t('play.mk.options', 'Round options')} onPress={() => setMenuOpen(true)} />}
    />
  );

  const footer = shop ? (
    <CtaBar>
      {steps.length > 0 ? (
        <UButton variant="accent" icon="play" label={t('play.mk.startCooking', 'Start cooking')} onPress={() => { setStage('cook'); setStepIndex(0); }} />
      ) : (
        <UButton icon="camera" label={t('play.mk.submit', 'Submit my plate')} onPress={() => void handIn()} />
      )}
    </CtaBar>
  ) : (
    <CtaBar>
      {lastStep ? (
        <View style={{ gap: 10 }}>
          <UButton variant="accent" icon="camera" label={t('play.mk.platedIt', 'Plated it — submit my plate')} onPress={() => void handIn()} />
          <UButton variant="ghost" label={t('play.mk.prevStep', 'Back')} onPress={() => setStepIndex((i) => Math.max(0, i - 1))} />
        </View>
      ) : (
        <View className="flex-row" style={{ gap: 10 }}>
          <View style={{ width: 110 }}>
            <UButton variant="ghost" label={t('play.mk.prevStep', 'Back')} disabled={stepIndex === 0} onPress={() => setStepIndex((i) => Math.max(0, i - 1))} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <UButton variant="accent" label={t('play.mk.nextStep', 'Next step')} onPress={() => setStepIndex((i) => Math.min(steps.length - 1, i + 1))} />
          </View>
        </View>
      )}
    </CtaBar>
  );

  return (
    <Screen tone="dark" scroll bottomSpace={lastStep && !shop ? 220 : 150} footer={footer}>
      {topBar}

      {shop ? (
        <>
          <View style={{ gap: 6 }}>
            <H1>{t('play.mk.getIngredients', 'Ingredients to get')}</H1>
            <Muted>{t('play.mk.getIngredientsSub', 'Gather these first, tick them off, then start cooking. The dish is a secret.')}</Muted>
          </View>
          <View className="flex-row flex-wrap" style={{ gap: 12 }}>
            {round.secret.ingredients.map((ing) => (
              <View key={ing.label} style={{ width: '47.5%', flexGrow: 1 }}>
                <PhotoCard
                  source={ing.photo ? samplePhoto(ing.photo) : undefined}
                  height={130}
                  radius={22}
                  fade="both"
                  title={ing.label}
                  titleSize={15}
                  captionInset={12}
                  topRight={got.has(ing.label) ? <Tag tone="glassDark" icon="check" label={t('play.mk.gotIt', 'Got it')} /> : undefined}
                  onPress={() => toggleGot(ing.label)}
                  accessibilityLabel={ing.label}
                />
              </View>
            ))}
          </View>
          <Muted small>{t('play.mk.gotCount', '{{a}} of {{b}} ticked off', { a: got.size, b: round.secret.ingredients.length })}</Muted>
        </>
      ) : (
        <View style={{ gap: 14 }}>
          <View className="flex-row" style={{ gap: 6 }}>
            {steps.map((_, i) => (
              <View key={i} style={{ flex: 1, height: 5, borderRadius: 3, backgroundColor: i <= stepIndex ? tk.accent : tk.line }} />
            ))}
          </View>
          <View className="flex-row items-center justify-between">
            <H2>{t('play.mk.stepOf', 'Step {{n}} of {{m}}', { n: stepIndex + 1, m: steps.length })}</H2>
            <Muted small>{t('play.mk.secret', 'The dish is a secret')}</Muted>
          </View>

          {used.length > 0 ? (
            <View style={{ gap: 8 }}>
              <Muted small>{t('play.mk.usesNow', 'You need')}</Muted>
              <View className="flex-row flex-wrap" style={{ gap: 12 }}>
                {used.map((ing) => (
                  <View key={ing.label} style={{ width: 84, gap: 6, alignItems: 'center' }}>
                    {ing.photo ? (
                      <Image source={samplePhoto(ing.photo) ?? undefined} contentFit="cover" accessibilityIgnoresInvertColors style={{ width: 84, height: 84, borderRadius: 18 }} />
                    ) : (
                      <View style={{ width: 84, height: 84, borderRadius: 18, backgroundColor: tk['surface-2'] }} />
                    )}
                    <Body style={{ fontSize: 12 }} numberOfLines={1}>
                      {ing.label}
                    </Body>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          <StepPicture code={round.roomCode} index={stepIndex} paid={isSubscribed} onUnlock={() => setPaywall(true)} />

          <UCard style={{ borderRadius: 24, padding: 18 }}>
            <Body style={{ fontSize: 19, lineHeight: 28 }}>{steps[stepIndex]}</Body>
          </UCard>

          {hints.map((h, i) => (
            <UCard key={h} style={{ borderRadius: 22, padding: 14 }}>
              <View className="flex-row items-center" style={{ gap: 12 }}>
                <Icon name="bulb" />
                <View className="flex-1" style={{ gap: 4 }}>
                  <Title>{t('play.mk.hintUnlocked', 'Hint {{n}} unlocked', { n: i + 1 })}</Title>
                  <Muted small>
                    {h} −{HINT_COST} {t('play.mk.pts', 'pts')}
                  </Muted>
                </View>
              </View>
            </UCard>
          ))}

          {hintsLeft > 0 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('play.mk.useHint', 'Use a hint (−{{n}} pts)', { n: HINT_COST })}
              onPress={() => unlockHint()}
              style={{ flexDirection: 'row', alignItems: 'center', minHeight: 56, borderRadius: 22, paddingHorizontal: 14, gap: 12, borderWidth: 1.5, borderColor: tk.line }}
            >
              <Icon name="bulb" color="muted" />
              <View className="flex-1">
                <Title>{t('play.mk.needHint', 'Need a hint?')}</Title>
                <Muted small>{t('play.mk.hintCost', 'Each hint costs {{n}} points', { n: HINT_COST })}</Muted>
              </View>
            </Pressable>
          ) : null}
        </View>
      )}

      {round.twist ? (
        <UCard tone="accent" style={{ borderRadius: 22, padding: 14 }}>
          <View className="flex-row items-center" style={{ gap: 12 }}>
            <Icon name="refresh" />
            <View className="flex-1" style={{ gap: 4 }}>
              <Title>{round.twist.title}</Title>
              <Body style={{ fontSize: 12, lineHeight: 17.4 }}>{round.twist.text}</Body>
            </View>
          </View>
        </UCard>
      ) : null}

      <Sheet visible={menuOpen} onClose={() => setMenuOpen(false)} title={t('play.mk.options', 'Round options')}>
        <H2>{t('play.mk.options', 'Round options')}</H2>
        {!shop ? <UButton variant="ghost" icon="camera" label={t('play.mk.submitNow', 'Submit my plate now')} onPress={() => void handIn()} /> : null}
        <UButton variant="ghost" label={t('play.mk.leave', 'Leave round')} onPress={leave} />
      </Sheet>

      <Paywall visible={paywall} onClose={() => setPaywall(false)} feature={t('play.mk.paywallFeature', 'Step pictures')} requiredTier="premium" />
    </Screen>
  );
}
