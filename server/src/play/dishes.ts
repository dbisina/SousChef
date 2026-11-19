import type { MkDifficulty } from '@shared';

/** A secret dish for Mystery Kitchen: the basket everyone cooks from, and three hints that get warmer. */
export interface MkDish {
  name: string;
  difficulty: MkDifficulty;
  basket: string[];
  /// Warmest last. Buying one costs the player points.
  hints: [string, string, string];
  /** How to cook it, step by step, never naming the dish (the built-in list has none; the pool writes them). */
  steps?: string[];
  /** A real photo of the finished dish, when there is one. */
  photoUrl?: string | null;
  /** The pool row it came from, so what is learned about it (steps, photo) can be kept. */
  poolId?: string;
}

export const DISHES: MkDish[] = [
  { name: 'Jollof Rice', difficulty: 'medium', basket: ['long-grain rice', 'tomatoes', 'red bell peppers', 'scotch bonnet', 'onion', 'thyme', 'curry powder'], hints: ['A one-pot grain dish from West Africa', 'The base is a blended red pepper sauce', 'The best part is the smoky bottom of the pot'] },
  { name: 'Egusi Soup', difficulty: 'hard', basket: ['ground melon seeds', 'spinach', 'palm oil', 'stockfish', 'onion', 'crayfish', 'chili'], hints: ['A thick soup eaten with a swallow', 'Made from ground seeds that clump into curds', 'Often eaten with pounded yam'] },
  { name: 'Shakshuka', difficulty: 'easy', basket: ['eggs', 'tomatoes', 'red bell pepper', 'onion', 'garlic', 'cumin', 'paprika'], hints: ['Eggs cooked in a pan, not scrambled', 'They poach right in a spiced tomato sauce', 'Served with bread to mop up the sauce'] },
  { name: 'Spaghetti Carbonara', difficulty: 'medium', basket: ['spaghetti', 'eggs', 'pecorino', 'cured pork cheek', 'black pepper'], hints: ['A Roman pasta with very few ingredients', 'The sauce is made without cream', 'Egg and cheese turn silky off the heat'] },
  { name: 'Chicken Fried Rice', difficulty: 'easy', basket: ['cooked rice', 'chicken', 'eggs', 'peas', 'carrots', 'soy sauce', 'spring onion'], hints: ['Better made with yesterday\'s rice', 'Cooked fast over very high heat', 'A wok classic with egg scrambled through it'] },
  { name: 'Beef Tacos', difficulty: 'easy', basket: ['minced beef', 'corn tortillas', 'onion', 'lime', 'coriander', 'cumin', 'chili'], hints: ['Handheld and folded', 'Seasoned meat in a soft shell', 'Finished with lime and fresh coriander'] },
  { name: 'Pad Thai', difficulty: 'hard', basket: ['rice noodles', 'prawns', 'eggs', 'bean sprouts', 'tamarind', 'peanuts', 'lime', 'fish sauce'], hints: ['A street-food noodle dish', 'Sweet, sour and salty from tamarind and fish sauce', 'Topped with crushed peanuts'] },
  { name: 'Chicken Curry', difficulty: 'medium', basket: ['chicken thighs', 'onion', 'garlic', 'ginger', 'tomatoes', 'garam masala', 'yoghurt', 'turmeric'], hints: ['A slow-simmered spiced gravy', 'Built on onion, ginger and garlic', 'Best with rice or flatbread'] },
  { name: 'Pancakes', difficulty: 'easy', basket: ['flour', 'milk', 'eggs', 'butter', 'sugar', 'baking powder'], hints: ['A breakfast stack', 'Cooked on a flat griddle', 'Bubbles on top tell you when to flip'] },
  { name: 'Ratatouille', difficulty: 'hard', basket: ['aubergine', 'courgette', 'tomatoes', 'bell peppers', 'onion', 'garlic', 'thyme', 'olive oil'], hints: ['A vegetable dish from the south of France', 'Everything is sliced thin and layered or stewed', 'Made famous by an animated rat chef'] },
  { name: 'Mushroom Risotto', difficulty: 'hard', basket: ['arborio rice', 'mushrooms', 'stock', 'white wine', 'parmesan', 'onion', 'butter'], hints: ['A creamy rice dish with no cream', 'Stock is added a ladle at a time', 'Stirring brings out the starch'] },
  { name: 'Vegetable Stir-fry', difficulty: 'easy', basket: ['broccoli', 'carrots', 'bell pepper', 'soy sauce', 'garlic', 'ginger', 'sesame oil'], hints: ['Quick and crunchy', 'Cooked in a hot wok in minutes', 'Tossed in a soy and ginger sauce'] },
];

/** A twist everyone must follow. */
export const TWISTS = [
  'Use only one pan',
  'No salt until the very end',
  'Plate it as if for a restaurant',
  'Make it vegetarian if you can',
  'Add one ingredient of your own',
  'Cook with the lights low and a timer on',
  'Use a spice from the back of the cupboard',
];

/** A random dish of the difficulty, and a twist. `random` is a number in [0, 1). */
export function pickDish(difficulty: MkDifficulty, random: () => number = Math.random): { dish: MkDish; twist: string } {
  const pool = DISHES.filter((d) => d.difficulty === difficulty);
  const from = pool.length > 0 ? pool : DISHES;
  const dish = from[Math.min(from.length - 1, Math.floor(random() * from.length))] as MkDish;
  const twist = TWISTS[Math.min(TWISTS.length - 1, Math.floor(random() * TWISTS.length))] as string;
  return { dish, twist };
}
