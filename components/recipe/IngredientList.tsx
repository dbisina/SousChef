import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ingredient } from '@/types';
import { Check, Icon, FONT } from '@/components/ui';

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
    <View>
      {ingredients.map((ingredient, index) => (
        <View key={`${ingredient.name}-${index}`}>
          {index > 0 ? <View className="bg-divider" style={{ height: 1 }} /> : null}
          <IngredientItem
            ingredient={ingredient}
            isChecked={checkedItems.has(ingredient.name)}
            onToggle={onToggleItem ? () => onToggleItem(ingredient.name) : undefined}
            showCalories={showCalories}
            editable={editable}
            onRemove={onRemoveItem ? () => onRemoveItem(index) : undefined}
          />
        </View>
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
  const { t } = useTranslation();
  const content = (
    <View className="flex-row items-center" style={{ minHeight: 56, gap: 14 }}>
      {onToggle ? <Check checked={isChecked} label={ingredient.name} /> : null}

      <View className="flex-1" style={{ minWidth: 0 }}>
        <Text
          className={isChecked ? 'text-subtle' : 'text-ink'}
          style={{
            fontFamily: FONT.sans,
            fontSize: 15,
            textDecorationLine: isChecked ? 'line-through' : 'none',
          }}
        >
          {ingredient.name}
          {ingredient.optional ? (
            <Text className="text-subtle">{` (${t('cooking.optional', 'optional')})`}</Text>
          ) : null}
        </Text>
      </View>

      {showCalories && ingredient.calories > 0 ? (
        <Text className="text-muted" style={{ fontFamily: FONT.sans, fontSize: 12 }}>
          {ingredient.calories} {t('cooking.cal', 'cal')}
        </Text>
      ) : null}

      <Text className="text-ink" style={{ fontFamily: FONT.sansSemi, fontSize: 15 }}>
        {ingredient.amount} {ingredient.unit}
      </Text>

      {editable && onRemove ? (
        <Pressable
          onPress={onRemove}
          accessibilityRole="button"
          accessibilityLabel={t('cooking.removeIngredient', 'Remove ingredient')}
          className="items-center justify-center bg-surface-3"
          style={{ width: 34, height: 34, borderRadius: 17 }}
          hitSlop={5}
        >
          <Icon name="close" size="sm" />
        </Pressable>
      ) : null}
    </View>
  );

  if (onToggle) {
    return (
      <Pressable
        onPress={onToggle}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: isChecked }}
        accessibilityLabel={ingredient.name}
        style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
      >
        {content}
      </Pressable>
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
  const renderRow = (ing: Ingredient, idx: number) => (
    <View key={idx} className="flex-row items-center" style={{ minHeight: 44, gap: 12 }}>
      <View className="bg-accent" style={{ width: 6, height: 6, borderRadius: 3 }} />
      <Text className="flex-1 text-ink" style={{ fontFamily: FONT.sans, fontSize: 14 }}>
        {ing.name}
      </Text>
      <Text className="text-ink" style={{ fontFamily: FONT.sansSemi, fontSize: 14 }}>
        {ing.amount} {ing.unit}
      </Text>
    </View>
  );

  if (columns === 2) {
    const midpoint = Math.ceil(ingredients.length / 2);
    return (
      <View className="flex-row" style={{ gap: 16 }}>
        <View className="flex-1">{ingredients.slice(0, midpoint).map(renderRow)}</View>
        <View className="flex-1">{ingredients.slice(midpoint).map(renderRow)}</View>
      </View>
    );
  }

  return <View>{ingredients.map(renderRow)}</View>;
};
