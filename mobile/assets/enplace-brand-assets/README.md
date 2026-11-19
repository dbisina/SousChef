# enplace — complete logo export package

Logo created from the selected connected-script enplace brandboard. SVGs contain real vector paths, not embedded bitmap images. The orange period is drawn as its own vector circle. Original raster lettering was smoothed and reconstructed into scale-independent cubic Bezier outlines; the files are not embedded screenshots.

## Included

Each of the **3 parts** has **4 theme/background treatments** and **6 formats** (72 exports total):

- **wordmark:** joined lowercase `enplace` and orange period.
- **icon:** rounded-square app icon and `en` with orange period. The **dark/solid** export is the primary app icon, with a near-black square background. For transparent icon files, the square is deliberately absent, leaving only the en + dot artwork.
- **lockup:** app icon plus joined wordmark. Its square app icon remains visible even when the rest of the canvas is transparent.

Treatments per part: `dark_solid`, `dark_transparent`, `light_solid`, `light_transparent`.

Formats: **SVG, PNG, JPG, WebP, ICO, WebM**.

## Colors

- Orange full stop: `#ff6b35`
- Near-black: `#0b0b0b`
- Off-white: `#fafafa`
- Warm cream: `#fbf7f1`

## Notes

- `*_transparent.png`, `*.webp`, and `*.svg` preserve transparency. Transparent WebMs use VP9 alpha, which depends on player/browser support.
- JPEG does not support transparency: transparent-treatment JPGs are **flattened** against their matching dark or warm-cream brand background.
- ICO packages multiple favicon-sized representations. For production favicons, prefer **icon/enplace_icon_dark_solid.ico**.
- Each WebM is a 1-second stationary (nonanimated) logo clip. It is not an animation; this format was requested for compatibility with video workflows.
- Transparent dark logo exports are light ink, suited to dark surfaces; transparent light exports are dark ink, suited to light surfaces.
- All text stays lowercase; all lettering is traced as outlines, so no font installation or licensing is required to render the SVG.
