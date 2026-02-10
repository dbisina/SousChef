import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Cookbook } from '@/types';
import { useThemeColors } from '@/stores/themeStore';

interface CookbookCardProps {
  cookbook: Cookbook;
  onPress?: () => void;
  onSave?: () => void;
  isSaved?: boolean;
}

export const CookbookCard: React.FC<CookbookCardProps> = ({
  cookbook,
  onPress,
  onSave,
  isSaved = false,
}) => {
  const router = useRouter();
  const colors = useThemeColors();

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else {
      router.push(`/cookbook/${cookbook.id}` as any);
    }
  };

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
          source={{ uri: cookbook.coverImageURL }}
          className="w-full h-48"
          resizeMode="cover"
        />

        {/* Gradient overlay for better text readability */}
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.5)']}
          className="absolute bottom-0 left-0 right-0 h-24"
        />

        {/* Cookbook badge - glass effect */}
        <View className="absolute top-4 left-4 rounded-full overflow-hidden" style={styles.badge}>
          <BlurView intensity={80} tint="light" style={StyleSheet.absoluteFill} />
          <View className="flex-row items-center px-3 py-1.5 bg-white/60">
            <Ionicons name="book" size={14} color={colors.accent} />
            <Text className="text-xs font-semibold ml-1" style={{ color: colors.accent }}>Cookbook</Text>
          </View>
        </View>

        {/* Save button - glass effect */}
        {onSave && (
          <View className="absolute top-4 right-4">
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
          </View>
        )}

        {/* Recipe count at bottom of image */}
        <View className="absolute bottom-4 left-4">
          <View className="rounded-full overflow-hidden" style={styles.countBadge}>
            <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />
            <View className="flex-row items-center px-3 py-1.5 bg-black/30">
              <Ionicons name="restaurant-outline" size={14} color="white" />
              <Text className="text-white text-xs font-medium ml-1">
                {cookbook.recipeIds.length} recipes
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Content */}
      <View className="p-5 bg-white dark:bg-neutral-800">
        <Text className="text-xl font-bold text-neutral-800 dark:text-neutral-100 tracking-tight" numberOfLines={1}>
          {cookbook.title}
        </Text>

        <Text className="text-sm text-neutral-500 dark:text-neutral-400 mt-1.5 leading-relaxed" numberOfLines={2}>
          {cookbook.description}
        </Text>

        {/* Category badge */}
        {cookbook.category && (
          <View className="mt-3">
            <View className="self-start px-3 py-1 rounded-full" style={{ backgroundColor: colors.accent + '15' }}>
              <Text className="text-xs font-medium" style={{ color: colors.accent }}>{cookbook.category}</Text>
            </View>
          </View>
        )}

        {/* Footer with likes */}
        <View className="flex-row items-center justify-between mt-4 pt-4 border-t border-neutral-100 dark:border-neutral-700">
          <View className="flex-row items-center">
            <Ionicons name="heart" size={16} color={colors.accent} />
            <Text className="text-sm text-neutral-600 dark:text-neutral-400 ml-1.5 font-medium">
              {cookbook.likes} likes
            </Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

// Horizontal scrolling cookbook card - Book Style
export const HorizontalCookbookCard: React.FC<CookbookCardProps> = ({
  cookbook,
  onPress,
}) => {
  const router = useRouter();
  const colors = useThemeColors();

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else {
      router.push(`/cookbook/${cookbook.id}` as any);
    }
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      className="mr-5 mb-2"
      activeOpacity={0.9}
    >
      {/* Book Cover Container */}
      <View 
        className="w-40 h-60 rounded-r-lg rounded-l-sm overflow-hidden bg-white relative"
        style={styles.bookShadow}
      >
        <Image
          source={{ uri: cookbook.coverImageURL }}
          className="w-full h-full"
          resizeMode="cover"
        />

        {/* Spine Effect (Left Edge) */}
        <LinearGradient
          colors={['rgba(255,255,255,0.4)', 'rgba(255,255,255,0.1)', 'rgba(0,0,0,0.1)', 'rgba(0,0,0,0.3)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 14, zIndex: 10 }}
        />
        
        {/* Spine Groove Line */}
        <View 
          className="absolute top-0 bottom-0 w-[0.5px] bg-black/20"
          style={{ left: 14, zIndex: 10 }}
        />

        {/* Gradient overlay for text */}
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.8)']}
          className="absolute bottom-0 left-0 right-0 h-32"
        />

        {/* Content Overlay */}
        <View className="absolute bottom-0 left-0 right-0 p-3 pl-5">
          <Text className="text-white font-bold text-base leading-tight mb-1" numberOfLines={2}>
            {cookbook.title}
          </Text>
          <View className="flex-row items-center justify-between">
            <Text className="text-white/80 text-xs font-medium">
              {cookbook.recipeIds.length} recipes
            </Text>
             <View className="flex-row items-center bg-black/30 rounded-full px-1.5 py-0.5">
              <Ionicons name="heart" size={10} color={colors.accent} />
              <Text className="text-[10px] text-white ml-1 font-medium">
                {cookbook.likes}
              </Text>
            </View>
          </View>
        </View>

        {/* Cookbook badge */}
        <View className="absolute top-2 right-2 rounded-full overflow-hidden">
          <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />
          <View className="px-2 py-1 bg-black/30">
            <Ionicons name="book" size={10} color="white" />
          </View>
        </View>
      </View>
      
      {/* Pages Effect (Right Edge Depth) */}
      <View 
        className="absolute top-1 bottom-1 -right-1.5 w-1.5 bg-neutral-100 rounded-r-sm border-r border-t border-b border-neutral-300"
        style={{ zIndex: -1 }}
      >
        {/* Lines to simulate paper */}
        <View className="h-full w-full flex-col justify-evenly opacity-30">
             {[...Array(10)].map((_, i) => (
                 <View key={i} className="h-[0.5px] bg-black w-full" />
             ))}
        </View>
      </View>
    </TouchableOpacity>
  );
};

// Compact cookbook card for lists
export const CompactCookbookCard: React.FC<CookbookCardProps> = ({
  cookbook,
  onPress,
}) => {
  const router = useRouter();
  const colors = useThemeColors();

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else {
      router.push(`/cookbook/${cookbook.id}` as any);
    }
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      className="flex-row rounded-2xl overflow-hidden mb-3"
      style={styles.compactCard}
      activeOpacity={0.85}
    >
      <Image
        source={{ uri: cookbook.coverImageURL }}
        className="w-24 h-24 rounded-xl"
      />
      <View className="flex-1 p-3 justify-center">
        <Text className="text-base font-semibold text-neutral-800 dark:text-neutral-100" numberOfLines={1}>
          {cookbook.title}
        </Text>
        <Text className="text-sm text-neutral-500 dark:text-neutral-400 mt-1" numberOfLines={1}>
          {cookbook.description}
        </Text>
        <View className="flex-row items-center mt-2 space-x-3">
          <View className="flex-row items-center">
            <Ionicons name="restaurant-outline" size={12} color="#78716C" />
            <Text className="text-xs text-neutral-500 dark:text-neutral-400 ml-1">
              {cookbook.recipeIds.length} recipes
            </Text>
          </View>
          <View className="flex-row items-center">
            <Ionicons name="heart" size={12} color={colors.accent} />
            <Text className="text-xs ml-1" style={{ color: colors.accent }}>{cookbook.likes}</Text>
          </View>
        </View>
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
  bookShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 8,
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
  countBadge: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
});
