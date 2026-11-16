import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Body, CtaBar, H2, Muted, Screen, Tag, Title, TopBar, UButton, UCard } from '@/components/ui';
import { ApiError } from '@/lib/api';
import { apiSoloAnswer, apiSoloStart } from '@/services/soloApi';
import { SOLO_GAMES, type SoloGameId, type SoloResult, type SoloRound } from '../../../shared/index';

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
        {result.reveal.map((r, i) => (
          <UCard key={r.id} style={{ padding: 14, borderRadius: 22, gap: 6 }}>
            <Title>{`${i + 1}. ${r.correct ? t('play.solo.right', 'Right') : t('play.solo.wrong', 'Not quite')}`}</Title>
            {Array.isArray(r.answer) ? r.answer.map((s, n) => <Body key={s}>{`${n + 1}. ${s}`}</Body>) : <Body>{r.answer}</Body>}
            {r.note ? <Muted small>{r.note}</Muted> : null}
          </UCard>
        ))}
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
          <H2>{item.prompt}</H2>
          {item.options?.map((option, i) => (
            <UButton key={`${index}-${option}`} variant={picks[index] === i ? 'accent' : 'primary'} label={option} onPress={() => setPick(i)} />
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
                tapped.includes(s) ? null : <UButton key={`s${s}`} variant="primary" label={step} onPress={() => tapStep(s)} />,
              )}
              {tapped.length > 0 ? <UButton size="sm" label={t('play.solo.reset', 'Start this one again')} onPress={() => setPick([])} /> : null}
            </View>
          ) : null}
        </View>
      )}
    </Screen>
  );
}
