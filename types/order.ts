import type { PhotoRef } from './social';

export type RatingLevel = 'low' | 'medium' | 'high';
export type TrafficTone = 'green' | 'amber' | 'red';

export interface Rating {
  level: RatingLevel;
  /** "Low" | "Medium" | "High" */
  word: string;
  tone: TrafficTone;
}

/** Grams per 100 g of food. */
export interface Nutrients100g {
  fat: number;
  saturates: number;
  sugars: number;
  salt: number;
}

export interface NutritionRatings {
  fat: Rating;
  saturates: Rating;
  sugars: Rating;
  salt: Rating;
}

export interface MealExtra {
  id: string;
  label: string;
  pricePence: number;
}

export interface MenuDish {
  id: string;
  restaurantId: string;
  name: string;
  description: string;
  photo: PhotoRef;
  /** Price in pence. */
  pricePence: number;
  kcal: number;
  prepMin: number;
  portionG: number;
  carbsG: number;
  per100g: Nutrients100g;
  allergens: string[];
  category: string;
  /** Optional add-ons for "Make it a meal". */
  extras: MealExtra[];
}

export interface Restaurant {
  id: string;
  name: string;
  photo: PhotoRef;
  rating: number;
  ratingCount: string;
  distanceKm: number;
  etaMin: [number, number];
  hygiene: 0 | 1 | 2 | 3 | 4 | 5;
  sponsored?: boolean;
  deliveryPence: number;
  freeDeliveryOverPence?: number;
  categories: string[];
}

export interface CartLine {
  id: string;
  dishId: string;
  qty: number;
  extraIds: string[];
  logToHealth: boolean;
}

export const ORDER_STATUSES = ['Confirmed', 'Preparing', 'On the way', 'Arrived'] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export interface OrderLineSnapshot {
  dishId: string;
  name: string;
  qty: number;
  extras: string[];
  unitPence: number;
}

export interface Order {
  id: string;
  /** Display number, e.g. "2841" */
  number: string;
  restaurantId: string;
  restaurantName: string;
  lines: OrderLineSnapshot[];
  subtotalPence: number;
  deliveryPence: number;
  totalPence: number;
  status: OrderStatus;
  placedAt: string;
  /** Minutes remaining, updated at each status change. */
  etaMin: number;
  rider: { name: string; rating: number; photo: PhotoRef };
  loggedToHealth: boolean;
  /** Demo order: no real payment or delivery. */
  demo: true;
}
