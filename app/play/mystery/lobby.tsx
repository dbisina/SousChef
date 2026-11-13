import React, { useEffect, useState } from 'react';
import { Share, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as Clipboard from 'expo-clipboard';
import {
  Check,
  CtaBar,
  H2,
  Muted,
  Rows,
  Screen,
  Tag,
  Title,
  TopBar,
  UAvatar,
  UButton,
} from '@/components/ui';
import { RoomCodeCard } from '@/components/play/RoomCodeCard';
import { samplePhoto } from '@/components/play/samplePhoto';
import { MAX_PLAYERS, canStart } from '@/lib/mysteryKitchen';
import { usePlayStore } from '@/stores/playStore';

export default function MysteryLobbyScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const round = usePlayStore((s) => s.round);
  const hostRound = usePlayStore((s) => s.hostRound);
  const startRound = usePlayStore((s) => s.startRound);
  const leaveRound = usePlayStore((s) => s.leaveRound);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!round) hostRound();
  }, [round, hostRound]);

  const phase = round?.phase;
  useEffect(() => {
    if (phase === 'cooking') router.replace('/play/mystery/round');
    else if (phase === 'reveal') router.replace('/play/mystery/reveal');
  }, [phase, router]);

  if (!round) {
    return (
      <Screen tone="dark">
        <TopBar variant="compact" title={t('play.mk.title', 'Mystery Kitchen')} />
      </Screen>
    );
  }

  const me = round.players.find((p) => p.isYou);
  const isHost = !!me?.isHost;
  const ready = canStart(round);
  const close = () => {
    leaveRound();
    router.back();
  };
  const copy = async () => {
    await Clipboard.setStringAsync(round.roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  const invite = () =>
    Share.share({
      message: t('play.mk.inviteMessage', 'Join my Mystery Kitchen on SousChef. Room code {{code}}', {
        code: round.roomCode,
      }),
    }).catch(() => undefined);

  return (
    <Screen
      tone="dark"
      scroll
      bottomSpace={130}
      footer={
        <CtaBar>
          <UButton
            variant="accent"
            label={isHost ? t('play.mk.start', 'Start the round') : t('play.mk.waiting', 'Waiting for the host')}
            disabled={!isHost || !ready}
            onPress={() => startRound()}
          />
        </CtaBar>
      }
    >
      <TopBar variant="compact" title={t('play.mk.title', 'Mystery Kitchen')} onBack={close} />

      <RoomCodeCard
        code={round.roomCode}
        hint={t('play.mk.codeHint', 'Friends join from SousChef with this code')}
        copied={copied}
        labels={{
          room: t('play.mk.roomCode', 'Room code'),
          copy: t('play.mk.copyCode', 'Copy code'),
          copied: t('play.mk.copied', 'Copied'),
          invite: t('play.mk.invite', 'Invite'),
        }}
        onCopy={copy}
        onInvite={invite}
      />

      <View className="flex-row items-center justify-between">
        <H2>{t('play.mk.players', 'Players · {{n}}', { n: round.players.length })}</H2>
        <Muted small>{t('play.mk.upTo', 'Up to {{n}}', { n: MAX_PLAYERS })}</Muted>
      </View>
      <Rows box>
        {round.players.map((p) => (
          <View key={p.id} className="flex-row items-center" style={{ minHeight: 64, gap: 12 }}>
            <UAvatar source={samplePhoto(p.avatar)} name={p.name} size={44} />
            <View className="flex-1 flex-row items-center" style={{ gap: 8, minWidth: 0 }}>
              <Title numberOfLines={1}>{p.name}</Title>
              {p.isHost ? <Tag tone="o" label={t('play.mk.host', 'Host')} /> : null}
              {p.guest ? <Muted small>{t('play.mk.guest', 'guest')}</Muted> : null}
            </View>
            {p.status === 'joined' ? (
              <Check checked label={t('play.mk.joined', '{{name}} joined', { name: p.name })} />
            ) : (
              <Muted small>{t('play.mk.joining', 'joining…')}</Muted>
            )}
          </View>
        ))}
      </Rows>

      <View className="flex-row flex-wrap" style={{ gap: 8 }}>
        <Tag large icon="clock" label={t('play.mk.minutes', '{{n}} min', { n: Math.round(round.totalSec / 60) })} />
        <Tag large icon="bag" label={t('play.mk.pantryMode', 'Pantry mode')} />
        <Tag
          large
          label={
            round.pantryMode === 'everyone-same'
              ? t('play.mk.sameDish', 'Everyone same dish')
              : t('play.mk.differentDish', 'Different dishes')
          }
        />
        <Tag large label={round.difficulty} />
        {round.restrictions.map((r) => (
          <Tag key={r} large label={r} />
        ))}
      </View>
    </Screen>
  );
}
