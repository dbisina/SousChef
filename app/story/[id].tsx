import React, { useCallback, useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, Text as RNText, TextInput, View, useWindowDimensions } from 'react-native';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import Animated, { Easing, cancelAnimation, runOnJS, useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import { Glass, PhotoCard, Screen, UAvatar, UIconButton } from '@/components/ui';
import { FONT } from '@/components/ui/fonts';
import { FIXED } from '@/stores/themeStore';
import { useSocialStore } from '@/stores/socialStore';
import { useToastStore } from '@/stores/toastStore';
import { timeAgo } from '@/lib/timeAgo';
import { GlassPill, photoOf } from '@/components/feed/shared';

const SEGMENT_MS = 5000;

function Bar({ state, progress }: { state: 'past' | 'current' | 'future'; progress: SharedValue<number> }) {
  const style = useAnimatedStyle(() => ({ width: state === 'past' ? '100%' : state === 'current' ? `${progress.value * 100}%` : '0%' }));
  return (
    <View style={{ flex: 1, height: 3, borderRadius: 2, overflow: 'hidden', backgroundColor: FIXED.glassEdge }}>
      <Animated.View style={[{ height: '100%', backgroundColor: FIXED.paper }, style]} />
    </View>
  );
}

export default function StoryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();
  const stories = useSocialStore((s) => s.stories);
  const authors = useSocialStore((s) => s.authors);
  const markViewed = useSocialStore((s) => s.markStoryViewed);
  const showToast = useToastStore((s) => s.showToast);

  const index = stories.findIndex((s) => s.id === id);
  const story = index >= 0 ? stories[index] : undefined;
  const author = story ? authors.find((a) => a.id === story.authorId) : undefined;
  const nextStory = index >= 0 ? stories[index + 1] : undefined;
  const prevStory = index > 0 ? stories[index - 1] : undefined;

  const [segment, setSegment] = useState(0);
  const [reply, setReply] = useState('');
  const [liked, setLiked] = useState(false);
  const [paused, setPaused] = useState(false);
  const progress = useSharedValue(0);

  const close = useCallback(() => router.back(), [router]);

  const advance = useCallback(() => {
    if (!story) return;
    if (segment < story.segments - 1) {
      setSegment((n) => n + 1);
    } else if (nextStory) {
      router.replace(`/story/${nextStory.id}` as Href);
    } else {
      close();
    }
  }, [story, segment, nextStory, router, close]);

  const back = useCallback(() => {
    if (segment > 0) setSegment((n) => n - 1);
    else if (prevStory) router.replace(`/story/${prevStory.id}` as Href);
  }, [segment, prevStory, router]);

  // New story: reset position and record the view.
  useEffect(() => {
    setSegment(0);
    setLiked(false);
    if (story) markViewed(story.id);
  }, [story?.id, markViewed]); // eslint-disable-line react-hooks/exhaustive-deps

  // Run the progress strip for the current segment; typing a reply pauses it.
  const advanceRef = useRef(advance);
  advanceRef.current = advance;
  const onSegmentDone = useCallback(() => advanceRef.current(), []);
  useEffect(() => {
    cancelAnimation(progress);
    progress.value = 0;
    if (!story || paused) return;
    progress.value = withTiming(1, { duration: SEGMENT_MS, easing: Easing.linear }, (finished) => {
      if (finished) runOnJS(onSegmentDone)();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [story?.id, segment, paused]);

  if (!story || !author) {
    return (
      <Screen tone="dark" bare>
        <View className="flex-1 items-center justify-center" style={{ gap: 14 }}>
          <RNText className="text-muted" style={{ fontFamily: FONT.sans, fontSize: 14 }}>
            {t('story.notFound', 'This story is no longer available.')}
          </RNText>
          <UIconButton icon="close" label={t('story.close', 'Close')} onPress={close} />
        </View>
      </Screen>
    );
  }

  const top = Math.max(insets.top, 20);
  const bottom = Math.max(insets.bottom, 20);

  const send = () => {
    if (!reply.trim()) return;
    setReply('');
    showToast(t('story.replySent', 'Reply sent to {{name}}', { name: author.displayName }), { type: 'success' });
  };

  return (
    <Screen tone="dark" bare>
      <PhotoCard
        source={photoOf(story.photo)}
        height={screenHeight}
        radius={0}
        fade="both"
        style={{ position: 'absolute', top: 0, left: 0, right: 0 }}
      />

      {/* Tap zones: left third goes back, the rest goes forward. */}
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: bottom + 70, flexDirection: 'row' }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('story.previous', 'Previous')}
          onPress={back}
          style={{ flex: 1 }}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('story.next', 'Next')}
          onPress={advance}
          style={{ flex: 2 }}
        />
      </View>

      <View pointerEvents="none" className="flex-row" style={{ position: 'absolute', top: top + 8, left: 12, right: 12, gap: 4 }}>
        {Array.from({ length: story.segments }, (_, i) => (
          <Bar key={i} state={i < segment ? 'past' : i === segment ? 'current' : 'future'} progress={progress} />
        ))}
      </View>

      <View
        pointerEvents="box-none"
        className="flex-row items-center justify-between"
        style={{ position: 'absolute', top: top + 26, left: 16, right: 16 }}
      >
        <View className="flex-row items-center" style={{ gap: 10 }}>
          <UAvatar source={photoOf(author.avatar)} name={author.displayName} size={38} />
          <RNText style={{ fontFamily: FONT.display, fontSize: 15, color: FIXED.paper }}>{author.handle}</RNText>
          <RNText style={{ fontFamily: FONT.sans, fontSize: 12, color: FIXED.captionSub }}>{timeAgo(story.createdAt)}</RNText>
        </View>
        <UIconButton tone="glassDark" icon="close" label={t('story.close', 'Close')} onPress={close} />
      </View>

      {story.recipeId ? (
        <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, top: '61.6%', alignItems: 'center' }}>
          <GlassPill
            icon="link"
            height={44}
            label={t('story.seeRecipe', 'See the recipe')}
            onPress={() => router.push(`/recipe/${story.recipeId}` as Href)}
          />
        </View>
      ) : null}

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}
      >
        <View className="flex-row items-center" style={{ paddingHorizontal: 16, paddingBottom: bottom, gap: 10 }}>
          <Glass dark style={{ flex: 1, height: 50, borderRadius: 25, paddingHorizontal: 20, justifyContent: 'center' }}>
            <TextInput
              accessibilityLabel={t('story.replyTo', 'Reply to {{name}}', { name: author.displayName })}
              placeholder={t('story.replyPlaceholder', 'Reply to {{name}}…', { name: author.displayName })}
              placeholderTextColor={FIXED.captionSub}
              selectionColor={FIXED.accent}
              value={reply}
              onChangeText={setReply}
              onFocus={() => setPaused(true)}
              onBlur={() => setPaused(false)}
              onSubmitEditing={send}
              returnKeyType="send"
              style={{ fontFamily: FONT.sans, fontSize: 15, color: FIXED.paper, height: '100%' }}
            />
          </Glass>
          <UIconButton
            tone="glassDark"
            icon="heart"
            filled={liked}
            label={liked ? t('story.unlike', 'Unlike') : t('story.like', 'Like')}
            onPress={() => setLiked((v) => !v)}
          />
          <UIconButton tone="glassDark" icon="send" label={t('story.send', 'Send reply')} onPress={send} />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
