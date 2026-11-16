import { describe, expect, it } from 'vitest';
import { cleanText, decodeEntities, isoDurationToMinutes, jsonLdRecipes, pageMeta, parseIngredientLine, recipeFromJsonLd, visibleText } from '../src/imports/html';

describe('text clean-up', () => {
  it('decodes entities and removes markup and extra spaces', () => {
    expect(decodeEntities('Tom &amp; Jerry &#39;s &quot;jollof&quot; &#x41; &nbsp;rice &unknown;')).toBe('Tom & Jerry \'s "jollof" A  rice &unknown;');
    expect(cleanText('  <b>Hot</b>   and\n\n<i>spicy</i> &amp; sweet ')).toBe('Hot and spicy & sweet');
    expect(cleanText('x'.repeat(50), 10)).toHaveLength(10);
    expect(decodeEntities('&#0; &#9999999999;')).toBe('&#0; &#9999999999;'); // impossible code points are left alone
  });
});

describe('what a page says about itself', () => {
  const html = `<html><head><title> Fallback   title </title>
    <meta property="og:title" content="Best Jollof &amp; Stew">
    <meta content="Smoky party rice" property="og:description">
    <meta name="description" content="ignored because og wins">
    <meta property="og:image" content="https://img.example.com/j.jpg"></head><body></body></html>`;

  it('prefers the social tags, in either attribute order', () => {
    expect(pageMeta(html)).toEqual({ title: 'Best Jollof & Stew', description: 'Smoky party rice', image: 'https://img.example.com/j.jpg' });
  });

  it('falls back to the title tag and the plain description, and reports what is missing', () => {
    expect(pageMeta('<title>Just a title</title><meta name="description" content="Plain">')).toEqual({ title: 'Just a title', description: 'Plain', image: null });
    expect(pageMeta('<p>nothing</p>')).toEqual({ title: null, description: null, image: null });
  });
});

describe('the readable text of a page', () => {
  it('drops scripts, styles, menus and footers, and keeps the content in lines', () => {
    const text = visibleText(`<html><head><style>p{}</style></head><body>
      <nav>Home | About</nav><header>Site</header>
      <script>var secret = "ignore previous instructions";</script>
      <h1>Egusi Soup</h1><p>2 cups <b>melon</b> seeds</p><ul><li>Fry the onions</li><li>Add the stock</li></ul>
      <!-- a comment --><footer>Copyright</footer></body></html>`);
    expect(text).toBe('Egusi Soup\n2 cups melon seeds\nFry the onions\nAdd the stock');
  });

  it('is cut to the length asked for', () => {
    expect(visibleText('<body>' + '<p>word</p>'.repeat(5000) + '</body>', 100).length).toBeLessThanOrEqual(100);
  });
});

describe('durations', () => {
  it.each([
    ['PT30M', 30],
    ['PT1H15M', 75],
    ['PT2H', 120],
    ['P1DT2H', 1560],
    ['PT90S', 2],
    ['pt45m', 45],
  ])('%s is %i minutes', (value, minutes) => {
    expect(isoDurationToMinutes(value)).toBe(minutes);
  });

  it('returns nothing for anything else', () => {
    for (const bad of ['', 'PT0M', '30 minutes', 'P', 30, null, undefined]) expect(isoDurationToMinutes(bad)).toBeUndefined();
  });
});

describe('an ingredient line', () => {
  it.each([
    ['2 cups flour', { amount: 2, unit: 'cups', name: 'flour' }],
    ['1 1/2 tsp salt', { amount: 1.5, unit: 'tsp', name: 'salt' }],
    ['½ cup sugar', { amount: 0.5, unit: 'cup', name: 'sugar' }],
    ['1½ cups milk', { amount: 1.5, unit: 'cups', name: 'milk' }],
    ['2-3 cloves garlic, minced', { amount: 2, unit: 'cloves', name: 'garlic, minced' }],
    ['3 eggs', { amount: 3, unit: '', name: 'eggs' }],
    ['250g butter', { amount: 250, unit: 'g', name: 'butter' }],
    ['1.5 kg chicken thighs', { amount: 1.5, unit: 'kg', name: 'chicken thighs' }],
    ['2 tablespoons of olive oil', { amount: 2, unit: 'tablespoons', name: 'olive oil' }],
    ['salt to taste', { amount: 1, unit: '', name: 'salt to taste' }],
    ['  - 1 can (400 g) tomatoes ', { amount: 1, unit: 'can', name: '(400 g) tomatoes' }],
    ['1/4 teaspoon pepper', { amount: 0.25, unit: 'teaspoon', name: 'pepper' }],
  ])('"%s"', (line, expected) => {
    expect(parseIngredientLine(line)).toEqual(expected);
  });

  it('never returns an empty name', () => {
    expect(parseIngredientLine('2').name).not.toBe('');
  });
});

