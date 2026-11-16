import React, { useEffect } from 'react';
import { useColorScheme } from 'nativewind';
import { Appearance } from 'react-native';
import { useThemeStore } from '@/stores/themeStore';
import { ToneScope } from '@/components/ui/tone';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { setColorScheme } = useColorScheme();
  const { effectiveTheme, isLoaded, loadSettings, settings, syncSystemTheme } = useThemeStore();

  // Load persisted settings on mount
  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // Apply effective theme to NativeWind (legacy `dark:` classes) whenever it changes
  useEffect(() => {
    if (isLoaded) {
      setColorScheme(effectiveTheme);
    }
  }, [effectiveTheme, isLoaded, setColorScheme]);

  // Follow the OS scheme while the setting is 'system'
  useEffect(() => {
    if (settings.theme !== 'system') return;
    const listener = Appearance.addChangeListener(() => syncSystemTheme());
    return () => listener.remove();
  }, [settings.theme, syncSystemTheme]);

  // Root token scope so portals/toasts/screens without <Screen> still resolve semantic colors.
  return <ToneScope tone={effectiveTheme}>{children}</ToneScope>;
}
