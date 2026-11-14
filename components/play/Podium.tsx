import React from 'react';
import { Text as RNText, View } from 'react-native';
import { FONT, Tag, UAvatar } from '@/components/ui';
import type { PhotoSource } from '@/components/ui';

export interface PodiumEntry {
  id: string;
  name: string;
  avatar: PhotoSource;
  score: number;
  rank: number;
}

const HEIGHT: Record<number, number> = { 1: 104, 2: 70, 3: 52 };

/** Top three: 2nd, 1st, 3rd. The winner gets the orange pillar. */
export function Podium({ entries, winnerLabel }: { entries: PodiumEntry[]; winnerLabel: string }) {
  const byRank = (r: number) => entries.find((e) => e.rank === r);
  const order = [byRank(2), byRank(1), byRank(3)].filter((e): e is PodiumEntry => !!e);
  return (
    <View className="flex-row" style={{ gap: 10, alignItems: 'flex-end' }}>
      {order.map((e) => {
        const win = e.rank === 1;
        return (
          <View key={e.id} className="flex-1" style={{ alignItems: 'center', gap: 6 }}>
            {win ? (
              <View style={{ alignSelf: 'center' }}>
                <Tag tone="o" icon="trophy" label={winnerLabel} />
              </View>
            ) : null}
            <View
              className={win ? 'border-[3px] border-accent' : undefined}
              style={win ? { borderRadius: 36, margin: -3 } : undefined}
            >
              <UAvatar source={e.avatar} name={e.name} size={win ? 66 : 56} />
            </View>
            <View
              className={`items-center justify-center self-stretch ${win ? 'bg-accent' : 'bg-surface'}`}
              style={{ height: HEIGHT[e.rank] ?? 52, borderTopLeftRadius: 16, borderTopRightRadius: 16, borderBottomLeftRadius: 6, borderBottomRightRadius: 6 }}
            >
              <RNText
                className={win ? 'text-accent-ink' : 'text-ink'}
                numberOfLines={1}
                style={{ fontFamily: FONT.display, fontSize: 15, letterSpacing: -0.15 }}
              >
                {win ? `${e.name} · ${e.score}` : `${e.rank} · ${e.score}`}
              </RNText>
            </View>
          </View>
        );
      })}
    </View>
  );
}

