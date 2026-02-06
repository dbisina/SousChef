import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PantryItem as PantryItemType } from '@/types';
import { formatDate, isExpiringSoon, isExpired } from '@/lib/utils';

interface PantryItemProps {
  item: PantryItemType;
  onPress?: () => void;
  onDelete?: () => void;
  showExpiry?: boolean;
}

export const PantryItemCard: React.FC<PantryItemProps> = ({
  item,
  onPress,
  onDelete,
  showExpiry = true,
}) => {
  const expiringSoon = item.expiryDate ? isExpiringSoon(item.expiryDate) : false;
  const expired = item.expiryDate ? isExpired(item.expiryDate) : false;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={!onPress}
      className={`
        bg-white rounded-xl p-4 mb-2 flex-row items-center
        ${expired ? 'border-l-4 border-red-500' : expiringSoon ? 'border-l-4 border-amber-500' : ''}
      `}
      activeOpacity={onPress ? 0.7 : 1}
    >
      {/* Category icon */}
      <View className="w-10 h-10 rounded-full bg-primary-100 items-center justify-center mr-3">
        <Ionicons
          name={getCategoryIcon(item.category)}
          size={20}
          color="#FF6B35"
        />
      </View>

      {/* Item info */}
      <View className="flex-1">
        <Text className="text-base font-semibold text-neutral-900">
          {item.name}
        </Text>
        <Text className="text-sm text-neutral-500">
          {item.amount} {item.unit}
        </Text>
        {showExpiry && item.expiryDate && (
          <Text
            className={`text-xs mt-1 ${
              expired
                ? 'text-red-500'
                : expiringSoon
                ? 'text-amber-500'
                : 'text-neutral-400'
            }`}
          >
            {expired ? 'Expired: ' : expiringSoon ? 'Expires: ' : 'Exp: '}
            {formatDate(item.expiryDate)}
          </Text>
        )}
      </View>

      {/* Status indicator */}
      {(expired || expiringSoon) && (
        <View className="mr-2">
          <Ionicons
            name={expired ? 'warning' : 'alert-circle'}
            size={20}
            color={expired ? '#EF4444' : '#F59E0B'}
          />
        </View>
      )}

      {/* Delete button */}
      {onDelete && (
        <TouchableOpacity onPress={onDelete} className="p-2">
          <Ionicons name="trash-outline" size={20} color="#EF4444" />
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
};

// Compact pantry item for lists
interface CompactPantryItemProps {
  item: PantryItemType;
  onPress?: () => void;
  selected?: boolean;
}

export const CompactPantryItem: React.FC<CompactPantryItemProps> = ({
  item,
  onPress,
  selected = false,
}) => {
  return (
    <TouchableOpacity
      onPress={onPress}
      className={`
        flex-row items-center px-3 py-2 rounded-lg mr-2 mb-2
        ${selected ? 'bg-primary-500' : 'bg-neutral-100'}
      `}
    >
      <Ionicons
        name={getCategoryIcon(item.category)}
        size={16}
        color={selected ? 'white' : '#737373'}
      />
      <Text
        className={`ml-2 ${selected ? 'text-white font-medium' : 'text-neutral-700'}`}
      >
        {item.name}
      </Text>
    </TouchableOpacity>
  );
};

// Helper function to get category icon
const getCategoryIcon = (category: string): keyof typeof Ionicons.glyphMap => {
  const icons: Record<string, keyof typeof Ionicons.glyphMap> = {
    produce: 'leaf-outline',
    dairy: 'water-outline',
    meat: 'restaurant-outline',
    seafood: 'fish-outline',
    grains: 'nutrition-outline',
    spices: 'flask-outline',
    condiments: 'color-fill-outline',
    canned: 'cube-outline',
    frozen: 'snow-outline',
    beverages: 'cafe-outline',
    other: 'ellipse-outline',
  };
  return icons[category] || 'ellipse-outline';
};

// Category header for grouped lists
interface CategoryHeaderProps {
  category: string;
  itemCount: number;
}

export const CategoryHeader: React.FC<CategoryHeaderProps> = ({
  category,
  itemCount,
}) => {
  return (
    <View className="flex-row items-center py-2 mt-2">
      <Ionicons name={getCategoryIcon(category)} size={20} color="#737373" />
      <Text className="ml-2 text-sm font-semibold text-neutral-600 capitalize">
        {category}
      </Text>
      <View className="ml-2 px-2 py-0.5 bg-neutral-200 rounded-full">
        <Text className="text-xs text-neutral-600">{itemCount}</Text>
      </View>
    </View>
  );
};
