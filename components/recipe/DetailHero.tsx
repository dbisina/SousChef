import React from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PhotoCard, UIconButton } from '@/components/ui';
import type { PhotoSource } from '@/components/ui';

interface DetailHeroProps {
  source: PhotoSource;
  height?: number;
  onBack: () => void;
  backLabel: string;
  /** Glass buttons on the right of the top row. */
  actions?: React.ReactNode;
  /** Caption block pinned to the bottom (title, author line, source tag). */
  caption?: React.ReactNode;
}

/** Full-bleed photo header (.pc.ft, radius 0) with glass back + action buttons; the sheet below overlaps it by 34px. */
export function DetailHero({ source, height = 370, onBack, backLabel, actions, caption }: DetailHeroProps) {
  const insets = useSafeAreaInsets();
  const top = Math.max(insets.top, 20) + 38;
  return (
    <PhotoCard source={source} height={height} radius={0} fade="both">
      <View
        pointerEvents="box-none"
        style={{ position: 'absolute', top, left: 20, right: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', zIndex: 2 }}
      >
        <UIconButton icon="back" label={backLabel} tone="glassDark" onPress={onBack} />
        <View className="flex-row items-center" style={{ gap: 8 }}>
          {actions}
        </View>
      </View>
      {caption ? (
        <View pointerEvents="box-none" style={{ position: 'absolute', left: 22, right: 22, bottom: 56, gap: 10, zIndex: 2 }}>
          {caption}
        </View>
      ) : null}
    </PhotoCard>
  );
}
