import React, { useEffect, useMemo, useState } from 'react';
import { Text as RNText, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Image } from 'expo-image';
import {
  CtaBar,
  FONT,
  Icon,
  Muted,
  Rows,
  Screen,
  SectionLabel,
  Tag,
  Title,
  TopBar,
  UButton,
  UCard,
  UInput,
  useTokens,
} from '@/components/ui';
import { Backdrop } from '@/components/ui/Backdrop';
import { MAX_CLUES, MAX_GUESSES, clueSlots, isCorrect } from '@/lib/dailyDish';
import {
  selectDailyPuzzle,
  selectDailyScore,
  selectDailyStreak,
  usePlayStore,
} from '@/stores/playStore';

export default function DailyDishScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const tk = useTokens();
  const daily = usePlayStore((s) => s.daily);
  const puzzle = usePlayStore((s) => selectDailyPuzzle(s));
  const streak = usePlayStore((s) => selectDailyStreak(s));
  const score = usePlayStore((s) => selectDailyScore(s));
  const serverDaily = usePlayStore((s) => s.serverDaily);
  const startDaily = usePlayStore((s) => s.startDaily);
  const revealNextClue = usePlayStore((s) => s.revealNextClue);
  const guessDaily = usePlayStore((s) => s.guessDaily);
  const [text, setText] = useState('');

  useEffect(() => {
    startDaily();
  }, [startDaily]);

  // The server's puzzle may have fewer than six clues: show exactly the ones it has.
  const total = Math.min(MAX_CLUES, serverDaily?.cluesTotal ?? MAX_CLUES);
  const slots = useMemo(() => (daily ? clueSlots(puzzle, daily).slice(0, total) : []), [puzzle, daily, total]);

  if (!daily) {
    return (
      <Screen>
        <TopBar variant="compact" title={t('play.daily.title', 'Daily Dish')} onBack={() => router.back()} />
      </Screen>
    );
  }

  const playing = daily.status === 'playing';
  const submit = () => {
    if (!playing || !text.trim()) return;
    guessDaily(text);
    setText('');
  };

  return (
    <Screen
      scroll
      bottomSpace={playing ? 230 : 130}
      footer={
        <CtaBar>
          {playing ? (
            <View style={{ gap: 10 }}>
              <UInput
                label={t('play.daily.inputLabel', 'Guess the dish')}
                placeholder={t('play.daily.inputPlaceholder', 'Type your guess')}
                icon="search"
                value={text}
                onChangeText={setText}
                onSubmitEditing={submit}
                returnKeyType="go"
                autoCapitalize="none"
                autoCorrect={false}
              />
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ width: 150 }}>
                  <UButton
                    variant="ghost"
                    label={t('play.daily.nextClue', 'Next clue')}
                    disabled={daily.cluesShown >= total}
                    onPress={revealNextClue}
                  />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <UButton label={t('play.daily.guess', 'Guess')} disabled={!text.trim()} onPress={submit} />
                </View>
              </View>
            </View>
          ) : (
            <UButton label={t('play.daily.backToPlay', 'Back to Play')} onPress={() => router.back()} />
          )}
        </CtaBar>
      }
    >
      <TopBar
        variant="compact"
        title={t('play.daily.heading', 'Daily Dish #{{n}}', { n: daily.puzzleNumber })}
        onBack={() => router.back()}
        right={<Tag tone="o" icon="flame" label={String(streak)} />}
      />

      <View className="bg-surface-3 overflow-hidden" style={{ height: 240, borderRadius: 30 }}>
        {!playing && serverDaily?.photoUrl ? <Image source={{ uri: serverDaily.photoUrl }} contentFit="cover" transition={200} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} /> : <Backdrop />}
        <View className="items-center justify-center" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, gap: 10 }}>
          <Icon name={playing ? 'help' : daily.status === 'solved' ? 'check' : 'close'} size="lg" />
          {playing ? (
            <RNText className="text-ink text-center" style={{ fontFamily: FONT.sansMedium, fontSize: 14, paddingHorizontal: 32, lineHeight: 20 }}>
              {t('play.daily.prompt', 'Guess the dish from its clues. Stuck? Tap Next clue for another, at a small cost in points.')}
            </RNText>
          ) : null}
        </View>
        <View style={{ position: 'absolute', top: 14, left: 14 }}>
          <Tag
            tone="glassDark"
            large
            label={
              playing
                ? t('play.daily.clueOf', 'Clue {{n}} of {{max}}', { n: daily.cluesShown, max: total })
                : daily.status === 'solved'
                  ? t('play.daily.solved', 'Solved · +{{n}} pts', { n: score })
                  : t('play.daily.failed', 'Not this time')
            }
          />
        </View>
      </View>

      {!playing ? (
        <UCard tone="black" style={{ gap: 4 }}>
          <SectionLabel>{t('play.daily.answer', 'Today’s dish')}</SectionLabel>
          <RNText className="text-ink" style={{ fontFamily: FONT.display, fontSize: 28, letterSpacing: -0.56 }}>
            {puzzle.answer}
          </RNText>
          <Muted small>{t('play.daily.streakNow', '{{n}}-day streak', { n: streak })}</Muted>
        </UCard>
      ) : null}

      <View style={{ gap: 8 }}>
        <SectionLabel>{t('play.daily.soFar', 'Ingredients so far')}</SectionLabel>
        <View className="flex-row flex-wrap" style={{ gap: 8 }}>
          {slots.map((c, i) =>
            c ? (
              <Tag key={i} large label={c} />
            ) : (
              <View
                key={i}
                accessibilityLabel={t('play.daily.hiddenClue', 'Hidden clue')}
                style={{
                  height: 36,
                  borderRadius: 18,
                  paddingHorizontal: 14,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: tk.ground,
                  borderWidth: 1.5,
                  borderColor: tk.line,
                }}
              >
                <Icon name="lock" size="sm" />
              </View>
            ),
          )}
        </View>
      </View>

      {daily.guesses.length > 0 ? (
        <View style={{ gap: 8 }}>
          <SectionLabel>
            {t('play.daily.guesses', 'Your guesses')} · {daily.guesses.length}/{MAX_GUESSES}
          </SectionLabel>
          <Rows box>
            {daily.guesses.map((g, i) => {
              const right = isCorrect(puzzle, g);
              return (
                <View key={`${g}-${i}`} className="flex-row items-center" style={{ minHeight: 64, gap: 14 }}>
                  <View className="items-center justify-center bg-ground" style={{ width: 32, height: 32, borderRadius: 16 }}>
                    <Icon name={right ? 'check' : 'close'} size="sm" />
                  </View>
                  <View className="flex-1">
                    <Title>{g}</Title>
                  </View>
                </View>
              );
            })}
          </Rows>
        </View>
      ) : null}

    </Screen>
  );
}
