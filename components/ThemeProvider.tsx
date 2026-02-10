import React, { useEffect } from 'react';
import { useColorScheme } from 'nativewind';
import { Appearance } from 'react-native';
import { useThemeStore } from '@/stores/themeStore';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { setColorScheme } = useColorScheme();
  const { effectiveTheme, isLoaded, loadSettings, settings } = useThemeStore();

  // Load persisted settings on mount
  useEffect(() => {
    loadSettings();
  }, []);

  // Apply effective theme to NativeWind whenever it changes
  useEffect(() => {
    if (isLoaded) {
      setColorScheme(effectiveTheme);
    }
  }, [effectiveTheme, isLoaded]);

  // Listen for system color scheme changes when theme is set to 'system'
  useEffect(() => {
    if (settings.theme !== 'system') return;

    const listener = Appearance.addChangeListener(({ colorScheme }) => {
      const effective = colorScheme === 'dark' ? 'dark' : 'light';
      const { settings: s } = useThemeStore.getState();
      const { buildColors } = require('@/stores/themeStore');
      useThemeStore.setState({
        effectiveTheme: effective,
        colors: (() => {
          // Rebuild colors inline from the store helper
          const ACCENT_PALETTES = require('@/stores/themeStore').ACCENT_PALETTES;
          const p = ACCENT_PALETTES[s.accentColor];
          const isDark = effective === 'dark';
          return {
            background: isDark ? '#0A0A0A' : '#FAFAF9',
            surface: isDark ? '#1C1917' : '#FFFFFF',
            surfaceSecondary: isDark ? '#292524' : '#F5F5F4',
            surfaceTertiary: isDark ? '#44403C' : '#E7E5E4',
            text: isDark ? '#FAFAF9' : '#1C1917',
            textSecondary: isDark ? '#A8A29E' : '#57534E',
            textTertiary: isDark ? '#78716C' : '#A8A29E',
            textMuted: isDark ? '#78716C' : '#A8A29E',
            textInverse: isDark ? '#1C1917' : '#FAFAF9',
            border: isDark ? '#44403C' : '#E7E5E4',
            borderSecondary: isDark ? '#292524' : '#F5F5F4',
            icon: isDark ? '#D6D3D1' : '#404040',
            iconSecondary: isDark ? '#78716C' : '#A8A29E',
            accent: p[500],
            accentLight: isDark ? p[400] : p[500],
            accentDark: p[700],
            accentBg: isDark ? p[900] + '30' : p[50],
            accentSurface: isDark ? p[800] + '50' : p[100],
            palette: p,
            tabBarFill: isDark ? '#1C1917' : '#FFFFFF',
            tabBarInactive: isDark ? '#78716C' : '#A8A29E',
            statusBarStyle: isDark ? 'light' as const : 'dark' as const,
            isDark,
            skeleton: isDark ? '#292524' : '#E7E5E4',
            overlay: isDark ? 'rgba(0,0,0,0.7)' : 'rgba(0,0,0,0.5)',
            refreshTint: p[500],
            gradientBg: isDark
              ? ['#0A0A0A', '#1C1917', '#0A0A0A'] as [string, string, string]
              : ['#FFF7ED', '#FEF3C7', '#ECFCCB'] as [string, string, string],
          };
        })(),
      });
    });

    return () => listener.remove();
  }, [settings.theme, settings.accentColor]);

  return <>{children}</>;
}
