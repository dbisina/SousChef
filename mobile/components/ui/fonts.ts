/** Loaded font family names (see useFonts in app/_layout.tsx). Keep in sync with tailwind.config.js fontFamily. */
export const FONT = {
  display: 'Outfit_500Medium',
  displayRegular: 'Outfit_400Regular',
  displaySemi: 'Outfit_600SemiBold',
  sans: 'Inter_400Regular',
  sansMedium: 'Inter_500Medium',
  sansSemi: 'Inter_600SemiBold',
  /** A connected script, used only for the word "mise" in the opening animation (the logo itself is the brand kit's vector). */
  script: 'Satisfy_400Regular',
} as const;
