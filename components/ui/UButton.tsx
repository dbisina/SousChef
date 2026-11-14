import React from 'react';
import { ActivityIndicator, Pressable, Text as RNText, View, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from './Icon';
import { FONT } from './fonts';
import { useColor, useTokens } from './tone';
import { FIXED } from '@/stores/themeStore';
import type { IconName } from './icons';

export type UButtonVariant = 'primary' | 'accent' | 'white' | 'ghost';

// bg / fg / icon are color keys (token or FIXED names) resolved to hex with useColor. The Pressable
// carries no className: NativeWind drops a function `style` (height, radius) on a Pressable that has one.
const FILL: Record<UButtonVariant, { bg: string; fg: string; icon: string }> = {
  primary: { bg: 'ink', fg: 'ink-inverse', icon: 'ink-inverse' },
  accent: { bg: 'accent', fg: 'accent-ink', icon: 'accent-ink' },
  white: { bg: 'paper', fg: 'night', icon: 'night' },
  ghost: { bg: 'surface-2', fg: 'ink', icon: 'ink' },
};

interface UButtonProps {
  label: string;
  onPress?: () => void;
  variant?: UButtonVariant;
  /** 'md' = 58px full width pill, 'sm' = 44px auto width. */
  size?: 'md' | 'sm';
  icon?: IconName;
  /** Pin `icon` to the left edge in a fixed 24px slot and centre the label across the full width (social sign-in). */
  iconStart?: boolean;
  /** Round icon chip on the right edge (.btn .ic), e.g. an arrow. */
  trailingIcon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

/** .btn: Outfit 16 pill. Primary is ink (black light / near-white dark), accent is the single orange action. */
export function UButton({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  iconStart,
  trailingIcon,
  loading,
  disabled,
  accessibilityLabel,
  style,
}: UButtonProps) {
  const f = FILL[variant];
  const sm = size === 'sm';
  const h = sm ? 44 : 58;
  const inactive = disabled || loading;
  const spin = useColor(f.icon);
  const bg = useColor(f.bg);
  const fg = useColor(f.fg);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: bg,
          height: h,
          borderRadius: h / 2,
          gap: 10,
          paddingHorizontal: sm ? 20 : 0,
          alignSelf: sm ? 'flex-start' : 'stretch',
          opacity: disabled ? 0.4 : pressed ? 0.85 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={spin} size="small" />
      ) : (
        <>
          {icon && iconStart ? (
            <View style={{ position: 'absolute', left: 22, top: 0, bottom: 0, width: 24, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={icon} size="md" color={f.icon} />
            </View>
          ) : icon ? (
            <Icon name={icon} size={sm ? 'sm' : 'md'} color={f.icon} />
          ) : null}
          <RNText
            numberOfLines={1}
            style={{ fontFamily: FONT.display, fontSize: sm ? 14 : 16, letterSpacing: -0.16, color: fg }}
          >
            {label}
          </RNText>
          {trailingIcon ? (
            <View
              style={{
                width: 46,
                height: 46,
                borderRadius: 23,
                marginRight: -12,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: FIXED.night,
              }}
            >
              <Icon name={trailingIcon} color="paper" />
            </View>
          ) : null}
        </>
      )}
    </Pressable>
  );
}

interface CtaBarProps {
  children: React.ReactNode;
  /** Stack buttons vertically (.cta.v). */
  vertical?: boolean;
  /** Fade the screen content out beneath the bar (.cta.fd). */
  fade?: boolean;
}

/** .cta: absolute bottom action row. Children are UButtons; each grows equally in a row. */
export function CtaBar({ children, vertical, fade }: CtaBarProps) {
  const insets = useSafeAreaInsets();
  const t = useTokens();
  const bottom = Math.max(insets.bottom, 34);
  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        left: fade ? 0 : 20,
        right: fade ? 0 : 20,
        bottom: fade ? 0 : bottom,
        paddingHorizontal: fade ? 20 : 0,
        paddingTop: fade ? 34 : 0,
        paddingBottom: fade ? bottom : 0,
        zIndex: 3,
      }}
    >
      {fade ? (
        <LinearGradient
          pointerEvents="none"
          colors={[`${t.ground}00`, t.ground, t.ground]}
          locations={[0, 0.4, 1]}
          style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
        />
      ) : null}
      <View style={{ flexDirection: vertical ? 'column' : 'row', gap: 10, alignItems: 'stretch' }}>
        {vertical
          ? children
          : React.Children.map(children, (c) => (c ? <View style={{ flex: 1, minWidth: 0 }}>{c}</View> : null))}
      </View>
    </View>
  );
}
