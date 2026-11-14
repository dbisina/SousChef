import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text as RNText, View, useWindowDimensions } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import {
  AvatarStack,
  Body,
  H2,
  Icon,
  LinkText,
  PhotoCard,
  Tag,
  UAvatar,
  UButton,
  UCard,
  useTokens,
  type PhotoSource,
} from '@/components/ui';
import { FONT } from '@/components/ui/fonts';
import { FIXED } from '@/stores/themeStore';
import { PREVIEW_LABEL } from '@/constants/features';

/** The design shows no "Preview" tags; flip to true to label sample content again. */
const SHOW_PREVIEW = false;
import { RESTAURANTS, MENU } from '@/data/sample/restaurants';
import { SAMPLE } from '@/assets/sample';
import { selectAuthor, selectIsFollowing, selectIsPostLiked, selectIsPostSaved, useSocialStore } from '@/stores/socialStore';
import { compactCount, timeAgo } from '@/lib/timeAgo';
import type { PhotoRef } from '@/types/social';
import { Action, AuthorRow, BarText, DarkBar, photoOf, shareText } from './shared';

const go = (router: ReturnType<typeof useRouter>, href: string) => router.push(href as Href);

const pounds = (pence: number) => `£${(pence / 100).toFixed(pence % 100 === 0 ? 0 : 2)}`;

/** Extra step photos for the sample carousel (the data layer holds one photo per post). */
const CAROUSEL_EXTRAS: Record<string, PhotoRef[]> = {
  'post-katsu': ['chicken', 'garlic', 'bowl'],
};

/* ------------------------------------------------------------------ friend recipe post */

export function FriendPost({ postId }: { postId: string }) {
  const { t } = useTranslation();
  const tokens = useTokens();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const post = useSocialStore((s) => s.posts.find((p) => p.id === postId));
  const author = useSocialStore(post ? selectAuthor(post.authorId) : () => undefined);
  const liked = useSocialStore(selectIsPostLiked(postId));
  const saved = useSocialStore(selectIsPostSaved(postId));
  const following = useSocialStore(post ? selectIsFollowing(post.authorId) : () => false);
  const toggleLike = useSocialStore((s) => s.toggleLikePost);
  const toggleSave = useSocialStore((s) => s.toggleSavePost);
  const toggleFollow = useSocialStore((s) => s.toggleFollow);
  const [page, setPage] = useState(0);
  const restaurant = RESTAURANTS[0];

  if (!post || !author) return null;
  const photos: PhotoRef[] = [post.photo, ...(CAROUSEL_EXTRAS[post.id] ?? [])];
  const w = width - 40;
  const kindLabel = post.kind === 'recipe' ? t('home.kindRecipe', 'Recipe') : post.kind === 'plan' ? t('home.kindPlan', 'Plan') : t('home.kindPost', 'Post');
  const open = () => go(router, `/post/${post.id}`);

  return (
    <View style={{ gap: 12 }}>
      <AuthorRow
        photo={author.avatar}
        name={author.handle}
        sub={`${timeAgo(post.createdAt)} · ${kindLabel}`}
        onPress={() => go(router, `/user/${author.id}`)}
        right={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={following ? t('home.following', 'Following') : t('home.follow', 'Follow')}
            accessibilityState={{ selected: following }}
            hitSlop={5}
            onPress={() => toggleFollow(author.id)}
            style={({ pressed }) => ({ height: 34, borderRadius: 17, paddingHorizontal: 14, justifyContent: 'center', backgroundColor: tokens['surface-2'], opacity: pressed ? 0.8 : 1 })}
          >
            <RNText className={following ? 'text-muted' : 'text-ink'} style={{ fontFamily: FONT.sansMedium, fontSize: 13 }}>
              {following ? t('home.following', 'Following') : t('home.follow', 'Follow')}
            </RNText>
          </Pressable>
        }
      />

      <View style={{ height: 380, borderRadius: 28, overflow: 'hidden' }}>
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / w))}
        >
          {photos.map((ref, i) => (
            <PhotoCard
              key={`${ref}-${i}`}
              source={photoOf(ref)}
              width={w}
              height={380}
              radius={28}
              fade="none"
              onPress={open}
              accessibilityLabel={post.title}
            />
          ))}
        </ScrollView>
        <View pointerEvents="none" className="flex-row justify-between" style={{ position: 'absolute', top: 14, left: 14, right: 14 }}>
          <View className="flex-row items-center" style={{ gap: 8 }}>
            {post.meta ? <Tag tone="glassDark" large icon="clock" label={post.meta} /> : null}
            {SHOW_PREVIEW ? <Tag tone="glassDark" label={PREVIEW_LABEL} /> : null}
          </View>
          {photos.length > 1 ? <Tag tone="glassDark" large label={`${page + 1}/${photos.length}`} /> : null}
        </View>
      </View>

      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center" style={{ gap: 14 }}>
          <Action icon="heart" label={t('home.like', 'Like')} active={liked} count={post.likes} onPress={() => toggleLike(post.id)} />
          <Action icon="chat" label={t('home.comments', 'Comments')} count={post.commentCount} onPress={open} />
          <Action icon="send" label={t('home.share', 'Share')} onPress={() => shareText(`${post.title} · ${post.caption}`)} />
        </View>
        <Action icon="bookmark" label={t('home.save', 'Save')} active={saved} onPress={() => toggleSave(post.id)} />
      </View>

      <Body>
        <RNText style={{ fontFamily: FONT.sansSemi }}>{author.handle}</RNText> {post.caption}
      </Body>

      <View className="flex-row flex-wrap" style={{ gap: 8 }}>
        <UButton
          size="sm"
          label={t('home.cookThis', 'Cook this')}
          onPress={() => go(router, post.recipeId ? `/recipe/${post.recipeId}` : `/post/${post.id}`)}
        />
        <UButton size="sm" variant="ghost" label={t('home.addToPlan', 'Add to plan')} onPress={() => go(router, '/(tabs)/mealplan')} />
        <UButton
          size="sm"
          variant="ghost"
          icon="pin"
          label={t('home.order', 'Order')}
          onPress={() => go(router, `/restaurant/${restaurant.id}`)}
        />
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ reels row */

