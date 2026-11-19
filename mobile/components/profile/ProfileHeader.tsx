import React from 'react';
import { Text as RNText, View } from 'react-native';
import { Pressable } from '@/components/ui/Pressable';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, UAvatar, type PhotoSource } from '@/components/ui';
import { FONT } from '@/components/ui/fonts';
import { compactCount } from '@/lib/timeAgo';

export interface ProfileStat {
  value: number;
  label: string;
  onPress?: () => void;
}

interface ProfileHeaderProps {
  handle?: string | null;
  name: string;
  bio?: string | null;
  avatar?: PhotoSource | undefined;
  verified?: boolean;
  /** Left of the top bar: a back button on someone else's profile, nothing on your own. */
  topLeft?: React.ReactNode;
  /** Right of the top bar: messages / settings. */
  topRight?: React.ReactNode;
  stats: ProfileStat[];
  /** The row of buttons under the bio (Edit profile and Share, or Follow and Message). */
  actions?: React.ReactNode;
  /** Optional extra row under the buttons (for example small shortcut chips). */
  extra?: React.ReactNode;
}

/**
 * The profile top, laid out the way people already know: the @handle on top, the photo on the left with three counts beside it,
 * name and bio under, then a row of buttons. Used by your own profile and by everyone else's.
 */
export function ProfileHeader({ handle, name, bio, avatar, verified, topLeft, topRight, stats, actions, extra }: ProfileHeaderProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ paddingTop: Math.max(insets.top, 20) + 10, paddingHorizontal: 20, gap: 14 }}>
      <View className="flex-row items-center justify-between" style={{ minHeight: 44, gap: 10 }}>
        <View className="flex-row items-center flex-1" style={{ gap: 10, minWidth: 0 }}>
          {topLeft}
          {handle ? (
            <RNText className="text-ink" numberOfLines={1} style={{ fontFamily: FONT.display, fontSize: 20, flexShrink: 1 }}>
              {handle}
            </RNText>
          ) : null}
        </View>
        <View className="flex-row items-center" style={{ gap: 8 }}>
          {topRight}
        </View>
      </View>

      <View className="flex-row items-center" style={{ gap: 22 }}>
        <UAvatar source={avatar} name={name} size={88} />
        <View className="flex-row flex-1 justify-between">
          {stats.map((s) => (
            <Pressable
              key={s.label}
              accessibilityRole={s.onPress ? 'button' : 'text'}
              accessibilityLabel={`${compactCount(s.value)} ${s.label}`}
              disabled={!s.onPress}
              onPress={s.onPress}
              style={{ alignItems: 'center', minWidth: 56 }}
            >
              <RNText className="text-ink" style={{ fontFamily: FONT.display, fontSize: 19, lineHeight: 24 }}>
                {compactCount(s.value)}
              </RNText>
              <RNText className="text-muted" style={{ fontFamily: FONT.sans, fontSize: 12, marginTop: 2 }}>
                {s.label}
              </RNText>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={{ gap: 3 }}>
        <View className="flex-row items-center" style={{ gap: 6 }}>
          <RNText className="text-ink" numberOfLines={1} style={{ fontFamily: FONT.sansSemi, fontSize: 15, flexShrink: 1 }}>
            {name}
          </RNText>
          {verified ? <Icon name="check" size="sm" color="accent" /> : null}
        </View>
        {bio ? (
          <RNText className="text-ink" style={{ fontFamily: FONT.sans, fontSize: 14, lineHeight: 20 }}>
            {bio}
          </RNText>
        ) : null}
      </View>

      {actions ? (
        <View className="flex-row" style={{ gap: 8 }}>
          {actions}
        </View>
      ) : null}
      {extra}
    </View>
  );
}
