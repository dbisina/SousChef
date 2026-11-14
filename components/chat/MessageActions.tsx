import React, { useEffect } from 'react';
import { Modal, Text as RNText, View, useWindowDimensions } from 'react-native';
import { BlurView } from 'expo-blur';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Pressable } from '@/components/ui/Pressable';
import { FONT } from '@/components/ui/fonts';
import { Icon, ToneBlock, useTokens } from '@/components/ui';
import { useTone } from '@/components/ui/tone';
import { REACTION_EMOJI } from '@/lib/chatLogic';
import { feedback } from '@/lib/feedback';
import { FIXED } from '@/stores/themeStore';

export interface Anchor {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Props {
  visible: boolean;
  anchor: Anchor | null;
  side: 'me' | 'them';
  /** The emoji I have already put on this message, if any. */
  myEmoji?: string;
  canCopy: boolean;
  onClose: () => void;
  onReact: (emoji: string) => void;
  onReply: () => void;
  onCopy: () => void;
  /** The message, drawn again at the same spot so it looks lifted. */
  children: React.ReactNode;
}

const BAR_H = 52;
const BAR_W = 8 + REACTION_EMOJI.length * 44 + 8;
const ACTIONS_W = 210;
const ROW_H = 46;
const GAP = 10;

function EmojiButton({
  emoji,
  index,
  selected,
  open,
  onPick,
}: {
  emoji: string;
  index: number;
  selected: boolean;
  open: boolean;
  onPick: (emoji: string) => void;
}) {
  const tokens = useTokens();
  const pop = useSharedValue(0);
  const bump = useSharedValue(1);

  useEffect(() => {
    pop.value = open ? withDelay(70 + index * 32, withSpring(1, { damping: 9, stiffness: 260 })) : 0;
  }, [open, index, pop]);

  const style = useAnimatedStyle(() => ({
    opacity: pop.value,
    transform: [{ scale: pop.value * bump.value }, { translateY: (1 - pop.value) * 14 }],
  }));

  return (
    <Animated.View style={style}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={emoji}
        accessibilityState={{ selected }}
        onPress={() => {
          bump.value = withSequence(withTiming(1.5, { duration: 90 }), withSpring(1, { damping: 8, stiffness: 300 }));
          onPick(emoji);
        }}
        style={{
          width: 44,
          height: 44,
          borderRadius: 22,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: selected ? tokens['surface-3'] : 'transparent',
        }}
      >
        <RNText style={{ fontSize: 26 }}>{emoji}</RNText>
      </Pressable>
    </Animated.View>
  );
}

/**
 * Long-press menu for a message: the message lifts, the rest blurs, a bar of reactions pops in above it
 * and Reply / Copy sit below. The caller draws the message again as `children` at the measured spot.
 */
export function MessageActions({ visible, anchor, side, myEmoji, canCopy, onClose, onReact, onReply, onCopy, children }: Props) {
  const { t } = useTranslation();
  const tokens = useTokens();
  const tone = useTone();
  const insets = useSafeAreaInsets();
  const { width: winW, height: winH } = useWindowDimensions();
  const progress = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      feedback.menuOpen();
      progress.value = withSpring(1, { damping: 16, stiffness: 230 });
    } else {
      progress.value = 0;
    }
  }, [visible, progress]);

  const finish = (after?: () => void) => {
    progress.value = withTiming(0, { duration: 130 }, (done) => {
      if (done) {
        runOnJS(onClose)();
        if (after) runOnJS(after)();
      }
    });
  };

  const backdrop = useAnimatedStyle(() => ({ opacity: progress.value }));
  const lift = useAnimatedStyle(() => ({ transform: [{ scale: 1 + 0.035 * progress.value }] }));
  const bar = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scale: 0.7 + 0.3 * progress.value }],
  }));
  const actions = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * -8 }, { scale: 0.92 + 0.08 * progress.value }],
  }));

  if (!visible || !anchor) return null;

  const top = insets.top + 8;
  const bottom = winH - insets.bottom - 8;
  const totalH = BAR_H + GAP + anchor.height + GAP + ROW_H * (canCopy ? 2 : 1);
  // Keep the whole stack (bar, message, actions) on screen by moving it as one piece.
  let shift = 0;
  const wantedTop = anchor.y - BAR_H - GAP;
  if (wantedTop < top) shift = top - wantedTop;
  else if (wantedTop + totalH > bottom) shift = Math.min(0, bottom - (wantedTop + totalH));

  const msgY = anchor.y + shift;
  const barX = Math.min(Math.max(side === 'me' ? anchor.x + anchor.width - BAR_W : anchor.x, 12), winW - BAR_W - 12);
  const actionsX = Math.min(Math.max(side === 'me' ? anchor.x + anchor.width - ACTIONS_W : anchor.x, 12), winW - ACTIONS_W - 12);

  return (
    <Modal transparent visible animationType="none" statusBarTranslucent onRequestClose={() => finish()}>
      <ToneBlock tone={tone} style={{ flex: 1 }}>
        <Animated.View style={[{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }, backdrop]}>
          <BlurView intensity={32} tint={tone === 'dark' ? 'dark' : 'light'} style={{ flex: 1 }} />
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: tokens.ground, opacity: 0.35 }} />
        </Animated.View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('chat.closeMenu', 'Close')}
          onPress={() => finish()}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        >
          <View />
        </Pressable>

        <Animated.View
          style={[
            {
              position: 'absolute',
              top: msgY - BAR_H - GAP,
              left: barX,
              width: BAR_W,
              height: BAR_H,
              borderRadius: BAR_H / 2,
              paddingHorizontal: 8,
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: tokens.surface,
              transformOrigin: side === 'me' ? 'bottom right' : 'bottom left',
              shadowColor: FIXED.shadow,
              shadowOpacity: 0.18,
              shadowRadius: 18,
              shadowOffset: { width: 0, height: 8 },
              elevation: 10,
            },
            bar,
          ]}
        >
          {REACTION_EMOJI.map((e, i) => (
            <EmojiButton
              key={e}
              emoji={e}
              index={i}
              open={visible}
              selected={myEmoji === e}
              onPick={(emoji) => {
                feedback.react();
                setTimeout(() => finish(() => onReact(emoji)), 140);
              }}
            />
          ))}
        </Animated.View>

        <Animated.View
          pointerEvents="none"
          style={[{ position: 'absolute', top: msgY, left: anchor.x, width: anchor.width, height: anchor.height }, lift]}
        >
          {children}
        </Animated.View>

        <Animated.View
          style={[
            {
              position: 'absolute',
              top: msgY + anchor.height + GAP,
              left: actionsX,
              width: ACTIONS_W,
              borderRadius: 18,
              overflow: 'hidden',
              backgroundColor: tokens.surface,
              transformOrigin: side === 'me' ? 'top right' : 'top left',
              shadowColor: FIXED.shadow,
              shadowOpacity: 0.18,
              shadowRadius: 18,
              shadowOffset: { width: 0, height: 8 },
              elevation: 10,
            },
            actions,
          ]}
        >
          <ActionRow icon="reply" label={t('chat.reply', 'Reply')} onPress={() => finish(onReply)} />
          {canCopy ? <ActionRow icon="copy" label={t('chat.copy', 'Copy')} onPress={() => finish(onCopy)} divider /> : null}
        </Animated.View>
      </ToneBlock>
    </Modal>
  );
}

function ActionRow({ icon, label, onPress, divider }: { icon: 'reply' | 'copy'; label: string; onPress: () => void; divider?: boolean }) {
  const tokens = useTokens();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({
        height: ROW_H,
        paddingHorizontal: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: pressed ? tokens['surface-3'] : 'transparent',
        borderTopWidth: divider ? 1 : 0,
        borderTopColor: tokens.divider,
      })}
    >
      <RNText style={{ fontFamily: FONT.sans, fontSize: 15, color: tokens.ink }}>{label}</RNText>
      <Icon name={icon} size="md" color="ink" />
    </Pressable>
  );
}