export function ReelsRow() {
  const { t } = useTranslation();
  const router = useRouter();
  const reels = useSocialStore((s) => s.reels);
  const shown = useMemo(() => reels.slice(0, 3), [reels]);
  if (shown.length === 0) return null;
  return (
    <View style={{ gap: 12 }}>
      <View className="flex-row items-center justify-between" style={{ height: 24 }}>
        <View className="flex-row items-center" style={{ gap: 8 }}>
          <H2>{t('home.reels', 'Reels')}</H2>
          {SHOW_PREVIEW ? <Tag label={PREVIEW_LABEL} /> : null}
        </View>
        <Pressable accessibilityRole="link" accessibilityLabel={t('home.seeAllReels', 'See all reels')} onPress={() => go(router, '/reels')} hitSlop={10}>
          <LinkText>{t('home.seeAll', 'See all')}</LinkText>
        </Pressable>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0, marginRight: -20 }}
        contentContainerStyle={{ gap: 10, paddingRight: 20 }}
      >
        {shown.map((reel) => (
          <PhotoCard
            key={reel.id}
            source={photoOf(reel.photo)}
            width={132}
            height={228}
            radius={22}
            onPress={() => router.push({ pathname: '/reels', params: { start: reel.id } })}
            accessibilityLabel={reel.title}
          >
            <View pointerEvents="none" style={{ position: 'absolute', left: 12, right: 10, bottom: 10, gap: 2 }}>
              <View className="flex-row items-center" style={{ gap: 4 }}>
                <Icon name="play" size="sm" color="paper" />
                <RNText style={{ fontFamily: FONT.sans, fontSize: 12, color: FIXED.captionSub }}>{compactCount(reel.views)}</RNText>
              </View>
              <RNText numberOfLines={2} style={{ fontFamily: FONT.display, fontSize: 13, lineHeight: 16.4, color: FIXED.paper }}>
                {reel.title}
              </RNText>
            </View>
          </PhotoCard>
        ))}
      </ScrollView>
    </View>
  );
}

/* ------------------------------------------------------------------ imported by you */

export interface ImportedCardData {
  id: string;
  title: string;
  platform: string;
  minutes?: number;
  photo: PhotoSource;
  preview?: boolean;
}

