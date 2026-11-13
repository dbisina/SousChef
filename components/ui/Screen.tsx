import React from 'react';
import { ScrollView, View, type StyleProp, type ViewStyle } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ToneScope } from './tone';
import { useThemeStore } from '@/stores/themeStore';
import { BarTitle, Dim, H1 } from './Typography';
import { UIconButton } from './IconButton';

type ScreenTone = 'auto' | 'light' | 'dark';

interface ScreenProps {
  /** 'auto' follows the user's theme; 'dark'/'light' force the token set for this subtree. */
  tone?: ScreenTone;
  /** Scroll the body (20px side padding, 18px gap, like tokens.css .body). */
  scroll?: boolean;
  /** Extra space under the content, e.g. 110 to clear the floating tab bar or a CtaBar. */
  bottomSpace?: number;
  /** Render children directly with no padded body wrapper. */
  bare?: boolean;
  /** Fixed content below the scroll area, e.g. <CtaBar>. */
  footer?: React.ReactNode;
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function Screen({ tone = 'auto', scroll, bottomSpace = 0, bare, footer, children, style }: ScreenProps) {
  const effective = useThemeStore((s) => s.effectiveTheme);
  const resolved = tone === 'auto' ? effective : tone;
  return (
    <ToneScope tone={resolved} style={style}>
      <StatusBar style={resolved === 'dark' ? 'light' : 'dark'} />
      {bare ? (
        children
      ) : scroll ? (
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingHorizontal: 20, gap: 18, paddingBottom: bottomSpace }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      ) : (
        <View className="flex-1 px-5" style={{ gap: 18, paddingBottom: bottomSpace }}>
          {children}
        </View>
      )}
      {footer}
    </ToneScope>
  );
}

interface TopBarProps {
  /** Large two-tone headline on the left (variant="large") or centered title (variant="compact"). */
  title?: React.ReactNode;
  /** Grey tail appended to the large title. */
  titleDim?: React.ReactNode;
  variant?: 'large' | 'compact';
  /** Shows a back button in compact mode. */
  onBack?: () => void;
  backLabel?: string;
  right?: React.ReactNode;
  left?: React.ReactNode;
}

/** .top: 58px top padding (safe area aware), 20px sides, 14px bottom. */
export function TopBar({ title, titleDim, variant = 'large', onBack, backLabel = 'Back', right, left }: TopBarProps) {
  const insets = useSafeAreaInsets();
  const paddingTop = Math.max(insets.top, 20) + 14;
  const side = left ?? (onBack ? <UIconButton icon="back" label={backLabel} onPress={onBack} /> : null);

  if (variant === 'compact') {
    return (
      <View
        className="flex-row items-center justify-between"
        style={{ paddingTop, paddingBottom: 14, paddingHorizontal: 20, gap: 12 }}
      >
        <View style={{ minWidth: 46 }}>{side}</View>
        <View className="flex-1 items-center">
          {typeof title === 'string' ? <BarTitle>{title}</BarTitle> : title}
        </View>
        <View style={{ minWidth: 46, alignItems: 'flex-end' }}>{right}</View>
      </View>
    );
  }
  return (
    <View
      className="flex-row items-center justify-between"
      style={{ paddingTop, paddingBottom: 14, paddingHorizontal: 20, gap: 12 }}
    >
      {side}
      <View className="flex-1">
        {typeof title === 'string' ? (
          <H1>
            {title}
            {titleDim ? <Dim>{` ${String(titleDim)}`}</Dim> : null}
          </H1>
        ) : (
          title
        )}
      </View>
      {right}
    </View>
  );
}
