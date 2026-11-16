import React from 'react';
import { Text as RNText, type TextProps as RNTextProps } from 'react-native';
import { FONT } from './fonts';

type Props = RNTextProps & { className?: string; center?: boolean };

const join = (...p: (string | undefined | false)[]) => p.filter(Boolean).join(' ');

/** Grey tail of a two-tone headline. Nest inside H1: <H1>Good evening <Dim>Daniel</Dim></H1> */
export function Dim({ style, className, ...rest }: Props) {
  return <RNText className={join('text-subtle', className)} style={style} {...rest} />;
}

/** .h1: Outfit 32/1.08, tracking -0.03em. */
export function H1({ style, className, center, ...rest }: Props) {
  return (
    <RNText
      accessibilityRole="header"
      className={join('text-ink', center && 'text-center', className)}
      style={[{ fontFamily: FONT.display, fontSize: 32, lineHeight: 34.56, letterSpacing: -0.96 }, style]}
      {...rest}
    />
  );
}

/** .h2: Outfit 19/1.2, tracking -0.015em. */
export function H2({ style, className, center, ...rest }: Props) {
  return (
    <RNText
      accessibilityRole="header"
      className={join('text-ink', center && 'text-center', className)}
      style={[{ fontFamily: FONT.display, fontSize: 19, lineHeight: 22.8, letterSpacing: -0.285 }, style]}
      {...rest}
    />
  );
}

/** .t: Outfit 15/1.3. Card and row titles. */
export function Title({ style, className, center, ...rest }: Props) {
  return (
    <RNText
      className={join('text-ink', center && 'text-center', className)}
      style={[{ fontFamily: FONT.display, fontSize: 15, lineHeight: 19.5, letterSpacing: -0.15 }, style]}
      {...rest}
    />
  );
}

/** .tt: Outfit 17 top-bar title. */
export function BarTitle({ style, className, center, ...rest }: Props) {
  return (
    <RNText
      accessibilityRole="header"
      numberOfLines={1}
      className={join('text-ink', center && 'text-center', className)}
      style={[{ fontFamily: FONT.display, fontSize: 17, letterSpacing: -0.17 }, style]}
      {...rest}
    />
  );
}

/** Inter 14/1.45 default body copy. */
export function Body({ style, className, center, ...rest }: Props) {
  return (
    <RNText
      className={join('text-ink', center && 'text-center', className)}
      style={[{ fontFamily: FONT.sans, fontSize: 14, lineHeight: 20.3 }, style]}
      {...rest}
    />
  );
}

/** .mut: secondary text. `small` = .sm 12px. */
export function Muted({ style, className, center, small, ...rest }: Props & { small?: boolean }) {
  return (
    <RNText
      className={join('text-muted', center && 'text-center', className)}
      style={[{ fontFamily: FONT.sans, fontSize: small ? 12 : 14, lineHeight: small ? 17.4 : 20.3 }, style]}
      {...rest}
    />
  );
}

/** .lnk: 13 medium. `accent` = .lnk.o */
export function LinkText({ style, className, accent, ...rest }: Props & { accent?: boolean }) {
  return (
    <RNText
      accessibilityRole="link"
      className={join(accent ? 'text-accent-text' : 'text-muted', className)}
      style={[{ fontFamily: FONT.sansMedium, fontSize: 13 }, style]}
      {...rest}
    />
  );
}

/** .sec: 11 uppercase, tracking .12em. */
export function SectionLabel({ style, className, ...rest }: Props) {
  return (
    <RNText
      className={join('text-muted uppercase', className)}
      style={[{ fontFamily: FONT.sansMedium, fontSize: 11, letterSpacing: 1.32 }, style]}
      {...rest}
    />
  );
}

/** Big numerals (timer, stats): Outfit at any size. */
export function Display({ style, className, size = 44, ...rest }: Props & { size?: number }) {
  return (
    <RNText
      className={join('text-ink', className)}
      style={[{ fontFamily: FONT.display, fontSize: size, lineHeight: size * 1.05, letterSpacing: -size * 0.02 }, style]}
      {...rest}
    />
  );
}
