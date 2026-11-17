// Hand-written starter content: the official enplace accounts, what they post, and the first Daily Dish puzzles.
// Nothing here names a real person. Photos reuse the recipe photos (web links); there is no upload involved.
import type { DailyPuzzleInput } from '@shared';
import moreHouses from '../../seed/houses.json';

/** Which official account owns a dish: the key of an entry in HOUSES. */
export type HouseKey = string;

const ORIGINAL_HOUSES: Record<string, { handle: string; legacyHandle: string; displayName: string; bio: string }> = {
  kitchen: { handle: 'enplace_kitchen', legacyHandle: 'souschef_kitchen', displayName: 'enplace Kitchen', bio: 'Everyday dinners made properly. An official enplace account.' },
  baking: { handle: 'enplace_baking', legacyHandle: 'souschef_baking', displayName: 'enplace Baking', bio: 'Cakes, bakes and breakfasts that work first time. An official enplace account.' },
  quick: { handle: 'enplace_quick', legacyHandle: 'souschef_quick', displayName: 'enplace Quick Meals', bio: 'Good food in 30 minutes or less. An official enplace account.' },
  vegan: { handle: 'enplace_vegan', legacyHandle: 'souschef_green', displayName: 'enplace Green', bio: 'Plant-based cooking that never feels like a compromise. An official enplace account.' },
  street: { handle: 'enplace_street', legacyHandle: 'souschef_street', displayName: 'enplace Street Food', bio: 'Classics from the world’s markets and street stalls, made at home. An official enplace account.' },
  healthy: { handle: 'enplace_healthy', legacyHandle: 'souschef_healthy', displayName: 'enplace Healthy', bio: 'Balanced, easy and full of flavour. An official enplace account.' },
  family: { handle: 'enplace_family', legacyHandle: 'souschef_family', displayName: 'enplace Family Table', bio: 'Comfort food the whole table will eat. An official enplace account.' },
  desserts: { handle: 'enplace_desserts', legacyHandle: 'souschef_sweet', displayName: 'enplace Desserts', bio: 'Puddings, pastries and sweet endings. An official enplace account.' },
};

/** The eight first accounts above (their old souschef_ handles are renamed in place by the seed) plus the themed accounts in seed/houses.json. */
export const HOUSES: Record<HouseKey, { handle: string; legacyHandle: string; displayName: string; bio: string }> = {
  ...ORIGINAL_HOUSES,
  ...Object.fromEntries((moreHouses as { key: string; handle: string; legacyHandle: string; displayName: string; bio: string }[]).map((h) => [h.key, { handle: h.handle, legacyHandle: h.legacyHandle, displayName: h.displayName, bio: h.bio }])),
};

/** What each official account says about a recipe it shares (by recipe title). */
export const HOUSE_POSTS: { recipe: string; title: string; caption: string }[] = [
  { recipe: 'Classic Chicken Stir-Fry', title: 'Stir-fry in 30 minutes', caption: 'Get the pan properly hot before the chicken goes in, then keep everything moving. Dinner is on the table before the rice cools.' },
  { recipe: 'Creamy Mushroom Risotto', title: 'The patient risotto', caption: 'Add the stock a ladle at a time and stir often. The creaminess comes from the rice, not from extra cream.' },
  { recipe: 'Grilled Salmon with Asparagus', title: 'Salmon, no stress', caption: 'Pat the fillets dry and let them sit undisturbed until they release from the pan. Lemon at the very end.' },
  { recipe: 'Fluffy Blueberry Pancakes', title: 'Weekend pancakes', caption: 'Do not over-mix: a lumpy batter makes a fluffy pancake. Rest it for five minutes while the pan heats.' },
  { recipe: 'Chocolate Lava Cake', title: 'A dessert that looks hard', caption: 'It is mostly timing. Take them out when the edges are set and the middle still wobbles.' },
  { recipe: 'Homemade Tiramisu', title: 'Make it the day before', caption: 'Tiramisu tastes better after a night in the fridge. Dip the ladyfingers quickly so they stay light.' },
  { recipe: 'Avocado Toast with Poached Egg', title: 'Five-minute breakfast', caption: 'A splash of vinegar in the water keeps the egg together. Chilli flakes are optional but encouraged.' },
  { recipe: 'Spicy Beef Tacos', title: 'Taco night, sorted', caption: 'Brown the beef hard for flavour, then warm the shells for a minute. Lots of cilantro.' },
  { recipe: 'Vegan Buddha Bowl', title: 'A bowl with everything', caption: 'Roast the vegetables, cook the grains once, and build bowls all week. Dressing makes it.' },
];

