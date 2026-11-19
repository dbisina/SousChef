# The enplace brand in the app

The source is the owner's brand kit in `mobile/assets/enplace-brand-assets` (wordmark, icon and lockup, light and dark, SVG and
PNG and more; see its README). The name is always written lowercase. Colours: orange full stop `#ff6b35`, near-black `#0b0b0b`,
off-white `#fafafa`, warm cream `#fbf7f1`.

**Generated from the kit** by `node scripts/build-brand-assets.mjs` (run it again whenever the kit changes), in `mobile/`:

| File | Used for |
|---|---|
| `assets/icon.png` | iOS app icon: 1024 px, full square, opaque, no alpha (iOS rounds the corners itself) |
| `assets/adaptive-icon.png` | Android adaptive icon foreground (artwork inside the central safe zone, transparent); background `#0b0b0b` |
| `assets/adaptive-icon-monochrome.png` | Android 13 themed icon (one colour) |
| `assets/notification-icon.png` | Android status-bar icon: white on transparent (colour icons show as a white square); accent `#ff6b35` |
| `assets/splash-icon.png` | the still splash: the wordmark on a transparent square over `#0b0b0b` |
| `assets/favicon.png`, `public/favicon.*`, `admin/public/favicon.*` | web |
| `assets/brand/wordmark-*.svg`, `lib/brandWordmark.ts` | the wordmark as vector inside the app (`components/brand/Wordmark.tsx`) and where its dot sits |

**In the app:** the Home header and the onboarding top use the wordmark; the opening animation (`components/ui/BrandSplash.tsx`)
starts from the still splash picture so nothing jumps. The first launch: "mise" slides in beside the logo (reading "mise enplace"),
holds, tucks away and the dot beats; later launches are just the beat. Login, onboarding and the health report show `assets/icon.png`.

Things to know: the splash and icon changes need a new native build to appear on a phone (they are baked into the app binary);
`expo-image` draws the SVGs.
