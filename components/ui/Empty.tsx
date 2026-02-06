import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from './Button';

interface EmptyProps {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export const Empty: React.FC<EmptyProps> = ({
  icon = 'file-tray-outline',
  title,
  description,
  actionLabel,
  onAction,
}) => {
  return (
    <View className="flex-1 items-center justify-center px-8 py-12">
      <View className="w-20 h-20 rounded-full bg-neutral-100 items-center justify-center mb-4">
        <Ionicons name={icon} size={40} color="#737373" />
      </View>

      <Text className="text-xl font-semibold text-neutral-900 text-center mb-2">
        {title}
      </Text>

      {description && (
        <Text className="text-base text-neutral-500 text-center mb-6">
          {description}
        </Text>
      )}

      {actionLabel && onAction && (
        <Button title={actionLabel} onPress={onAction} variant="primary" />
      )}
    </View>
  );
};

// Specialized empty states
export const EmptyRecipes: React.FC<{ onAction?: () => void }> = ({ onAction }) => (
  <Empty
    icon="restaurant-outline"
    title="No recipes yet"
    description="Be the first to add a delicious recipe!"
    actionLabel="Add Recipe"
    onAction={onAction}
  />
);

export const EmptyPantry: React.FC<{ onAction?: () => void }> = ({ onAction }) => (
  <Empty
    icon="basket-outline"
    title="Your pantry is empty"
    description="Add ingredients to get personalized recipe suggestions"
    actionLabel="Add Ingredients"
    onAction={onAction}
  />
);

export const EmptySearch: React.FC = () => (
  <Empty
    icon="search-outline"
    title="No results found"
    description="Try adjusting your search or filters"
  />
);

export const EmptySaved: React.FC<{ onAction?: () => void }> = ({ onAction }) => (
  <Empty
    icon="bookmark-outline"
    title="No saved recipes"
    description="Save recipes you love for quick access"
    actionLabel="Browse Recipes"
    onAction={onAction}
  />
);
