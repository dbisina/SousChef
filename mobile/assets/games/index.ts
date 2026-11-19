// Card art for the games, made for the app (generated with ChatGPT from our own prompts and resized for the app). Fixed app
// imagery like the food photos: it never depends on an account. Metro needs literal require paths.
export const GAME_ART = {
  mystery_kitchen: require('./mystery_kitchen.jpg'),
  daily_dish: require('./daily_dish.jpg'),
  kitchen_trivia: require('./kitchen_trivia.jpg'),
  myth_or_fact: require('./myth_or_fact.jpg'),
  name_that_cuisine: require('./name_that_cuisine.jpg'),
  odd_one_out: require('./odd_one_out.jpg'),
  technique_match: require('./technique_match.jpg'),
  flavour_pairing: require('./flavour_pairing.jpg'),
  step_sorter: require('./step_sorter.jpg'),
  ingredient_match: require('./ingredient_match.jpg'),
} as const;

export type GameArtName = keyof typeof GAME_ART;

/** The art for a solo game id from the server (trivia, myth, cuisine, odd, technique, pairing, sorter, match). */
export const SOLO_GAME_ART: Record<string, GameArtName> = {
  trivia: 'kitchen_trivia',
  myth: 'myth_or_fact',
  cuisine: 'name_that_cuisine',
  odd: 'odd_one_out',
  technique: 'technique_match',
  pairing: 'flavour_pairing',
  sorter: 'step_sorter',
  match: 'ingredient_match',
};