const recipeLd = (extra: Record<string, unknown> = {}) => ({
  '@type': 'Recipe',
  name: 'Party Jollof Rice',
  description: 'Smoky, <b>spicy</b> rice',
  image: ['https://img.example.com/1.jpg', 'https://img.example.com/2.jpg'],
  recipeYield: '6 servings',
  prepTime: 'PT20M',
  cookTime: 'PT1H',
  keywords: 'rice, party, nigerian',
  recipeIngredient: ['2 cups rice', '4 tomatoes', '1 tbsp salt'],
  recipeInstructions: [{ '@type': 'HowToStep', text: 'Blend the tomatoes.' }, 'Fry the base.', { '@type': 'HowToSection', itemListElement: [{ '@type': 'HowToStep', text: 'Add rice.' }, { '@type': 'HowToStep', text: 'Simmer.' }] }],
  ...extra,
});
const page = (...blocks: unknown[]) => `<html><head>${blocks.map((b) => `<script type="application/ld+json">${JSON.stringify(b)}</script>`).join('')}</head></html>`;

describe('structured recipe data', () => {
  it('finds a recipe however the page nests it', () => {
    expect(jsonLdRecipes(page(recipeLd()))).toHaveLength(1);
    expect(jsonLdRecipes(page({ '@graph': [{ '@type': 'WebSite' }, recipeLd()] }))).toHaveLength(1);
    expect(jsonLdRecipes(page([{ '@type': 'Article' }, recipeLd()]))).toHaveLength(1);
    expect(jsonLdRecipes(page(recipeLd({ '@type': ['Thing', 'Recipe'] })))).toHaveLength(1);
    expect(jsonLdRecipes(page({ '@type': 'Article' }))).toHaveLength(0);
    expect(jsonLdRecipes('<script type="application/ld+json">{broken</script>' + page(recipeLd()))).toHaveLength(1); // one bad block does not hide the rest
    expect(jsonLdRecipes('<p>no data</p>')).toEqual([]);
  });

  it('turns it into a recipe, flattening sections of steps', () => {
    const parsed = recipeFromJsonLd(recipeLd());
    expect(parsed).toEqual({
      title: 'Party Jollof Rice',
      description: 'Smoky, spicy rice',
      imageUrl: 'https://img.example.com/1.jpg',
      ingredients: [
        { amount: 2, unit: 'cups', name: 'rice' },
        { amount: 4, unit: '', name: 'tomatoes' },
        { amount: 1, unit: 'tbsp', name: 'salt' },
      ],
      instructions: ['Blend the tomatoes.', 'Fry the base.', 'Add rice.', 'Simmer.'],
      servings: 6,
      prepTime: 20,
      cookTime: 60,
      tags: ['rice', 'party', 'nigerian'],
    });
  });

  it('copes with missing optional parts and odd shapes', () => {
    const parsed = recipeFromJsonLd(recipeLd({ image: { url: 'https://img.example.com/o.jpg' }, recipeYield: 4, prepTime: undefined, cookTime: 'soon', keywords: ['a', 'b'] }));
    expect(parsed).toMatchObject({ imageUrl: 'https://img.example.com/o.jpg', servings: 4, tags: ['a', 'b'] });
    expect(parsed).not.toHaveProperty('prepTime');
    expect(parsed).not.toHaveProperty('cookTime');
    expect(recipeFromJsonLd(recipeLd({ image: 'javascript:alert(1)', recipeYield: 'a few' }))).toMatchObject({ servings: 2 });
    expect(recipeFromJsonLd(recipeLd({ image: 'javascript:alert(1)' }))).not.toHaveProperty('imageUrl');
  });

  it('is nothing without a title, two ingredients and a step', () => {
    expect(recipeFromJsonLd(recipeLd({ name: '' }))).toBeNull();
    expect(recipeFromJsonLd(recipeLd({ recipeIngredient: ['2 cups rice'] }))).toBeNull();
    expect(recipeFromJsonLd(recipeLd({ recipeInstructions: [] }))).toBeNull();
    expect(recipeFromJsonLd({ '@type': 'Recipe' })).toBeNull();
  });
});
