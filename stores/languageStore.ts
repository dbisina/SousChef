import { create } from 'zustand';
import i18n from '@/lib/i18n';
import { saveLanguage, SUPPORTED_LANGUAGES, isRTL } from '@/lib/i18n';
import { textModel } from '@/lib/gemini';

interface LanguageState {
  language: string;
  isTranslating: boolean;

  // Actions
  setLanguage: (code: string) => Promise<void>;
  getLanguageName: () => string;
  getNativeLanguageName: () => string;
  isRTL: () => boolean;
  translateRecipeContent: (content: {
    title: string;
    description: string;
    ingredients: { name: string; unit: string }[];
    instructions: string[];
  }) => Promise<{
    title: string;
    description: string;
    ingredients: { name: string; unit: string }[];
    instructions: string[];
  }>;
}

export const useLanguageStore = create<LanguageState>((set, get) => ({
  language: i18n.language || 'en',
  isTranslating: false,

  setLanguage: async (code) => {
    // Change i18next language (this updates all useTranslation hooks)
    await i18n.changeLanguage(code);
    // Persist
    await saveLanguage(code);
    set({ language: code });
  },

  getLanguageName: () => {
    const { language } = get();
    return SUPPORTED_LANGUAGES.find((l) => l.code === language)?.name || 'English';
  },

  getNativeLanguageName: () => {
    const { language } = get();
    return SUPPORTED_LANGUAGES.find((l) => l.code === language)?.nativeName || 'English';
  },

  isRTL: () => isRTL(get().language),

  // AI-powered recipe translation for dynamic content
  translateRecipeContent: async (content) => {
    const { language } = get();
    if (language === 'en') return content;

    const langConfig = SUPPORTED_LANGUAGES.find((l) => l.code === language);
    if (!langConfig) return content;

    set({ isTranslating: true });

    const prompt = `Translate this recipe from English to ${langConfig.name} (${langConfig.nativeName}).
Keep ingredient names recognizable. Use locale-appropriate measurement units.
Return ONLY valid JSON with the same structure. No markdown.

{
  "title": "${content.title}",
  "description": "${content.description.replace(/"/g, '\\"')}",
  "ingredients": [${content.ingredients.map((i) => `{"name": "${i.name.replace(/"/g, '\\"')}", "unit": "${i.unit}"}`).join(', ')}],
  "instructions": [${content.instructions.map((i) => `"${i.replace(/"/g, '\\"')}"`).join(', ')}]
}`;

    try {
      const result = await textModel.generateContent(prompt);
      const response = result.response.text();
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        set({ isTranslating: false });
        return JSON.parse(jsonMatch[0]);
      }
    } catch (error) {
      console.warn('[i18n] Recipe translation failed:', error);
    }

    set({ isTranslating: false });
    return content;
  },
}));
