import React from 'react';
import { Pressable, View } from 'react-native';
import { Icon, type IconSize } from './Icon';
import { Glass } from './Glass';
import { useColor } from './tone';
import type { IconName } from './icons';

export type IconButtonTone = 'default' | 'black' | 'accent' | 'white' | 'glass' | 'glassDark';

const FILL: Record<Exclude<IconButtonTone, 'glass' | 'glassDark'>, string> = {
  default: 'surface-2',
  black: 'night',
  accent: 'accent',
  white: 'paper',
};

const ICON_COLOR: Record<IconButtonTone, string> = {
  default: 'ink',
  black: 'paper',
  accent: 'night',
  white: 'night',
  glass: 'night',
  glassDark: 'paper',
};

interface UIconButtonProps {
  icon: IconName;
  /** Required: icon-only buttons need an accessible name. */
  label: string;
  onPress?: () => void;
  tone?: IconButtonTone;
  /** 46 = .ib (default), 44 = .ic */
  size?: 44 | 46 | number;
  iconSize?: IconSize;
  filled?: boolean;
  disabled?: boolean;
}

/** Round icon button (.ib / .ic). Min hit area 44. */
export function UIconButton({ icon, label, onPress, tone = 'default', size = 46, iconSize = 'md', filled, disabled }: UIconButtonProps) {
  const fill = useColor(tone === 'glass' || tone === 'glassDark' ? undefined : FILL[tone]);
  const dim = { width: size, height: size, borderRadius: size / 2 };
  const glyph = <Icon name={icon} size={iconSize} color={ICON_COLOR[tone]} filled={filled} />;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={size < 44 ? (44 - size) / 2 : 0}
      style={({ pressed }) => [{ opacity: disabled ? 0.4 : pressed ? 0.75 : 1 }]}
    >
      {tone === 'glass' || tone === 'glassDark' ? (
        <Glass dark={tone === 'glassDark'} style={[dim, { alignItems: 'center', justifyContent: 'center' }]}>
          {/* positioned wrapper: the Glass overlays are absolute and would paint over a bare web <svg> */}
          <View>{glyph}</View>
        </Glass>
      ) : (
        <View style={[dim, { alignItems: 'center', justifyContent: 'center', backgroundColor: fill }]}>
          {glyph}
        </View>
      )}
    </Pressable>
  );
}
