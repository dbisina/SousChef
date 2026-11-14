import type {
  Nutrients100g,
  Rating,
  RatingLevel,
  TrafficTone,
  NutritionRatings,
} from '@/types/order';

/**
 * UK front-of-pack traffic-light thresholds, grams per 100 g of food.
 * Low: at or below `low`. High: above `high`. Medium: in between.
 */
export const TRAFFIC_LIGHT_100G = {
  fat: { low: 3, high: 17.5 },
  saturates: { low: 1.5, high: 5 },
  sugars: { low: 5, high: 22.5 },
  salt: { low: 0.3, high: 1.5 },
} as const;

export type NutrientKey = keyof typeof TRAFFIC_LIGHT_100G;

const WORD: Record<RatingLevel, string> = { low: 'Low', medium: 'Medium', high: 'High' };
const TONE: Record<RatingLevel, TrafficTone> = { low: 'green', medium: 'amber', high: 'red' };

export function rateNutrient(key: NutrientKey, gPer100g: number): Rating {
  const t = TRAFFIC_LIGHT_100G[key];
  const level: RatingLevel = gPer100g <= t.low ? 'low' : gPer100g > t.high ? 'high' : 'medium';
  return { level, word: WORD[level], tone: TONE[level] };
}

export function rateNutrition(per100g: Nutrients100g): NutritionRatings {
  return {
    fat: rateNutrient('fat', per100g.fat),
    saturates: rateNutrient('saturates', per100g.saturates),
    sugars: rateNutrient('sugars', per100g.sugars),
    salt: rateNutrient('salt', per100g.salt),
  };
}

export function formatPrice(pence: number): string {
  const sign = pence < 0 ? '-' : '';
  const abs = Math.abs(Math.round(pence));
  return `${sign}£${(abs / 100).toFixed(2)}`;
}
