import React from 'react';
import { Pressable, ScrollView, Text as RNText, View } from 'react-native';
import { Icon } from './Icon';
import { Glass } from './Glass';
import { FONT } from './fonts';
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
  const fill = on ? 'bg-ink' : outlined ? 'bg-ground border-[1.5px] border-ink' : 'bg-surface-2';
  const text = on ? 'text-ink-inverse' : 'text-ink';
  const iconColor = on ? 'ink-inverse' : 'ink';
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected: !!(on || outlined) }}
      onPress={onPress}
      className={`flex-row items-center self-start ${fill}`}
      style={({ pressed }) => ({ height: 42, paddingHorizontal: 18, borderRadius: 21, gap: 6, opacity: pressed ? 0.8 : 1 })}
    >
      {icon ? <Icon name={icon} size="sm" color={iconColor} /> : null}
      <RNText className={text} style={{ fontFamily: FONT.sansMedium, fontSize: 13 }} numberOfLines={1}>
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
      style={{ flexGrow: 0 }}
      contentContainerStyle={{ gap: 8, paddingHorizontal: 20 }}
    >
      {children}
    </ScrollView>
  );
}

export type TagTone = 'default' | 'o' | 'g' | 'r' | 'k' | 'glass' | 'glassDark';

const TAG: Record<Exclude<TagTone, 'glass' | 'glassDark'>, { bg: string; fg: string }> = {
  default: { bg: 'bg-surface-3', fg: 'text-ink' },
  o: { bg: 'bg-tag-o', fg: 'text-tag-o-fg' },
  g: { bg: 'bg-tag-g', fg: 'text-tag-g-fg' },
  r: { bg: 'bg-tag-r', fg: 'text-tag-r-fg' },
  k: { bg: 'bg-night', fg: 'text-paper' },
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
  const h = large ? 36 : 28;
  const size = { height: h, borderRadius: h / 2, paddingHorizontal: large ? 14 : 11 };
  const textStyle = { fontFamily: FONT.sansMedium, fontSize: large ? 13 : 12 };
  if (tone === 'glass' || tone === 'glassDark') {
    const dark = tone === 'glassDark';
    return (
      <Glass dark={dark} style={[size, { flexDirection: 'row', alignItems: 'center', gap: 5 }]}>
        {icon ? <Icon name={icon} size="sm" color={dark ? 'paper' : 'night'} /> : null}
        <RNText className={dark ? 'text-paper' : 'text-night'} style={textStyle} numberOfLines={1}>
          {label}
        </RNText>
      </Glass>
    );
  }
  const t = TAG[tone];
  return (
    <View className={`flex-row items-center self-start ${t.bg}`} style={[size, { gap: 5 }]}>
      {icon ? <Icon name={icon} size="sm" color={tone === 'k' ? 'paper' : tone === 'default' ? 'ink' : (`tag-${tone}-fg` as const)} /> : null}
      <RNText className={t.fg} style={textStyle} numberOfLines={1}>
        {label}
      </RNText>
    </View>
  );
}

export type RatingLevel = 'lo' | 'md' | 'hi' | 'neutral';

const RATING: Record<RatingLevel, { bg: string; fg: string; dot: string; bd: string }> = {
  lo: { bg: 'bg-rating-lo', fg: 'text-rating-lo-fg', dot: 'bg-rating-lo-dot', bd: 'border-rating-lo-fg' },
  md: { bg: 'bg-rating-md', fg: 'text-rating-md-fg', dot: 'bg-rating-md-dot', bd: 'border-rating-md-fg' },
  hi: { bg: 'bg-rating-hi', fg: 'text-rating-hi-fg', dot: 'bg-rating-hi-dot', bd: 'border-rating-hi-fg' },
  neutral: { bg: 'bg-surface-3', fg: 'text-ink', dot: 'bg-muted', bd: 'border-ink' },
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
  const h = small ? 24 : 30;
  return (
    <View
      accessibilityLabel={label}
      className={`flex-row items-center self-start ${r.bg} ${emphasis ? `border-[1.5px] ${r.bd}` : ''}`}
      style={{ height: h, borderRadius: h / 2, paddingHorizontal: small ? 9 : 11, gap: 6 }}
    >
      <View className={r.dot} style={{ width: 8, height: 8, borderRadius: 4 }} />
      <RNText className={r.fg} style={{ fontFamily: FONT.sansMedium, fontSize: small ? 11 : 12 }} numberOfLines={1}>
        {label}
      </RNText>
    </View>
  );
}
