// The app's own fixed photography: ingredients and dishes used for Meal Plan, Pantry, Shopping and cookbook covers.
// These are part of the app (they never change per account); people's pictures always come from the server.
// Metro needs literal require paths.
export const PHOTOS = {
  avocado: require('./avocado.jpg'),
  beef: require('./beef.jpg'),
  bowl: require('./bowl.jpg'),
  broccoli: require('./broccoli.jpg'),
  brownie: require('./brownie.jpg'),
  chicken: require('./chicken.jpg'),
  cookbook: require('./cookbook.jpg'),
  eggs: require('./eggs.jpg'),
  garlic: require('./garlic.jpg'),
  gnocchi: require('./gnocchi.jpg'),
  greens: require('./greens.jpg'),
  grocery: require('./grocery.jpg'),
  pancakes: require('./pancakes.jpg'),
  pasta: require('./pasta.jpg'),
  penne: require('./penne.jpg'),
  pizza: require('./pizza.jpg'),
  plating: require('./plating.jpg'),
  powerbowl: require('./powerbowl.jpg'),
  ramen: require('./ramen.jpg'),
  ricebowl: require('./ricebowl.jpg'),
  salad: require('./salad.jpg'),
  salmon: require('./salmon.jpg'),
  spinach: require('./spinach.jpg'),
  tacos: require('./tacos.jpg'),
  tacos2: require('./tacos2.jpg'),
  toast: require('./toast.jpg'),
  tomatoes: require('./tomatoes.jpg'),
} as const;

export type PhotoName = keyof typeof PHOTOS;
