import type { DailyDishPuzzle, Game, MKPlayer, MKDishSecret, MKTwist } from '@/types/play';

export const GAMES: Game[] = [
  {
    id: 'mystery-kitchen',
    name: 'Mystery Kitchen',
    tagline: 'Cook from ingredients alone, then see the real dish.',
    photo: 'plating',
    featured: true,
    minPlayers: 2,
    maxPlayers: 10,
  },
  { id: 'basket-battle', name: 'Basket Battle', tagline: 'Use every mystery item', photo: 'garlic' },
  { id: 'plate-off', name: 'Plate Off', tagline: 'Best plating wins', photo: 'plating' },
  { id: 'balanced-plate', name: 'Balanced Plate', tagline: 'Fits your health targets', photo: 'bowl' },
  { id: 'guess-the-dish', name: 'Guess the Dish', tagline: 'Party game, no cooking', photo: 'tomatoes' },
];

export const GAMES_TOTAL = 14;

export const DAILY_PUZZLES: DailyDishPuzzle[] = [
  {
    answer: 'Ramen',
    aliases: ['spicy egg ramen', 'egg ramen'],
    clues: ['Wheat noodles', 'Soft egg', 'Spring onion', 'Chilli oil', 'Pork belly', 'Nori'],
  },
  {
    answer: 'Chicken katsu',
    aliases: ['katsu', 'chicken katsu curry', 'katsu curry'],
    clues: ['Chicken breast', 'Panko', 'Short-grain rice', 'Curry sauce', 'Cabbage', 'Pickled ginger'],
  },
  {
    answer: 'Margherita pizza',
    aliases: ['pizza margherita', 'margherita'],
    clues: ['Flour', 'Tomato', 'Mozzarella', 'Basil', 'Olive oil', 'Yeast'],
  },
  {
    answer: 'Jollof rice',
    aliases: ['jollof'],
    clues: ['Long-grain rice', 'Tomato', 'Scotch bonnet', 'Onion', 'Thyme', 'Bay leaf'],
  },
  {
    answer: 'Pad thai',
    aliases: ['phad thai'],
    clues: ['Rice noodles', 'Tamarind', 'Peanuts', 'Bean sprouts', 'Egg', 'Lime'],
  },
];

/** Starting state seed: the 9-day streak shown on the Play hub. */
export const SAMPLE_STREAK = { current: 9, best: 9 };

export const MK_SECRET: MKDishSecret = {
  name: 'Chicken katsu bowl',
  description: 'Crispy chicken over rice with curry sauce',
  photo: 'ricebowl',
  ingredients: [
    { label: 'Eggs · 2', photo: 'eggs' },
    { label: 'Chicken · 2', photo: 'chicken' },
    { label: 'Garlic, spices', photo: 'garlic' },
  ],
  hints: [
    'It’s crispy and served over rice.',
    'The sauce is mild and golden.',
    'It comes from Japan.',
  ],
};

export const MK_TWIST: MKTwist = {
  title: 'Twist!',
  text: 'Swap one ingredient with the player on your left.',
};

export const MK_PLAYERS: MKPlayer[] = [
  { id: 'p-you', name: 'You', avatar: 'chef', isYou: true, isHost: true, status: 'joined' },
  { id: 'p-dayo', name: 'Dayo', avatar: 'p_knit', status: 'joined' },
  { id: 'p-ama', name: 'Ama', avatar: 'p_woman', status: 'joined' },
  { id: 'p-tolu', name: 'Tolu', avatar: 'p_man', guest: true, status: 'joining' },
];

/** Reveal-screen sample: scores already include judge feedback. */
export const MK_SAMPLE_RESULT = [
  { playerId: 'p-dayo', judgeScore: 86, hintsUsed: 0, timeLeftSec: 0, plate: 'ricebowl', comment: 'Crisp coating, right sauce. Rice a little dry.' },
  { playerId: 'p-ama', judgeScore: 84, hintsUsed: 1, timeLeftSec: 0, plate: 'bowl', comment: 'Great sauce, crumb a little pale.' },
  { playerId: 'p-you', judgeScore: 78, hintsUsed: 1, timeLeftSec: 0, plate: 'salmon', comment: 'Good crust. Plating could be cleaner.' },
  { playerId: 'p-tolu', judgeScore: 68, hintsUsed: 0, timeLeftSec: 0, plate: 'pasta', comment: 'Nicely seasoned, sauce needs time.' },
] as const;
