import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Appearance, ColorSchemeName } from 'react-native';

const APPEARANCE_KEY = '@souschef_appearance';

export type ThemeOption = 'light' | 'dark' | 'system';
export type AccentColor = 'orange' | 'blue' | 'green' | 'purple' | 'pink';

export interface AppearanceSettings {
  theme: ThemeOption;
  accentColor: AccentColor;
  compactMode: boolean;
  showCalories: boolean;
}

const defaultSettings: AppearanceSettings = {
  theme: 'system',
  accentColor: 'orange',
  compactMode: false,
  showCalories: true,
};

// ── Accent color palettes ────────────────────────────────────────────
export interface AccentPalette {
  50: string;
  100: string;
  200: string;
  300: string;
  400: string;
  500: string; // primary
  600: string;
  700: string;
  800: string;
  900: string;
}

export const ACCENT_PALETTES: Record<AccentColor, AccentPalette> = {
  orange: {
    50: '#FFF7ED', 100: '#FFEDD5', 200: '#FED7AA', 300: '#FDBA74',
    400: '#FB923C', 500: '#F97316', 600: '#EA580C', 700: '#C2410C',
    800: '#9A3412', 900: '#7C2D12',
  },
  blue: {
    50: '#EFF6FF', 100: '#DBEAFE', 200: '#BFDBFE', 300: '#93C5FD',
    400: '#60A5FA', 500: '#3B82F6', 600: '#2563EB', 700: '#1D4ED8',
    800: '#1E40AF', 900: '#1E3A8A',
  },
  green: {
    50: '#F0FDF4', 100: '#DCFCE7', 200: '#BBF7D0', 300: '#86EFAC',
    400: '#4ADE80', 500: '#22C55E', 600: '#16A34A', 700: '#15803D',
    800: '#166534', 900: '#14532D',
  },
  purple: {
    50: '#FAF5FF', 100: '#F3E8FF', 200: '#E9D5FF', 300: '#D8B4FE',
    400: '#C084FC', 500: '#8B5CF6', 600: '#7C3AED', 700: '#6D28D9',
    800: '#5B21B6', 900: '#4C1D95',
  },
  pink: {
    50: '#FDF2F8', 100: '#FCE7F3', 200: '#FBCFE8', 300: '#F9A8D4',
    400: '#F472B6', 500: '#EC4899', 600: '#DB2777', 700: '#BE185D',
    800: '#9D174D', 900: '#831843',
  },
};

// ── Theme color tokens ───────────────────────────────────────────────
export interface ThemeColors {
  // Backgrounds
  background: string;
  surface: string;
  surfaceSecondary: string;
  surfaceTertiary: string;
  // Text
  text: string;
  textSecondary: string;
  textTertiary: string;
  textMuted: string;
  textInverse: string;
  // Borders
  border: string;
  borderSecondary: string;
  // Icon
  icon: string;
  iconSecondary: string;
  // Accent (from palette)
  accent: string;
  accentLight: string;
  accentDark: string;
  accentBg: string;
  accentSurface: string;
  // The full palette for fine control
  palette: AccentPalette;
  // Tab bar
  tabBarFill: string;
  tabBarInactive: string;
  // Status bar
  statusBarStyle: 'light' | 'dark';
  // Misc
  isDark: boolean;
  skeleton: string;
  overlay: string;
  refreshTint: string;
  gradientBg: [string, string, string];
}

const buildColors = (
  theme: 'light' | 'dark',
  accent: AccentColor
): ThemeColors => {
  const p = ACCENT_PALETTES[accent];
  const isDark = theme === 'dark';

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
    statusBarStyle: isDark ? 'light' : 'dark',
    isDark,
    skeleton: isDark ? '#292524' : '#E7E5E4',
    overlay: isDark ? 'rgba(0,0,0,0.7)' : 'rgba(0,0,0,0.5)',
    refreshTint: p[500],
    gradientBg: isDark
      ? ['#0A0A0A', '#1C1917', '#0A0A0A']
      : ['#FFF7ED', '#FEF3C7', '#ECFCCB'],
  };
};

// ── Store ────────────────────────────────────────────────────────────
interface ThemeStore {
  settings: AppearanceSettings;
  effectiveTheme: 'light' | 'dark';
  colors: ThemeColors;
  isLoaded: boolean;

  loadSettings: () => Promise<void>;
  updateSetting: <K extends keyof AppearanceSettings>(
    key: K,
    value: AppearanceSettings[K]
  ) => Promise<void>;
}

const getEffective = (
  theme: ThemeOption,
  system: ColorSchemeName
): 'light' | 'dark' => {
  if (theme === 'system') return system === 'dark' ? 'dark' : 'light';
  return theme;
};

export const useThemeStore = create<ThemeStore>((set, get) => {
  const initialEffective = getEffective('system', Appearance.getColorScheme());

  return {
    settings: defaultSettings,
    effectiveTheme: initialEffective,
    colors: buildColors(initialEffective, defaultSettings.accentColor),
    isLoaded: false,

    loadSettings: async () => {
      try {
        const stored = await AsyncStorage.getItem(APPEARANCE_KEY);
        if (stored) {
          const parsed: AppearanceSettings = JSON.parse(stored);
          const effective = getEffective(parsed.theme, Appearance.getColorScheme());
          set({
            settings: parsed,
            effectiveTheme: effective,
            colors: buildColors(effective, parsed.accentColor),
            isLoaded: true,
          });
        } else {
          set({ isLoaded: true });
        }
      } catch {
        set({ isLoaded: true });
      }
    },

    updateSetting: async (key, value) => {
      const { settings } = get();
      const newSettings = { ...settings, [key]: value };
      try {
        await AsyncStorage.setItem(APPEARANCE_KEY, JSON.stringify(newSettings));
      } catch {}
      const effective = getEffective(
        newSettings.theme,
        Appearance.getColorScheme()
      );
      set({
        settings: newSettings,
        effectiveTheme: effective,
        colors: buildColors(effective, newSettings.accentColor),
      });
    },
  };
});

/** Convenience hook – returns just the computed color tokens. */
export const useThemeColors = () => useThemeStore((s) => s.colors);

