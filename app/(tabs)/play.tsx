import React, { useEffect, useState } from 'react';
import { ScrollView, Text as RNText, View } from 'react-native';
import { Pressable } from '@/components/ui/Pressable';
import { useRouter, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SAMPLE } from '@/assets/sample';
import {
  FONT,
  Glass,
  H2,
  Icon,
  LinkText,
  Muted,
  PhotoCard,
  Screen,
  Sheet,
  Tag,
  Title,
  TopBar,
  UButton,
  UCard,
  UInput,
} from '@/components/ui';
import type { PhotoSource } from '@/components/ui';
import { samplePhoto } from '@/components/play/samplePhoto';
import { PREVIEW_LABEL, SERVER_MODE } from '@/constants/features';
import { apiSoloGames } from '@/services/soloApi';
import type { SoloGameInfo } from '../../shared/index';
import { FIXED } from '@/stores/themeStore';
import { puzzleNumberFor } from '@/lib/dailyDish';
import { playService } from '@/services/playService';
import { selectDailyStreak, usePlayStore } from '@/stores/playStore';

const SOLO_PHOTO = { trivia: 'tomatoes', sorter: 'garlic', match: 'bowl' } as const;

export default function PlayScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const hostRound = usePlayStore((s) => s.hostRound);
  const joinRound = usePlayStore((s) => s.joinRound);
  const puzzleNumber = usePlayStore((s) => s.daily?.puzzleNumber ?? puzzleNumberFor(new Date()));
  const streak = usePlayStore((s) => selectDailyStreak(s));
  const { games, total } = playService.getGames();
  const [joinOpen, setJoinOpen] = useState(false);
  const [code, setCode] = useState('');
  const [solo, setSolo] = useState<SoloGameInfo[]>([]);
  useEffect(() => {
    if (!SERVER_MODE) return;
    apiSoloGames().then(setSolo).catch(() => setSolo([]));
  }, []);

  const go = (href: string) => router.push(href as Href);
  const host = (mode: 'solo' | 'group' = 'group') => {
    hostRound(mode);
    go('/play/mystery/lobby');
  };
  const join = () => {
    if (code.trim().length < 4) return;
    joinRound(code);
    setJoinOpen(false);
    setCode('');
    go('/play/mystery/lobby');
  };

  const feature = games.find((g) => g.featured) ?? games[0];
  const more = games.filter((g) => g.id !== feature.id);

  return (
    <Screen bare>
      <TopBar
        title={t('play.title', 'Play')}
        right={
          SERVER_MODE ? undefined : (
            <View className="flex-row items-center" style={{ gap: 8 }}>
              <Tag tone="o" label={PREVIEW_LABEL} />
              <Tag tone="o" large icon="trophy" label={t('play.rank', 'Rank {{n}} · {{title}}', { n: 7, title: 'Sous' })} />
            </View>
          )
        }
      />
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, gap: 16, paddingBottom: 130 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <PhotoCard
          source={SAMPLE.friends as PhotoSource}
          height={290}
          fade="both"
          topLeft={
            <Tag
              tone="glassDark"
              large
              icon="people"
              label={t('play.playersRange', '{{min}}–{{max}} players', { min: feature.minPlayers ?? 2, max: feature.maxPlayers ?? 10 })}
            />
          }
        >
          <View style={{ position: 'absolute', left: 18, right: 18, bottom: 16, gap: 6 }}>
            <RNText
              accessibilityRole="header"
              style={{ fontFamily: FONT.display, fontSize: 28, lineHeight: 32, letterSpacing: -0.56, color: FIXED.paper, marginBottom: 3 }}
            >
              {feature.name}
            </RNText>
            <RNText style={{ fontFamily: FONT.sans, fontSize: 12, color: FIXED.captionSub }}>
              {t('play.mkTagline', feature.tagline)}
            </RNText>
            <View className="flex-row" style={{ gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
              <UButton
                variant="accent"
                size="sm"
                label={t('play.host', 'Host a game')}
                onPress={() => host('group')}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('play.joinWithCode', 'Join with code')}
                onPress={() => setJoinOpen(true)}
              >
                <Glass style={{ height: 44, borderRadius: 22, paddingHorizontal: 18, justifyContent: 'center' }}>
                  <RNText style={{ fontFamily: FONT.sansMedium, fontSize: 13, color: FIXED.night }}>
                    {t('play.joinWithCode', 'Join with code')}
                  </RNText>
                </Glass>
              </Pressable>
              {SERVER_MODE ? (
                <Pressable accessibilityRole="button" accessibilityLabel={t('play.solo', 'Play solo')} onPress={() => host('solo')}>
                  <Glass style={{ height: 44, borderRadius: 22, paddingHorizontal: 18, justifyContent: 'center' }}>
                    <RNText style={{ fontFamily: FONT.sansMedium, fontSize: 13, color: FIXED.night }}>{t('play.solo', 'Play solo')}</RNText>
                  </Glass>
                </Pressable>
              ) : null}
            </View>
          </View>
        </PhotoCard>

        <UCard tone="black" onPress={() => go('/play/daily-dish')} accessibilityLabel={t('play.dailyDish', 'Daily Dish #{{n}}', { n: puzzleNumber })} style={{ padding: 14, borderRadius: 26 }}>
          <View className="flex-row items-center" style={{ gap: 14 }}>
            <View style={{ width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', backgroundColor: FIXED.accent }}>
              <Icon name="grid" color="night" />
            </View>
            <View className="flex-1" style={{ minWidth: 0 }}>
              <Title>{t('play.dailyDish', 'Daily Dish #{{n}}', { n: puzzleNumber })}</Title>
              <Muted small>
                {t('play.dailySub', 'Guess today’s dish · {{n}}-day streak', { n: streak })}
              </Muted>
            </View>
            <View className="items-center justify-center bg-night-2" style={{ height: 28, borderRadius: 14, paddingHorizontal: 11 }}>
              <RNText style={{ fontFamily: FONT.sansMedium, fontSize: 12, color: FIXED.paper }}>
                {t('play.play', 'Play')}
              </RNText>
            </View>
          </View>
        </UCard>

        {/* On the server: Mystery Kitchen and Daily Dish above, and the three solo games here. */}
        {SERVER_MODE ? (
          <>
            <H2>{t('play.moreGames', 'More games')}</H2>
            <View className="flex-row flex-wrap" style={{ gap: 12 }}>
              {solo.map((g) => (
                <PhotoCard
                  key={g.id}
                  source={samplePhoto(SOLO_PHOTO[g.id])}
                  height={150}
                  radius={24}
                  width="47.5%"
                  style={{ flexGrow: 1 }}
                  title={g.name}
                  titleSize={15}
                  subtitle={g.best === null ? g.tagline : t('play.bestScore', 'Best {{n}}', { n: g.best })}
                  captionInset={14}
                  onPress={() => go(`/play/solo/${g.id}`)}
                />
              ))}
            </View>
          </>
        ) : (
        <>
        <View className="flex-row items-center justify-between">
          <H2>{t('play.moreGames', 'More games')}</H2>
          <LinkText onPress={() => go('/play/mystery/lobby')}>{t('play.allGames', 'All {{n}}', { n: total })}</LinkText>
        </View>
        <View className="flex-row flex-wrap" style={{ gap: 12 }}>
          {more.map((g) => (
            <PhotoCard
              key={g.id}
              source={samplePhoto(g.photo)}
              height={150}
              radius={24}
              width="47.5%"
              style={{ flexGrow: 1 }}
              title={g.name}
              titleSize={15}
              subtitle={g.tagline}
              captionInset={14}
              onPress={() => host()}
            />
          ))}
        </View>
        </>
        )}
      </ScrollView>

      <Sheet visible={joinOpen} onClose={() => setJoinOpen(false)} title={t('play.joinWithCode', 'Join with code')}>
        <H2>{t('play.joinWithCode', 'Join with code')}</H2>
        <UInput
          label={t('play.roomCode', 'Room code')}
          placeholder={t('play.roomCodePlaceholder', '4-digit room code')}
          icon="qr"
          value={code}
          onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 4))}
          keyboardType="number-pad"
          maxLength={4}
          returnKeyType="go"
          onSubmitEditing={join}
        />
        <UButton label={t('play.join', 'Join')} variant="accent" disabled={code.length < 4} onPress={join} />
      </Sheet>
    </Screen>
  );
}
