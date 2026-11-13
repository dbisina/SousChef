import React, { useMemo } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { RatingTag } from '@/components/ui';
import { rateNutrition, type NutrientKey } from '@/lib/nutrition';
import type { MenuDish } from '@/types/order';
import { tagLevel } from './dishInfo';

const ORDER: NutrientKey[] = ['fat', 'saturates', 'salt', 'sugars'];
const COMPACT: NutrientKey[] = ['fat', 'salt', 'sugars'];

interface Props {
  dish: MenuDish;
  /** Show the Low/Medium/High word next to each nutrient (order sheet). */
  withWord?: boolean;
  /** Outline this nutrient (the one that matters most for the user). */
  emphasis?: NutrientKey;
  /** Compact list-row variant: Fat, Salt, Sugars, small tags. */
  small?: boolean;
}

/** Traffic-light nutrition tags for a dish. Word + colour, never colour alone. */
export function NutritionTags({ dish, withWord, emphasis, small }: Props) {
  const { t } = useTranslation();
  const ratings = useMemo(() => rateNutrition(dish.per100g), [dish.per100g]);
  const keys = small ? COMPACT : ORDER;
  const name = (k: NutrientKey) => t(`nutrition.${k}`, k.charAt(0).toUpperCase() + k.slice(1));
  const word = (k: NutrientKey) => t(`nutrition.${ratings[k].level}`, ratings[k].word);
  const spoken = keys.map((k) => `${name(k)} ${word(k).toLowerCase()}`).join(', ');

  return (
    <View
      accessible
      accessibilityLabel={spoken}
      className="flex-row flex-wrap"
      style={{ gap: small ? 4 : 8 }}
    >
      {keys.map((k) => (
        <RatingTag
          key={k}
          small={small}
          level={tagLevel(ratings[k])}
          emphasis={emphasis === k}
          label={withWord ? `${name(k)} ${word(k)}` : name(k)}
        />
      ))}
    </View>
  );
}
