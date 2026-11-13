import React, { useEffect, useMemo } from 'react';
import { ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { CtaBar, Muted, PhotoCard, Screen, Tag, Title, UAvatar, UButton, UCard, UIconButton } from '@/components/ui';
import { Podium, type PodiumEntry } from '@/components/play/Podium';
import { samplePhoto } from '@/components/play/samplePhoto';
import { rankSubmissions } from '@/lib/mysteryKitchen';
import { usePlayStore } from '@/stores/playStore';

export default function MysteryRevealScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const round = usePlayStore((s) => s.round);
  const hostRound = usePlayStore((s) => s.hostRound);
  const leaveRound = usePlayStore((s) => s.leaveRound);

  const phase = round?.phase;
  useEffect(() => {
    if (phase !== 'reveal')
      router.replace(
        phase === 'cooking' ? '/play/mystery/round' : phase === 'lobby' ? '/play/mystery/lobby' : '/(tabs)/play',
      );
  }, [phase, router]);

  const ranked = useMemo(() => rankSubmissions(round?.submissions ?? []), [round?.submissions]);
  const players = round?.players;
  const entries = useMemo<PodiumEntry[]>(
    () =>
      ranked.map((s, i) => {
        const p = players?.find((x) => x.id === s.playerId);
        return {
          id: s.playerId,
          name: p?.name ?? s.playerId,
          avatar: samplePhoto(p?.avatar ?? 'chef'),
          score: s.score,
          rank: i + 1,
        };
      }),
    [ranked, players],
  );

  if (!round || round.phase !== 'reveal') return <Screen tone="dark" />;

  const close = () => {
    leaveRound();
    router.replace('/(tabs)/play');
  };
  const playAgain = () => {
    hostRound();
    router.replace('/play/mystery/lobby');
  };
  const postToFeed = () => {
    leaveRound();
    router.replace('/(tabs)');
  };

  return (
    <Screen
      tone="dark"
      bare
      footer={
        <CtaBar>
          <UButton variant="ghost" label={t('play.mk.playAgain', 'Play again')} onPress={playAgain} />
          <UButton variant="accent" label={t('play.mk.postToFeed', 'Post to feed')} onPress={postToFeed} />
        </CtaBar>
      }
    >
      <ScrollView contentContainerStyle={{ gap: 14, paddingBottom: 130 }} showsVerticalScrollIndicator={false}>
        <PhotoCard
          source={samplePhoto(round.secret.photo)}
          height={330}
          radius={0}
          fade="both"
          title={round.secret.name}
          titleSize={34}
          subtitle={round.secret.description}
          captionInset={22}
          style={{ borderBottomLeftRadius: 36, borderBottomRightRadius: 36 }}
        >
          <View
            className="flex-row items-start justify-between"
            style={{
              position: 'absolute',
              top: Math.max(insets.top, 20) + 14,
              left: 20,
              right: 20,
            }}
          >
            <Tag tone="glassDark" large label={t('play.mk.secretWas', 'The secret dish was…')} />
            <UIconButton icon="close" tone="glassDark" label={t('play.mk.close', 'Close')} onPress={close} />
          </View>
        </PhotoCard>

        <View style={{ paddingHorizontal: 20, paddingTop: 6 }}>
          <Podium entries={entries} winnerLabel={t('play.mk.winner', 'Winner')} />
        </View>

        {ranked.map((s, i) => {
          const e = entries[i];
          const you = round.players.find((p) => p.id === s.playerId)?.isYou;
          return (
            <View key={s.playerId} style={{ paddingHorizontal: 20 }}>
              <UCard style={{ borderRadius: 22, padding: 12 }}>
                <View className="flex-row items-center" style={{ gap: 12 }}>
                  <UAvatar
                    source={samplePhoto(s.plate)}
                    name={t('play.mk.plateOf', '{{name}}’s plate', {
                      name: e.name,
                    })}
                    size={64}
                    square
                  />
                  <View className="flex-1" style={{ minWidth: 0 }}>
                    <Title numberOfLines={1}>
                      {you
                        ? t('play.mk.yourPlate', 'Your plate')
                        : t('play.mk.plateOf', '{{name}}’s plate', {
                            name: e.name,
                          })}
                    </Title>
                    <Muted small numberOfLines={3}>
                      {`“${s.comment}”`}
                    </Muted>
                  </View>
                  <Title>{s.score}</Title>
                </View>
              </UCard>
            </View>
          );
        })}
      </ScrollView>
    </Screen>
  );
}
