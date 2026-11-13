import React from 'react';
import { Modal, Pressable, StyleSheet, Text as RNText, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from './Icon';
import { FONT } from './fonts';
import { ToneBlock, useTone } from './tone';
import { FIXED } from '@/stores/themeStore';
import type { IconName } from './icons';

interface RowsProps {
  /** .rows.box: grey rounded container with 16px side padding. */
  box?: boolean;
  children: React.ReactNode;
}

/** .rows: vertical list with hairline dividers between rows. */
export function Rows({ box, children }: RowsProps) {
  const items = React.Children.toArray(children).filter(Boolean);
  return (
    <View
      className={box ? 'bg-surface' : undefined}
      style={box ? { borderRadius: 26, paddingHorizontal: 16, paddingVertical: 2 } : undefined}
    >
      {items.map((child, i) => (
        <React.Fragment key={(child as React.ReactElement).key ?? i}>
          {i > 0 ? <View className="bg-divider" style={{ height: 1 }} /> : null}
          {child}
        </React.Fragment>
      ))}
    </View>
  );
}

interface ListRowProps {
  title: string;
  subtitle?: string;
  /** Leading round icon (.ic). */
  icon?: IconName;
  /** Custom leading node, e.g. a Thumb or UAvatar. Overrides icon. */
  leading?: React.ReactNode;
  /** Custom trailing node (switch, tag, text). */
  right?: React.ReactNode;
  /** Show a chevron when pressable and no `right` is given. */
  chevron?: boolean;
  /** 72px (.li) instead of 64px. */
  tall?: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
}

/** Row inside <Rows>: leading, title + subtitle, trailing. */
export function ListRow({ title, subtitle, icon, leading, right, chevron = true, tall, onPress, accessibilityLabel }: ListRowProps) {
  const content = (
    <View className="flex-row items-center" style={{ minHeight: tall ? 72 : 64, gap: 14 }}>
      {leading ?? (icon ? (
        <View className="items-center justify-center bg-surface-3" style={{ width: 44, height: 44, borderRadius: 22 }}>
          <Icon name={icon} />
        </View>
      ) : null)}
      <View className="flex-1" style={{ minWidth: 0, gap: 2 }}>
        <RNText className="text-ink" numberOfLines={1} style={{ fontFamily: FONT.display, fontSize: 15, lineHeight: 20, letterSpacing: -0.15 }}>
          {title}
        </RNText>
        {subtitle ? (
          <RNText className="text-muted" numberOfLines={2} style={{ fontFamily: FONT.sans, fontSize: 12, lineHeight: 17 }}>
            {subtitle}
          </RNText>
        ) : null}
      </View>
      {right ?? (onPress && chevron ? <Icon name="chevronRight" color="subtle" /> : null)}
    </View>
  );
  if (!onPress) return content;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      onPress={onPress}
      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
    >
      {content}
    </Pressable>
  );
}

interface SheetProps {
  visible: boolean;
  onClose: () => void;
  /** Accessible name for the sheet. */
  title: string;
  children: React.ReactNode;
}

/** Bottom sheet (.sheet + .scrim): 34px top radius, 24/20 padding, tap scrim to dismiss. */
export function Sheet({ visible, onClose, title, children }: SheetProps) {
  const tone = useTone();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <ToneBlock tone={tone} style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Close ${title}`}
          onPress={onClose}
          style={[StyleSheet.absoluteFill, { backgroundColor: FIXED.scrim }]}
        />
        <View
          accessibilityViewIsModal
          accessibilityLabel={title}
          className="bg-ground"
          style={{
            borderTopLeftRadius: 34,
            borderTopRightRadius: 34,
            paddingTop: 24,
            paddingHorizontal: 20,
            paddingBottom: Math.max(insets.bottom, 20),
            gap: 16,
            maxHeight: '88%',
          }}
        >
          {children}
        </View>
      </ToneBlock>
    </Modal>
  );
}

/** Inline sheet surface (.sheet) that overlaps the content above it by 34px, e.g. recipe detail. */
export function SheetPanel({ children }: { children: React.ReactNode }) {
  return (
    <View
      className="bg-ground flex-1"
      style={{ borderTopLeftRadius: 34, borderTopRightRadius: 34, paddingTop: 24, paddingHorizontal: 20, gap: 16, marginTop: -34 }}
    >
      {children}
    </View>
  );
}
