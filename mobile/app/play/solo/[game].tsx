import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { Pressable } from '@/components/ui/Pressable';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Body, CtaBar, FONT, H2, Muted, Screen, Tag, Title, TopBar, UButton, UCard } from '@/components/ui';
import { ApiError } from '@/lib/api';
import { questionPhoto } from '@/lib/gamePhotos';
import { apiSoloAnswer, apiSoloStart } from '@/services/soloApi';
import { SOLO_GAMES, type SoloGameId, type SoloResult, type SoloRound } from '@shared/index';

const NAMES: Record<SoloGameId, string> = {
  trivia: 'Kitchen Trivia',
  myth: 'Myth or Fact',
  cuisine: 'Name That Cuisine',
  odd: 'Odd One Out',
  technique: 'Technique Match',
  pairing: 'Flavour Pairing',
  sorter: 'Step Sorter',
  match: 'Ingredient Match',
};

const isGame = (g: unknown): g is SoloGameId => typeof g === 'string' && (SOLO_GAMES as readonly string[]).includes(g);

/** One screen for the three solo games: the server's round in, the player's answers out, the server's marks back. */
/** An answer to pick. Long answers wrap onto as many lines as they need instead of being cut off with "...". */
function AnswerOption({ label, selected = false, onPress }: { label: string; selected?: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      onPress={onPress}
      style={{ minHeight: 60, borderRadius: 28, paddingHorizontal: 22, paddingVertical: 14, justifyContent: 'center', backgroundColor: selected ? '#F97316' : '#F4F4F4' }}
    >
      <Text style={{ fontFamily: FONT.sansMedium, fontSize: 16, lineHeight: 22, textAlign: 'center', color: selected ? '#1C1C1C' : '#0B0B0B' }}>{label}</Text>
    </Pressable>
  );
}

