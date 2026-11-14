import React from 'react';
import { View } from 'react-native';
import { Display, Muted, Ring } from '@/components/ui';
import { formatClock } from '@/lib/mysteryKitchen';

interface Props {
  left: number;
  total: number;
  caption: string;
}

/** Orange ring + clock for the Mystery Kitchen round. */
export function MKCountdown({ left, total, caption }: Props) {
  const clock = formatClock(left);
  return (
    <Ring size={190} thickness={11} value={total > 0 ? left / total : 0} color="accent" label={`${clock} ${caption}`}>
      <View style={{ alignItems: 'center', gap: 18 }}>
        <Display size={44} style={{ lineHeight: 44 }}>{clock}</Display>
        <Muted small>{caption}</Muted>
      </View>
    </Ring>
  );
}
