import React, { useEffect, useState } from 'react';
import { ScrollView, Text as RNText, View } from 'react-native';
import { Pressable } from '@/components/ui/Pressable';
import { useRouter, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
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
  type PhotoSource,
} from '@/components/ui';
import { PHOTOS, type PhotoName } from '@/assets/photos';

import { apiSoloGames } from '@/services/soloApi';
import type { SoloGameInfo } from '@shared/index';
import { FIXED } from '@/stores/themeStore';
import { puzzleNumberFor } from '@/lib/dailyDish';
import { selectDailyStreak, usePlayStore } from '@/stores/playStore';

// The app's own picture for each solo game card.
const GAME_PHOTO: Record<string, PhotoName> = {
  trivia: 'salad',
  myth: 'eggs',
  cuisine: 'ramen',
  odd: 'tomatoes',
  technique: 'salmon',
  pairing: 'avocado',
  sorter: 'pancakes',
  match: 'veg',
};

export default function PlayScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const hostRound = usePlayStore((s) => s.hostRound);
  const joinRound = usePlayStore((s) => s.joinRound);
  const puzzleNumber = usePlayStore((s) => s.daily?.puzzleNumber ?? puzzleNumberFor(new Date()));
  const streak = usePlayStore((s) => selectDailyStreak(s));
  const [joinOpen, setJoinOpen] = useState(false);
  const [code, setCode] = useState('');
  const [solo, setSolo] = useState<SoloGameInfo[]>([]);
  useEffect(() => {
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

  const feature = { name: t('play.mk.title', 'Mystery Kitchen'), tagline: t('play.mkTagline', 'Cook from ingredients alone, then see the real dish.'), minPlayers: 1, maxPlayers: 10 };

  return (
    <Screen bare>
      <TopBar
        title={t('play.title', 'Play')}
      />
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, gap: 16, paddingBottom: 130 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <PhotoCard
          source={PHOTOS.gnocchi as PhotoSource}
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
              {feature.tagline}
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
                              <Pressable accessibilityRole="button" accessibilityLabel={t('play.solo', 'Play solo')} onPress={() => host('solo')}>
                  <Glass style={{ height: 44, borderRadius: 22, paddingHorizontal: 18, justifyContent: 'center' }}>
                    <RNText style={{ fontFamily: FONT.sansMedium, fontSize: 13, color: FIXED.night }}>{t('play.solo', 'Play solo')}</RNText>
                  </Glass>
                </Pressable>
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

        {solo.length > 0 ? (
          <>
          <H2>{t('play.moreGames', 'More games')}</H2>
          <View className="flex-row flex-wrap" style={{ gap: 12 }}>
            {solo.map((g) => (
              <PhotoCard
                key={g.id}
                source={(PHOTOS[GAME_PHOTO[g.id] ?? "plating"]) as PhotoSource}
                fade="both"
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
        ) : null}
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
