import type { MealExtra, MenuDish, Restaurant } from '@/types/order';

export const RESTAURANTS: Restaurant[] = [
  {
    id: 'smash',
    name: 'Smash & Co.',
    photo: 'burger',
    rating: 4.7,
    ratingCount: '1.2k',
    distanceKm: 1.2,
    etaMin: [25, 35],
    hygiene: 5,
    sponsored: true,
    deliveryPence: 199,
    freeDeliveryOverPence: 1500,
    categories: ['Popular', 'Burgers', 'Sides', 'Drinks'],
  },
];

const BURGER_EXTRAS: MealExtra[] = [
  { id: 'fries', label: 'Fries', pricePence: 280 },
  { id: 'drink', label: 'Drink', pricePence: 190 },
];

export const MENU: MenuDish[] = [
  {
    id: 'double-smash',
    restaurantId: 'smash',
    name: 'Double smash burger',
    description: 'Two patties, cheese, pickles',
    photo: 'burger',
    pricePence: 950,
    kcal: 880,
    prepMin: 25,
    portionG: 260,
    carbsG: 48,
    per100g: { fat: 18.5, saturates: 8.1, sugars: 4.2, salt: 1.6 },
    allergens: ['milk', 'gluten', 'mustard'],
    category: 'Burgers',
    extras: BURGER_EXTRAS,
  },
  {
    id: 'crispy-chicken',
    restaurantId: 'smash',
    name: 'Crispy chicken burger',
    description: 'Buttermilk thigh, slaw',
    photo: 'chicken',
    pricePence: 890,
    kcal: 760,
    prepMin: 25,
    portionG: 250,
    carbsG: 55,
    per100g: { fat: 14.2, saturates: 3.4, sugars: 6.1, salt: 1.2 },
    allergens: ['milk', 'gluten', 'egg'],
    category: 'Burgers',
    extras: BURGER_EXTRAS,
  },
  {
    id: 'grilled-bowl',
    restaurantId: 'smash',
    name: 'Grilled chicken bowl',
    description: 'Grilled thigh, greens, grains',
    photo: 'powerbowl',
    pricePence: 1020,
    kcal: 540,
    prepMin: 25,
    portionG: 380,
    carbsG: 52,
    per100g: { fat: 2.9, saturates: 0.8, sugars: 1.9, salt: 0.5 },
    allergens: ['sesame'],
    category: 'Popular',
    extras: [{ id: 'drink', label: 'Drink', pricePence: 190 }],
  },
];

export const RIDER = { name: 'Tunde', rating: 4.9, photo: 'rider' } as const;
