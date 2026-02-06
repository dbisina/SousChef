import React, { memo, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  Platform,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolate,
  FadeIn,
  Layout,
} from 'react-native-reanimated';
import { WantToCookItem, WantToCookStatus } from '@/types/wantToCook';
import { formatDistanceToNow } from 'date-fns';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface WantToCookCardProps {
  item: WantToCookItem;
  onPress: () => void;
  onAddToShoppingList: () => void;
  onMarkAsCooked: () => void;
  onRemove: () => void;
}

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

const STATUS_CONFIG: Record<WantToCookStatus, { color: string; bg: string; icon: string; label: string }> = {
  saved: { color: '#6366F1', bg: '#EEF2FF', icon: 'bookmark', label: 'Saved' },
  planned: { color: '#F59E0B', bg: '#FEF3C7', icon: 'calendar', label: 'Planned' },
  shopping: { color: '#10B981', bg: '#D1FAE5', icon: 'cart', label: 'Shopping' },
  cooked: { color: '#22C55E', bg: '#DCFCE7', icon: 'checkmark-circle', label: 'Cooked' },
};

export const WantToCookCard = memo<WantToCookCardProps>(({
  item,
  onPress,
  onAddToShoppingList,
  onMarkAsCooked,
  onRemove,
}) => {
  const scale = useSharedValue(1);
  const recipe = item.importedRecipe;

  if (!recipe) return null;

  const statusConfig = STATUS_CONFIG[item.status];
  const savedDaysAgo = Math.floor(
    (Date.now() - item.savedAt.toMillis()) / (1000 * 60 * 60 * 24)
  );
  const pantryMatch = item.pantryMatchPercent ?? 0;

  const handlePressIn = () => {
    scale.value = withSpring(0.97, { damping: 15 });
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15 });
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  // Pantry match color
  const getMatchColor = (percent: number) => {
    if (percent >= 80) return { text: '#22C55E', bg: '#DCFCE7' };
    if (percent >= 50) return { text: '#F59E0B', bg: '#FEF3C7' };
    return { text: '#EF4444', bg: '#FEE2E2' };
  };

  const matchColor = getMatchColor(pantryMatch);

  return (
    <AnimatedTouchable
      entering={FadeIn.duration(300)}
      layout={Layout.springify()}
      style={[animatedStyle]}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      activeOpacity={1}
      className="mb-4"
    >
      <View
        className="bg-white rounded-3xl overflow-hidden"
        style={{
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.08,
          shadowRadius: 12,
          elevation: 4,
        }}
      >
        {/* Image Section */}
        <View className="relative">
          {recipe.imageURL ? (
            <Image
              source={{ uri: recipe.imageURL }}
              className="w-full h-44"
              resizeMode="cover"
            />
          ) : (
            <LinearGradient
              colors={['#FF6B35', '#FF8F5A']}
              className="w-full h-44 items-center justify-center"
            >
              <Ionicons name="restaurant-outline" size={48} color="white" />
            </LinearGradient>
          )}

          {/* Source badge */}
          {recipe.sourcePlatform && (
            <View className="absolute top-3 left-3">
              <View className="bg-black/60 px-3 py-1.5 rounded-full flex-row items-center">
                <Ionicons
                  name={
                    recipe.sourcePlatform === 'youtube' ? 'logo-youtube' :
                    recipe.sourcePlatform === 'tiktok' ? 'logo-tiktok' :
                    recipe.sourcePlatform === 'instagram' ? 'logo-instagram' :
                    'globe-outline'
                  }
                  size={14}
                  color="white"
                />
                <Text className="text-white text-xs font-medium ml-1 capitalize">
                  {recipe.sourcePlatform}
                </Text>
              </View>
            </View>
          )}

          {/* Status badge */}
          <View className="absolute top-3 right-3">
            <View
              className="px-3 py-1.5 rounded-full flex-row items-center"
              style={{ backgroundColor: statusConfig.bg }}
            >
              <Ionicons name={statusConfig.icon as any} size={14} color={statusConfig.color} />
              <Text style={{ color: statusConfig.color }} className="text-xs font-semibold ml-1">
                {statusConfig.label}
              </Text>
            </View>
          </View>

          {/* Pantry match indicator */}
          <View className="absolute bottom-3 right-3">
            <View
              className="px-3 py-2 rounded-xl flex-row items-center"
              style={{ backgroundColor: matchColor.bg }}
            >
              <Ionicons name="basket-outline" size={16} color={matchColor.text} />
              <Text style={{ color: matchColor.text }} className="text-sm font-bold ml-1">
                {pantryMatch}%
              </Text>
              <Text style={{ color: matchColor.text }} className="text-xs ml-1">
                match
              </Text>
            </View>
          </View>

          {/* Days ago nudge */}
          {savedDaysAgo >= 7 && item.status === 'saved' && (
            <View className="absolute bottom-3 left-3">
              <View className="bg-amber-500 px-3 py-2 rounded-xl flex-row items-center">
                <Ionicons name="time-outline" size={14} color="white" />
                <Text className="text-white text-xs font-semibold ml-1">
                  {savedDaysAgo}d ago - Cook it!
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* Content Section */}
        <View className="p-4">
          <Text className="text-lg font-bold text-neutral-900 mb-1" numberOfLines={2}>
            {recipe.title}
          </Text>

          {recipe.description && (
            <Text className="text-neutral-500 text-sm mb-3" numberOfLines={2}>
              {recipe.description}
            </Text>
          )}

          {/* Recipe meta */}
          <View className="flex-row items-center mb-4">
            {recipe.prepTime && (
              <View className="flex-row items-center mr-4">
                <Ionicons name="time-outline" size={16} color="#6B7280" />
                <Text className="text-neutral-600 text-sm ml-1">
                  {(recipe.prepTime || 0) + (recipe.cookTime || 0)} min
                </Text>
              </View>
            )}
            {recipe.servings && (
              <View className="flex-row items-center mr-4">
                <Ionicons name="people-outline" size={16} color="#6B7280" />
                <Text className="text-neutral-600 text-sm ml-1">
                  {recipe.servings} servings
                </Text>
              </View>
            )}
            <View className="flex-row items-center">
              <Ionicons name="nutrition-outline" size={16} color="#6B7280" />
              <Text className="text-neutral-600 text-sm ml-1">
                {recipe.ingredients.length} ingredients
              </Text>
            </View>
          </View>

          {/* Missing ingredients preview */}
          {item.missingIngredients && item.missingIngredients.length > 0 && (
            <View className="mb-4">
              <Text className="text-xs font-semibold text-neutral-400 mb-2">
                NEED TO BUY ({item.missingIngredients.length})
              </Text>
              <View className="flex-row flex-wrap">
                {item.missingIngredients.slice(0, 4).map((ing, idx) => (
                  <View
                    key={idx}
                    className="bg-red-50 px-2 py-1 rounded-lg mr-2 mb-1"
                  >
                    <Text className="text-red-600 text-xs">{ing}</Text>
                  </View>
                ))}
                {item.missingIngredients.length > 4 && (
                  <View className="bg-neutral-100 px-2 py-1 rounded-lg">
                    <Text className="text-neutral-500 text-xs">
                      +{item.missingIngredients.length - 4} more
                    </Text>
                  </View>
                )}
              </View>
            </View>
          )}

          {/* Action buttons */}
          <View className="flex-row gap-2">
            {item.status !== 'cooked' && (
              <>
                <TouchableOpacity
                  onPress={onAddToShoppingList}
                  className="flex-1 bg-primary-500 py-3 rounded-xl flex-row items-center justify-center"
                  activeOpacity={0.8}
                >
                  <Ionicons name="cart-outline" size={18} color="white" />
                  <Text className="text-white font-semibold ml-2">Add to List</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={onMarkAsCooked}
                  className="w-12 h-12 bg-green-100 rounded-xl items-center justify-center"
                  activeOpacity={0.8}
                >
                  <Ionicons name="checkmark-circle-outline" size={24} color="#22C55E" />
                </TouchableOpacity>
              </>
            )}

            {item.status === 'cooked' && (
              <View className="flex-1 bg-green-100 py-3 rounded-xl flex-row items-center justify-center">
                <Ionicons name="checkmark-circle" size={20} color="#22C55E" />
                <Text className="text-green-600 font-semibold ml-2">Cooked!</Text>
              </View>
            )}

            <TouchableOpacity
              onPress={onRemove}
              className="w-12 h-12 bg-neutral-100 rounded-xl items-center justify-center"
              activeOpacity={0.8}
            >
              <Ionicons name="trash-outline" size={20} color="#6B7280" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </AnimatedTouchable>
  );
});

WantToCookCard.displayName = 'WantToCookCard';

export default WantToCookCard;