export function ImportedCard({ item, onPress }: { item: ImportedCardData; onPress: () => void }) {
  const { t } = useTranslation();
  const tokens = useTokens();
  const meta = item.minutes
    ? t('home.importedMeta', '{{n}} min · ready to cook', { n: item.minutes })
    : t('home.importedReady', 'Ready to cook');
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={item.title}
      onPress={onPress}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', backgroundColor: tokens.surface, padding: 12, borderRadius: 26, gap: 14, opacity: pressed ? 0.85 : 1 })}
    >
      <UAvatar source={item.photo} name={item.title} size={76} square />
      <View className="flex-1" style={{ minWidth: 0, gap: 2 }}>
        <View className="flex-row items-center" style={{ gap: 6 }}>
          <RNText className="text-muted" numberOfLines={1} style={{ fontFamily: FONT.sans, fontSize: 12, flexShrink: 1 }}>
            {t('home.importedBy', 'Imported by you · {{source}}', { source: item.platform })}
          </RNText>
          {SHOW_PREVIEW && item.preview ? <Tag label={PREVIEW_LABEL} /> : null}
        </View>
        <RNText className="text-ink" numberOfLines={2} style={{ fontFamily: FONT.display, fontSize: 15, lineHeight: 20, letterSpacing: -0.15 }}>
          {item.title}
        </RNText>
        <RNText className="text-muted" style={{ fontFamily: FONT.sans, fontSize: 12 }}>
          {meta}
        </RNText>
      </View>
      <View className="items-center justify-center bg-night" style={{ width: 44, height: 44, borderRadius: 22 }}>
        <Icon name="arrowRight" color="paper" />
      </View>
    </Pressable>
  );
}

/* ------------------------------------------------------------------ shared / own plan */

export interface PlanCardData {
  key: string;
  day: string;
  title: string;
  photo: PhotoSource;
}

interface PlanShareProps {
  /** Sample plan from a friend (true) or the user's own plan (false). */
  shared: boolean;
  cards: PlanCardData[];
  onUse: () => void;
}

export function PlanShare({ shared, cards, onUse }: PlanShareProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const tolu = useSocialStore(selectAuthor('tolu'));
  return (
    <View style={{ gap: 12 }}>
      {shared && tolu ? (
        <AuthorRow
          photo={tolu.avatar}
          name={t('home.sharedPlan', '{{handle}} shared a meal plan', { handle: tolu.handle })}
          sub={t('home.sharedPlanMeta', '5 days · high protein · 1.2k uses')}
          size={44}
          onPress={() => go(router, `/user/${tolu.id}`)}
          right={SHOW_PREVIEW ? <Tag label={PREVIEW_LABEL} /> : undefined}
        />
      ) : (
        <View className="flex-row items-center justify-between">
          <H2>{t('home.yourPlan', 'Your plan this week')}</H2>
        </View>
      )}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0, marginRight: -20 }}
        contentContainerStyle={{ gap: 10, paddingRight: 20 }}
      >
        {cards.map((c) => (
          <PhotoCard key={c.key} source={c.photo} width={118} height={150} radius={20} onPress={onUse} accessibilityLabel={`${c.day}, ${c.title}`}>
            <View pointerEvents="none" style={{ position: 'absolute', left: 10, right: 8, bottom: 8, gap: 1 }}>
              <RNText style={{ fontFamily: FONT.sans, fontSize: 12, color: FIXED.captionSub }}>{c.day}</RNText>
              <RNText numberOfLines={2} style={{ fontFamily: FONT.display, fontSize: 12, lineHeight: 14, color: FIXED.paper }}>
                {c.title}
              </RNText>
            </View>
          </PhotoCard>
        ))}
      </ScrollView>
      <UButton
        variant="ghost"
        label={shared ? t('home.usePlan', 'Use this plan') : t('home.openPlan', 'Open plan')}
        onPress={onUse}
        style={{ height: 50, borderRadius: 25 }}
      />
    </View>
  );
}

/* ------------------------------------------------------------------ sponsored restaurant dish */

