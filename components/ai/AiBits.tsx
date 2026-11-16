import React from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { Pressable } from '@/components/ui/Pressable';
import { FONT, Muted, UCard, useColor } from '@/components/ui';

/** A titled card used by every AI helper, with a busy spinner and an error line. */
export function AiCard({ title, busy, error, children }: { title: string; busy?: boolean; error?: string; children: React.ReactNode }) {
  const spinner = useColor('muted');
  return (
    <UCard>
      <View style={{ gap: 10 }}>
        <Text className="text-ink" style={{ fontFamily: FONT.display, fontSize: 17 }}>{title}</Text>
        {children}
        {busy ? <ActivityIndicator color={spinner} /> : null}
        {error ? <Text className="text-ink" accessibilityRole="alert" style={{ fontFamily: FONT.sans, fontSize: 14 }}>{error}</Text> : null}
      </View>
    </UCard>
  );
}

/** A selectable pill. */
export function AiChip({ label, on, onPress }: { label: string; on?: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: !!on }} className={on ? 'bg-accent' : 'bg-surface-3'} style={{ minHeight: 40, paddingHorizontal: 14, borderRadius: 20, alignItems: 'center', justifyContent: 'center' }}>
      <Text className={on ? 'text-accent-ink' : 'text-ink'} style={{ fontFamily: FONT.sansMedium, fontSize: 14 }}>{label}</Text>
    </Pressable>
  );
}

/** A line saying what the AI used, so nobody mistakes a guess for a fact. */
export const AiNote = ({ children }: { children: React.ReactNode }) => <Muted small>{children}</Muted>;
