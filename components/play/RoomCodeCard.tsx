import React from 'react';
import { View } from 'react-native';
import { Chip, Display, Muted, SectionLabel, UCard } from '@/components/ui';

interface Props {
  code: string;
  hint: string;
  labels: { room: string; copy: string; copied: string; invite: string };
  copied: boolean;
  onCopy: () => void;
  onInvite: () => void;
}

/** Big room code with copy and invite actions (MKLobby). */
export function RoomCodeCard({ code, hint, labels, copied, onCopy, onInvite }: Props) {
  return (
    <UCard style={{ alignItems: 'center', gap: 6, borderRadius: 30, padding: 22 }}>
      <SectionLabel>{labels.room}</SectionLabel>
      <Display size={64} accessibilityLabel={code.split('').join(' ')} style={{ letterSpacing: 7.7, lineHeight: 64 }}>
        {code}
      </Display>
      <Muted small center>
        {hint}
      </Muted>
      <View className="flex-row" style={{ gap: 8, marginTop: 8 }}>
        <Chip icon="link" label={copied ? labels.copied : labels.copy} onPress={onCopy} />
        <Chip icon="send" label={labels.invite} onPress={onInvite} />
      </View>
    </UCard>
  );
}
