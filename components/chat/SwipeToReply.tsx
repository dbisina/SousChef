import React from 'react';
import { View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Icon, useTokens } from '@/components/ui';
import { REPLY_THRESHOLD, replyArmed, rubberBand } from '@/lib/chatLogic';

interface Props {
  children: React.ReactNode;
  /** Released past the threshold. */
  onReply: () => void;
  /** Crossed the threshold while dragging (fires once per crossing; used for the haptic tick). */
  onArm?: () => void;
  /** Press and hold. */
  onLongPress?: () => void;
  enabled?: boolean;
}

const SPRING_BACK = { damping: 18, stiffness: 260, mass: 0.8 } as const;

/**
 * Drag a message to the right to reply (like WhatsApp and Instagram).
 * The bubble follows the finger, then resists (rubber band); a reply arrow grows behind it and pops when
 * the threshold is crossed. Horizontal drags only, so scrolling the list is never fought.
 * A long press on the same message opens the reaction menu.
 */
export function SwipeToReply({ children, onReply, onArm, onLongPress, enabled = true }: Props) {
  const tokens = useTokens();
  const x = useSharedValue(0);
  const armed = useSharedValue(false);
  const pop = useSharedValue(1);
  const armedFill = useSharedValue(0);

  const arm = () => onArm?.();
  const reply = () => onReply();
  const longPress = () => onLongPress?.();

  const pan = Gesture.Pan()
    .enabled(enabled)
    .activeOffsetX([-1000, 14])
    .failOffsetY([-12, 12])
    .onUpdate((e) => {
      const offset = rubberBand(e.translationX);
      x.value = offset;
      const nowArmed = replyArmed(offset);
      if (nowArmed !== armed.value) {
        armed.value = nowArmed;
        pop.value = withSpring(nowArmed ? 1.2 : 1, { damping: 9, stiffness: 320 });
        armedFill.value = withTiming(nowArmed ? 1 : 0, { duration: 120 });
        if (nowArmed) runOnJS(arm)();
      }
    })
    .onEnd(() => {
      if (armed.value) runOnJS(reply)();
    })
    .onFinalize(() => {
      armed.value = false;
      pop.value = withSpring(1, { damping: 12, stiffness: 260 });
      armedFill.value = withTiming(0, { duration: 160 });
      x.value = withSpring(0, SPRING_BACK);
    });

  const press = Gesture.LongPress()
    .enabled(enabled && !!onLongPress)
    .minDuration(320)
    .maxDistance(10)
    .onStart(() => {
      runOnJS(longPress)();
    });

  const gesture = Gesture.Race(press, pan);

  const bubbleStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

  const iconStyle = useAnimatedStyle(() => ({
    opacity: interpolate(x.value, [8, REPLY_THRESHOLD * 0.75], [0, 1], Extrapolation.CLAMP),
    transform: [
      { translateX: interpolate(x.value, [0, REPLY_THRESHOLD], [-10, 0], Extrapolation.CLAMP) },
      { scale: interpolate(x.value, [8, REPLY_THRESHOLD], [0.45, 1], Extrapolation.CLAMP) * pop.value },
    ],
  }));

  const fillStyle = useAnimatedStyle(() => ({ opacity: armedFill.value }));

  return (
    <View style={{ width: '100%', justifyContent: 'center' }}>
      <Animated.View
        pointerEvents="none"
        style={[
          { position: 'absolute', left: 6, width: 32, height: 32, borderRadius: 16, backgroundColor: tokens['surface-3'] },
          iconStyle,
        ]}
      >
        <Animated.View
          style={[{ position: 'absolute', width: 32, height: 32, borderRadius: 16, backgroundColor: tokens.accent }, fillStyle]}
        />
        <View style={{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="reply" size="sm" color="ink" />
        </View>
      </Animated.View>
      <GestureDetector gesture={gesture}>
        <Animated.View style={[{ width: '100%' }, bubbleStyle]}>{children}</Animated.View>
      </GestureDetector>
    </View>
  );
}
