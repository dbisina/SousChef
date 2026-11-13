/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // SousChef 2.0 semantic tokens: values come from CSS variables (global.css light/dark sets,
        // overridden per subtree by <Screen tone> / ToneScope via NativeWind vars()).
        'ground': 'rgb(var(--ground) / <alpha-value>)',
        'surface': 'rgb(var(--surface) / <alpha-value>)',
        'surface-2': 'rgb(var(--surface-2) / <alpha-value>)',
        'surface-3': 'rgb(var(--surface-3) / <alpha-value>)',
        'ink': 'rgb(var(--ink) / <alpha-value>)',
        'ink-inverse': 'rgb(var(--ink-inverse) / <alpha-value>)',
        'muted': 'rgb(var(--muted) / <alpha-value>)',
        'subtle': 'rgb(var(--subtle) / <alpha-value>)',
        'divider': 'rgb(var(--divider) / <alpha-value>)',
        'track': 'rgb(var(--track) / <alpha-value>)',
        'line': 'rgb(var(--line) / <alpha-value>)',
        'raise': 'rgb(var(--raise) / <alpha-value>)',
        'seen': 'rgb(var(--seen) / <alpha-value>)',
        'accent': 'rgb(var(--accent) / <alpha-value>)',
        'accent-ink': 'rgb(var(--accent-ink) / <alpha-value>)',
        'accent-text': 'rgb(var(--accent-text) / <alpha-value>)',
        // Fixed (theme independent)
        night: '#0F0F0F',
        'night-2': '#1C1C1C',
        paper: '#FFFFFF',
        // Tag tones and nutrition rating levels
        tag: {
          'o': 'rgb(var(--tag-o-bg) / <alpha-value>)',
          'o-fg': 'rgb(var(--tag-o-fg) / <alpha-value>)',
          'g': 'rgb(var(--tag-g-bg) / <alpha-value>)',
          'g-fg': 'rgb(var(--tag-g-fg) / <alpha-value>)',
          'r': 'rgb(var(--tag-r-bg) / <alpha-value>)',
          'r-fg': 'rgb(var(--tag-r-fg) / <alpha-value>)',
        },
        rating: {
          'lo': 'rgb(var(--rating-lo-bg) / <alpha-value>)',
          'lo-fg': 'rgb(var(--rating-lo-fg) / <alpha-value>)',
          'lo-dot': 'rgb(var(--rating-lo-dot) / <alpha-value>)',
          'md': 'rgb(var(--rating-md-bg) / <alpha-value>)',
          'md-fg': 'rgb(var(--rating-md-fg) / <alpha-value>)',
          'md-dot': 'rgb(var(--rating-md-dot) / <alpha-value>)',
          'hi': 'rgb(var(--rating-hi-bg) / <alpha-value>)',
          'hi-fg': 'rgb(var(--rating-hi-fg) / <alpha-value>)',
          'hi-dot': 'rgb(var(--rating-hi-dot) / <alpha-value>)',
        },
        // Warm, appetizing coral palette
        primary: {
          50: '#FFF7ED',
          100: '#FFEDD5',
          200: '#FED7AA',
          300: '#FDBA74',
          400: '#FB923C',
          500: '#F97316', // Main brand - warm coral
          600: '#EA580C',
          700: '#C2410C',
          800: '#9A3412',
          900: '#7C2D12',
        },
        // Warm neutral palette (legacy screens)
        neutral: {
          50: '#FAFAF9',
          100: '#F5F5F4',
          200: '#E7E5E4',
          300: '#D6D3D1',
          400: '#A8A29E',
          500: '#78716C',
          600: '#57534E',
          700: '#44403C',
          800: '#292524',
          900: '#1C1917',
        },
        // Glass effect colors
        glass: {
          white: 'rgba(255, 255, 255, 0.85)',
          light: 'rgba(255, 255, 255, 0.6)',
          subtle: 'rgba(255, 255, 255, 0.4)',
          border: 'rgba(255, 255, 255, 0.3)',
          dark: 'rgba(0, 0, 0, 0.05)',
        },
      },
      fontFamily: {
        // Outfit for display/headings, Inter for body. Each weight is its own loaded family.
        display: ['Outfit_500Medium'],
        'display-regular': ['Outfit_400Regular'],
        'display-semibold': ['Outfit_600SemiBold'],
        sans: ['Inter_400Regular'],
        'sans-medium': ['Inter_500Medium'],
        'sans-semibold': ['Inter_600SemiBold'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      fontSize: {
        // Refined type scale
        'display-xl': ['3rem', { lineHeight: '1.1', letterSpacing: '-0.02em', fontWeight: '700' }],
        'display-lg': ['2.25rem', { lineHeight: '1.2', letterSpacing: '-0.02em', fontWeight: '700' }],
        'display-md': ['1.875rem', { lineHeight: '1.25', letterSpacing: '-0.01em', fontWeight: '600' }],
        'display-sm': ['1.5rem', { lineHeight: '1.3', letterSpacing: '-0.01em', fontWeight: '600' }],
        'body-lg': ['1.125rem', { lineHeight: '1.6', fontWeight: '400' }],
        'body-md': ['1rem', { lineHeight: '1.6', fontWeight: '400' }],
        'body-sm': ['0.875rem', { lineHeight: '1.5', fontWeight: '400' }],
        'caption': ['0.75rem', { lineHeight: '1.4', fontWeight: '500' }],
      },
      borderRadius: {
        '4xl': '2rem',
        '5xl': '2.5rem',
      },
      boxShadow: {
        // Soft, diffused shadows for glass effect
        'glass': '0 8px 32px rgba(0, 0, 0, 0.08)',
        'glass-sm': '0 4px 16px rgba(0, 0, 0, 0.06)',
        'glass-lg': '0 16px 48px rgba(0, 0, 0, 0.12)',
        'glow': '0 0 40px rgba(249, 115, 22, 0.15)',
        'glow-sm': '0 0 20px rgba(249, 115, 22, 0.1)',
        'inner-glow': 'inset 0 1px 1px rgba(255, 255, 255, 0.5)',
      },
      backdropBlur: {
        'glass': '20px',
        'glass-lg': '40px',
      },
      animation: {
        'float': 'float 6s ease-in-out infinite',
        'pulse-soft': 'pulse-soft 2s ease-in-out infinite',
        'shimmer': 'shimmer 2s linear infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        'pulse-soft': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
    },
  },
  plugins: [],
};
