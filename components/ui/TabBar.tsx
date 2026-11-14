import React from 'react';
import { Pressable, Text as RNText, View } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from './Icon';
import { FONT } from './fonts';
import { useTone, useTokens } from './tone';
import { FIXED } from '@/stores/themeStore';
import type { IconName } from './icons';

interface Slot {
  /** Tab route name; null for the Create button (opens /create as a modal). */
  route: string | null;
  label: string;
  icon: IconName;
}

const SLOTS: Slot[] = [
  { route: 'index', label: 'Home', icon: 'home' },
  { route: 'kitchen', label: 'Kitchen', icon: 'kitchen' },
  { route: null, label: 'Create', icon: 'plus' },
  { route: 'play', label: 'Play', icon: 'gamepad' },
  { route: 'you', label: 'You', icon: 'user' },
];

/** Hidden tabs light up the visible tab they belong to. */
const PARENT: Record<string, string> = {
  pantry: 'kitchen',
  scan: 'kitchen',
  shopping: 'kitchen',
  mealplan: 'kitchen',
  browse: 'kitchen',
  upload: 'kitchen',
  more: 'you',
  profile: 'you',
};

/**
 * Floating nav pill (tokens.css .nav): 70px, 7px padding, black; dark theme #1C1C1C with a 1px #2A2A2A edge.
 * Active tab = white pill with label; Create = orange circle that opens /create.
 */
export function TabBar({ state, navigation }: BottomTabBarProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const tone = useTone();
  const tokens = useTokens();
  const dark = tone === 'dark';
  const current = state.routes[state.index]?.name ?? 'index';
  const active = PARENT[current] ?? current;
  const bottom = Math.max(insets.bottom - 6, 16);

  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom, alignItems: 'center' }}>
      <View
        accessibilityRole="tablist"
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 2,
          height: 70,
          padding: 7,
          borderRadius: 35,
          backgroundColor: dark ? FIXED.night2 : FIXED.night,
          borderWidth: dark ? 1 : 0,
          borderColor: tokens.track,
          shadowColor: FIXED.shadow,
          shadowOffset: { width: 0, height: 18 },
          shadowOpacity: dark ? 0 : 0.22,
          shadowRadius: 36,
          elevation: dark ? 0 : 12,
        }}
      >
        {SLOTS.map((slot) => {
          if (slot.route === null) {
            return (
              <Pressable
                key="create"
                accessibilityRole="button"
                accessibilityLabel="Create"
                onPress={() => router.push('/create')}
                style={({ pressed }) => ({
                  width: 50,
                  height: 50,
                  marginHorizontal: 4,
                  borderRadius: 25,
                  backgroundColor: FIXED.accent,
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: pressed ? 0.85 : 1,
                })}
              >
                <Icon name="plus" color="night" />
              </Pressable>
            );
          }
          const route = slot.route;
          const focused = active === route;
          const onPress = () => {
            const target = state.routes.find((r) => r.name === route);
            if (!target) return;
            const event = navigation.emit({ type: 'tabPress', target: target.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) navigation.navigate(route);
          };
          return (
            <Pressable
              key={route}
              accessibilityRole="tab"
              accessibilityLabel={slot.label}
              accessibilityState={{ selected: focused }}
              onPress={onPress}
              style={({ pressed }) => ({
                width: focused ? undefined : 52,
                height: 56,
                paddingHorizontal: focused ? 20 : 0,
                borderRadius: 28,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                backgroundColor: focused ? FIXED.paper : 'transparent',
                opacity: pressed ? 0.8 : 1,
              })}
            >
              <Icon name={slot.icon} color={focused ? 'night' : '#9A9A9A'} />
              {focused ? (
                <RNText style={{ fontFamily: FONT.display, fontSize: 14, color: FIXED.night }}>{slot.label}</RNText>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
