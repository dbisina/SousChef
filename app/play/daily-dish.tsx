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
} from '@/components/ui';
import { dailyDishPhoto } from '@/components/play/samplePhoto';
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
  const daily = usePlayStore((s) => s.daily);
  const puzzle = usePlayStore((s) => selectDailyPuzzle(s));
  const streak = usePlayStore((s) => selectDailyStreak(s));
  const score = usePlayStore((s) => selectDailyScore(s));
  const startDaily = usePlayStore((s) => s.startDaily);
  const revealNextClue = usePlayStore((s) => s.revealNextClue);
  const guessDaily = usePlayStore((s) => s.guessDaily);
  const [text, setText] = useState('');

  useEffect(() => {
    startDaily();
  }, [startDaily]);

  const slots = useMemo(() => (daily ? clueSlots(puzzle, daily) : []), [puzzle, daily]);

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
      bottomSpace={130}
      footer={
        <CtaBar>
          {playing ? (
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ width: 150 }}>
                <UButton
                  variant="ghost"
                  label={t('play.daily.nextClue', 'Next clue')}
                  disabled={daily.cluesShown >= MAX_CLUES}
                  onPress={revealNextClue}
                />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <UButton label={t('play.daily.guess', 'Guess')} disabled={!text.trim()} onPress={submit} />
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
        <Image
          source={dailyDishPhoto(puzzle.answer)}
          blurRadius={playing ? 14 : 0}
          contentFit="cover"
          accessibilityLabel={playing ? t('play.daily.blurred', 'Today’s mystery dish, blurred') : puzzle.answer}
          style={{ flex: 1, transform: [{ scale: playing ? 1.15 : 1 }] }}
        />
        <View style={{ position: 'absolute', top: 14, left: 14 }}>
          <Tag
            tone="glassDark"
            large
            label={
              playing
                ? t('play.daily.clueOf', 'Clue {{n}} of {{max}}', { n: daily.cluesShown, max: MAX_CLUES })
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
                className="bg-ground border-[1.5px] border-line items-center justify-center"
                style={{ height: 36, borderRadius: 18, paddingHorizontal: 14 }}
              >
                <RNText className="text-subtle" style={{ fontFamily: FONT.sansMedium, fontSize: 13 }}>
                  ?
                </RNText>
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

      {playing ? (
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
      ) : null}
    </Screen>
  );
}
