import React from 'react';
import { View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Recipe, User } from '@/types';
import { Icon, FONT } from '@/components/ui';

interface AllergenWarningProps {
  recipe: Recipe;
  user: User | null;
}

const ALLERGEN_LABELS: Record<string, string> = {
  nuts: 'Tree Nuts',
  peanuts: 'Peanuts',
  shellfish: 'Shellfish',
  fish: 'Fish',
  eggs: 'Eggs',
  soy: 'Soy',
  wheat: 'Wheat',
  sesame: 'Sesame',
  milk: 'Milk / Dairy',
  corn: 'Corn',
  mustard: 'Mustard',
  celery: 'Celery',
  lupin: 'Lupin',
  mollusks: 'Mollusks',
  sulfites: 'Sulfites',
  gluten: 'Gluten',
};

const CONDITION_WARNINGS: Record<string, { ingredients: string[]; message: string }> = {
  'diabetic-type1': {
    ingredients: ['sugar', 'honey', 'syrup', 'molasses', 'agave', 'candy', 'chocolate'],
    message: 'This recipe contains high-sugar ingredients. Monitor carb intake carefully.',
  },
  'diabetic-type2': {
    ingredients: ['sugar', 'honey', 'syrup', 'molasses', 'agave', 'white rice', 'white bread', 'potato'],
    message: 'This recipe contains high-glycemic ingredients. Consider portion control.',
  },
  'high-blood-pressure': {
    ingredients: ['salt', 'soy sauce', 'bacon', 'salami', 'ham', 'canned', 'pickled', 'bouillon'],
    message: 'This recipe may be high in sodium.',
  },
  'gerd': {
    ingredients: ['tomato', 'citrus', 'lemon', 'lime', 'orange', 'chocolate', 'coffee', 'mint', 'garlic', 'onion', 'spicy', 'chili', 'pepper'],
    message: 'This recipe contains common GERD triggers.',
  },
  'gout': {
    ingredients: ['organ meat', 'liver', 'anchovy', 'sardine', 'herring', 'mussel', 'scallop', 'beer', 'bacon'],
    message: 'This recipe contains high-purine ingredients.',
  },
  'kidney-disease': {
    ingredients: ['banana', 'potato', 'tomato', 'avocado', 'spinach', 'salt', 'nuts', 'beans', 'dairy'],
    message: 'This recipe may be high in potassium, phosphorus, or sodium.',
  },
  'ibs': {
    ingredients: ['garlic', 'onion', 'beans', 'lentils', 'wheat', 'apple', 'pear', 'milk', 'cream', 'mushroom'],
    message: 'This recipe contains potential FODMAP triggers.',
  },
  'high-cholesterol': {
    ingredients: ['butter', 'lard', 'bacon', 'sausage', 'cream', 'cheese', 'egg yolk', 'fried'],
    message: 'This recipe contains high-cholesterol or saturated fat ingredients.',
  },
};

export const AllergenWarning: React.FC<AllergenWarningProps> = ({ recipe, user }) => {
  const { t } = useTranslation();
  if (!user) return null;

  const userAllergens = user.allergies || [];
  const userConditions = user.healthConditions || [];
  const recipeAllergens = recipe.allergens || [];
  const ingredientNames = recipe.ingredients.map((i) => i.name.toLowerCase());

  // Check allergen matches
  const matchedAllergens = userAllergens.filter((a) => recipeAllergens.includes(a));

  // Check health condition warnings
  const conditionWarnings: { condition: string; message: string }[] = [];
  for (const condition of userConditions) {
    const warn = CONDITION_WARNINGS[condition];
    if (warn) {
      const hasTriggering = ingredientNames.some((name) =>
        warn.ingredients.some((trigger) => name.includes(trigger))
      );
      if (hasTriggering) {
        conditionWarnings.push({ condition, message: warn.message });
      }
    }
  }

  if (matchedAllergens.length === 0 && conditionWarnings.length === 0) return null;

  return (
    <View style={{ gap: 8 }}>
      {matchedAllergens.length > 0 ? (
        <View className="bg-tag-r" style={{ borderRadius: 24, padding: 14, gap: 4 }}>
          <View className="flex-row items-center" style={{ gap: 8 }}>
            <Icon name="warning" size="sm" color="tag-r-fg" />
            <Text className="text-tag-r-fg" style={{ fontFamily: FONT.display, fontSize: 15 }}>
              {t('cooking.allergenAlert', 'Allergen Alert')}
            </Text>
          </View>
          <Text className="text-tag-r-fg" style={{ fontFamily: FONT.sans, fontSize: 13 }}>
            {t('cooking.contains', 'Contains: {{list}}', {
              list: matchedAllergens.map((a) => ALLERGEN_LABELS[a] || a).join(', '),
            })}
          </Text>
        </View>
      ) : null}

      {conditionWarnings.map((warn, index) => (
        <View key={index} className="bg-tag-o" style={{ borderRadius: 24, padding: 14, gap: 4 }}>
          <View className="flex-row items-center" style={{ gap: 8 }}>
            <Icon name="info" size="sm" color="tag-o-fg" />
            <Text className="text-tag-o-fg" style={{ fontFamily: FONT.display, fontSize: 15 }}>
              {t('cooking.healthNotice', 'Health Notice')}
            </Text>
          </View>
          <Text className="text-tag-o-fg" style={{ fontFamily: FONT.sans, fontSize: 13 }}>
            {warn.message}
          </Text>
        </View>
      ))}
    </View>
  );
};
