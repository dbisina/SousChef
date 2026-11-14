import React, { useEffect, useRef } from 'react';
import { Text as RNText, View } from 'react-native';
import Animated, { FadeInDown, useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { Pressable } from '@/components/ui/Pressable';
import { FONT } from '@/components/ui/fonts';
import { useTokens } from '@/components/ui';
import { feedback } from '@/lib/feedback';
import { ReactionRow } from './ReactionRow';
import { SwipeToReply } from './SwipeToReply';
import type { Anchor } from './MessageActions';
import type { Message } from '@/types/social';

export interface QuoteInfo {
  name: string;
  preview: string;
  onPress: () => void;
}

interface Props {
  message: Message;
  side: 'me' | 'them';
  /** The bubble, card or voice note itself. */
  children: React.ReactNode;
  /** Delivery text under my latest message. */
  tick?: string;
  failed?: boolean;
  quote?: QuoteInfo;
  /** Briefly lights up when the user jumped here from a quote. */
  highlighted?: boolean;
  /** Slides in (a message created while the screen is open). */
  isNew?: boolean;
  onReply: () => void;
  onOpenMenu: (anchor: Anchor) => void;
  onToggleReaction: (emoji: string) => void;
  onRetry: () => void;
}

/**
 * Everything around one message in the list: swipe to reply, long press for the menu, the quote above,
 * reaction chips and delivery text below, the highlight flash and the slide-in.
 */
export function MessageFrame({
  message,
  side,
  children,
  tick,
  failed,
  quote,
  highlighted,
  isNew,
  onReply,
  onOpenMenu,
  onToggleReaction,
  onRetry,
}: Props) {
  const tokens = useTokens();
  const bubbleRef = useRef<View>(null);
  const flash = useSharedValue(0);

  useEffect(() => {
    if (highlighted) flash.value = withSequence(withTiming(1, { duration: 160 }), withTiming(0, { duration: 1100 }));
  }, [highlighted, flash]);

  // Peak 22% so the flash tints the row without hiding the message.
  const flashStyle = useAnimatedStyle(() => ({ opacity: flash.value * 0.22 }));

  const openMenu = () => {
    bubbleRef.current?.measureInWindow((x, y, width, height) => onOpenMenu({ x, y, width, height }));
  };

  const align = side === 'me' ? 'flex-end' : 'flex-start';

  return (
    <Animated.View
      entering={isNew ? FadeInDown.duration(240).springify().damping(15).stiffness(220) : undefined}
      style={{ width: '100%', gap: 4 }}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          { position: 'absolute', top: -4, bottom: -4, left: -8, right: -8, borderRadius: 18, backgroundColor: tokens.accent },
          flashStyle,
        ]}
      />
      {quote ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${quote.name}: ${quote.preview}`}
          onPress={quote.onPress}
          style={{
            alignSelf: align,
            maxWidth: '72%',
            paddingVertical: 6,
            paddingHorizontal: 12,
            borderRadius: 16,
            backgroundColor: tokens['surface-2'],
            gap: 1,
          }}
        >
          <RNText numberOfLines={1} style={{ fontFamily: FONT.display, fontSize: 12, color: tokens.muted }}>
            {quote.name}
          </RNText>
          <RNText numberOfLines={2} style={{ fontFamily: FONT.sans, fontSize: 13, lineHeight: 18, color: tokens.muted }}>
            {quote.preview}
          </RNText>
        </Pressable>
      ) : null}

      <SwipeToReply onReply={() => { feedback.replySent(); onReply(); }} onArm={feedback.replyArmed} onLongPress={openMenu}>
        <View ref={bubbleRef} collapsable={false} style={{ alignSelf: align, maxWidth: '100%' }}>
          {children}
        </View>
      </SwipeToReply>

      <ReactionRow reactions={message.reactions} side={side} onToggle={onToggleReaction} />

      {tick ? (
        failed ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={tick}
            onPress={onRetry}
            hitSlop={10}
            style={{ alignSelf: 'flex-end' }}
          >
            <RNText className="text-tag-r-fg" style={{ fontFamily: FONT.sans, fontSize: 11 }}>
              {tick}
            </RNText>
          </Pressable>
        ) : (
          <RNText className="text-muted" style={{ fontFamily: FONT.sans, fontSize: 11, alignSelf: 'flex-end' }}>
            {tick}
          </RNText>
        )
      ) : null}
    </Animated.View>
  );
}
