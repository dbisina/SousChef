import React from 'react';
import { Text as RNText, View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';
import { Pressable } from '@/components/ui/Pressable';
import { FONT } from '@/components/ui/fonts';
import { useTokens } from '@/components/ui';
import { ME_ID, type MessageReaction } from '@/types/social';

interface Props {
  reactions?: MessageReaction[];
  side: 'me' | 'them';
  onToggle: (emoji: string) => void;
}

/** Reaction chips under a bubble. A chip pops in when it appears; tapping your own chip removes it. */
export function ReactionRow({ reactions, side, onToggle }: Props) {
  const tokens = useTokens();
  if (!reactions?.length) return null;
  return (
    <View
      style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 4,
        alignSelf: side === 'me' ? 'flex-end' : 'flex-start',
        marginTop: -4,
        paddingHorizontal: 8,
      }}
    >
      {reactions.map((r) => {
        const mine = r.userIds.includes(ME_ID);
        return (
          <Animated.View key={r.emoji} entering={ZoomIn.springify().damping(11).stiffness(260)}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${r.emoji} ${r.userIds.length}`}
              accessibilityState={{ selected: mine }}
              onPress={() => onToggle(r.emoji)}
              hitSlop={8}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                height: 26,
                paddingHorizontal: 8,
                borderRadius: 13,
                backgroundColor: mine ? tokens['surface-3'] : tokens['surface-2'],
                borderWidth: 1.5,
                borderColor: mine ? tokens.accent : tokens.ground,
              }}
            >
              <RNText style={{ fontSize: 13 }}>{r.emoji}</RNText>
              {r.userIds.length > 1 ? (
                <RNText style={{ fontFamily: FONT.sans, fontSize: 11, color: tokens.muted }}>{r.userIds.length}</RNText>
              ) : null}
            </Pressable>
          </Animated.View>
        );
      })}
    </View>
  );
}
