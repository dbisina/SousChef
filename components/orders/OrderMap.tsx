import React from 'react';
import { View, useWindowDimensions } from 'react-native';
import { useTranslation } from 'react-i18next';
import Svg, { Path, Rect } from 'react-native-svg';
import { Icon, useColor, type IconName } from '@/components/ui';
import type { OrderStatus } from '@/types/order';

/** Design canvas (OrderTracking.html): 390 x 440. */
const W = 390;
const H = 440;

const HOME = { x: 90, y: 330 };
const SHOP = { x: 300, y: 108 };
const ROUTE = 'M90 330 C 140 300, 150 230, 200 210 S 270 150, 300 110';
/** Rider position on the dotted route per status. Null = not on the road yet. */
const RIDER: Record<OrderStatus, { x: number; y: number } | null> = {
  Confirmed: null,
  Preparing: null,
  'On the way': { x: 200, y: 212 },
  Arrived: null,
};

/** Road bands from the design: [left, top, width, height, rotation deg]. */
const ROADS: [number, number, number, number, number][] = [
  [-40, 120, 520, 22, -12],
  [140, -40, 22, 560, 18],
  [-30, 300, 520, 16, 8],
  [255, 0, 16, 480, 0],
];

interface PinProps {
  x: number;
  y: number;
  size: number;
  icon: IconName;
  fill: 'bg-night' | 'bg-accent' | 'bg-paper';
  glyph: 'paper' | 'night';
  label: string;
  halo?: boolean;
}

function Pin({ x, y, size, icon, fill, glyph, label, halo }: PinProps) {
  const ring = size + 16;
  return (
    <View
      accessible
      accessibilityLabel={label}
      pointerEvents="none"
      style={{ position: 'absolute', left: x - ring / 2, top: y - ring / 2, width: ring, height: ring, alignItems: 'center', justifyContent: 'center' }}
    >
      {halo ? (
        <View className="bg-accent" style={{ position: 'absolute', width: ring, height: ring, borderRadius: ring / 2, opacity: 0.2 }} />
      ) : null}
      <View className={`items-center justify-center ${fill}`} style={{ width: size, height: size, borderRadius: size / 2 }}>
        <Icon name={icon} size="sm" color={glyph} />
      </View>
    </View>
  );
}

/** Drawn tracking map (react-native-svg, no map SDK): roads, dotted route, restaurant / rider / home pins. */
export function OrderMap({ status }: { status: OrderStatus }) {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const base = useColor('surface-3');
  const road = useColor('ground');
  const route = useColor('ink');

  // Same "cover" scaling as the svg's preserveAspectRatio so pins stay on the roads.
  const s = Math.max(width / W, 1);
  const ox = (width - W * s) / 2;
  const oy = (H - H * s) / 2;
  const at = (p: { x: number; y: number }) => ({ x: ox + p.x * s, y: oy + p.y * s });

  const rider = RIDER[status];
  const shop = at(SHOP);
  const home = at(HOME);
  const rp = rider ? at(rider) : null;

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={t('orders.track.mapA11y', 'Map showing the restaurant, your rider and your home')}
      className="bg-surface-3 overflow-hidden"
      style={{ position: 'absolute', top: 0, left: 0, right: 0, height: H }}
    >
      <Svg width={width} height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice">
        <Rect x={-200} y={-200} width={W + 400} height={H + 400} fill={base} />
        {ROADS.map(([l, tp, w, h, deg], i) => (
          <Rect
            key={i}
            x={l}
            y={tp}
            width={w}
            height={h}
            fill={road}
            transform={`rotate(${deg} ${l + w / 2} ${tp + h / 2})`}
          />
        ))}
        <Path d={ROUTE} fill="none" stroke={route} strokeWidth={4} strokeLinecap="round" strokeDasharray="1 9" />
      </Svg>
      <Pin x={shop.x} y={shop.y} size={40} icon="store" fill="bg-night" glyph="paper" label={t('orders.track.pinRestaurant', 'Restaurant')} />
      <Pin x={home.x} y={home.y} size={40} icon="home" fill="bg-paper" glyph="night" label={t('orders.track.pinHome', 'Home')} />
      {rp ? (
        <Pin x={rp.x} y={rp.y} size={44} icon="bike" fill="bg-accent" glyph="night" label={t('orders.track.pinRider', 'Rider')} halo />
      ) : null}
    </View>
  );
}
