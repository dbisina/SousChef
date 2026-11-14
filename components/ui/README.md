# components/ui

Two generations live side by side until Phase 5 cleanup.

- Old (NativeWind `dark:` pairs, Ionicons): Button, IconButton, Input, SearchInput, Card, PressableCard, GlassCard, Badge, Avatar, AvatarGroup, Loading, Empty, Toast...
- New (SousChef 2.0, semantic tokens): everything in the "2.0 primitives" block of `index.ts`.

Naming: a new primitive keeps the plain name unless an old export has it. Collisions get a `U` prefix:
UButton, UIconButton, UCard, UInput, UBadge, UAvatar, USwitch (RN Switch). Phase 5 drops the old ones and the prefix.

Rules for screens: compose primitives, no hex, no `dark:`, no Ionicons. Colors are Tailwind semantic classes
(`bg-ground bg-surface text-ink text-muted bg-accent border-divider bg-tag-o text-rating-lo-fg`).
Icons: `<Icon name="heart" />` (names in `icons.ts`); colors take token names (`color="muted"`).
Forced dark: `<Screen tone="dark">` (re-tones the whole subtree; black UCard/PhotoCard do the same locally).
Photos: `SAMPLE` from `@/assets/sample`. Visual check: route `/dev/primitives` (dev builds only).
