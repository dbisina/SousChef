import React, { useCallback, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, Text as RNText, View, useWindowDimensions, type ViewToken } from 'react-native';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Glass, Muted, Screen, TopBar, UIconButton } from '@/components/ui';
import { FONT } from '@/components/ui/fonts';
import { FIXED } from '@/stores/themeStore';
import { useSocialStore } from '@/stores/socialStore';
import { ReelPage } from '@/components/feed/ReelPage';
import type { Reel } from '@/types/social';

type Tab = 'forYou' | 'following';

export default function ReelsScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { height } = useWindowDimensions();
  const { start } = useLocalSearchParams<{ start?: string }>();
  const reels = useSocialStore((s) => s.reels);
  const followingIds = useSocialStore((s) => s.followingIds);
  const [tab, setTab] = useState<Tab>('forYou');
  const [activeId, setActiveId] = useState<string | undefined>(start);

  const list = useMemo(
    () => (tab === 'forYou' ? reels : reels.filter((r) => followingIds.includes(r.authorId))),
    [tab, reels, followingIds],
  );
  const startIndex = useMemo(() => {
    const i = list.findIndex((r) => r.id === start);
    return i > 0 ? i : 0;
    // Only the first render positions the list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const current = activeId && list.some((r) => r.id === activeId) ? activeId : list[0]?.id;

  const onViewable = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const first = viewableItems[0]?.item as Reel | undefined;
    if (first) setActiveId(first.id);
  }).current;
  const viewConfig = useRef({ itemVisiblePercentThreshold: 60 }).current;

  const renderItem = useCallback(
    ({ item }: { item: Reel }) => (
      <ReelPage
        reel={item}
        height={height}
        active={item.id === current}
        onComments={() => router.push(`/post/${item.id}` as Href)}
        onCook={() => router.push('/(tabs)/browse' as Href)}
      />
    ),
    [height, current, router],
  );

  const tabs: { value: Tab; label: string }[] = [
    { value: 'forYou', label: t('reels.forYou', 'For You') },
    { value: 'following', label: t('reels.followingTab', 'Following') },
  ];

  return (
    <Screen tone="dark" bare>
      {list.length === 0 ? (
        <View className="flex-1 items-center justify-center" style={{ paddingHorizontal: 40 }}>
          <Muted center>{t('reels.emptyFollowing', 'Follow cooks to see their reels here.')}</Muted>
        </View>
      ) : (
        <FlatList
          data={list}
          keyExtractor={(r) => r.id}
          renderItem={renderItem}
          pagingEnabled
          snapToInterval={height}
          decelerationRate="fast"
          showsVerticalScrollIndicator={false}
          initialScrollIndex={startIndex}
          getItemLayout={(_, index) => ({ length: height, offset: height * index, index })}
          onViewableItemsChanged={onViewable}
          viewabilityConfig={viewConfig}
          extraData={current}
        />
      )}
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 3 }} pointerEvents="box-none">
        <TopBar
          variant="compact"
          left={<UIconButton tone="glassDark" icon="back" label={t('common.back', 'Back')} onPress={() => router.back()} />}
          title={
            <Glass dark accessibilityRole="tablist" style={{ flexDirection: 'row', padding: 4, borderRadius: 27 }}>
              {tabs.map((o) => {
                const on = o.value === tab;
                return (
                  <Pressable
                    key={o.value}
                    accessibilityRole="tab"
                    accessibilityLabel={o.label}
                    accessibilityState={{ selected: on }}
                    onPress={() => setTab(o.value)}
                    style={{
                      height: 38,
                      paddingHorizontal: 18,
                      borderRadius: 19,
                      justifyContent: 'center',
                      backgroundColor: on ? FIXED.paper : undefined,
                    }}
                  >
                    <RNText style={{ fontFamily: FONT.sansMedium, fontSize: 13, color: on ? FIXED.night : FIXED.paper }}>{o.label}</RNText>
                  </Pressable>
                );
              })}
            </Glass>
          }
          right={<UIconButton tone="glassDark" icon="camera" label={t('reels.camera', 'New post')} onPress={() => router.push('/post/new' as Href)} />}
        />
      </View>
    </Screen>
  );
}
