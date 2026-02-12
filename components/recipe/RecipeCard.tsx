import React, { memo } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Recipe } from '@/types';
import { useThemeColors } from '@/stores/themeStore';
import { DifficultyBadge, CalorieBadge, TimeBadge } from '@/components/ui';
import { formatRelativeTime } from '@/lib/utils';

interface RecipeCardProps {
  recipe: Recipe;
  onPress?: () => void;
  onLike?: () => void;
  onSave?: () => void;
  isSaved?: boolean;
  showAuthor?: boolean;
  compact?: boolean;
}

export const RecipeCard: React.FC<RecipeCardProps> = memo(({
  recipe,
  onPress,
  onLike,
  onSave,
  isSaved = false,
  showAuthor = true,
  compact = false,
}) => {
  const router = useRouter();
  const colors = useThemeColors();

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else {
      router.push(`/recipe/${recipe.id}`);
    }
  };

  if (compact) {
    return (
      <TouchableOpacity
        onPress={handlePress}
        className="flex-row rounded-2xl overflow-hidden mb-3"
        style={styles.compactCard}
        activeOpacity={0.85}
      >
        <Image
          source={{ uri: recipe.imageURL }}
          className="w-24 h-24 rounded-xl"
        />
        <View className="flex-1 p-3 justify-center">
          <Text className="text-base font-semibold text-neutral-800 dark:text-neutral-200" numberOfLines={1}>
            {recipe.title}
          </Text>
          <View className="flex-row items-center mt-2 space-x-2">
            <DifficultyBadge difficulty={recipe.difficulty} size="sm" />
            <TimeBadge minutes={recipe.prepTime + recipe.cookTime} size="sm" />
          </View>
        </View>
        <View className="p-3 justify-center">
          <View className="bg-primary-50 px-3 py-1.5 rounded-full">
            <Text className="text-sm font-semibold text-primary-600">
              {recipe.nutrition?.caloriesPerServing || 0} cal
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      onPress={handlePress}
      className="rounded-3xl overflow-hidden mb-5"
      style={styles.card}
      activeOpacity={0.9}
    >
      {/* Image with gradient overlay */}
      <View className="relative">
        <Image
          source={{ uri: recipe.imageURL }}
          className="w-full h-52"
          resizeMode="cover"
        />

        {/* Gradient overlay for better text readability */}
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.4)']}
          className="absolute bottom-0 left-0 right-0 h-24"
        />

        {/* Official badge - glass effect */}
        {recipe.isOfficial && (
          <View className="absolute top-4 left-4 rounded-full overflow-hidden" style={styles.badge}>
            <BlurView intensity={80} tint="light" style={StyleSheet.absoluteFill} />
            <View className="flex-row items-center px-3 py-1.5 bg-white/60">
              <Ionicons name="checkmark-circle" size={14} color={colors.accent} />
              <Text className="text-xs font-semibold ml-1" style={{ color: colors.accent }}>Chef's Pick</Text>
            </View>
          </View>
        )}

        {/* Action buttons - glass effect */}
        <View className="absolute top-4 right-4 flex-row space-x-2">
          {onSave && (
            <TouchableOpacity
              onPress={onSave}
              className="w-10 h-10 rounded-full overflow-hidden items-center justify-center"
              style={styles.actionButton}
            >
              <BlurView intensity={80} tint="light" style={StyleSheet.absoluteFill} />
              <View className="w-full h-full items-center justify-center bg-white/60">
                <Ionicons
                  name={isSaved ? 'bookmark' : 'bookmark-outline'}
                  size={20}
                  color={isSaved ? colors.accent : '#44403C'}
                />
              </View>
            </TouchableOpacity>
          )}
        </View>

        {/* Time badge at bottom of image */}
        <View className="absolute bottom-4 left-4">
          <View className="rounded-full overflow-hidden" style={styles.timeBadge}>
            <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />
            <View className="flex-row items-center px-3 py-1.5 bg-black/30">
              <Ionicons name="time-outline" size={14} color="white" />
              <Text className="text-white text-xs font-medium ml-1">
                {recipe.prepTime + recipe.cookTime} min
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Content */}
      <View className="p-5 bg-white dark:bg-neutral-800">
        <Text className="text-xl font-bold text-neutral-800 dark:text-neutral-100 tracking-tight" numberOfLines={1}>
          {recipe.title}
        </Text>

        <Text className="text-sm text-neutral-500 dark:text-neutral-400 mt-1.5 leading-relaxed" numberOfLines={2}>
          {recipe.description}
        </Text>

        {/* Badges */}
        <View className="flex-row flex-wrap mt-4 gap-2">
          <DifficultyBadge difficulty={recipe.difficulty} />
          <CalorieBadge calories={recipe.nutrition?.caloriesPerServing || 0} />
        </View>

        {/* Footer */}
        <View className="flex-row items-center justify-between mt-5 pt-4 border-t border-neutral-100 dark:border-neutral-700">
          {showAuthor && (
            <View className="flex-row items-center">
              <View className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-100 to-primary-200 items-center justify-center">
                <Text className="text-sm font-bold text-primary-600">
                  {recipe.authorName.charAt(0).toUpperCase()}
                </Text>
              </View>
              <Text className="text-sm font-medium text-neutral-600 dark:text-neutral-400 ml-2.5">
                {recipe.authorName}
              </Text>
            </View>
          )}

          <View className="flex-row items-center space-x-4">
            {onLike && (
              <TouchableOpacity onPress={onLike} className="flex-row items-center">
                <Ionicons name="heart-outline" size={18} color={colors.textMuted} />
                <Text className="text-sm text-neutral-500 dark:text-neutral-400 ml-1 font-medium">{recipe.likes}</Text>
              </TouchableOpacity>
            )}
            <Text className="text-xs text-neutral-400 dark:text-neutral-500 font-medium">
              {formatRelativeTime(recipe.createdAt)}
            </Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}, (prevProps, nextProps) => {
  // Only re-render if recipe data, saved state, or handlers changed
  return (
    prevProps.recipe.id === nextProps.recipe.id &&
    prevProps.recipe.title === nextProps.recipe.title &&
    prevProps.recipe.imageURL === nextProps.recipe.imageURL &&
    prevProps.recipe.likes === nextProps.recipe.likes &&
    prevProps.isSaved === nextProps.isSaved &&
    prevProps.compact === nextProps.compact &&
    prevProps.showAuthor === nextProps.showAuthor &&
    prevProps.onPress === nextProps.onPress &&
    prevProps.onLike === nextProps.onLike &&
    prevProps.onSave === nextProps.onSave
  );
});

