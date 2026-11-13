import React from 'react';
import { Pressable, Share, Text as RNText, View, type StyleProp, type ViewStyle } from 'react-native';
import { SAMPLE } from '@/assets/sample';
import { Glass, Icon, Title, UAvatar, type IconName, type PhotoSource } from '@/components/ui';
import { FONT } from '@/components/ui/fonts';
import { FIXED } from '@/stores/themeStore';
import { compactCount } from '@/lib/timeAgo';
import type { PhotoRef } from '@/types/social';

/** Bundled sample photo for a PhotoRef. */
export const photoOf = (ref: PhotoRef): PhotoSource => SAMPLE[ref] as PhotoSource;

/** Opens the native share sheet; failures (cancelled, unsupported) are ignored. */
export function shareText(message: string) {
  Share.share({ message }).catch(() => undefined);
}

interface AuthorRowProps {
  photo: PhotoRef;
  name: string;
  /** Second line, muted. */
  sub?: string;
  size?: number;
  onPress?: () => void;
  right?: React.ReactNode;
}

/** .ph-h: avatar + handle + muted second line, with an optional trailing slot. */
export function AuthorRow({ photo, name, sub, size = 44, onPress, right }: AuthorRowProps) {
  const body = (
    <View className="flex-row items-center flex-1" style={{ gap: 10, minWidth: 0, minHeight: 44 }}>
      <UAvatar source={photoOf(photo)} name={name} size={size} />
      <View style={{ flexShrink: 1, minWidth: 0 }}>
        <Title numberOfLines={1}>{name}</Title>
        {sub ? (
          <RNText className="text-muted" numberOfLines={1} style={{ fontFamily: FONT.sans, fontSize: 12 }}>
            {sub}
          </RNText>
        ) : null}
      </View>
    </View>
  );
  return (
    <View className="flex-row items-center justify-between" style={{ gap: 10 }}>
      {onPress ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={name}
          onPress={onPress}
          className="flex-1"
          style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
        >
          {body}
        </Pressable>
      ) : (
        body
      )}
      {right}
    </View>
  );
}

interface ActionProps {
  icon: IconName;
  label: string;
  count?: number | string;
  active?: boolean;
  onPress?: () => void;
}

/** One entry of .acts: icon + optional count. */
export function Action({ icon, label, count, active, onPress }: ActionProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: !!active }}
      onPress={onPress}
      hitSlop={6}
      className="flex-row items-center"
      style={({ pressed }) => ({ gap: 6, minHeight: 44, opacity: pressed ? 0.6 : 1 })}
    >
      <Icon name={icon} filled={active} color={active ? 'accent' : 'ink'} />
      {count !== undefined ? (
        <RNText className="text-ink" style={{ fontFamily: FONT.sansMedium, fontSize: 13 }}>
          {typeof count === 'number' ? compactCount(count) : count}
        </RNText>
      ) : null}
    </Pressable>
  );
}

/** Dark glass caption bar pinned to the bottom of a photo (.gbar.glk). Children carry their own paper-colored text. */
export function DarkBar({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <Glass
      dark
      style={[
        {
          position: 'absolute',
          left: 8,
          right: 8,
          bottom: 8,
          borderRadius: 24,
          paddingVertical: 12,
          paddingStart: 16,
          paddingRight: 12,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          zIndex: 1,
        },
        style,
      ]}
    >
      {children}
    </Glass>
  );
}

/** Title + sub pair for use inside DarkBar / dark scrims. */
export function BarText({ title, sub, size = 17 }: { title: string; sub?: string; size?: number }) {
  return (
    <View className="flex-1" style={{ minWidth: 0, gap: 2 }}>
      <RNText numberOfLines={1} style={{ fontFamily: FONT.display, fontSize: size, color: FIXED.paper, letterSpacing: -0.17 }}>
        {title}
      </RNText>
      {sub ? (
        <RNText numberOfLines={1} style={{ fontFamily: FONT.sans, fontSize: 12, color: FIXED.captionSub }}>
          {sub}
        </RNText>
      ) : null}
    </View>
  );
}

/** Pill that reads like a button on a photo (.tag.gl.lg): light glass, night text. */
export function GlassPill({
  label,
  icon,
  onPress,
  height = 36,
}: {
  label: string;
  icon?: IconName;
  onPress?: () => void;
  height?: number;
}) {
  const body = (
    <Glass style={{ height, borderRadius: height / 2, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      {icon ? <Icon name={icon} size="sm" color="night" /> : null}
      <RNText numberOfLines={1} style={{ fontFamily: FONT.sansMedium, fontSize: 13, color: FIXED.night }}>
        {label}
      </RNText>
    </Glass>
  );
  if (!onPress) return body;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={4}>
      {body}
    </Pressable>
  );
}
