import React from 'react';
import { Pressable, StyleSheet, Text as RNText, View, type DimensionValue, type StyleProp, type ViewStyle } from 'react-native';
import { Image, type ImageSource } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { FIXED, TOKEN_HEX } from '@/stores/themeStore';
import { FONT } from './fonts';
import { Glass } from './Glass';
import { ToneBlock } from './tone';

export type PhotoSource = ImageSource | number;

interface PhotoCardProps {
  source: PhotoSource;
  height?: number;
  width?: DimensionValue;
  /** 30 default (.pc), 26 for small grid tiles. */
  radius?: number;
  /** 'bottom' = .pc default, 'both' = .pc.ft (darkened top for overlays), 'none' = .pc.nf */
  fade?: 'bottom' | 'both' | 'none';
  /** Content for the top row (.tl): tags, icon buttons. Use topRight for the right-hand slot. */
  topLeft?: React.ReactNode;
  topRight?: React.ReactNode;
  /** Caption (.cap): title in Outfit 20, subtitle 12. */
  title?: string;
  titleSize?: number;
  subtitle?: string;
  captionInset?: number;
  /** Glass bar (.gbar) pinned to the bottom, e.g. title + action button. */
  glassBar?: React.ReactNode;
  /** 'dark' = .gbar.glk (dark glass, light text). Default 'light' = .gbar.gl. */
  glassBarTone?: 'light' | 'dark';
  /** CSS object-position as expo-image contentPosition. */
  focus?: { left?: string | number; top?: string | number };
  onPress?: () => void;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  /** Extra absolutely positioned children (.ov). */
  children?: React.ReactNode;
}

const FADES = {
  bottom: { colors: [FIXED.photoFadeFrom, FIXED.photoFadeTo] as const, locations: [0.42, 1] as const },
  both: {
    colors: [FIXED.photoFadeTop, FIXED.photoFadeFrom, FIXED.photoFadeFrom, FIXED.photoFadeBottom] as const,
    locations: [0, 0.3, 0.5, 1] as const,
  },
};

/** Photo-led card (.pc): image, fade, top slot, caption, glass bar. Content is always on a dark scrim, so it is toned dark. */
export function PhotoCard({
  source,
  height = 160,
  width,
  radius = 30,
  fade = 'bottom',
  topLeft,
  topRight,
  title,
  titleSize = 20,
  subtitle,
  captionInset = 18,
  glassBar,
  glassBarTone = 'light',
  focus,
  onPress,
  accessibilityLabel,
  style,
  children,
}: PhotoCardProps) {
  // With onPress the Pressable is the layout box (it carries width / flex). The visual frame then fills it:
  // applying a percentage width to both would compound (48% of 48% = ~81px in a two-column grid).
  const flat = StyleSheet.flatten(style) ?? {};
  const inner: ViewStyle = onPress
    ? { ...flat, width: '100%', flex: undefined, flexGrow: undefined, flexShrink: undefined, flexBasis: undefined, alignSelf: undefined }
    : flat;
  const frame: ViewStyle = { height, width, borderRadius: radius, overflow: 'hidden', backgroundColor: TOKEN_HEX.dark['surface-3'] };
  const body = (
    <ToneBlock tone="dark" style={[frame, inner, onPress ? { width: '100%' } : null]}>
      <Image
        source={source}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        contentPosition={focus}
        transition={150}
        accessible={false}
      />
      {fade !== 'none' && (
        <LinearGradient
          pointerEvents="none"
          colors={[...FADES[fade].colors]}
          locations={[...FADES[fade].locations]}
          style={StyleSheet.absoluteFill}
        />
      )}
      {(topLeft || topRight) && (
        <View
          className="flex-row items-start justify-between"
          style={{ position: 'absolute', top: 14, left: 14, right: 14, gap: 8, zIndex: 1 }}
        >
          <View className="flex-row items-center" style={{ gap: 8, flexShrink: 1 }}>{topLeft}</View>
          <View className="flex-row items-center" style={{ gap: 8 }}>{topRight}</View>
        </View>
      )}
      {(title || subtitle) && !glassBar && (
        <View style={{ position: 'absolute', left: captionInset, right: 18, bottom: 16, gap: 4, zIndex: 1 }}>
          {title ? (
            <RNText
              numberOfLines={2}
              style={{ fontFamily: FONT.display, fontSize: titleSize, lineHeight: titleSize * 1.15, letterSpacing: -titleSize * 0.02, color: FIXED.paper }}
            >
              {title}
            </RNText>
          ) : null}
          {subtitle ? (
            <RNText numberOfLines={2} style={{ fontFamily: FONT.sans, fontSize: 12, lineHeight: 17.4, color: FIXED.captionSub }}>
              {subtitle}
            </RNText>
          ) : null}
        </View>
      )}
      {glassBar ? (
        <Glass
          dark={glassBarTone === 'dark'}
          style={{
            position: 'absolute',
            left: 8,
            right: 8,
            bottom: 8,
            borderRadius: 24,
            paddingVertical: 12,
            paddingStart: 16,
            paddingRight: 12,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            zIndex: 1,
          }}
        >
          <ToneBlock tone={glassBarTone} className="flex-1 flex-row items-center" style={{ gap: 10 }}>
            {glassBar}
          </ToneBlock>
        </Glass>
      ) : null}
      {children}
    </ToneBlock>
  );
  if (!onPress) return body;
  const outer: ViewStyle = { width, flex: flat.flex, flexGrow: flat.flexGrow, flexBasis: flat.flexBasis, alignSelf: flat.alignSelf };
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      onPress={onPress}
      style={({ pressed }) => [outer, { opacity: pressed ? 0.9 : 1 }]}
    >
      {body}
    </Pressable>
  );
}
