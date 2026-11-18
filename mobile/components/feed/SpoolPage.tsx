import React, { useEffect, useState } from 'react';
import { Text as RNText, View } from 'react-native';
import { Pressable } from '@/components/ui/Pressable';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import Animated, { Easing, cancelAnimation, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Glass, PhotoCard, UAvatar, UButton, UIconButton } from '@/components/ui';
import { FONT } from '@/components/ui/fonts';
import { FIXED } from '@/stores/themeStore';
import { selectAuthor, selectIsFollowing, selectIsReelLiked, selectIsReelSaved, useSocialStore } from '@/stores/socialStore';
import { compactCount } from '@/lib/timeAgo';
import { SafetySheet } from '@/components/moderation/SafetySheet';
import { useAuthStore } from '@/stores/authStore';
import type { Reel } from '@/types/social';
import { BarText, photoOf, shareText } from './shared';

const PLAY_MS = 12_000;

interface SpoolPageProps {
  reel: Reel;
  height: number;
  active: boolean;
  onComments: () => void;
  onCook: () => void;
}

function Rail({ children, count }: { children: React.ReactNode; count: string }) {
  return (
    <View className="items-center" style={{ gap: 4 }}>
      {children}
      <RNText style={{ fontFamily: FONT.sans, fontSize: 12, lineHeight: 17.4, color: FIXED.paper }}>{count}</RNText>
    </View>
  );
}

/** One full-screen reel: photo, action rail, author + caption, recipe pill, progress strip. */
export function SpoolPage({ reel, height, active, onComments, onCook }: SpoolPageProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const author = useSocialStore(selectAuthor(reel.authorId));
  const liked = useSocialStore(selectIsReelLiked(reel.id));
  const saved = useSocialStore(selectIsReelSaved(reel.id));
  const following = useSocialStore(selectIsFollowing(reel.authorId));
  const toggleLike = useSocialStore((s) => s.toggleLikeReel);
  const toggleSave = useSocialStore((s) => s.toggleSaveReel);
  const toggleFollow = useSocialStore((s) => s.toggleFollow);

  const myId = useAuthStore((s) => s.user?.id);
  const [safety, setSafety] = useState(false);
  const progress = useSharedValue(0);
  useEffect(() => {
    cancelAnimation(progress);
    progress.value = 0;
    if (active) progress.value = withTiming(1, { duration: PLAY_MS, easing: Easing.linear });
  }, [active, progress]);
  const barStyle = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }));

  const base = Math.max(insets.bottom, 20);

  return (
    <View style={{ height }}>
      <PhotoCard source={photoOf(reel.photo)} height={height} radius={0} fade="both" accessibilityLabel={reel.title} />

      <View pointerEvents="box-none" style={{ position: 'absolute', right: 14, bottom: base + 166, gap: 18, zIndex: 2 }}>
        <Rail count={compactCount(reel.likes)}>
          <UIconButton
            tone="glassDark"
            icon="heart"
            filled={liked}
            label={liked ? t('spools.unlike', 'Unlike') : t('spools.like', 'Like')}
            onPress={() => toggleLike(reel.id)}
          />
        </Rail>
        <Rail count={compactCount(reel.commentCount)}>
          <UIconButton tone="glassDark" icon="chat" label={t('spools.comments', 'Comments')} onPress={onComments} />
        </Rail>
        <Rail count={compactCount(reel.saves)}>
          <UIconButton
            tone="glassDark"
            icon="bookmark"
            filled={saved}
            label={saved ? t('spools.unsave', 'Remove from saved') : t('spools.save', 'Save')}
            onPress={() => toggleSave(reel.id)}
          />
        </Rail>
        <Rail count={t('spools.share', 'Share')}>
          <UIconButton
            tone="glassDark"
            icon="send"
            label={t('spools.share', 'Share')}
            onPress={() => shareText(`${reel.title} · ${reel.caption}`)}
          />
        </Rail>
        {reel.authorId !== myId ? (
          <Rail count={t('safety.reportShort', 'Report')}>
            <UIconButton tone="glassDark" icon="more" label={t('safety.title', 'Report or block')} onPress={() => setSafety(true)} />
          </Rail>
        ) : null}
      </View>
      <SafetySheet visible={safety} onClose={() => setSafety(false)} targetType="post" targetId={reel.id} personId={reel.authorId} personName={author?.handle} />

      <View style={{ position: 'absolute', left: 20, right: 84, bottom: base + 84, gap: 10, zIndex: 2 }}>
        {author ? (
          <View className="flex-row items-center" style={{ gap: 10 }}>
            <UAvatar source={photoOf(author.avatar)} name={author.displayName} size={40} />
            <RNText numberOfLines={1} style={{ fontFamily: FONT.display, fontSize: 15, color: FIXED.paper, flexShrink: 1 }}>
              {author.handle}
            </RNText>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={following ? t('spools.following', 'Following') : t('spools.follow', 'Follow')}
              accessibilityState={{ selected: following }}
              onPress={() => toggleFollow(author.id)}
              hitSlop={6}
            >
              <Glass
                dark={!following}
                style={{
                  height: 32,
                  borderRadius: 16,
                  paddingHorizontal: 14,
                  justifyContent: 'center',
                }}
              >
                <RNText style={{ fontFamily: FONT.sansMedium, fontSize: 13, color: following ? FIXED.night : FIXED.paper }}>
                  {following ? t('spools.following', 'Following') : t('spools.follow', 'Follow')}
                </RNText>
              </Glass>
            </Pressable>
          </View>
        ) : null}
        <RNText numberOfLines={3} style={{ fontFamily: FONT.sans, fontSize: 14, lineHeight: 20, color: FIXED.paper }}>
          {reel.caption}
        </RNText>
      </View>

      <Glass
        dark
        style={{
          position: 'absolute',
          left: 12,
          right: 12,
          bottom: base,
          borderRadius: 26,
          padding: 10,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          zIndex: 2,
        }}
      >
        <UAvatar source={photoOf(reel.recipePhoto)} name={reel.recipeTitle} size={52} square />
        <BarText title={reel.recipeTitle} sub={reel.recipeMeta} size={15} />
        <UButton size="sm" variant="accent" label={t('spools.cookThis', 'Cook this')} onPress={onCook} />
      </Glass>

      <View
        pointerEvents="none"
        style={{ position: 'absolute', left: 20, right: 20, bottom: base - 12, height: 3, borderRadius: 2, overflow: 'hidden', zIndex: 2, backgroundColor: FIXED.glassEdge }}
      >
        <Animated.View style={[{ height: '100%', backgroundColor: FIXED.paper, borderRadius: 2 }, barStyle]} />
      </View>
    </View>
  );
}
