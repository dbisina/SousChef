import { PHOTOS, type PhotoName } from '@/assets/photos';
import type { PhotoSource } from '@/components/ui';

// Words in a question -> the app's own photo of that food. The first match wins, so the more specific words come first.
const KEYWORDS: [RegExp, PhotoName][] = [
  [/carbonara|spaghetti|pasta|lasagn|macaroni|penne|noodle dough|al dente/i, 'pasta'],
  [/gnocchi/i, 'gnocchi'],
  [/pizza|neapolitan/i, 'pizza'],
  [/burger|patty|bun\b/i, 'burger'],
  [/taco|tortilla|mexic|salsa|guacamole|nixtamal/i, 'tacos'],
  [/ramen|miso|dashi|japan|soba|udon|pho\b|broth/i, 'ramen'],
  [/risotto|rice|paella|jollof|biryani|pilaf|sushi|congee/i, 'ricebowl'],
  [/salmon|fish|seafood|tuna|cod|shrimp|prawn|sear|grill|fillet/i, 'salmon'],
  [/chicken|poultry|turkey|roast/i, 'chicken'],
  [/beef|steak|pork|lamb|brisket|meat|ribs|sausage|bacon|maillard|braise/i, 'beef'],
  [/\begg|omelet|omelette|meringue|souffl|yolk|custard|poach/i, 'eggs'],
  [/avocado/i, 'avocado'],
  [/tomato|ratatouille|marinara|ketchup/i, 'tomatoes'],
  [/garlic|onion|shallot|leek|saut[eé]|caramelis/i, 'garlic'],
  [/broccoli|cauliflower|brassica|cabbage/i, 'broccoli'],
  [/spinach|kale|chard|arugula|lettuce/i, 'spinach'],
  [/pancake|waffle|crepe|batter|griddle/i, 'pancakes'],
  [/bread|toast|dough|yeast|sourdough|bake|baking|flour|knead|proof|gluten/i, 'toast'],
  [/chocolate|cake|brownie|dessert|sugar|cookie|cream|caramel|pastry|sweet/i, 'brownie'],
  [/salad|herb|basil|vinaigrette|dressing|raw|fresh|vegan|vegetarian|vegetable|veg\b/i, 'salad'],
  [/curry|spice|cumin|turmeric|chili|chilli|pepper|pepper/i, 'powerbowl'],
  [/cheese|dairy|milk|butter|yogh?urt/i, 'plating'],
  [/soup|stew|simmer|stock/i, 'bowl'],
  [/knife|cut|chop|slice|dice|julienne|mise/i, 'veg'],
  [/shop|pantry|ingredient|store|market|season|salt/i, 'grocery'],
];

// Anything that matches nothing still gets a dish photo: picked from the text so the same question always shows the same one.
const GENERIC: PhotoName[] = ['plating', 'bowl', 'powerbowl', 'salad', 'veg', 'grocery', 'ricebowl', 'toast'];

const hash = (text: string): number => {
  let h = 0;
  for (let i = 0; i < text.length; i += 1) h = (h * 31 + text.charCodeAt(i)) >>> 0;
  return h;
};

/** The name of the app's photo that fits a question (its words, then its answer), never empty. */
export function questionPhotoName(prompt: string, extra = ''): PhotoName {
  for (const text of [prompt, extra]) {
    for (const [re, name] of KEYWORDS) if (re.test(text)) return name;
  }
  return GENERIC[hash(prompt) % GENERIC.length] as PhotoName;
}

/** The picture for a game question: the real photo the server found when there is one, otherwise the app's own photo that fits. */
export function questionPhoto(item: { prompt: string; imageUrl?: string | null }, extra = ''): PhotoSource {
  if (item.imageUrl) return { uri: item.imageUrl };
  return PHOTOS[questionPhotoName(item.prompt, extra)] as PhotoSource;
}
