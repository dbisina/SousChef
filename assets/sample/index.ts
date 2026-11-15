// Static requires for the redesign sample photos (copied from .redesign-assets). Metro needs literal require paths.
export const SAMPLE = {
  avocado: require('./avocado.jpg'),
  beef: require('./beef.jpg'),
  bowl: require('./bowl.jpg'),
  broccoli: require('./broccoli.jpg'),
  brownie: require('./brownie.jpg'),
  burger: require('./burger.jpg'),
  chef: require('./chef.jpg'),
  chicken: require('./chicken.jpg'),
  cookbook: require('./cookbook.jpg'),
  eggs: require('./eggs.jpg'),
  family: require('./family.jpg'),
  friends: require('./friends.jpg'),
  garlic: require('./garlic.jpg'),
  gnocchi: require('./gnocchi.jpg'),
  greens: require('./greens.jpg'),
  grocery: require('./grocery.jpg'),
  p_knit: require('./p_knit.jpg'),
  p_man: require('./p_man.jpg'),
  p_woman: require('./p_woman.jpg'),
  pancakes: require('./pancakes.jpg'),
  pasta: require('./pasta.jpg'),
  penne: require('./penne.jpg'),
  phone: require('./phone.jpg'),
  pizza: require('./pizza.jpg'),
  plating: require('./plating.jpg'),
  powerbowl: require('./powerbowl.jpg'),
  ramen: require('./ramen.jpg'),
  ricebowl: require('./ricebowl.jpg'),
  rider: require('./rider.jpg'),
  salad: require('./salad.jpg'),
  salmon: require('./salmon.jpg'),
  spinach: require('./spinach.jpg'),
  tacos: require('./tacos.jpg'),
  tacos2: require('./tacos2.jpg'),
  toast: require('./toast.jpg'),
  tomatoes: require('./tomatoes.jpg'),
  veg: require('./veg.jpg'),
} as const;

export type SampleName = keyof typeof SAMPLE;

/**
 * A picture in the feed, chat or games: the name of a bundled sample photo, or (when the app talks to the server) the
 * address of a real one. `photoSource` turns either into something an image can show.
 */
export type PhotoLike = SampleName | (string & {});

const isAddress = (ref: string) => /^(https?:|file:|data:|content:)/i.test(ref);

/** The image source for a sample name or an address; null for an unknown name, so a bad value shows nothing instead of crashing. */
export function photoSource(ref: string | null | undefined): (typeof SAMPLE)[SampleName] | { uri: string } | null {
  if (!ref) return null;
  if (isAddress(ref)) return { uri: ref };
  return (SAMPLE as Record<string, (typeof SAMPLE)[SampleName]>)[ref] ?? null;
}
