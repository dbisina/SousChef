import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FONT } from '@/components/ui/fonts';

interface BrandSplashProps {
  /** True once the app has what it needs to start. The splash never ends before this. */
  ready: boolean;
  onDone: () => void;
}

const SIZE = 56;
const INK = '#fafafa';
const ACCENT = '#ff6b35';
const GROUND = '#0b0b0b';
const SEEN_KEY = '@enplace_splash_seen';

/**
 * The opening screen. The first time, "mise en place" appears; "mise" and the spaces close up and what is left is the name,
 * "enplace", with one orange dot (about three seconds). Every launch after that is the short version: the name and the dot,
 * about a second. With reduced motion it just shows the name. The last frame holds until the app is ready.
 */
export function BrandSplash({ ready, onDone }: BrandSplashProps) {
  const appear = useRef(new Animated.Value(0)).current;
  const miseW = useRef(new Animated.Value(1)).current; // 1 = open, 0 = closed (scaled by the measured width)
  const spaceW = useRef(new Animated.Value(1)).current;
  const dot = useRef(new Animated.Value(0)).current;
  const [width, setWidth] = useState<{ mise: number; space: number } | null>(null);
  const [played, setPlayed] = useState(false);
  // 'full' on the very first launch, 'short' after that; null until the saved flag has been read.
  const [mode, setMode] = useState<'full' | 'short' | null>(null);

  useEffect(() => {
    let live = true;
    AsyncStorage.getItem(SEEN_KEY)
      .then((v) => {
        if (live) setMode(v === '1' ? 'short' : 'full');
      })
      .catch(() => live && setMode('short'));
    AsyncStorage.setItem(SEEN_KEY, '1').catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    if (!width || !mode) return undefined;
    let live = true;
    const run = async () => {
      const reduce = await AccessibilityInfo.isReduceMotionEnabled().catch(() => false);
      if (!live) return;
      if (reduce) {
        appear.setValue(1);
        miseW.setValue(0);
        spaceW.setValue(0);
        dot.setValue(1);
        setTimeout(() => live && setPlayed(true), 900);
        return;
      }
      if (mode === 'short') {
        miseW.setValue(0);
        spaceW.setValue(0);
        Animated.sequence([
          Animated.timing(appear, { toValue: 1, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
          Animated.spring(dot, { toValue: 1, friction: 6, tension: 220, useNativeDriver: false }),
          Animated.delay(240),
        ]).start(({ finished }) => {
          if (finished && live) setPlayed(true);
        });
        return;
      }
      Animated.sequence([
        Animated.timing(appear, { toValue: 1, duration: 520, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
        Animated.delay(780),
        Animated.parallel([
          Animated.timing(miseW, { toValue: 0, duration: 620, easing: Easing.inOut(Easing.cubic), useNativeDriver: false }),
          Animated.timing(spaceW, { toValue: 0, duration: 760, easing: Easing.inOut(Easing.cubic), useNativeDriver: false }),
        ]),
        Animated.spring(dot, { toValue: 1, friction: 5, tension: 160, useNativeDriver: false }),
        Animated.delay(520),
      ]).start(({ finished }) => {
        if (finished && live) setPlayed(true);
      });
    };
    void run();
    return () => {
      live = false;
    };
  }, [width, mode, appear, miseW, spaceW, dot]);

  useEffect(() => {
    if (played && ready) {
      const fade = Animated.timing(appear, { toValue: 0, duration: 260, useNativeDriver: false });
      fade.start(() => onDone());
      return () => fade.stop();
    }
    return undefined;
  }, [played, ready, appear, onDone]);

  const style = { fontFamily: FONT.script, fontSize: SIZE, lineHeight: SIZE * 1.3, color: INK, includeFontPadding: false } as const;
  const collapse = (v: Animated.Value, full: number) => ({ width: width ? v.interpolate({ inputRange: [0, 1], outputRange: [0, full] }) : undefined, overflow: 'hidden' as const });

  return (
    <View style={{ flex: 1, backgroundColor: GROUND, alignItems: 'center', justifyContent: 'center' }} accessible accessibilityRole="image" accessibilityLabel="enplace">
      {/* Measure the two pieces that close up, once, off screen. */}
      {!width ? (
        <View style={{ position: 'absolute', opacity: 0 }} pointerEvents="none">
          <Text
            style={style}
            onLayout={(e) => setWidth((w) => ({ mise: e.nativeEvent.layout.width, space: w?.space ?? SIZE * 0.3 }))}
          >
            mise
          </Text>
        </View>
      ) : null}
      <Animated.View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          opacity: appear,
          transform: [{ translateY: appear.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
        }}
      >
        <Animated.View style={collapse(miseW, width?.mise ?? 0)}>
          <Text style={style} numberOfLines={1}>
            mise
          </Text>
        </Animated.View>
        <Animated.View style={collapse(spaceW, SIZE * 0.3)} />
        <Text style={style}>en</Text>
        <Animated.View style={collapse(spaceW, SIZE * 0.3)} />
        <Text style={style}>place</Text>
        <Animated.View
          style={{
            width: 10,
            height: 10,
            borderRadius: 5,
            marginLeft: 8,
            marginTop: 18,
            backgroundColor: ACCENT,
            transform: [{ scale: dot }],
          }}
        />
      </Animated.View>
      <Animated.Text
        style={{ position: 'absolute', bottom: 90, fontFamily: FONT.sans, fontSize: 12, letterSpacing: 2.2, color: '#9a9a9a', opacity: appear }}
      >
        everything in its place
      </Animated.Text>
    </View>
  );
}
