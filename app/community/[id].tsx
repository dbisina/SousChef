import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text as RNText, View } from 'react-native';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import {
  AvatarStack,
  Chip,
  ChipRow,
  H2,
  Muted,
  PhotoCard,
  Screen,
  Tag,
  UAvatar,
  UButton,
  UIconButton,
} from '@/components/ui';
import { FONT } from '@/components/ui/fonts';
import { FIXED } from '@/stores/themeStore';
import { useSocialStore } from '@/stores/socialStore';
import { compactCount, timeAgo } from '@/lib/timeAgo';
import { photoOf } from '@/components/feed/shared';
import type { Challenge, CommunityEvent } from '@/types/social';

type Tab = 'feed' | 'challenges' | 'cookbook' | 'events';

function ChallengeRow({ challenge, onEnter }: { challenge: Challenge; onEnter: () => void }) {
  const { t } = useTranslation();
  return (
    <View className="flex-row items-center bg-surface" style={{ padding: 12, borderRadius: 24, gap: 12 }}>
      <UAvatar source={photoOf(challenge.photo)} name={challenge.title} size={64} square />
      <View className="flex-1" style={{ minWidth: 0, gap: 2 }}>
        <RNText className="text-muted" style={{ fontFamily: FONT.sans, fontSize: 12 }}>
          {t('community.thisWeek', 'This week’s challenge')}
        </RNText>
        <RNText className="text-ink" numberOfLines={2} style={{ fontFamily: FONT.display, fontSize: 15, lineHeight: 20, letterSpacing: -0.15 }}>
          {challenge.title}
        </RNText>
        <RNText className="text-muted" style={{ fontFamily: FONT.sans, fontSize: 12 }}>
          {t('community.entries', '{{n}} entries · {{ends}}', { n: challenge.entries, ends: challenge.endsLabel })}
        </RNText>
      </View>
      <UButton size="sm" label={t('community.enter', 'Enter')} onPress={onEnter} />
    </View>
  );
}

function EventRow({ event, reminded, onToggle }: { event: CommunityEvent; reminded: boolean; onToggle: () => void }) {
  const { t } = useTranslation();
  const date = new Date(event.date);
  return (
    <View className="flex-row items-center" style={{ gap: 14 }}>
      <View className="items-center justify-center bg-night" style={{ width: 64, height: 68, borderRadius: 18 }}>
        <RNText style={{ fontFamily: FONT.display, fontSize: 24, lineHeight: 24, color: FIXED.paper }}>{date.getDate()}</RNText>
        <RNText style={{ fontFamily: FONT.sans, fontSize: 12, color: FIXED.captionSub }}>
          {date.toLocaleDateString(undefined, { month: 'short' })}
        </RNText>
      </View>
      <View className="flex-1" style={{ minWidth: 0, gap: 2 }}>
        <RNText className="text-ink" numberOfLines={2} style={{ fontFamily: FONT.display, fontSize: 15, lineHeight: 20, letterSpacing: -0.15 }}>
          {event.title}
        </RNText>
        <RNText className="text-muted" style={{ fontFamily: FONT.sans, fontSize: 12 }}>
          {event.detail}
        </RNText>
      </View>
      <UIconButton
        icon="bell"
        filled={reminded}
        label={reminded ? t('community.reminderOn', 'Reminder set') : t('community.remindMe', 'Remind me')}
        onPress={onToggle}
      />
    </View>
  );
}

