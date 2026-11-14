import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Appearance, ColorSchemeName } from 'react-native';

const APPEARANCE_KEY = '@souschef_appearance';

export type ThemeOption = 'light' | 'dark' | 'system';
export type ThemeMode = 'light' | 'dark';
/** @deprecated The accent picker was dropped in 2.0 (orange only). Kept so persisted settings and old screens still type-check. */
export type AccentColor = 'orange' | 'blue' | 'green' | 'purple' | 'pink';

export interface AppearanceSettings {
  theme: ThemeOption;
  /** @deprecated ignored, accent is always orange */
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

// ── THE token table ──────────────────────────────────────────────────
// Single source for every semantic color. Values come from docs/redesign/tokens.css.
// The same numbers live as CSS variables in global.css (static fallback) and are
// pushed at runtime through NativeWind `vars()` (see components/ui/tone.tsx).
// Keep global.css in sync when editing this table.
export const TOKEN_NAMES = [
  'ground', 'surface', 'surface-2', 'surface-3', 'ink', 'ink-inverse', 'muted', 'subtle',
  'divider', 'track', 'line', 'raise', 'seen', 'accent', 'accent-ink', 'accent-text',
  'tag-o-bg', 'tag-o-fg', 'tag-g-bg', 'tag-g-fg', 'tag-r-bg', 'tag-r-fg',
  'rating-lo-bg', 'rating-lo-fg', 'rating-lo-dot',
  'rating-md-bg', 'rating-md-fg', 'rating-md-dot',
  'rating-hi-bg', 'rating-hi-fg', 'rating-hi-dot',
] as const;
export type TokenName = (typeof TOKEN_NAMES)[number];

const LIGHT: Record<TokenName, string> = {
  ground: '#FFFFFF',
  surface: '#F4F4F4',
  'surface-2': '#F4F4F4',
  'surface-3': '#F1F1F1',
  ink: '#0F0F0F',
  'ink-inverse': '#FFFFFF',
  muted: '#6B6B6B',
  subtle: '#9A9A9A',
  divider: '#EFEFEF',
  track: '#EAEAEA',
  line: '#C9C9C9',
  raise: '#FFFFFF',
  seen: '#E2E2E2',
  accent: '#F97316',
  'accent-ink': '#0F0F0F',
  'accent-text': '#C2410C',
  'tag-o-bg': '#FFF0E5', 'tag-o-fg': '#9A3412',
  'tag-g-bg': '#EDF3E8', 'tag-g-fg': '#365224',
  'tag-r-bg': '#FDECEA', 'tag-r-fg': '#9F2A1C',
  'rating-lo-bg': '#EDF3E8', 'rating-lo-fg': '#365224', 'rating-lo-dot': '#4C7A35',
  'rating-md-bg': '#FFF0E5', 'rating-md-fg': '#9A3412', 'rating-md-dot': '#E8770F',
  'rating-hi-bg': '#FDECEA', 'rating-hi-fg': '#9F2A1C', 'rating-hi-dot': '#C93A27',
};

const DARK: Record<TokenName, string> = {
  ...LIGHT,
  ground: '#0B0B0B',
  surface: '#161616',
  'surface-2': '#1A1A1A',
  'surface-3': '#1F1F1F',
  ink: '#F4F4F4',
  'ink-inverse': '#0B0B0B',
  muted: '#A3A3A3',
  subtle: '#7A7A7A',
  divider: '#222222',
  track: '#2A2A2A',
  line: '#4A4A4A',
  raise: '#2A2A2A',
  seen: '#2A2A2A',
  'accent-text': '#FB923C',
};

export const TOKEN_HEX: Record<ThemeMode, Record<TokenName, string>> = { light: LIGHT, dark: DARK };

/** Colors that never change with the theme (black/white/glass/overlays). */
export const FIXED = {
  night: '#0F0F0F',
  night2: '#1C1C1C',
  paper: '#FFFFFF',
  accent: '#F97316',
  placeholder: '#7A7A7A',
  scrim: 'rgba(0,0,0,0.45)',
  glass: 'rgba(255,255,255,0.82)',
  glassDark: 'rgba(15,15,15,0.42)',
  glassEdge: 'rgba(255,255,255,0.14)',
  photoFadeFrom: 'rgba(0,0,0,0)',
  photoFadeTo: 'rgba(0,0,0,0.74)',
  photoFadeTop: 'rgba(0,0,0,0.35)',
  photoFadeBottom: 'rgba(0,0,0,0.78)',
  captionSub: 'rgba(255,255,255,0.82)',
  shadow: '#000000',
  skeletonLight: '#E7E5E4',
} as const;

const hexToChannels = (hex: string): string => {
  const h = hex.replace('#', '');
  return `${parseInt(h.slice(0, 2), 16)} ${parseInt(h.slice(2, 4), 16)} ${parseInt(h.slice(4, 6), 16)}`;
};

/** CSS-variable map ("--ground": "255 255 255") for NativeWind `vars()`. */
export const tokenChannels = (mode: ThemeMode): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const name of TOKEN_NAMES) out[`--${name}`] = hexToChannels(TOKEN_HEX[mode][name]);
  return out;
};