export default function SoloGameScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ game?: string }>();
  const game = isGame(params.game) ? params.game : null;

  const [round, setRound] = useState<SoloRound | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  /** Trivia / match: the option picked per item. Sorter: the steps tapped so far, in order. */
  const [picks, setPicks] = useState<(number | number[])[]>([]);
  const [result, setResult] = useState<SoloResult | null>(null);
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    if (!game) return;
    setRound(null);
    setResult(null);
    setError(null);
    setIndex(0);
    setPicks([]);
    try {
      setRound(await apiSoloStart(game));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('play.solo.loadFailed', 'Could not start a round. Check your connection and try again.'));
    }
  }, [game, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const item = round?.items[index];
  const isSorter = game === 'sorter';
  const tapped = useMemo(() => (isSorter && Array.isArray(picks[index]) ? (picks[index] as number[]) : []), [isSorter, picks, index]);
  const answered = isSorter ? !!item?.steps && tapped.length === item.steps.length : typeof picks[index] === 'number';

  const submit = async (all: (number | number[])[]) => {
    if (!game || !round) return;
    setSending(true);
    try {
      setResult(await apiSoloAnswer(game, { token: round.token, answers: all }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('play.solo.sendFailed', 'Could not send your answers. Try again.'));
    } finally {
      setSending(false);
    }
  };

  const next = () => {
    if (!round) return;
    if (index + 1 < round.items.length) setIndex(index + 1);
    else void submit(picks);
  };

  const setPick = (value: number | number[]) => setPicks((p) => Object.assign([...p], { [index]: value }));
  const tapStep = (step: number) => {
    if (tapped.includes(step)) return;
    setPick([...tapped, step]);
  };

  if (!game) {
    return (
      <Screen tone="dark">
        <TopBar variant="compact" title={t('play.title', 'Play')} onBack={() => router.back()} />
        <Muted center>{t('play.solo.unknown', 'That game does not exist.')}</Muted>
      </Screen>
    );
  }

  const title = NAMES[game];

  if (result) {
    return (
      <Screen
        tone="dark"
        scroll
        bottomSpace={130}
        footer={
          <CtaBar>
            <UButton variant="accent" label={t('play.solo.again', 'Play again')} onPress={() => void load()} />
          </CtaBar>
        }
      >
        <TopBar variant="compact" title={title} onBack={() => router.back()} />
        <View style={{ alignItems: 'center', gap: 6, paddingVertical: 8 }}>
          <H2>{t('play.solo.score', '{{n}} points', { n: result.score })}</H2>
          <Muted>{t('play.solo.correct', '{{c}} of {{n}} right', { c: result.correctCount, n: result.total })}</Muted>
          <Tag tone="o" large icon="trophy" label={result.newBest ? t('play.solo.newBest', 'New best!') : t('play.solo.best', 'Best {{n}}', { n: result.best })} />
        </View>
        {result.reveal.map((r, i) => {
          const asked = round?.items[i];
          const mine = asked?.options && typeof picks[i] === 'number' ? asked.options[picks[i] as number] : null;
          return (
            <UCard key={r.id} style={{ padding: 12, borderRadius: 22, gap: 10 }}>
              <View className="flex-row" style={{ gap: 12 }}>
                {asked ? (
                  <Image source={questionPhoto(asked)} contentFit="cover" accessibilityIgnoresInvertColors style={{ width: 72, height: 72, borderRadius: 16 }} />
                ) : null}
                <View className="flex-1" style={{ gap: 4, minWidth: 0 }}>
                  <Tag tone={r.correct ? 'o' : undefined} icon={r.correct ? 'check' : 'close'} label={r.correct ? t('play.solo.right', 'Right') : t('play.solo.wrong', 'Not quite')} />
                  {asked ? <Title>{asked.prompt}</Title> : null}
                </View>
              </View>
              {Array.isArray(r.answer) ? (
                r.answer.map((st, n) => <Body key={st}>{`${n + 1}. ${st}`}</Body>)
              ) : (
                <View style={{ gap: 2 }}>
                  {!r.correct && mine ? <Muted small>{t('play.solo.yourAnswer', 'You said: {{a}}', { a: mine })}</Muted> : null}
                  <Body>{t('play.solo.theAnswer', 'Answer: {{a}}', { a: r.answer })}</Body>
                </View>
              )}
              {r.note ? <Muted small>{r.note}</Muted> : null}
            </UCard>
          );
        })}
      </Screen>
    );
  }

  return (
    <Screen
      tone="dark"
      scroll
      bottomSpace={130}
      footer={
        round && item ? (
          <CtaBar>
            <UButton
              variant="accent"
              label={index + 1 < round.items.length ? t('play.solo.next', 'Next') : t('play.solo.finish', 'Finish')}
              disabled={!answered || sending}
              loading={sending}
              onPress={next}
            />
          </CtaBar>
        ) : undefined
      }
    >
      <TopBar
        variant="compact"
        title={title}
        onBack={() => router.back()}
        right={round ? <Tag large label={`${Math.min(index + 1, round.items.length)}/${round.items.length}`} /> : undefined}
      />
      {round && !error ? (
        <View className="flex-row" style={{ gap: 5 }}>
          {round.items.map((it, n) => (
            <View key={it.id} style={{ flex: 1, height: 5, borderRadius: 3, backgroundColor: n <= index ? '#F97316' : 'rgba(255,255,255,0.14)' }} />
          ))}
        </View>
      ) : null}
      {error ? (
        <View style={{ gap: 12, alignItems: 'center', paddingTop: 24 }}>
          <Muted center>{error}</Muted>
          <UButton label={t('play.solo.retry', 'Try again')} onPress={() => void load()} />
        </View>
      ) : !round || !item ? (
        <View style={{ paddingTop: 48 }}>
          <ActivityIndicator />
        </View>
      ) : (
        <View style={{ gap: 12 }}>
          <Image
            source={questionPhoto(item)}
            accessibilityIgnoresInvertColors
            contentFit="cover"
            transition={150}
            style={{ width: '100%', height: 190, borderRadius: 24 }}
          />
          <H2>{item.prompt}</H2>
          {item.options?.map((option, i) => (
            <AnswerOption key={`${index}-${option}`} label={option} selected={picks[index] === i} onPress={() => setPick(i)} />
          ))}
          {item.steps ? (
            <View style={{ gap: 10 }}>
              <Muted small>{t('play.solo.tapOrder', 'Tap the steps in the order you would cook them.')}</Muted>
              {tapped.map((s, n) => (
                <UCard key={`t${s}`} style={{ padding: 12, borderRadius: 18 }}>
                  <Body>{`${n + 1}. ${item.steps?.[s] ?? ''}`}</Body>
                </UCard>
              ))}
              {item.steps.map((step, s) =>
                tapped.includes(s) ? null : <AnswerOption key={`s${s}`} label={step} onPress={() => tapStep(s)} />,
              )}
              {tapped.length > 0 ? <UButton size="sm" label={t('play.solo.reset', 'Start this one again')} onPress={() => setPick([])} /> : null}
            </View>
          ) : null}
        </View>
      )}
    </Screen>
  );
}