export default function CommunityScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const communities = useSocialStore((s) => s.communities);
  const challenges = useSocialStore((s) => s.challenges);
  const events = useSocialStore((s) => s.events);
  const posts = useSocialStore((s) => s.posts);
  const authors = useSocialStore((s) => s.authors);
  const joinedIds = useSocialStore((s) => s.joinedCommunityIds);
  const toggleJoin = useSocialStore((s) => s.toggleJoinCommunity);
  const [tab, setTab] = useState<Tab>('feed');
  const [reminders, setReminders] = useState<string[]>([]);

  const community = communities.find((c) => c.id === id);
  const myChallenges = useMemo(() => challenges.filter((c) => c.communityId === id), [challenges, id]);
  const myEvents = useMemo(() => events.filter((e) => e.communityId === id), [events, id]);
  const myPosts = useMemo(() => posts.filter((p) => p.communityId === id), [posts, id]);
  const cookbookPosts = useMemo(() => myPosts.filter((p) => p.recipeId), [myPosts]);

  if (!community) {
    return (
      <Screen bare>
        <View className="flex-1 items-center justify-center" style={{ paddingHorizontal: 32, gap: 14 }}>
          <H2 center>{t('community.notFound', 'Community not found')}</H2>
          <UButton size="sm" label={t('community.goBack', 'Go back')} onPress={() => router.back()} />
        </View>
      </Screen>
    );
  }

  const joined = joinedIds.includes(community.id);
  const top = Math.max(insets.top, 20) + 14;
  const enter = () => router.push('/post/new' as Href);
  const toggleReminder = (eventId: string) =>
    setReminders((r) => (r.includes(eventId) ? r.filter((x) => x !== eventId) : [...r, eventId]));

  const postRows = (list: typeof myPosts) =>
    list.length === 0 ? (
      <Muted>{t('community.nothingYet', 'Nothing here yet.')}</Muted>
    ) : (
      list.map((p) => {
        const a = authors.find((x) => x.id === p.authorId);
        if (!a) return null;
        return (
          <Pressable
            key={p.id}
            accessibilityRole="button"
            accessibilityLabel={`${a.handle}: ${p.caption}`}
            onPress={() => router.push(`/post/${p.id}` as Href)}
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          >
            <View className="flex-row items-start" style={{ gap: 12 }}>
            <UAvatar source={photoOf(a.avatar)} name={a.displayName} size={38} />
            <View className="flex-1" style={{ minWidth: 0 }}>
              <View className="flex-row items-center" style={{ gap: 6 }}>
                <RNText className="text-ink" style={{ fontFamily: FONT.sansSemi, fontSize: 12 }}>
                  {a.handle}
                </RNText>
                <RNText className="text-muted" style={{ fontFamily: FONT.sans, fontSize: 12 }}>
                  {timeAgo(p.createdAt)}
                </RNText>
              </View>
              <RNText className="text-ink" style={{ fontFamily: FONT.sans, fontSize: 14, lineHeight: 20 }}>
                {p.caption}
              </RNText>
            </View>
            </View>
          </Pressable>
        );
      })
    );

  const tabs: { value: Tab; label: string }[] = [
    { value: 'feed', label: t('community.tabFeed', 'Feed') },
    { value: 'challenges', label: t('community.tabChallenges', 'Challenges') },
    { value: 'cookbook', label: t('community.tabCookbook', 'Cookbook') },
    { value: 'events', label: t('community.tabEvents', 'Events') },
  ];

  return (
    <Screen bare>
      <ScrollView contentContainerStyle={{ paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
        <PhotoCard
          source={photoOf(community.photo)}
          height={320}
          radius={0}
          fade="both"
          style={{ borderBottomLeftRadius: 36, borderBottomRightRadius: 36 }}
          accessibilityLabel={community.name}
        >
          <View className="flex-row justify-between" style={{ position: 'absolute', top, left: 20, right: 20 }}>
            <UIconButton tone="glassDark" icon="back" label={t('common.back', 'Back')} onPress={() => router.back()} />
            <UIconButton
              tone="glassDark"
              icon="chat"
              label={t('community.groupChat', 'Group chat')}
              onPress={() => router.push('/messages' as Href)}
            />
          </View>
          <View style={{ position: 'absolute', left: 22, right: 22, bottom: 22, gap: 8 }}>
            <View style={{ alignSelf: 'flex-start' }}>
              <Tag
                tone="glassDark"
                label={community.visibility === 'public' ? t('community.public', 'Public community') : t('community.private', 'Private community')}
              />
            </View>
            <RNText
              accessibilityRole="header"
              numberOfLines={2}
              style={{ fontFamily: FONT.display, fontSize: 30, lineHeight: 33, letterSpacing: -0.6, color: FIXED.paper }}
            >
              {community.name}
            </RNText>
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center" style={{ gap: 10 }}>
                <AvatarStack people={community.memberAvatars.map((a) => ({ name: a, source: photoOf(a) }))} />
                <RNText style={{ fontFamily: FONT.sans, fontSize: 12, color: FIXED.paper }}>
                  {t('community.members', '{{n}} members', { n: compactCount(community.memberCount) })}
                </RNText>
              </View>
              <UButton
                size="sm"
                variant={joined ? 'ghost' : 'accent'}
                label={joined ? t('community.joined', 'Joined') : t('community.join', 'Join')}
                onPress={() => toggleJoin(community.id)}
              />
            </View>
          </View>
        </PhotoCard>

        <View style={{ paddingTop: 16, gap: 14 }}>
          <ChipRow>
            {tabs.map((o) => (
              <Chip key={o.value} label={o.label} on={tab === o.value} onPress={() => setTab(o.value)} />
            ))}
          </ChipRow>

          <View style={{ paddingHorizontal: 20, gap: 14 }}>
            {tab === 'feed' || tab === 'challenges'
              ? myChallenges.map((c) => <ChallengeRow key={c.id} challenge={c} onEnter={enter} />)
              : null}
            {tab === 'feed' || tab === 'events'
              ? myEvents.map((e) => (
                  <EventRow key={e.id} event={e} reminded={reminders.includes(e.id)} onToggle={() => toggleReminder(e.id)} />
                ))
              : null}
            {tab === 'feed' ? postRows(myPosts) : null}
            {tab === 'cookbook' ? postRows(cookbookPosts) : null}
            {tab === 'challenges' && myChallenges.length === 0 ? <Muted>{t('community.nothingYet', 'Nothing here yet.')}</Muted> : null}
            {tab === 'events' && myEvents.length === 0 ? <Muted>{t('community.nothingYet', 'Nothing here yet.')}</Muted> : null}
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}
