import React from 'react';
import { Pressable, ScrollView, Text as RNText, View } from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Dot, Icon, PhotoCard, StoryRing, Tag, UBadge, UIconButton, type PhotoSource } from '@/components/ui';
import { FONT } from '@/components/ui/fonts';
import { SAMPLE } from '@/assets/sample';
import { useSocialStore } from '@/stores/socialStore';
import { PREVIEW_LABEL } from '@/constants/features';
import { DarkBar, BarText, GlassPill, photoOf } from './shared';

interface HomeHeaderProps {
  unread: number;
  onSearch: () => void;
  onNotifications: () => void;
  onMessages: () => void;
}

/** .top: logo + wordmark on the left, search / notifications / messages on the right. */
export function HomeHeader({ unread, onSearch, onNotifications, onMessages }: HomeHeaderProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  return (
    <View
      className="flex-row items-center justify-between"
      style={{ paddingTop: Math.max(insets.top, 20) + 14, paddingBottom: 10, paddingHorizontal: 20, gap: 12 }}
    >
      <View className="flex-row items-center" style={{ gap: 10 }}>
        <Image
          source={require('../../assets/icon.jpg')}
          style={{ width: 36, height: 36, borderRadius: 11 }}
          accessible={false}
        />
        <RNText className="text-ink" accessibilityRole="header" style={{ fontFamily: FONT.display, fontSize: 22, letterSpacing: -0.44 }}>
          SousChef
        </RNText>
      </View>
      <View className="flex-row items-center" style={{ gap: 6 }}>
        <UIconButton icon="search" label={t('home.search', 'Search')} onPress={onSearch} />
        <View>
          <UIconButton icon="bell" label={t('home.notifications', 'Notifications')} onPress={onNotifications} />
          <View pointerEvents="none" style={{ position: 'absolute', top: 11, right: 12 }}>
            <Dot />
          </View>
        </View>
        <View>
          <UIconButton
            icon="send"
            label={unread > 0 ? t('home.messagesUnread', 'Messages, {{n}} unread', { n: unread }) : t('home.messages', 'Messages')}
            onPress={onMessages}
          />
          {unread > 0 ? (
            <View pointerEvents="none" style={{ position: 'absolute', top: -2, right: -4 }}>
              <UBadge count={unread} />
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
}

/** Link-paste bar: opens /import. */
export function LinkBar({ onPress }: { onPress: () => void }) {
  const { t } = useTranslation();
  const label = t('home.pasteLink', 'Paste a recipe or video link');
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      className="flex-row items-center bg-surface-2"
      style={({ pressed }) => ({ height: 56, borderRadius: 28, paddingStart: 20, paddingRight: 6, gap: 10, opacity: pressed ? 0.85 : 1 })}
    >
      <Icon name="link" color="muted" />
      <RNText className="text-muted flex-1" numberOfLines={1} style={{ fontFamily: FONT.sans, fontSize: 15 }}>
        {label}
      </RNText>
      <View className="items-center justify-center bg-night" style={{ width: 44, height: 44, borderRadius: 22 }}>
        <Icon name="arrowRight" color="paper" />
      </View>
    </Pressable>
  );
}

interface StoriesRowProps {
  onOpen: (storyId: string) => void;
  onAdd: () => void;
}

/** Story bubbles: own "Your plate" first, then friends. Seen state comes from the social store. */
export function StoriesRow({ onOpen, onAdd }: StoriesRowProps) {
  const { t } = useTranslation();
  const stories = useSocialStore((s) => s.stories);
  const authors = useSocialStore((s) => s.authors);
  const viewed = useSocialStore((s) => s.viewedStoryIds);
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ flexGrow: 0, marginHorizontal: -20 }}
      contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}
    >
      <StoryRing source={SAMPLE.chef} name={t('home.yourPlate', 'Your plate')} seen add onPress={onAdd} />
      {stories.map((story) => {
        const author = authors.find((a) => a.id === story.authorId);
        if (!author) return null;
        return (
          <StoryRing
            key={story.id}
            source={photoOf(author.avatar)}
            name={author.displayName}
            seen={viewed.includes(story.id)}
            onPress={() => onOpen(story.id)}
          />
        );
      })}
    </ScrollView>
  );
}

interface TonightCardProps {
  title: string;
  sub: string;
  photo: PhotoSource;
  preview?: boolean;
  onPress: () => void;
}

/** Tonight's meal from the plan: photo card with a dark glass bar. */
export function TonightCard({ title, sub, photo, preview, onPress }: TonightCardProps) {
  const { t } = useTranslation();
  return (
    <PhotoCard
      source={photo}
      height={230}
      fade="both"
      topLeft={<Tag tone="glassDark" large label={t('home.tonight', 'Tonight · from your plan')} />}
      topRight={preview ? <Tag tone="glassDark" label={PREVIEW_LABEL} /> : undefined}
      onPress={onPress}
      accessibilityLabel={title}
    >
      <DarkBar>
        <BarText title={title} sub={sub} />
        <GlassPill label={t('home.startCooking', 'Start cooking')} />
      </DarkBar>
    </PhotoCard>
  );
}
