import React from 'react';
import { Pressable, Text as RNText, TextInput, View, type TextInputProps } from 'react-native';
import { Icon } from './Icon';
import { FONT } from './fonts';
import { useTokens, useTone } from './tone';
import { FIXED } from '@/stores/themeStore';
import type { IconName } from './icons';

interface UInputProps extends Omit<TextInputProps, 'style'> {
  /** Leading icon (e.g. 'search'). */
  icon?: IconName;
  /** Trailing slot, e.g. a UIconButton (pill keeps 6px right padding like .inp). */
  right?: React.ReactNode;
  label: string;
}

/** .inp: 56px pill input (search bars, chat composer). `label` is the accessible name. */
export function UInput({ icon, right, label, ...rest }: UInputProps) {
  const t = useTokens();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: t['surface-2'],
        height: 56,
        borderRadius: 28,
        paddingStart: 20,
        paddingRight: 6,
        gap: 10,
      }}
    >
      {icon ? <Icon name={icon} color="muted" /> : null}
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={FIXED.placeholder}
        selectionColor={t.accent}
        {...rest}
        style={{ flex: 1, color: t.ink, fontFamily: FONT.sans, fontSize: 15, height: '100%', minWidth: 0 }}
      />
      {right ? <View style={{ justifyContent: 'center' }}>{right}</View> : null}
    </View>
  );
}

interface FieldProps extends Omit<TextInputProps, 'style'> {
  label: string;
  error?: string;
  /** Control pinned inside the right edge of the field (e.g. show/hide password). The text reserves room for it. */
  trailing?: React.ReactNode;
}

/** .fld: label above a 54px rounded field (80px for multiline). */
export function Field({ label, error, multiline, trailing, ...rest }: FieldProps) {
  const t = useTokens();
  return (
    <View style={{ gap: 7, minWidth: 0 }}>
      <RNText style={{ color: t.muted, fontFamily: FONT.sansMedium, fontSize: 12, paddingStart: 4 }}>
        {label}
      </RNText>
      <View style={{ justifyContent: 'center' }}>
        <TextInput
          accessibilityLabel={label}
          placeholderTextColor={FIXED.placeholder}
          selectionColor={t.accent}
          multiline={multiline}
          {...rest}
          style={{
            backgroundColor: t['surface-2'],
            color: t.ink,
            height: multiline ? 80 : 54,
            borderRadius: 18,
            paddingStart: 18,
            paddingEnd: trailing ? 54 : 18,
            paddingVertical: multiline ? 15 : 0,
            fontFamily: FONT.sans,
            fontSize: 15,
            textAlignVertical: multiline ? 'top' : 'center',
          }}
        />
        {trailing ? (
          <View style={{ position: 'absolute', top: 0, bottom: 0, end: 0, width: 54, alignItems: 'center', justifyContent: 'center' }}>
            {trailing}
          </View>
        ) : null}
      </View>
      {error ? (
        <RNText style={{ color: t['tag-r-fg'], fontFamily: FONT.sans, fontSize: 12, paddingStart: 4 }}>
          {error}
        </RNText>
      ) : null}
    </View>
  );
}

interface SegmentedProps<T extends string> {
  options: { value: T; label: string; icon?: IconName }[];
  value: T;
  onChange: (value: T) => void;
}

/** .seg: pill group, 46px segments, selected = ink fill. */
export function Segmented<T extends string>({ options, value, onChange }: SegmentedProps<T>) {
  const t = useTokens();
  return (
    <View
      accessibilityRole="tablist"
      style={{ flexDirection: 'row', backgroundColor: t['surface-2'], borderRadius: 27, padding: 4 }}
    >
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityLabel={o.label}
            accessibilityState={{ selected: on }}
            onPress={() => onChange(o.value)}
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: on ? t.ink : 'transparent',
              height: 46,
              borderRadius: 23,
              gap: 6,
            }}
          >
            {o.icon ? <Icon name={o.icon} size="sm" color={on ? 'ink-inverse' : 'muted'} /> : null}
            <RNText
              style={{ fontFamily: FONT.sansMedium, fontSize: 13, color: on ? t['ink-inverse'] : t.muted }}
              numberOfLines={1}
            >
              {o.label}
            </RNText>
          </Pressable>
        );
      })}
    </View>
  );
}

interface USwitchProps {
  value: boolean;
  onValueChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
}

/** .sw: 50x30 track. On = ink (light) / orange (dark). */
export function USwitch({ value, onValueChange, label, disabled }: USwitchProps) {
  const dark = useTone() === 'dark';
  const t = useTokens();
  const track = value ? (dark ? t.accent : t.ink) : dark ? t.track : t.line;
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value, disabled: !!disabled }}
      disabled={disabled}
      onPress={() => onValueChange(!value)}
      hitSlop={7}
      style={{ width: 50, height: 30, borderRadius: 15, backgroundColor: track, opacity: disabled ? 0.4 : 1 }}
    >
      <View
        style={{
          backgroundColor: FIXED.paper,
          position: 'absolute',
          top: 3,
          left: value ? 23 : 3,
          width: 24,
          height: 24,
          borderRadius: 12,
          shadowColor: FIXED.shadow,
          shadowOpacity: 0.15,
          shadowRadius: 1,
          shadowOffset: { width: 0, height: 1 },
          elevation: 1,
        }}
      />
    </Pressable>
  );
}

interface CheckProps {
  checked: boolean;
  onChange?: (v: boolean) => void;
  label: string;
}

/** .ck: 26px round check. Checked = ink fill (light) / orange fill (dark). */
export function Check({ checked, onChange, label }: CheckProps) {
  const dark = useTone() === 'dark';
  const t = useTokens();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked }}
      disabled={!onChange}
      onPress={() => onChange?.(!checked)}
      hitSlop={9}
      style={{
        width: 26,
        height: 26,
        borderRadius: 13,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: checked ? (dark ? t.accent : t.ink) : 'transparent',
        borderWidth: checked ? 0 : 1.5,
        borderColor: t.line,
      }}
    >
      {checked ? <Icon name="check" size="sm" color={dark ? 'accent-ink' : 'ink-inverse'} /> : null}
    </Pressable>
  );
}
