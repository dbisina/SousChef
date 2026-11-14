import React from 'react';
import { Pressable, StyleSheet, Text as RNText, View, type StyleProp, type ViewStyle } from 'react-native';
import { ToneBlock, useTone } from './tone';
import { FONT } from './fonts';
import { TOKEN_HEX, type ThemeMode } from '@/stores/themeStore';

export type SurfaceTone = 'default' | 'black' | 'accent' | 'white';

// Black surfaces re-tone their subtree to dark (ink/muted flip); accent and white surfaces force light.
const SUBTREE: Record<SurfaceTone, ThemeMode | null> = {
  default: null,
  black: 'dark',
  accent: 'light',
  white: 'light',
};

const FILL: Record<SurfaceTone, string> = {
  default: 'bg-surface',
  black: 'bg-night',
  accent: 'bg-accent',
  white: 'bg-paper border border-divider',
};

interface SurfaceProps {
  tone?: SurfaceTone;
  onPress?: () => void;
  accessibilityLabel?: string;
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  className?: string;
}

function Surface({
  tone = 'default',
  radius,
  pad,
  selected,
  onPress,
  accessibilityLabel,
  children,
  style,
  className,
}: SurfaceProps & { radius: number; pad: number; selected?: boolean }) {
  const current = useTone();
  const sub = SUBTREE[tone] ?? current;
  // When pressable, the Pressable is the layout box (width / flex / margins); the surface fills it.
  const flat: ViewStyle = StyleSheet.flatten(style) ?? {};
  const { width, flex, flexGrow, flexShrink, flexBasis, alignSelf, ...visual } = flat;
  const outer: ViewStyle = { width, flex, flexGrow, flexShrink, flexBasis, alignSelf };
  const innerStyle: StyleProp<ViewStyle> = onPress ? visual : style;
  const body = (
    <ToneBlock
      tone={sub}
      className={`${selected ? 'bg-ground' : FILL[tone]} ${className ?? ''}`}
      style={[{ borderRadius: radius, padding: pad }, selected ? { borderWidth: 1.5, borderColor: TOKEN_HEX[sub].ink } : null, innerStyle, onPress ? { flexGrow: 1 } : null]}
    >
      {children}
    </ToneBlock>
  );
  if (!onPress) return body;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [outer, { opacity: pressed ? 0.85 : 1 }]}
    >
      {body}
    </Pressable>
  );
}

/** .card: radius 28, padding 18. Variants: default grey, black, accent (orange), white (hairline). */
export function UCard(props: SurfaceProps) {
  return <Surface radius={28} pad={18} {...props} />;
}

interface TileProps extends SurfaceProps {
  /** Big Outfit 22 value (the `b` in .tile). */
  value?: React.ReactNode;
  /** 12px caption under the value. */
  label?: React.ReactNode;
  /** .tile.on: selected outline. */
  selected?: boolean;
  /** Caption above the value (analytics / ads stat tiles in the design). */
  labelFirst?: boolean;
  /** Value font size override (design uses 28 on stat tiles); line-height stays 1.15. */
  valueSize?: number;
}

/** .tile: radius 24, padding 14, value + caption. Children render below the label. */
export function Tile({ value, label, selected, labelFirst, valueSize, tone = 'default', children, style, ...rest }: TileProps) {
  return (
    <Surface radius={24} pad={14} tone={tone} selected={selected} style={[{ gap: 2, minWidth: 0 }, style]} {...rest}>
      {labelFirst && label != null && <TileText>{label}</TileText>}
      {value != null && (
        <TileText value size={valueSize}>{value}</TileText>
      )}
      {!labelFirst && label != null && <TileText>{label}</TileText>}
      {children}
    </Surface>
  );
}

function TileText({ children, value, size = 22 }: { children: React.ReactNode; value?: boolean; size?: number }) {
  if (value) {
    return (
      <RNText
        className="text-ink"
        style={{ fontFamily: FONT.display, fontSize: size, lineHeight: size * 1.15, letterSpacing: -size * 0.02 }}
      >
        {children}
      </RNText>
    );
  }
  return (
    <RNText className="text-muted" style={{ fontFamily: FONT.sans, fontSize: 12, lineHeight: 17.4 }}>
      {children}
    </RNText>
  );
}

/** Hairline divider (.hr). */
export function Divider() {
  return <View className="bg-divider" style={{ height: 1 }} />;
}
