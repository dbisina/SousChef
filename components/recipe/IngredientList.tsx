import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Ingredient } from '@/types';
import { useThemeColors } from '@/stores/themeStore';

interface IngredientListProps {
  ingredients: Ingredient[];
  checkedItems?: Set<string>;
  onToggleItem?: (ingredientName: string) => void;
  showCalories?: boolean;
  editable?: boolean;
  onRemoveItem?: (index: number) => void;
}

export const IngredientList: React.FC<IngredientListProps> = ({
  ingredients,
  checkedItems = new Set(),
  onToggleItem,
  showCalories = false,
  editable = false,
  onRemoveItem,
}) => {
  return (
    <View className="space-y-2">
      {ingredients.map((ingredient, index) => (
        <IngredientItem
          key={`${ingredient.name}-${index}`}
          ingredient={ingredient}
          isChecked={checkedItems.has(ingredient.name)}
          onToggle={onToggleItem ? () => onToggleItem(ingredient.name) : undefined}
          showCalories={showCalories}
          editable={editable}
          onRemove={onRemoveItem ? () => onRemoveItem(index) : undefined}
        />
      ))}
    </View>
  );
};

interface IngredientItemProps {
  ingredient: Ingredient;
  isChecked?: boolean;
  onToggle?: () => void;
  showCalories?: boolean;
  editable?: boolean;
  onRemove?: () => void;
}

export const IngredientItem: React.FC<IngredientItemProps> = ({
  ingredient,
  isChecked = false,
  onToggle,
  showCalories = false,
  editable = false,
  onRemove,
}) => {
  const colors = useThemeColors();
  const content = (
    <View className="flex-row items-center py-2">
      {/* Checkbox */}
      {onToggle && (
        <View
          className={`
            w-6 h-6 rounded-lg border-2 items-center justify-center mr-3
            ${isChecked ? 'bg-primary-500 border-primary-500' : 'border-neutral-300 dark:border-neutral-600'}
          `}
        >
          {isChecked && <Ionicons name="checkmark" size={16} color="white" />}
        </View>
      )}

      {/* Ingredient info */}
      <View className="flex-1">
        <Text
          className={`text-base ${isChecked ? 'text-neutral-400 dark:text-neutral-500 line-through' : 'text-neutral-900 dark:text-neutral-50'}`}
        >
          <Text className="font-medium">
            {ingredient.amount} {ingredient.unit}
          </Text>{' '}
          {ingredient.name}
          {ingredient.optional && (
            <Text className="text-neutral-400 dark:text-neutral-500"> (optional)</Text>
          )}
        </Text>
      </View>

      {/* Calories */}
      {showCalories && ingredient.calories > 0 && (
        <Text className="text-sm text-neutral-500 dark:text-neutral-400 ml-2">
          {ingredient.calories} cal
        </Text>
      )}

      {/* Remove button */}
      {editable && onRemove && (
        <TouchableOpacity onPress={onRemove} className="ml-2 p-1">
          <Ionicons name="close-circle" size={22} color="#EF4444" />
        </TouchableOpacity>
      )}
    </View>
  );

  if (onToggle) {
    return (
      <TouchableOpacity onPress={onToggle} activeOpacity={0.7}>
        {content}
      </TouchableOpacity>
    );
  }

  return content;
};

// Simple ingredient display without interaction
interface SimpleIngredientListProps {
  ingredients: Ingredient[];
  columns?: 1 | 2;
}

export const SimpleIngredientList: React.FC<SimpleIngredientListProps> = ({
  ingredients,
  columns = 1,
}) => {
  const colors = useThemeColors();
  if (columns === 2) {
    const midpoint = Math.ceil(ingredients.length / 2);
    const leftColumn = ingredients.slice(0, midpoint);
    const rightColumn = ingredients.slice(midpoint);

    return (
      <View className="flex-row">
        <View className="flex-1 pr-2">
          {leftColumn.map((ing, idx) => (
            <View key={idx} className="flex-row items-start py-1">
              <View className="w-2 h-2 rounded-full bg-primary-500 mt-2 mr-2" />
              <Text className="flex-1 text-neutral-700 dark:text-neutral-300">
                {ing.amount} {ing.unit} {ing.name}
              </Text>
            </View>
          ))}
        </View>
        <View className="flex-1 pl-2">
          {rightColumn.map((ing, idx) => (
            <View key={idx} className="flex-row items-start py-1">
              <View className="w-2 h-2 rounded-full bg-primary-500 mt-2 mr-2" />
              <Text className="flex-1 text-neutral-700 dark:text-neutral-300">
                {ing.amount} {ing.unit} {ing.name}
              </Text>
            </View>
          ))}
        </View>
      </View>
    );
  }

  return (
    <View>
      {ingredients.map((ing, idx) => (
        <View key={idx} className="flex-row items-start py-1">
          <View className="w-2 h-2 rounded-full bg-primary-500 mt-2 mr-2" />
          <Text className="flex-1 text-neutral-700 dark:text-neutral-300">
            {ing.amount} {ing.unit} {ing.name}
            {ing.optional && <Text className="text-neutral-400 dark:text-neutral-500"> (optional)</Text>}
          </Text>
        </View>
      ))}
    </View>
  );
};
