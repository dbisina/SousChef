import React from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { SAMPLE } from '@/assets/sample';
import { Muted, Thumb, Title, UIconButton, Body } from '@/components/ui';
import { formatPrice } from '@/lib/nutrition';
import type { MenuDish } from '@/types/order';
import { NutritionTags } from './NutritionTags';

interface Props {
  dish: MenuDish;
  /** The dish is already in the order: the add button turns black. */
  inCart?: boolean;
  onPress: () => void;
}

/** Menu row (Restaurant.html .rows > div): thumb, name, blurb, traffic-light tags, price, add button. */
export function DishRow({ dish, inCart, onPress }: Props) {
  const { t } = useTranslation();
  return (
    <View className="flex-row items-center" style={{ gap: 14, height: 115 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={dish.name}
        onPress={onPress}
        style={({ pressed }) => ({
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 14,
          minWidth: 0,
          opacity: pressed ? 0.75 : 1,
        })}
      >
        <Thumb source={SAMPLE[dish.photo]} name={dish.name} size={72} />
        <View className="flex-1" style={{ minWidth: 0, height: 115, paddingTop: 1 }}>
          <View style={{ gap: 3 }}>
            <Title numberOfLines={1}>{dish.name}</Title>
            <Muted small numberOfLines={1}>
              {dish.description}
            </Muted>
          </View>
          <View style={{ marginTop: 6 }}>
            <NutritionTags dish={dish} small />
          </View>
          <Body style={{ fontSize: 12, marginTop: 26 }}>{formatPrice(dish.pricePence)}</Body>
        </View>
      </Pressable>
      <UIconButton
        icon="plus"
        tone={inCart ? 'black' : 'default'}
        label={t('restaurant.add', 'Add {{name}}', { name: dish.name })}
        onPress={onPress}
      />
    </View>
  );
}
