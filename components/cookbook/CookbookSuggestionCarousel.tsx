import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { CookbookSuggestion } from '@/types/cookbookLibrary';
import { useThemeColors } from '@/stores/themeStore';

interface SuggestionCardProps {
  suggestion: CookbookSuggestion;
  index: number;
  onPress?: (suggestion: CookbookSuggestion) => void;
}

const SuggestionCard = ({ suggestion, index, onPress }: SuggestionCardProps) => (
  <Animated.View entering={FadeInDown.duration(300).delay(index * 80)}>
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => onPress?.(suggestion)}
      className="w-72 rounded-3xl overflow-hidden mr-4 bg-white dark:bg-neutral-800"
      style={styles.card}
    >
      {/* Food image or amber gradient fallback */}
      {suggestion.imageURL ? (
        <Image
          source={{ uri: suggestion.imageURL }}
          className="w-full"
          style={{ height: 140 }}
          resizeMode="cover"
        />
      ) : (
        <LinearGradient
          colors={['#F59E0B', '#D97706']}
          className="w-full items-center justify-center"
          style={{ height: 140 }}
        >
          <Ionicons name="restaurant-outline" size={40} color="rgba(255,255,255,0.7)" />
        </LinearGradient>
      )}

      {/* Confidence badge - top right */}
      <View className="absolute top-3 right-3">
        <View className="bg-green-500/90 px-2.5 py-1 rounded-full">
          <Text className="text-[11px] font-bold text-white">
            {Math.round(suggestion.confidence * 100)}%
          </Text>
        </View>
      </View>

      {/* Cookbook name badge - top left */}
      <View className="absolute top-3 left-3" style={{ maxWidth: 180 }}>
        <View className="bg-black/50 px-2.5 py-1 rounded-full flex-row items-center">
          <Ionicons name="book-outline" size={11} color="white" />
          <Text className="text-white text-[11px] font-medium ml-1" numberOfLines={1}>
            {suggestion.cookbookTitle}
          </Text>
        </View>
      </View>

      {/* Content below image */}
      <View className="p-3 pb-3.5">
        <Text
          className="text-[15px] font-bold text-neutral-900 dark:text-neutral-50"
          numberOfLines={1}
        >
          {suggestion.recipeName}
        </Text>

        {suggestion.reason ? (
          <Text
            className="text-xs text-neutral-500 dark:text-neutral-400 mt-1"
            numberOfLines={1}
          >
            {suggestion.reason}
          </Text>
        ) : null}

        {/* Ingredient badges */}
        <View className="flex-row flex-wrap mt-2 gap-1">
          {suggestion.matchingIngredients?.slice(0, 3).map((ing) => (
            <View
              key={ing}
              className="bg-green-50 dark:bg-green-900/20 px-2 py-0.5 rounded-full"
            >
              <Text className="text-[11px] text-green-700 dark:text-green-400">{ing}</Text>
            </View>
          ))}
          {(suggestion.missingIngredients?.length ?? 0) > 0 && (
            <View className="bg-red-50 dark:bg-red-900/20 px-2 py-0.5 rounded-full">
              <Text className="text-[11px] text-red-600 dark:text-red-400">
                +{suggestion.missingIngredients.length} needed
              </Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  </Animated.View>
);

interface CookbookSuggestionCarouselProps {
  suggestions: CookbookSuggestion[];
  onClear: () => void;
  onPressSuggestion?: (suggestion: CookbookSuggestion) => void;
  isSuggesting: boolean;
}

export const CookbookSuggestionCarousel: React.FC<CookbookSuggestionCarouselProps> = ({
  suggestions,
  onClear,
  onPressSuggestion,
  isSuggesting,
}) => {
  const colors = useThemeColors();

  if (suggestions.length === 0 && !isSuggesting) return null;

  return (
    <View className="mb-4">
      {/* Section header with clear button */}
      <View className="flex-row items-center justify-between px-5 mb-3">
        <View>
          <Text className="text-base font-bold text-neutral-900 dark:text-neutral-50">
            Recipes You Can Make
          </Text>
          <Text className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
            Based on your pantry + cookbooks
          </Text>
        </View>
        {suggestions.length > 0 && (
          <TouchableOpacity
            onPress={onClear}
            className="flex-row items-center px-3 py-1.5 rounded-full bg-neutral-100 dark:bg-neutral-700"
          >
            <Ionicons name="close-circle-outline" size={14} color={colors.textMuted} />
            <Text className="text-xs text-neutral-500 dark:text-neutral-400 ml-1 font-medium">
              Clear
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Loading state */}
      {isSuggesting && suggestions.length === 0 && (
        <View className="mx-5 p-6 rounded-2xl bg-amber-50 dark:bg-amber-900/20 items-center">
          <ActivityIndicator size="small" color="#D97706" />
          <Text className="text-amber-700 dark:text-amber-400 text-sm mt-2 font-medium">
            Searching your cookbooks...
          </Text>
        </View>
      )}

      {/* Horizontal carousel */}
      {suggestions.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 4 }}
        >
          {suggestions.map((s, i) => (
            <SuggestionCard
              key={`${s.cookbookTitle}-${s.recipeName}-${i}`}
              suggestion={s}
              index={i}
              onPress={onPressSuggestion}
            />
          ))}
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 8,
  },
});
