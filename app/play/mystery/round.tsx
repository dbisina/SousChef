import React, { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import {
  Body,
  CtaBar,
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
} from '@/components/ui';
import { MKCountdown } from '@/components/play/MKCountdown';
import { samplePhoto } from '@/components/play/samplePhoto';
import { useNow } from '@/components/play/useNow';
import { HINT_COST, secondsLeft } from '@/lib/mysteryKitchen';
import { usePlayStore } from '@/stores/playStore';

export default function MysteryRoundScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const round = usePlayStore((s) => s.round);
  const unlockHint = usePlayStore((s) => s.useHint);
  const submitPlate = usePlayStore((s) => s.submitPlate);
  const leaveRound = usePlayStore((s) => s.leaveRound);
  const [menuOpen, setMenuOpen] = useState(false);

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

  return (
    <Screen
      tone="dark"
      scroll
      bottomSpace={130}
      footer={
        <CtaBar>
          <UButton icon="camera" label={t('play.mk.submit', 'Submit my plate')} onPress={() => submitPlate()} />
        </CtaBar>
      }
    >
      <TopBar
        variant="compact"
        left={
          <Tag
            large
            icon="gamepad"
            label={t('play.mk.roundOf', 'Round 1 · {{n}} players', { n: round.players.length })}
          />
        }
        title=""
        right={<UIconButton icon="more" label={t('play.mk.options', 'Round options')} onPress={() => setMenuOpen(true)} />}
      />

      <View style={{ alignItems: 'center' }}>
        <MKCountdown left={left} total={round.totalSec} caption={t('play.mk.leftToCook', 'left to cook')} />
      </View>

      <View style={{ gap: 10 }}>
        <View className="flex-row items-center justify-between">
          <H2>{t('play.mk.yourIngredients', 'Your ingredients')}</H2>
          <Muted small>{t('play.mk.secret', 'The dish is a secret')}</Muted>
        </View>
        <View className="flex-row flex-wrap" style={{ gap: 12 }}>
          {round.secret.ingredients.map((ing) => (
            <View key={ing.label} style={{ width: '30.5%', flexGrow: 1, gap: 6, alignItems: 'center' }}>
              {ing.photo ? <PhotoCard source={samplePhoto(ing.photo)} height={76} radius={18} fade="none" width="100%" /> : null}
              <Body style={{ fontSize: 12 }} numberOfLines={1}>
                {ing.label}
              </Body>
            </View>
          ))}
        </View>
      </View>

      {hints.map((h, i) => (
        <UCard key={h} style={{ borderRadius: 22, padding: 14 }}>
          <View className="flex-row items-center" style={{ gap: 12 }}>
            <Icon name="bulb" />
            <View className="flex-1">
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
          className="flex-row items-center border-[1.5px] border-line"
          style={{ minHeight: 56, borderRadius: 22, paddingHorizontal: 14, gap: 12 }}
        >
          <Icon name="bulb" color="muted" />
          <View className="flex-1">
            <Title>{t('play.mk.needHint', 'Need a hint?')}</Title>
            <Muted small>{t('play.mk.hintCost', 'Each hint costs {{n}} points', { n: HINT_COST })}</Muted>
          </View>
        </Pressable>
      ) : null}

      {round.twist ? (
        <UCard tone="accent" style={{ borderRadius: 22, padding: 14 }}>
          <View className="flex-row items-center" style={{ gap: 12 }}>
            <Icon name="refresh" />
            <View className="flex-1">
              <Title>{round.twist.title}</Title>
              <Body style={{ fontSize: 12, lineHeight: 17 }}>
                {round.twist.text}
              </Body>
            </View>
          </View>
        </UCard>
      ) : null}

      <Sheet visible={menuOpen} onClose={() => setMenuOpen(false)} title={t('play.mk.options', 'Round options')}>
        <H2>{t('play.mk.options', 'Round options')}</H2>
        <UButton variant="ghost" label={t('play.mk.leave', 'Leave round')} onPress={leave} />
      </Sheet>
    </Screen>
  );
}
