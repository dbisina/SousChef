import React from 'react';
import { Pressable, ScrollView, Text as RNText, View } from 'react-native';
import { Icon } from './Icon';
import { Glass } from './Glass';
import { FONT } from './fonts';
import { useTokens } from './tone';
import { FIXED, type TokenName } from '@/stores/themeStore';
import type { IconName } from './icons';

interface ChipProps {
  label: string;
  icon?: IconName;
  /** Filled selected state (.chip.on). */
  on?: boolean;
  /** Outlined selected state (.chip.sel). */
  outlined?: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
}

/** .chip: 42px pill, 13px medium. */
export function Chip({ label, icon, on, outlined, onPress, accessibilityLabel }: ChipProps) {
  const t = useTokens();
  const bg = on ? t.ink : outlined ? t.ground : t['surface-2'];
  const textColor = on ? t['ink-inverse'] : t.ink;
  const iconColor = on ? 'ink-inverse' : 'ink';
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected: !!(on || outlined) }}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        backgroundColor: bg,
        borderWidth: outlined && !on ? 1.5 : 0,
        borderColor: t.ink,
        height: 42,
        paddingHorizontal: 18,
        borderRadius: 21,
        gap: 6,
        opacity: pressed ? 0.8 : 1,
      })}
    >
      {icon ? <Icon name={icon} size="sm" color={iconColor} /> : null}
      <RNText style={{ fontFamily: FONT.sansMedium, fontSize: 13, color: textColor }} numberOfLines={1}>
        {label}
      </RNText>
    </Pressable>
  );
}

/** Horizontal scroller for chips (.chips). */
export function ChipRow({ children }: { children: React.ReactNode }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ flexGrow: 0, flexShrink: 0 }}
      contentContainerStyle={{ gap: 8, paddingHorizontal: 20 }}
    >
      {children}
    </ScrollView>
  );
}

export type TagTone = 'default' | 'o' | 'g' | 'r' | 'k' | 'glass' | 'glassDark';

const TAG: Record<Exclude<TagTone, 'glass' | 'glassDark'>, { bg: string; fg: string }> = {
  default: { bg: 'surface-3', fg: 'ink' },
  o: { bg: 'tag-o-bg', fg: 'tag-o-fg' },
  g: { bg: 'tag-g-bg', fg: 'tag-g-fg' },
  r: { bg: 'tag-r-bg', fg: 'tag-r-fg' },
  k: { bg: 'night', fg: 'paper' },
};

interface TagProps {
  label: string;
  tone?: TagTone;
  icon?: IconName;
  /** .tag.lg: 36px */
  large?: boolean;
}

/** .tag: 28px pill label. Tones: default, o (orange), g (green), r (red), k (black), glass, glassDark. */
export function Tag({ label, tone = 'default', icon, large }: TagProps) {
  const tokens = useTokens();
  const hex = (k: string): string => (k in tokens ? tokens[k as TokenName] : FIXED[k as keyof typeof FIXED]);
  const h = large ? 36 : 28;
  const size = { height: h, borderRadius: h / 2, paddingHorizontal: large ? 14 : 11 };
  const textStyle = { fontFamily: FONT.sansMedium, fontSize: large ? 13 : 12 };
  if (tone === 'glass' || tone === 'glassDark') {
    const dark = tone === 'glassDark';
    return (
      <Glass dark={dark} style={[size, { flexDirection: 'row', alignItems: 'center', gap: 5 }]}>
        {icon ? <Icon name={icon} size="sm" color={dark ? 'paper' : 'night'} /> : null}
        <RNText style={[textStyle, { color: dark ? FIXED.paper : FIXED.night }]} numberOfLines={1}>
          {label}
        </RNText>
      </Glass>
    );
  }
  const t = TAG[tone];
  return (
    <View
      style={[size, { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', backgroundColor: hex(t.bg), gap: 5 }]}
    >
      {icon ? <Icon name={icon} size="sm" color={tone === 'k' ? 'paper' : tone === 'default' ? 'ink' : (`tag-${tone}-fg` as const)} /> : null}
      <RNText style={[textStyle, { color: hex(t.fg) }]} numberOfLines={1}>
        {label}
      </RNText>
    </View>
  );
}

export type RatingLevel = 'lo' | 'md' | 'hi' | 'neutral';

const RATING: Record<RatingLevel, { bg: TokenName; fg: TokenName; dot: TokenName }> = {
  lo: { bg: 'rating-lo-bg', fg: 'rating-lo-fg', dot: 'rating-lo-dot' },
  md: { bg: 'rating-md-bg', fg: 'rating-md-fg', dot: 'rating-md-dot' },
  hi: { bg: 'rating-hi-bg', fg: 'rating-hi-fg', dot: 'rating-hi-dot' },
  neutral: { bg: 'surface-3', fg: 'ink', dot: 'muted' },
};

interface RatingTagProps {
  label: string;
  level: RatingLevel;
  /** .rt.em outline emphasis */
  emphasis?: boolean;
  /** .rt.sm */
  small?: boolean;
}

/** .rt: Low / Medium / High rating pill with a status dot. */
export function RatingTag({ label, level, emphasis, small }: RatingTagProps) {
  const r = RATING[level];
  const t = useTokens();
  const h = small ? 24 : 30;
  return (
    <View
      accessibilityLabel={label}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        backgroundColor: t[r.bg],
        borderWidth: emphasis ? 1.5 : 0,
        borderColor: t[r.fg],
        height: h,
        borderRadius: h / 2,
        paddingHorizontal: small ? 9 : 11,
        gap: 6,
      }}
    >
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: t[r.dot] }} />
      <RNText style={{ fontFamily: FONT.sansMedium, fontSize: small ? 11 : 12, color: t[r.fg] }} numberOfLines={1}>
        {label}
      </RNText>
    </View>
  );
}
