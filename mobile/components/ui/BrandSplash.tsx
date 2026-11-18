import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, useWindowDimensions } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Wordmark } from '@/components/brand/Wordmark';
import { BRAND, WORDMARK } from '@/lib/brandWordmark';
import { FONT } from '@/components/ui/fonts';

interface BrandSplashProps {
  /** True once the app has what it needs to start. The splash never ends before this. */
  ready: boolean;
  onDone: () => void;
}

const SEEN_KEY = '@enplace_splash_seen';
/** The wordmark's width as a share of the screen's: the same as the still splash image, so the two frames match. */
const WIDTH_SHARE = 0.56;
/** While "mise" is beside it the wordmark is a little smaller, so the two fit across a phone. */
const BESIDE_SCALE = 0.8;
const GAP = 14;
const MISE_SIZE = 54;
/** Where the wordmark's letters sit inside its box, so "mise" can stand on the same line (the share of the height). */
const BASELINE = 0.69;

/**
 * The opening screen. Its first picture is the still splash (the wordmark and its orange dot on near-black) so nothing jumps.
 * The first time (about three and a half seconds): "mise" slides in beside the logo so it reads "mise enplace", the phrase the name
 * comes from, holds a moment, then tucks away and leaves the logo, and the dot beats once. Every launch after that is the short
 * version: a beat of the dot and out (under a second). With reduced motion it just shows the logo. The last picture holds until
 * the app is ready.
 */
export function BrandSplash({ ready, onDone }: BrandSplashProps) {
  const { width: screen } = useWindowDimensions();
  const width = Math.round(screen * WIDTH_SHARE);
  const scale = width / WORDMARK.width;
  const height = width * (WORDMARK.height / WORDMARK.width);

  const out = useRef(new Animated.Value(1)).current; // the whole screen, for the fade at the end
  const together = useRef(new Animated.Value(0)).current; // 0: the logo alone and centred; 1: "mise" beside it
  const mise = useRef(new Animated.Value(0)).current; // how visible "mise" is
  const dot = useRef(new Animated.Value(1)).current; // the dot's size (1 = as drawn)
  const [miseWidth, setMiseWidth] = useState(MISE_SIZE * 1.7);
  const [played, setPlayed] = useState(false);
  const [mode, setMode] = useState<'full' | 'short' | null>(null); // 'full' on the first launch, null until the saved flag is read

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
    if (!mode) return undefined;
    let live = true;
    const beat = Animated.sequence([
      Animated.timing(dot, { toValue: 1.45, duration: 180, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.spring(dot, { toValue: 1, friction: 4, tension: 200, useNativeDriver: true }),
    ]);
    const ease = Easing.inOut(Easing.cubic);
    const run = async () => {
      const reduce = await AccessibilityInfo.isReduceMotionEnabled().catch(() => false);
      if (!live) return;
      if (reduce) {
        setTimeout(() => live && setPlayed(true), 700);
        return;
      }
      const steps =
        mode === 'full'
          ? [
              Animated.delay(350),
              // "mise" slides in on the left while the logo makes room
              Animated.parallel([
                Animated.timing(together, { toValue: 1, duration: 700, easing: ease, useNativeDriver: true }),
                Animated.timing(mise, { toValue: 1, duration: 600, easing: ease, useNativeDriver: true }),
              ]),
              Animated.delay(1100),
              // "mise" tucks back behind the logo and fades, and the logo returns to the middle
              Animated.parallel([
                Animated.timing(together, { toValue: 0, duration: 700, easing: ease, useNativeDriver: true }),
                Animated.timing(mise, { toValue: 0, duration: 520, easing: ease, useNativeDriver: true }),
              ]),
              Animated.delay(120),
              beat,
              Animated.delay(350),
            ]
          : [Animated.delay(250), beat, Animated.delay(150)];
      Animated.sequence(steps).start(({ finished }) => {
        if (finished && live) setPlayed(true);
      });
    };
    void run();
    return () => {
      live = false;
    };
  }, [mode, together, mise, dot]);

  useEffect(() => {
    if (played && ready) {
      const fade = Animated.timing(out, { toValue: 0, duration: 240, useNativeDriver: true });
      fade.start(() => onDone());
      return () => fade.stop();
    }
    return undefined;
  }, [played, ready, out, onDone]);

  const r = WORDMARK.dot.r * scale;
  const beside = width * BESIDE_SCALE;
  const shift = (miseWidth + GAP) / 2; // the logo moves right by this, "mise" ends this far left of the middle, with the logo's size taken in
  const miseShift = (GAP + beside) / 2;
  return (
    <Animated.View
      style={{ flex: 1, backgroundColor: BRAND.nearBlack, alignItems: 'center', justifyContent: 'center', opacity: out }}
      accessible
      accessibilityRole="image"
      accessibilityLabel="enplace"
    >
      <Animated.View
        style={{
          width,
          height,
          transform: [
            { translateX: together.interpolate({ inputRange: [0, 1], outputRange: [0, shift] }) },
            { scale: together.interpolate({ inputRange: [0, 1], outputRange: [1, BESIDE_SCALE] }) },
          ],
        }}
      >
        <Wordmark width={width} ink="light" noDot />
        <Animated.View
          style={{
            position: 'absolute',
            left: WORDMARK.dot.x * scale - r,
            top: WORDMARK.dot.y * scale - r,
            width: r * 2,
            height: r * 2,
            borderRadius: r,
            backgroundColor: BRAND.orange,
            transform: [{ scale: dot }],
          }}
        />
      </Animated.View>
      <Animated.Text
        onLayout={(e) => setMiseWidth(e.nativeEvent.layout.width)}
        numberOfLines={1}
        style={{
          position: 'absolute',
          // on the logo's line: the baseline of the logo's letters is at BASELINE of its height
          top: '50%',
          marginTop: height * (BASELINE - 0.5) * BESIDE_SCALE - MISE_SIZE * 0.82,
          fontFamily: FONT.script,
          fontSize: MISE_SIZE,
          lineHeight: MISE_SIZE * 1.3,
          includeFontPadding: false,
          color: '#8a8a8a',
          opacity: mise,
          transform: [{ translateX: together.interpolate({ inputRange: [0, 1], outputRange: [0, -miseShift] }) }],
        }}
      >
        mise
      </Animated.Text>
    </Animated.View>
  );
}
