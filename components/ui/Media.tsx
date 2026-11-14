import React from 'react';
import { Pressable, StyleSheet, Text as RNText, View, type ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { FIXED } from '@/stores/themeStore';
import { FONT } from './fonts';
import { Icon } from './Icon';
import { useTokens } from './tone';
import type { PhotoSource } from './PhotoCard';

interface UAvatarProps {
  source?: PhotoSource | null;
  /** Used for initials fallback and the accessible name. */
  name: string;
  size?: number;
  /** Rounded-square thumbnail (.th) instead of a circle. */
  square?: boolean;
}

/** .av / .th: circular (or 18px-radius square) photo with initials fallback. */
export function UAvatar({ source, name, size = 44, square }: UAvatarProps) {
  const radius = square ? Math.round(size * 0.3) : size / 2;
  const initials = name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('');
  return (
    <View
      accessibilityLabel={name}
      accessibilityRole="image"
      className="bg-surface-3 items-center justify-center overflow-hidden"
      style={{ width: size, height: size, borderRadius: radius }}
    >
      {source ? (
        <Image source={source} style={StyleSheet.absoluteFill} contentFit="cover" accessible={false} />
      ) : (
        <RNText className="text-muted" style={{ fontFamily: FONT.display, fontSize: size * 0.36 }}>
          {initials}
        </RNText>
      )}
    </View>
  );
}

interface AvatarStackProps {
  people: { name: string; source?: PhotoSource | null }[];
  size?: number;
  max?: number;
}

/** .stack: overlapping 30px avatars with a ground-colored ring. */
export function AvatarStack({ people, size = 30, max = 5 }: AvatarStackProps) {
  const shown = people.slice(0, max);
  return (
    <View
      accessibilityLabel={people.map((p) => p.name).join(', ')}
      className="flex-row"
    >
      {shown.map((p, i) => (
        <View
          key={`${p.name}-${i}`}
          className="border-2 border-ground bg-ground"
          style={{ marginLeft: i === 0 ? -2 : -12, borderRadius: (size + 4) / 2 }}
        >
          <UAvatar source={p.source} name={p.name} size={size} />
        </View>
      ))}
    </View>
  );
}

interface StoryRingProps {
  source: PhotoSource;
  name: string;
  seen?: boolean;
  /** Show the orange + badge (own story). */
  add?: boolean;
  onPress?: () => void;
}

/** .st: 68px story avatar with orange (unseen) or grey (seen) ring and a label. */
export function StoryRing({ source, name, seen, add, onPress }: StoryRingProps) {
  const tk = useTokens();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${name}${seen ? ', seen' : ''}${add ? ', add story' : ''}`}
      onPress={onPress}
      style={{ width: 68, alignItems: 'center', gap: 6, minHeight: 44 }}
    >
      <View
        className={seen ? 'bg-seen' : 'bg-accent'}
        style={{ width: 68, height: 68, borderRadius: 34, padding: 3, alignItems: 'center', justifyContent: 'center' }}
      >
        <View style={{ width: 62, height: 62, borderRadius: 31, overflow: 'hidden', borderWidth: 3, borderColor: tk.ground }}>
          <Image source={source} style={StyleSheet.absoluteFill} contentFit="cover" accessible={false} />
        </View>
        {add ? (
          <View
            className="bg-accent border-2 border-ground items-center justify-center"
            style={{ position: 'absolute', right: -2, bottom: -2, width: 24, height: 24, borderRadius: 12 }}
          >
            <Icon name="plus" size="sm" color="accent-ink" />
          </View>
        ) : null}
      </View>
      <RNText className="text-ink" numberOfLines={1} style={{ fontFamily: FONT.sans, fontSize: 12 }}>
        {name}
      </RNText>
    </Pressable>
  );
}

interface BookCoverProps {
  source?: PhotoSource;
  title: string;
  kicker?: string;
  width?: number;
  height?: number;
  onPress?: () => void;
}

/** .cover: book spine radius (8 / 20), photo, dark fade, title and small kicker. */
export function BookCover({ source, title, kicker, width = 120, height = 168, onPress }: BookCoverProps) {
  const frame: ViewStyle = {
    width,
    height,
    borderTopLeftRadius: 8,
    borderBottomLeftRadius: 8,
    borderTopRightRadius: 20,
    borderBottomRightRadius: 20,
    overflow: 'hidden',
    shadowColor: FIXED.shadow,
    shadowOpacity: 0.18,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 14 },
    elevation: 6,
  };
  const body = (
    <View className="bg-night" style={frame}>
      {source ? <Image source={source} style={StyleSheet.absoluteFill} contentFit="cover" accessible={false} /> : null}
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(0,0,0,0.28)', 'rgba(0,0,0,0)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.08, y: 0 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(0,0,0,0.1)', 'rgba(0,0,0,0.72)']}
        style={StyleSheet.absoluteFill}
      />
      <View style={{ position: 'absolute', top: 14, bottom: 14, left: 16, right: 12, justifyContent: 'space-between' }}>
        <RNText
          style={{ fontFamily: FONT.sansMedium, fontSize: 10, letterSpacing: 1.2, textTransform: 'uppercase', color: FIXED.paper, opacity: 0.85 }}
          numberOfLines={1}
        >
          {kicker ?? ''}
        </RNText>
        <RNText
          numberOfLines={3}
          style={{ fontFamily: FONT.display, fontSize: 17, lineHeight: 19, letterSpacing: -0.17, color: FIXED.paper }}
        >
          {title}
        </RNText>
      </View>
    </View>
  );
  if (!onPress) return body;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={onPress}>
      {body}
    </Pressable>
  );
}

interface BubbleProps {
  children: string;
  side: 'me' | 'them';
  /** .tick delivery text under a sent bubble ("Seen"). */
  tick?: string;
}

/** .bub: chat bubble, 22 radius with a 6px tail corner. */
export function Bubble({ children, side, tick }: BubbleProps) {
  const me = side === 'me';
  return (
    <View style={{ alignSelf: me ? 'flex-end' : 'flex-start', maxWidth: '78%', gap: 4 }}>
      <View
        className={me ? 'bg-ink' : 'bg-surface-3'}
        style={{
          paddingVertical: 10,
          paddingHorizontal: 14,
          borderRadius: 22,
          borderBottomRightRadius: me ? 6 : 22,
          borderBottomLeftRadius: me ? 22 : 6,
        }}
      >
        <RNText className={me ? 'text-ink-inverse' : 'text-ink'} style={{ fontFamily: FONT.sans, fontSize: 14, lineHeight: 20 }}>
          {children}
        </RNText>
      </View>
      {tick ? (
        <RNText className="text-muted self-end" style={{ fontFamily: FONT.sans, fontSize: 11 }}>
          {tick}
        </RNText>
      ) : null}
    </View>
  );
}

/** Convenience: thumbnail used in list rows (.th, 60px, 18 radius). */
export function Thumb({ source, name, size = 60 }: { source?: PhotoSource | null; name: string; size?: number }) {
  return <UAvatar source={source} name={name} size={size} square />;
}
