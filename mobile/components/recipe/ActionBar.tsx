import React from 'react';
import { View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTokens } from '@/components/ui';

interface ActionBarProps {
  children: React.ReactNode;
  /** Stack children vertically (.cta.v). */
  vertical?: boolean;
  /** Fade the content out under the bar (.cta.fd). Default true. */
  fade?: boolean;
}

/**
 * .cta bar for rows that mix fixed-width and flexible buttons (e.g. a 58px icon button + a growing
 * accent button). CtaBar splits its children equally, so these screens use this instead.
 * Children control their own width: wrap flexible ones in <View style={{ flex: 1 }}>.
 */
export function ActionBar({ children, vertical, fade = true }: ActionBarProps) {
  const insets = useSafeAreaInsets();
  const t = useTokens();
  const bottom = Math.max(insets.bottom, 34);
  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        paddingHorizontal: 20,
        paddingTop: fade ? 34 : 0,
        paddingBottom: bottom,
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
      <View style={{ flexDirection: vertical ? 'column' : 'row', gap: 10, alignItems: vertical ? 'stretch' : 'center' }}>
        {children}
      </View>
    </View>
  );
}
