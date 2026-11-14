import React, { memo } from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { ICONS, type IconName } from './icons';
import { useColor, type ColorKey } from './tone';

export type IconSize = 'sm' | 'md' | 'lg' | number;

// tokens.css: .i 20/1.6, .i.sm 15/1.8, .i.lg 28/1.5
const SIZES = {
  sm: { px: 15, stroke: 1.8 },
  md: { px: 20, stroke: 1.6 },
  lg: { px: 28, stroke: 1.5 },
} as const;

interface IconProps {
  name: IconName;
  size?: IconSize;
  /** Token name (e.g. 'muted'), fixed color name (e.g. 'paper') or raw color. Defaults to ink. */
  color?: ColorKey | (string & {});
  /** Fill the glyph (design `.i.f`), e.g. a liked heart. */
  filled?: boolean;
  /** Decorative by default; pass a label when the icon stands alone. */
  accessibilityLabel?: string;
}

function IconBase({ name, size = 'md', color, filled, accessibilityLabel }: IconProps) {
  const def = ICONS[name] as (typeof ICONS)[IconName];
  const solid = filled || ('solid' in def && def.solid === true);
  const resolved = useColor(color, 'ink');
  const spec = typeof size === 'number' ? { px: size, stroke: 1.6 } : SIZES[size];
  return (
    <Svg
      width={spec.px}
      height={spec.px}
      viewBox="0 0 24 24"
      fill="none"
      // react-native-svg web renders a raw <svg>; make it positioned so it paints above the absolute Glass layers.
      style={{ position: 'relative' }}
      accessible={!!accessibilityLabel}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={accessibilityLabel ? 'image' : undefined}
    >
      {def.shapes.map((s, i) => {
        const common = {
          stroke: resolved,
          strokeWidth: spec.stroke,
          strokeLinecap: 'round' as const,
          strokeLinejoin: 'round' as const,
          fill: solid ? resolved : 'none',
        };
        if (s.t === 'p') return <Path key={i} d={s.d} {...common} />;
        if (s.t === 'c') return <Circle key={i} cx={s.cx} cy={s.cy} r={s.r} {...common} />;
        return <Rect key={i} x={s.x} y={s.y} width={s.w} height={s.h} rx={'rx' in s ? s.rx : undefined} {...common} />;
      })}
    </Svg>
  );
}

export const Icon = memo(IconBase);
