import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Recipe, User } from '@/types';

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
    <View className="mx-4 mt-3">
      {/* Allergen warning */}
      {matchedAllergens.length > 0 && (
        <View className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3 mb-2">
          <View className="flex-row items-center mb-1">
            <Ionicons name="warning" size={18} color="#DC2626" />
            <Text className="font-bold text-red-700 dark:text-red-400 ml-2 text-sm">
              Allergen Alert
            </Text>
          </View>
          <Text className="text-red-600 dark:text-red-300 text-sm">
            Contains: {matchedAllergens.map((a) => ALLERGEN_LABELS[a] || a).join(', ')}
          </Text>
        </View>
      )}

      {/* Health condition warnings */}
      {conditionWarnings.map((warn, index) => (
        <View
          key={index}
          className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3 mb-2"
        >
          <View className="flex-row items-center mb-1">
            <Ionicons name="medical" size={18} color="#D97706" />
            <Text className="font-bold text-amber-700 dark:text-amber-400 ml-2 text-sm">
              Health Notice
            </Text>
          </View>
          <Text className="text-amber-600 dark:text-amber-300 text-sm">{warn.message}</Text>
        </View>
      ))}
    </View>
  );
};
