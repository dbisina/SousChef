import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewProps, type ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { FIXED } from '@/stores/themeStore';

interface GlassProps extends ViewProps {
  /** false = .gl (white 82%), true = .glk (black 42% with hairline edge). */
  dark?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Blurred translucent surface (tokens.css .gl / .glk). Children render above the blur. */
export function Glass({ dark, style, children, ...rest }: GlassProps) {
  return (
    <View
      {...rest}
      style={[
        { overflow: 'hidden', zIndex: 0 },
        dark && { borderWidth: StyleSheet.hairlineWidth, borderColor: FIXED.glassEdge },
        style,
      ]}
    >
      <BlurView
        intensity={dark ? 28 : 32}
        tint={dark ? 'dark' : 'light'}
        style={[StyleSheet.absoluteFill, { zIndex: -1 }]}
        pointerEvents="none"
      />
      <View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { zIndex: -1, backgroundColor: dark ? FIXED.glassDark : FIXED.glass }]}
      />
      {children}
    </View>
  );
}
