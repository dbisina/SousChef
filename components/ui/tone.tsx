import React, { createContext, useContext, useMemo } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { vars } from 'nativewind';
import {
  FIXED,
  TOKEN_HEX,
  tokenChannels,
  useThemeStore,
  type ThemeMode,
  type TokenName,
} from '@/stores/themeStore';

/** Resolved color mode for a subtree. Null means "follow the user's theme". */
const ToneContext = createContext<ThemeMode | null>(null);

export function useTone(): ThemeMode {
  const ctx = useContext(ToneContext);
  const effective = useThemeStore((s) => s.effectiveTheme);
  return ctx ?? effective;
}

/** Hex values of the semantic tokens for the current subtree (for SVG strokes, gradients, native props). */
export function useTokens(): Record<TokenName, string> {
  return TOKEN_HEX[useTone()];
}

export type ColorKey = TokenName | keyof typeof FIXED;

/** Resolve a token name, a FIXED color name, or a raw color string. */
export function useColor(key: ColorKey | (string & {}) | undefined, fallback: TokenName = 'ink'): string {
  const t = useTokens();
  if (!key) return t[fallback];
  if (key in t) return t[key as TokenName];
  if (key in FIXED) return FIXED[key as keyof typeof FIXED];
  return key;
}

interface ToneScopeProps {
  tone: ThemeMode;
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  className?: string;
}

/**
 * Applies a token set (light or dark) to its subtree with NativeWind `vars()`
 * and provides the matching tone to useTokens/useTone. Renders a flex-1 ground view.
 */
export function ToneScope({ tone, children, style, className }: ToneScopeProps) {
  const themeVars = useMemo(() => vars(tokenChannels(tone)), [tone]);
  return (
    <ToneContext.Provider value={tone}>
      <View style={[{ flex: 1 }, themeVars, style]} className={`bg-ground ${className ?? ''}`}>
        {children}
      </View>
    </ToneContext.Provider>
  );
}

/** Token scope without a background or flex: wrap any region to re-tone it (black cards, galleries). */
export function ToneBlock({ tone, children, style, className }: ToneScopeProps) {
  const themeVars = useMemo(() => vars(tokenChannels(tone)), [tone]);
  return (
    <ToneContext.Provider value={tone}>
      <View style={[themeVars, style]} className={className}>
        {children}
      </View>
    </ToneContext.Provider>
  );
}
