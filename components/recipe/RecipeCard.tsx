import React, { memo } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Recipe } from '@/types';
import { PhotoCard, Tag, Thumb, UIconButton, FONT } from '@/components/ui';

interface RecipeCardProps {
  recipe: Recipe;
  onPress?: () => void;
  onLike?: () => void;
  onSave?: () => void;
  isSaved?: boolean;
  showAuthor?: boolean;
  compact?: boolean;
}

const useOpen = (recipe: Recipe, onPress?: () => void) => {
  const router = useRouter();
  return () => {
    if (onPress) {
      onPress();
    } else {
      router.push(`/recipe/${recipe.id}`);
    }
  };
};

const totalMinutes = (recipe: Recipe) => recipe.prepTime + recipe.cookTime;

export const RecipeCard: React.FC<RecipeCardProps> = memo(({
  recipe,
  onPress,
  onLike,
  onSave,
  isSaved = false,
  showAuthor = true,
  compact = false,
}) => {
  const { t } = useTranslation();
  const open = useOpen(recipe, onPress);
  const minutes = t('cooking.minutes', '{{count}} min', { count: totalMinutes(recipe) });
  const cal = recipe.nutrition?.caloriesPerServing || 0;

  if (compact) {
    return (
      <Pressable
        onPress={open}
        accessibilityRole="button"
        accessibilityLabel={recipe.title}
        style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', minHeight: 72, gap: 14, opacity: pressed ? 0.8 : 1 })}
      >
        <Thumb source={recipe.imageURL ? { uri: recipe.imageURL } : null} name={recipe.title} />
        <View className="flex-1" style={{ minWidth: 0, gap: 2 }}>
          <Text className="text-ink" numberOfLines={1} style={{ fontFamily: FONT.display, fontSize: 15, letterSpacing: -0.15 }}>
            {recipe.title}
          </Text>
          <Text className="text-muted" numberOfLines={1} style={{ fontFamily: FONT.sans, fontSize: 12 }}>
            {minutes}
          </Text>
        </View>
        <Tag label={`${cal} ${t('cooking.cal', 'cal')}`} tone="o" />
      </Pressable>
    );
  }

  const subtitle = [minutes, `${cal} ${t('cooking.cal', 'cal')}`, showAuthor ? recipe.authorName : null]
    .filter(Boolean)
    .join(' · ');

  return (
    <PhotoCard
      source={{ uri: recipe.imageURL }}
      height={240}
      title={recipe.title}
      subtitle={subtitle}
      onPress={open}
      topLeft={recipe.isOfficial ? <Tag label={t('cooking.chefPick', "Chef's Pick")} tone="glassDark" /> : undefined}
      topRight={
        <>
          {onLike ? (
            <UIconButton icon="heart" label={t('cooking.like', 'Like')} tone="glassDark" onPress={onLike} />
          ) : null}
          {onSave ? (
            <UIconButton
              icon="bookmark"
              label={isSaved ? t('cooking.unsave', 'Remove from saved') : t('cooking.save', 'Save recipe')}
              tone="glassDark"
              filled={isSaved}
              onPress={onSave}
            />
          ) : null}
        </>
      }
    />
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

// Horizontal scrolling recipe card
export const HorizontalRecipeCard: React.FC<RecipeCardProps> = ({ recipe, onPress }) => {
  const { t } = useTranslation();
  const open = useOpen(recipe, onPress);
  return (
    <View style={{ marginRight: 12 }}>
      <PhotoCard
        source={{ uri: recipe.imageURL }}
        width={288}
        height={190}
        radius={26}
        titleSize={17}
        title={recipe.title}
        subtitle={`${t('cooking.minutes', '{{count}} min', { count: totalMinutes(recipe) })} · ${
          recipe.nutrition?.caloriesPerServing || 0
        } ${t('cooking.cal', 'cal')}`}
        onPress={open}
        topLeft={recipe.isOfficial ? <Tag label={t('cooking.chefPick', "Chef's Pick")} tone="glassDark" /> : undefined}
      />
    </View>
  );
};

// Featured recipe card (larger, for hero sections)
export const FeaturedRecipeCard: React.FC<RecipeCardProps> = ({ recipe, onPress }) => {
  const { t } = useTranslation();
  const open = useOpen(recipe, onPress);
  return (
    <PhotoCard
      source={{ uri: recipe.imageURL }}
      height={260}
      fade="both"
      titleSize={24}
      title={recipe.title}
      subtitle={`${t('cooking.byAuthor', 'by {{name}}', { name: recipe.authorName })} · ${t('cooking.minutes', '{{count}} min', {
        count: totalMinutes(recipe),
      })}`}
      onPress={open}
      topLeft={<Tag label={t('cooking.featured', 'Featured')} tone="glassDark" />}
    />
  );
};