// ── Legacy color object (useThemeColors) ─────────────────────────────
// Old screens read these names. Values are derived from the token table above.
export interface AccentPalette {
  50: string; 100: string; 200: string; 300: string; 400: string;
  500: string; 600: string; 700: string; 800: string; 900: string;
}

/** Orange scale kept for legacy `colors.palette` consumers. */
const ORANGE_PALETTE: AccentPalette = {
  50: '#FFF7ED', 100: '#FFEDD5', 200: '#FED7AA', 300: '#FDBA74',
  400: '#FB923C', 500: '#F97316', 600: '#EA580C', 700: '#C2410C',
  800: '#9A3412', 900: '#7C2D12',
};

export interface ThemeColors {
  background: string;
  surface: string;
  surfaceSecondary: string;
  surfaceTertiary: string;
  text: string;
  textSecondary: string;
  textTertiary: string;
  textMuted: string;
  textInverse: string;
  border: string;
  borderSecondary: string;
  icon: string;
  iconSecondary: string;
  accent: string;
  accentLight: string;
  accentDark: string;
  accentBg: string;
  accentSurface: string;
  palette: AccentPalette;
  tabBarFill: string;
  tabBarInactive: string;
  statusBarStyle: 'light' | 'dark';
  isDark: boolean;
  skeleton: string;
  overlay: string;
  refreshTint: string;
  gradientBg: [string, string, string];
  /** Full new-system token set as hex, keyed by token name. */
  tokens: Record<TokenName, string>;
}

export const buildColors = (mode: ThemeMode): ThemeColors => {
  const t = TOKEN_HEX[mode];
  const isDark = mode === 'dark';
  return {
    background: t.ground,
    surface: isDark ? t.surface : t.ground,
    surfaceSecondary: t.surface,
    surfaceTertiary: t['surface-3'],
    text: t.ink,
    textSecondary: t.muted,
    textTertiary: t.subtle,
    textMuted: t.subtle,
    textInverse: t['ink-inverse'],
    border: t.divider,
    borderSecondary: t.divider,
    icon: t.ink,
    iconSecondary: t.subtle,
    accent: t.accent,
    accentLight: t.accent,
    accentDark: ORANGE_PALETTE[700],
    accentBg: t['tag-o-bg'],
    accentSurface: t['tag-o-bg'],
    palette: ORANGE_PALETTE,
    tabBarFill: FIXED.night,
    tabBarInactive: t.subtle,
    statusBarStyle: isDark ? 'light' : 'dark',
    isDark,
    skeleton: isDark ? t.track : FIXED.skeletonLight,
    overlay: FIXED.scrim,
    refreshTint: t.accent,
    gradientBg: [t.ground, t.ground, t.ground],
    tokens: t,
  };
};

// ── Store ────────────────────────────────────────────────────────────
interface ThemeStore {
  settings: AppearanceSettings;
  effectiveTheme: ThemeMode;
  colors: ThemeColors;
  isLoaded: boolean;

  loadSettings: () => Promise<void>;
  updateSetting: <K extends keyof AppearanceSettings>(
    key: K,
    value: AppearanceSettings[K]
  ) => Promise<void>;
  /** Re-resolve the effective theme (used when the OS scheme changes under 'system'). */
  syncSystemTheme: () => void;
}

const getEffective = (theme: ThemeOption, system: ColorSchemeName): ThemeMode => {
  if (theme === 'system') return system === 'dark' ? 'dark' : 'light';
  return theme;
};

export const useThemeStore = create<ThemeStore>((set, get) => {
  const initialEffective = getEffective('system', Appearance.getColorScheme());

  return {
    settings: defaultSettings,
    effectiveTheme: initialEffective,
    colors: buildColors(initialEffective),
    isLoaded: false,

    loadSettings: async () => {
      try {
        const stored = await AsyncStorage.getItem(APPEARANCE_KEY);
        if (stored) {
          const parsed: AppearanceSettings = { ...defaultSettings, ...JSON.parse(stored) };
          const effective = getEffective(parsed.theme, Appearance.getColorScheme());
          set({
            settings: parsed,
            effectiveTheme: effective,
            colors: buildColors(effective),
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
      const effective = getEffective(newSettings.theme, Appearance.getColorScheme());
      set({
        settings: newSettings,
        effectiveTheme: effective,
        colors: buildColors(effective),
      });
    },

    syncSystemTheme: () => {
      const { settings } = get();
      const effective = getEffective(settings.theme, Appearance.getColorScheme());
      set({ effectiveTheme: effective, colors: buildColors(effective) });
    },
  };
});

/** Convenience hook – returns just the computed color tokens. */
export const useThemeColors = () => useThemeStore((s) => s.colors);
