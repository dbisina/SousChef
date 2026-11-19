import React from 'react';
import { type StyleProp, type ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { useTone } from '@/components/ui';
import { WORDMARK } from '@/lib/brandWordmark';

const LIGHT_INK = require('@/assets/brand/wordmark-light.svg'); // for dark backgrounds
const DARK_INK = require('@/assets/brand/wordmark-dark.svg'); // for light backgrounds
const LIGHT_INK_NO_DOT = require('@/assets/brand/wordmark-light-nodot.svg');

interface WordmarkProps {
  /** How wide to draw it. The height follows. */
  width: number;
  /** The ink: `light` on dark surfaces, `dark` on light ones. Left out, it follows the app's theme. */
  ink?: 'light' | 'dark';
  /** Without the orange dot, when the dot is drawn on its own (the opening animation). Light ink only. */
  noDot?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** The enplace wordmark from the brand kit (vector, so it is sharp at any size). The name is always lowercase. */
export function Wordmark({ width, ink, noDot, style }: WordmarkProps) {
  const tone = useTone();
  const light = (ink ?? (tone === 'dark' ? 'light' : 'dark')) === 'light';
  const source = noDot ? LIGHT_INK_NO_DOT : light ? LIGHT_INK : DARK_INK;
  return (
    <Image
      source={source}
      contentFit="contain"
      accessibilityLabel="enplace"
      accessibilityRole="image"
      style={[{ width, height: (width * WORDMARK.height) / WORDMARK.width }, style as object]}
      priority="high"
      cachePolicy="memory-disk"
    />
  );
}
