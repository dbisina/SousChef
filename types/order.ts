// Traffic-light ratings for foods (used by the meal log), not an ordering feature.
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
