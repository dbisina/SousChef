/**
 * i18n configuration using react-i18next
 *
 * - 20 supported languages with lazy-loaded translation files
 * - Device language auto-detection via expo-localization
 * - Persistent language preference via AsyncStorage
 * - AI handles dynamic content (recipes) separately via languageStore
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ── Static translation imports ──
import en from '@/locales/en.json';
import es from '@/locales/es.json';
import fr from '@/locales/fr.json';
import de from '@/locales/de.json';
import it from '@/locales/it.json';
import pt from '@/locales/pt.json';
import zh from '@/locales/zh.json';
import ja from '@/locales/ja.json';
import ko from '@/locales/ko.json';
import ar from '@/locales/ar.json';
import hi from '@/locales/hi.json';
import tr from '@/locales/tr.json';
import ru from '@/locales/ru.json';
import nl from '@/locales/nl.json';
import pl from '@/locales/pl.json';
import vi from '@/locales/vi.json';
import th from '@/locales/th.json';
import id from '@/locales/id.json';
import sv from '@/locales/sv.json';
import uk from '@/locales/uk.json';

// ── Language metadata ──
export interface LanguageConfig {
  code: string;
  name: string;
  nativeName: string;
  flag: string;
  rtl?: boolean;
}

export const SUPPORTED_LANGUAGES: LanguageConfig[] = [
  { code: 'en', name: 'English', nativeName: 'English', flag: '🇺🇸' },
  { code: 'es', name: 'Spanish', nativeName: 'Español', flag: '🇪🇸' },
  { code: 'fr', name: 'French', nativeName: 'Français', flag: '🇫🇷' },
  { code: 'de', name: 'German', nativeName: 'Deutsch', flag: '🇩🇪' },
  { code: 'it', name: 'Italian', nativeName: 'Italiano', flag: '🇮🇹' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português', flag: '🇧🇷' },
  { code: 'zh', name: 'Chinese', nativeName: '中文', flag: '🇨🇳' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語', flag: '🇯🇵' },
  { code: 'ko', name: 'Korean', nativeName: '한국어', flag: '🇰🇷' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', flag: '🇸🇦', rtl: true },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', flag: '🇮🇳' },
  { code: 'tr', name: 'Turkish', nativeName: 'Türkçe', flag: '🇹🇷' },
  { code: 'ru', name: 'Russian', nativeName: 'Русский', flag: '🇷🇺' },
  { code: 'nl', name: 'Dutch', nativeName: 'Nederlands', flag: '🇳🇱' },
  { code: 'pl', name: 'Polish', nativeName: 'Polski', flag: '🇵🇱' },
  { code: 'vi', name: 'Vietnamese', nativeName: 'Tiếng Việt', flag: '🇻🇳' },
  { code: 'th', name: 'Thai', nativeName: 'ไทย', flag: '🇹🇭' },
  { code: 'id', name: 'Indonesian', nativeName: 'Bahasa Indonesia', flag: '🇮🇩' },
  { code: 'sv', name: 'Swedish', nativeName: 'Svenska', flag: '🇸🇪' },
  { code: 'uk', name: 'Ukrainian', nativeName: 'Українська', flag: '🇺🇦' },
];

export const getLanguageByCode = (code: string): LanguageConfig | undefined =>
  SUPPORTED_LANGUAGES.find((l) => l.code === code);

export const isRTL = (code: string): boolean =>
  SUPPORTED_LANGUAGES.find((l) => l.code === code)?.rtl || false;

// ── Detect device language ──
const getDeviceLanguage = (): string => {
  try {
    const locales = getLocales();
    const deviceLang = locales[0]?.languageCode || 'en';
    if (SUPPORTED_LANGUAGES.some((l) => l.code === deviceLang)) {
      return deviceLang;
    }
    return 'en';
  } catch {
    return 'en';
  }
};

// ── Persistence ──
const LANGUAGE_KEY = '@souschef_language';

export const getSavedLanguage = async (): Promise<string> => {
  try {
    const saved = await AsyncStorage.getItem(LANGUAGE_KEY);
    if (saved && SUPPORTED_LANGUAGES.some((l) => l.code === saved)) {
      return saved;
    }
    return getDeviceLanguage();
  } catch {
    return getDeviceLanguage();
  }
};

export const saveLanguage = async (code: string): Promise<void> => {
  try {
    await AsyncStorage.setItem(LANGUAGE_KEY, code);
  } catch {
    // silent fail
  }
};

// ── i18next init ──
const resources = {
  en: { translation: en },
  es: { translation: es },
  fr: { translation: fr },
  de: { translation: de },
  it: { translation: it },
  pt: { translation: pt },
  zh: { translation: zh },
  ja: { translation: ja },
  ko: { translation: ko },
  ar: { translation: ar },
  hi: { translation: hi },
  tr: { translation: tr },
  ru: { translation: ru },
  nl: { translation: nl },
  pl: { translation: pl },
  vi: { translation: vi },
  th: { translation: th },
  id: { translation: id },
  sv: { translation: sv },
  uk: { translation: uk },
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: getDeviceLanguage(),
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
    react: {
      useSuspense: false,
    },
  });

// Load saved language preference on startup
getSavedLanguage().then((lang) => {
  if (lang !== i18n.language) {
    i18n.changeLanguage(lang);
  }
});

export default i18n;
