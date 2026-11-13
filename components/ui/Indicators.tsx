import React from 'react';
import { Pressable, Text as RNText, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Icon } from './Icon';
import { FONT } from './fonts';
import { useColor, useTone, type ColorKey } from './tone';

interface ProgressBarProps {
  /** 0..1 */
  value: number;
  /** 'accent' forces the orange fill; 'auto' = ink in light, orange in dark (matches .bar / .dk .bar). */
  variant?: 'auto' | 'accent';
  label?: string;
}

/** .bar: 6px track. */
export function ProgressBar({ value, variant = 'auto', label }: ProgressBarProps) {
  const dark = useTone() === 'dark';
  const pct = Math.max(0, Math.min(1, value));
  const fill = variant === 'accent' || dark ? 'bg-accent' : 'bg-ink';
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(pct * 100) }}
      className="bg-track overflow-hidden"
      style={{ height: 6, borderRadius: 3, flexShrink: 0 }}
    >
      <View className={fill} style={{ height: 6, borderRadius: 3, width: `${pct * 100}%` }} />
    </View>
  );
}

interface StepperProps {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  label: string;
}

/** .stp: 46px pill with round minus/plus buttons. */
export function Stepper({ value, onChange, min = 0, max = 99, label }: StepperProps) {
  const raise = useColor('raise');
  const btn = (icon: 'minus' | 'plus', delta: number, disabled: boolean) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${delta < 0 ? 'Fewer' : 'More'} ${label}`}
      disabled={disabled}
      onPress={() => onChange(value + delta)}
      style={{
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: raise,
        opacity: disabled ? 0.4 : 1,
      }}
      hitSlop={4}
    >
      <Icon name={icon} size="sm" />
    </Pressable>
  );
  return (
    <View
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ now: value, min, max }}
      className="flex-row items-center self-start bg-surface-2"
      style={{ height: 46, borderRadius: 23, paddingHorizontal: 5, gap: 10 }}
    >
      {btn('minus', -1, value <= min)}
      <RNText className="text-ink text-center" style={{ fontFamily: FONT.display, fontSize: 15, minWidth: 18 }}>
        {value}
      </RNText>
      {btn('plus', 1, value >= max)}
    </View>
  );
}

/** .dots: page indicator, active = 26px bar. */
export function Dots({ count, index }: { count: number; index: number }) {
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={`Page ${index + 1} of ${count}`}
      className="flex-row items-center"
      style={{ gap: 6 }}
    >
      {Array.from({ length: count }, (_, i) => (
        <View
          key={i}
          className={i === index ? 'bg-ink' : 'bg-line'}
          style={{ height: 6, width: i === index ? 26 : 6, borderRadius: 3 }}
        />
      ))}
    </View>
  );
}

interface RingProps {
  size?: number;
  thickness?: number;
  /** 0..1 */
  value: number;
  color?: ColorKey | (string & {});
  trackColor?: ColorKey | (string & {});
  label?: string;
  children?: React.ReactNode;
}

/** .ring: circular progress with centered content (timer, calories). */
export function Ring({ size = 190, thickness = 11, value, color = 'accent', trackColor = 'track', label, children }: RingProps) {
  const stroke = useColor(color);
  const track = useColor(trackColor);
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, value));
  return (
    <View
      accessible={!!label}
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(pct * 100) }}
      style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}
    >
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={thickness} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={stroke}
          strokeWidth={thickness}
          fill="none"
          strokeDasharray={`${c * pct} ${c}`}
          strokeLinecap="butt"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      {children}
    </View>
  );
}

export type BarTone = 'default' | 'ink' | 'accent' | 'dim';
interface BarChartProps {
  /** Heights 0..1, or objects to color individual bars. */
  data: (number | { value: number; tone?: BarTone })[];
  height?: number;
  label?: string;
}

const BAR_BG: Record<BarTone, string> = {
  default: 'bg-track',
  ink: 'bg-ink',
  accent: 'bg-accent',
  dim: 'bg-raise',
};

/** .vbar: flexible vertical bars. */
export function BarChart({ data, height = 80, label }: BarChartProps) {
  return (
    <View
      accessible={!!label}
      accessibilityRole="image"
      accessibilityLabel={label}
      className="flex-row items-end"
      style={{ height, gap: 6 }}
    >
      {data.map((d, i) => {
        const v = typeof d === 'number' ? d : d.value;
        const tone = typeof d === 'number' ? 'default' : (d.tone ?? 'default');
        return (
          <View
            key={i}
            className={BAR_BG[tone]}
            style={{ flex: 1, borderRadius: 6, height: `${Math.max(0, Math.min(1, v)) * 100}%` }}
          />
        );
      })}
    </View>
  );
}

/** .badge: orange count pill. */
export function UBadge({ count }: { count: number | string }) {
  return (
    <View
      accessibilityLabel={`${count} new`}
      className="items-center justify-center bg-accent"
      style={{ minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6 }}
    >
      <RNText className="text-accent-ink" style={{ fontFamily: FONT.sansSemi, fontSize: 11 }}>
        {count}
      </RNText>
    </View>
  );
}

/** .dot: 8px orange unread dot. */
export function Dot({ color = 'accent' }: { color?: ColorKey | (string & {}) }) {
  const c = useColor(color);
  return <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c }} />;
}