RecipeCard.displayName = 'RecipeCard';

// Horizontal scrolling recipe card with glass effect
export const HorizontalRecipeCard: React.FC<RecipeCardProps> = ({
  recipe,
  onPress,
}) => {
  const router = useRouter();
  const colors = useThemeColors();

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else {
      router.push(`/recipe/${recipe.id}`);
    }
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      className="w-72 rounded-3xl overflow-hidden mr-4"
      style={styles.horizontalCard}
      activeOpacity={0.9}
    >
      <Image
        source={{ uri: recipe.imageURL }}
        className="w-full h-[170px]"
        resizeMode="cover"
      />

      {/* Gradient overlay */}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.5)']}
        className="absolute bottom-0 left-0 right-0 h-32"
      />

      {/* Glass content overlay */}
      <View className="absolute bottom-0 left-0 right-0 rounded-t-2xl overflow-hidden">
        <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFill} />
        <View className="p-4 bg-white/70" style={styles.horizontalContent}>
          <Text className="text-base font-bold text-neutral-800 dark:text-neutral-100" numberOfLines={1}>
            {recipe.title}
          </Text>
          <View className="flex-row items-center mt-2 space-x-3">
            <View className="flex-row items-center">
              <Ionicons name="time-outline" size={14} color={colors.textMuted} />
              <Text className="text-xs text-neutral-600 dark:text-neutral-400 ml-1 font-medium">
                {recipe.prepTime + recipe.cookTime} min
              </Text>
            </View>
            <View className="flex-row items-center">
              <Ionicons name="flame-outline" size={14} color={colors.accent} />
              <Text className="text-xs ml-1 font-medium" style={{ color: colors.accent }}>
                {recipe.nutrition?.caloriesPerServing || 0} cal
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Chef badge */}
      {recipe.isOfficial && (
        <View className="absolute top-3 left-3 rounded-full overflow-hidden">
          <BlurView intensity={80} tint="light" style={StyleSheet.absoluteFill} />
          <View className="px-2.5 py-1 bg-white/60">
            <Ionicons name="star" size={12} color={colors.accent} />
          </View>
        </View>
      )}
    </TouchableOpacity>
  );
};

// Featured recipe card (larger, for hero sections)
export const FeaturedRecipeCard: React.FC<RecipeCardProps> = ({
  recipe,
  onPress,
}) => {
  const router = useRouter();
  const colors = useThemeColors();

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else {
      router.push(`/recipe/${recipe.id}`);
    }
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      className="rounded-3xl overflow-hidden"
      style={styles.featuredCard}
      activeOpacity={0.9}
    >
      <Image
        source={{ uri: recipe.imageURL }}
        className="w-full h-64"
        resizeMode="cover"
      />

      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.7)']}
        className="absolute bottom-0 left-0 right-0 h-40"
      />

      <View className="absolute bottom-0 left-0 right-0 p-6">
        <View className="flex-row items-center mb-3">
          <View className="rounded-full overflow-hidden mr-2">
            <BlurView intensity={60} tint="light" style={StyleSheet.absoluteFill} />
            <View className="px-3 py-1 bg-white/50">
              <Text className="text-xs font-semibold text-primary-600">Featured</Text>
            </View>
          </View>
          <View className="flex-row items-center bg-white/20 rounded-full px-2 py-1">
            <Ionicons name="time-outline" size={12} color="white" />
            <Text className="text-xs text-white ml-1">{recipe.prepTime + recipe.cookTime} min</Text>
          </View>
        </View>

        <Text className="text-2xl font-bold text-white mb-1" numberOfLines={2}>
          {recipe.title}
        </Text>
        <Text className="text-sm text-white/80" numberOfLines={1}>
          by {recipe.authorName}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 24,
    elevation: 8,
  },
  compactCard: {
    backgroundColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 4,
  },
  horizontalCard: {
    backgroundColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 8,
  },
  horizontalContent: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.5)',
  },
  featuredCard: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.15,
    shadowRadius: 28,
    elevation: 12,
  },
  badge: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  actionButton: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  timeBadge: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
});