export function SponsoredDish() {
  const { t } = useTranslation();
  const router = useRouter();
  const restaurant = RESTAURANTS[0];
  const dish = MENU.find((m) => m.restaurantId === restaurant?.id);
  if (!restaurant || !dish) return null;
  const toRestaurant = () => go(router, `/restaurant/${restaurant.id}`);
  const sub = restaurant.freeDeliveryOverPence
    ? t('home.dishSub', '{{price}} · free delivery over {{min}}', { price: pounds(dish.pricePence), min: pounds(restaurant.freeDeliveryOverPence) })
    : pounds(dish.pricePence);
  return (
    <View style={{ gap: 12 }}>
      <View className="flex-row items-center justify-between" style={{ gap: 10 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={restaurant.name}
          onPress={toRestaurant}
          className="flex-row items-center flex-1"
          style={{ gap: 10, minHeight: 44 }}
        >
          <View className="items-center justify-center bg-night" style={{ width: 38, height: 38, borderRadius: 19 }}>
            <Icon name="store" size="sm" color="paper" />
          </View>
          <View style={{ flexShrink: 1, minWidth: 0 }}>
            <View className="flex-row items-center" style={{ gap: 6 }}>
              <RNText className="text-ink" numberOfLines={1} style={{ fontFamily: FONT.display, fontSize: 15, letterSpacing: -0.15, flexShrink: 1 }}>
                {restaurant.name}
              </RNText>
              <Tag label={t('home.nearYou', 'Near you')} />
            </View>
            <RNText className="text-muted" numberOfLines={1} style={{ fontFamily: FONT.sans, fontSize: 12 }}>
              {t('home.restaurantMeta', '{{km}} km · {{min}} min delivery · ★ {{rating}}', {
                km: restaurant.distanceKm,
                min: restaurant.etaMin[0],
                rating: restaurant.rating,
              })}
            </RNText>
          </View>
        </Pressable>
        {restaurant.sponsored ? (
          <RNText className="text-muted" style={{ fontFamily: FONT.sans, fontSize: 12 }}>
            {t('home.sponsored', 'Sponsored')}
          </RNText>
        ) : null}
      </View>
      <PhotoCard
        source={photoOf(dish.photo)}
        height={300}
        radius={28}
        fade="both"
        topLeft={<Tag tone="glassDark" large label={t('home.hygiene', 'Hygiene {{n}}', { n: restaurant.hygiene })} />}
        topRight={SHOW_PREVIEW ? <Tag tone="glassDark" label={PREVIEW_LABEL} /> : undefined}
        onPress={toRestaurant}
        accessibilityLabel={dish.name}
      >
        <DarkBar>
          <BarText title={dish.name} sub={sub} />
          <UButton size="sm" variant="accent" label={t('home.order', 'Order')} onPress={toRestaurant} />
        </DarkBar>
      </PhotoCard>
    </View>
  );
}

/* ------------------------------------------------------------------ community challenge */

export function ChallengeCard() {
  const { t } = useTranslation();
  const router = useRouter();
  const challenge = useSocialStore((s) => s.challenges[0]);
  const community = useSocialStore((s) => s.communities.find((c) => c.id === challenge?.communityId));
  if (!challenge || !community) return null;
  return (
    <PhotoCard
      source={photoOf(community.photo)}
      height={250}
      fade="both"
      topLeft={<Tag tone="glassDark" large icon="people" label={community.name} />}
      topRight={SHOW_PREVIEW ? <Tag tone="glassDark" label={PREVIEW_LABEL} /> : undefined}
      onPress={() => go(router, `/community/${community.id}`)}
      accessibilityLabel={`${community.name}: ${challenge.title}`}
    >
      <View pointerEvents="none" style={{ position: 'absolute', left: 18, right: 18, bottom: 16, gap: 4 }}>
        <RNText style={{ fontFamily: FONT.sans, fontSize: 12, color: FIXED.captionSub }}>
          {t('home.weeklyChallenge', 'Weekly challenge · {{ends}}', { ends: challenge.endsLabel })}
        </RNText>
        <RNText numberOfLines={2} style={{ fontFamily: FONT.display, fontSize: 24, lineHeight: 28, letterSpacing: -0.48, color: FIXED.paper }}>
          {challenge.title}
        </RNText>
        <View className="flex-row items-center" style={{ gap: 10, marginTop: 4 }}>
          <AvatarStack people={community.memberAvatars.map((a) => ({ name: a, source: photoOf(a) }))} />
          <RNText style={{ fontFamily: FONT.sans, fontSize: 12, color: FIXED.paper }}>
            {t('home.entriesJoin', '{{n}} entries · Join', { n: challenge.entries })}
          </RNText>
        </View>
      </View>
    </PhotoCard>
  );
}

/* ------------------------------------------------------------------ "made your recipe" */

export function MadeYourRecipe({ postId }: { postId: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  const post = useSocialStore((s) => s.posts.find((p) => p.id === postId));
  const author = useSocialStore(post ? selectAuthor(post.authorId) : () => undefined);
  const liked = useSocialStore(selectIsPostLiked(postId));
  const toggleLike = useSocialStore((s) => s.toggleLikePost);
  if (!post || !author) return null;
  const open = () => go(router, `/post/${post.id}`);
  return (
    <View className="flex-row items-start" style={{ gap: 14 }}>
      <UAvatar source={photoOf(author.avatar)} name={author.displayName} size={44} />
      <View className="flex-1" style={{ gap: 10, minWidth: 0 }}>
        <Body>
          <RNText style={{ fontFamily: FONT.sansSemi }}>{author.displayName}</RNText>
          {` ${t('home.madeYour', 'made your')} `}
          <RNText style={{ fontFamily: FONT.sansSemi }}>{post.title.toLowerCase()}</RNText>
          <RNText className="text-muted">{` · ${timeAgo(post.createdAt)}`}</RNText>
        </Body>
        <PhotoCard
          source={photoOf(post.photo)}
          height={220}
          radius={24}
          fade="none"
          onPress={open}
          accessibilityLabel={t('home.madePhoto', "{{name}}'s {{dish}}", { name: author.displayName, dish: post.title })}
          topRight={SHOW_PREVIEW ? <Tag tone="glassDark" label={PREVIEW_LABEL} /> : undefined}
        />
        <View className="flex-row items-center" style={{ gap: 14 }}>
          <Action icon="heart" label={t('home.like', 'Like')} active={liked} count={post.likes} onPress={() => toggleLike(post.id)} />
          <Action icon="chat" label={t('home.reply', 'Reply')} count={t('home.reply', 'Reply')} onPress={open} />
        </View>
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ Mystery Kitchen result */

export function MysteryCard() {
  const { t } = useTranslation();
  const router = useRouter();
  const label = t('home.mysteryWon', 'Dayo won with 86 pts');
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={() => go(router, '/play/mystery/reveal')}>
      <UCard tone="black" style={{ borderRadius: 30, padding: 16, gap: 14 }}>
        <PhotoCard
          source={SAMPLE.friends}
          height={170}
          radius={22}
          fade="none"
          topLeft={<Tag tone="glassDark" large icon="gamepad" label={t('home.mysteryTag', 'Mystery Kitchen · last night')} />}
          topRight={SHOW_PREVIEW ? <Tag tone="glassDark" label={PREVIEW_LABEL} /> : undefined}
        />
        <View className="flex-row items-center justify-between" style={{ gap: 10 }}>
          <View className="flex-1" style={{ minWidth: 0, gap: 2 }}>
            <RNText className="text-ink" numberOfLines={1} style={{ fontFamily: FONT.display, fontSize: 17, letterSpacing: -0.17 }}>
              {label}
            </RNText>
            <RNText className="text-muted" numberOfLines={2} style={{ fontFamily: FONT.sans, fontSize: 12 }}>
              {t('home.mysterySecret', 'The secret dish was chicken katsu')}
            </RNText>
          </View>
          <Tag large label={t('home.watchReveal', 'Watch reveal')} />
        </View>
      </UCard>
    </Pressable>
  );
}

/* ------------------------------------------------------------------ private glucose reminder */

export function GlucoseReminder({ latestLine, onPress }: { latestLine?: string; onPress: () => void }) {
  const { t } = useTranslation();
  const tokens = useTokens();
  const title = t('home.glucoseTitle', '2-hour check for your rice bowl lunch');
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'flex-start', backgroundColor: tokens.surface, padding: 16, borderRadius: 26, gap: 14, opacity: pressed ? 0.85 : 1 })}
    >
      <View className="items-center justify-center bg-accent" style={{ width: 44, height: 44, borderRadius: 22 }}>
        <Icon name="drop" color="accent-ink" />
      </View>
      <View className="flex-1" style={{ minWidth: 0, gap: 2 }}>
        <RNText className="text-ink" style={{ fontFamily: FONT.display, fontSize: 15, lineHeight: 20, letterSpacing: -0.15 }}>
          {title}
        </RNText>
        <RNText className="text-muted" style={{ fontFamily: FONT.sans, fontSize: 12, lineHeight: 17 }}>
          {latestLine ?? t('home.glucoseBody', 'Log your glucose to see how this meal suits you')}
        </RNText>
        <View className="flex-row items-center" style={{ gap: 6, marginTop: 6 }}>
          <Icon name="lock" size="sm" color="muted" />
          <RNText className="text-muted" style={{ fontFamily: FONT.sans, fontSize: 12 }}>
            {t('home.onlyYou', 'Only you can see this')}
          </RNText>
        </View>
      </View>
    </Pressable>
  );
}
