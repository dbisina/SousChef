import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Icon } from '@/components/ui';

interface Props {
  children: React.ReactNode;
  /** Double tap. Only ever likes; it never removes a like. */
  onLike: () => void;
  /** Single tap (opens the post). It waits briefly to be sure it is not the first half of a double tap. */
  onOpen?: () => void;
  style?: StyleProp<ViewStyle>;
}

/** Double-tap anything to like it: a big heart pops from the middle of the picture, then fades. */
export function DoubleTapHeart({ children, onLike, onOpen, style }: Props) {
  const pop = useSharedValue(0);

  const like = () => onLike();
  const open = () => onOpen?.();

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .maxDuration(260)
    .onEnd((_e, success) => {
      if (!success) return;
      pop.value = 0;
      pop.value = withSequence(withSpring(1, { damping: 7, stiffness: 280 }), withDelay(360, withTiming(0, { duration: 220 })));
      runOnJS(like)();
    });

  const singleTap = Gesture.Tap().onEnd((_e, success) => {
    if (success) runOnJS(open)();
  });

  // The double tap gets first refusal; a single tap only counts once it has failed.
  const gesture = onOpen ? Gesture.Exclusive(doubleTap, singleTap) : doubleTap;

  const heart = useAnimatedStyle(() => ({
    opacity: interpolate(pop.value, [0, 0.25, 1], [0, 1, 1], Extrapolation.CLAMP),
    transform: [
      { scale: interpolate(pop.value, [0, 1], [0.3, 1], Extrapolation.CLAMP) },
      { rotate: `${interpolate(pop.value, [0, 1], [-14, 0], Extrapolation.CLAMP)}deg` },
    ],
  }));

  return (
    <View style={style}>
      <GestureDetector gesture={gesture}>
        <View collapsable={false}>{children}</View>
      </GestureDetector>
      <Animated.View
        pointerEvents="none"
        style={[{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }, heart]}
      >
        <Icon name="heart" size={96} color="paper" filled />
      </Animated.View>
    </View>
  );
}