/** The first Daily Dish puzzles. The first clue is the hardest, the last gives it away. */
export const PUZZLES: DailyPuzzleInput[] = [
  { answer: 'Jollof Rice', aliases: ['jollof', 'party jollof'], clues: ['A one-pot party favourite across West Africa', 'Its colour comes from tomatoes, red peppers and a long, slow simmer', 'The smoky crust at the bottom of the pot is the best part', 'Nigeria and Ghana both claim to make it best'] },
  { answer: 'Tiramisu', clues: ['An Italian dessert with no baking at all', 'Layers of sponge fingers dipped in coffee', 'Mascarpone cream and a dusting of cocoa on top', 'Its name means "pick me up"'] },
  { answer: 'Pad Thai', aliases: ['phad thai'], clues: ['A street-food noodle dish', 'Stir-fried rice noodles with egg, tofu or prawns', 'Tamarind gives it a sweet-sour tang; peanuts go on top', 'Thailand\'s best-known noodle dish'] },
  { answer: 'Margherita Pizza', aliases: ['margherita', 'pizza margherita'], clues: ['Born in Naples and named after a queen', 'Only three toppings, which are also the colours of the flag', 'Tomato, mozzarella and fresh basil', 'The simplest classic pizza'] },
  { answer: 'Ramen', clues: ['A bowl that can take a day to make', 'Wheat noodles in a rich, savoury broth', 'Often topped with a soft egg, pork and spring onion', 'Japan\'s famous noodle soup'] },
  { answer: 'Guacamole', aliases: ['guac'], clues: ['Aztecs made an early version of it', 'Mashed, with lime juice, onion and cilantro', 'Always the first thing to go at a party', 'Avocado is the star'] },
  { answer: 'Paella', clues: ['Named after the wide pan it is cooked in', 'The best part is the crispy rice layer, the socarrat', 'Saffron makes the rice golden', 'Spain\'s famous rice dish, often with seafood'] },
  { answer: 'Butter Chicken', aliases: ['murgh makhani'], clues: ['A restaurant favourite that started as a way to use leftovers', 'Chicken first marinated in yoghurt and spices', 'A creamy, mildly spiced tomato sauce', 'Served with naan or rice'] },
  { answer: 'Sushi', clues: ['Rice is the heart of it, not the fish', 'Seasoned with vinegar, sugar and salt', 'Rolled in seaweed or pressed under fish', 'Often eaten with soy sauce, wasabi and ginger'] },
  { answer: 'Croissant', clues: ['Dozens of buttery layers', 'Made by folding butter into dough again and again', 'A crescent-shaped French breakfast', 'Best eaten warm with coffee'] },
  { answer: 'Shakshuka', clues: ['A one-pan breakfast eaten across North Africa and the Middle East', 'Eggs poached in a spiced sauce', 'Tomatoes, peppers and cumin', 'Scoop it up with bread'] },
  { answer: 'Pho', clues: ['A bowl that simmers for hours', 'Clear broth scented with star anise, cinnamon and charred ginger', 'Rice noodles, thin slices of beef, fresh herbs', 'Vietnam\'s famous noodle soup'] },
  { answer: 'Moussaka', clues: ['A baked dish with layers', 'Aubergine, spiced minced meat and a tomato sauce', 'Topped with a thick creamy béchamel', 'A Greek classic'] },
  { answer: 'Egusi Soup', aliases: ['egusi'], clues: ['A thick soup from Nigeria', 'Thickened with ground melon seeds', 'Often cooked with leafy greens, palm oil and assorted meat', 'Eaten with pounded yam or eba'] },
];
