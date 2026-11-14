import React, { memo } from 'react';
import { Alert, Platform, Pressable, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { WantToCookItem } from '@/types/wantToCook';
import { Icon, PhotoCard, Tag, Thumb, UIconButton, FONT } from '@/components/ui';
import { SAMPLE } from '@/assets/sample';

export type WantToCookCardVariant = 'hero' | 'tile' | 'row';

interface WantToCookCardProps {
  item: WantToCookItem;
  onPress: () => void;
  onAddToShoppingList: () => void;
  onMarkAsCooked: () => void;
  onRemove: () => void;
  /** hero = full-width photo, tile = half-width photo, row = thumbnail list row (Want to Cook screen). */
  variant?: WantToCookCardVariant;
}

const PLATFORM_LABEL: Record<string, string> = {
  tiktok: 'TikTok',
  youtube: 'YouTube',
  instagram: 'Instagram',
  x: 'X',
  website: 'Web',
};

export const sourceLabel = (platform?: string): string | undefined => {
  if (!platform) return undefined;
  return PLATFORM_LABEL[platform.toLowerCase()] ?? platform.charAt(0).toUpperCase() + platform.slice(1);
};

export const WantToCookCard = memo<WantToCookCardProps>(({
  item,
  onPress,
  onAddToShoppingList,
  onMarkAsCooked,
  onRemove,
  variant = 'hero',
}) => {
  const { t } = useTranslation();
  const recipe = item.importedRecipe;

  if (!recipe) return null;

  const cooked = item.status === 'cooked';
  const minutes = (recipe.prepTime || 0) + (recipe.cookTime || 0);
  const source = sourceLabel(recipe.sourcePlatform);
  const photo = recipe.imageURL ? { uri: recipe.imageURL } : SAMPLE.bowl;

  const handlePress = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onPress();
  };

  // Mark-as-cooked and remove have no slot in the photo-led design, so they live on long press.
  const openActions = () => {
    const buttons = [
      { text: t('cooking.addToList', 'Add to shopping list'), onPress: onAddToShoppingList },
      ...(cooked ? [] : [{ text: t('cooking.markCooked', 'Mark as Cooked'), onPress: onMarkAsCooked }]),
      { text: t('cooking.remove', 'Remove'), style: 'destructive' as const, onPress: onRemove },
      { text: t('cooking.cancel', 'Cancel'), style: 'cancel' as const },
    ];
    Alert.alert(recipe.title, undefined, buttons);
  };

  const subtitleParts = [
    minutes > 0 ? t('cooking.minutes', '{{count}} min', { count: minutes }) : null,
    variant === 'hero'
      ? t('cooking.ingredientCount', '{{count}} ingredients', { count: recipe.ingredients.length })
      : null,
  ].filter(Boolean);

  if (variant === 'row') {
    return (
      <Pressable
        onPress={handlePress}
        onLongPress={openActions}
        accessibilityRole="button"
        accessibilityLabel={recipe.title}
        accessibilityHint={t('cooking.longPressHint', 'Long press for more actions')}
        style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
      >
        <View className="flex-row items-center" style={{ minHeight: 64, gap: 14 }}>
        <Thumb source={photo} name={recipe.title} />
        <View className="flex-1" style={{ minWidth: 0, gap: 2 }}>
          <Text className="text-ink" numberOfLines={1} style={{ fontFamily: FONT.display, fontSize: 15, letterSpacing: -0.15 }}>
            {recipe.title}
          </Text>
          <Text className="text-muted" numberOfLines={1} style={{ fontFamily: FONT.sans, fontSize: 12 }}>
            {[...subtitleParts, cooked ? t('cooking.cooked', 'Cooked') : source].filter(Boolean).join(' · ')}
          </Text>
        </View>
        <Icon name="chevronRight" color="subtle" />
        </View>
      </Pressable>
    );
  }

  const tile = variant === 'tile';
  const topLeft = cooked ? (
    <Tag label={t('cooking.cooked', 'Cooked')} tone="glass" icon="check" large={!tile} />
  ) : source ? (
    <Tag label={source} tone="glassDark" icon={!tile ? 'play' : undefined} large={!tile} />
  ) : undefined;

  return (
    <Pressable
      onPress={handlePress}
      onLongPress={openActions}
      delayLongPress={350}
      accessibilityRole="button"
      accessibilityLabel={recipe.title}
      accessibilityHint={t('cooking.longPressHint', 'Long press for more actions')}
      style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1 })}
    >
      <PhotoCard
        source={photo}
        height={tile ? 210 : 200}
        radius={tile ? 26 : 30}
        title={recipe.title}
        titleSize={tile ? 16 : 20}
        captionInset={tile ? 16 : 18}
        subtitle={subtitleParts.join(' · ')}
        topLeft={topLeft}
        topRight={
          !tile && !cooked ? (
            <UIconButton
              icon="cart"
              label={t('cooking.addToList', 'Add to shopping list')}
              tone="glassDark"
              onPress={onAddToShoppingList}
            />
          ) : undefined
        }
      />
    </Pressable>
  );
});

WantToCookCard.displayName = 'WantToCookCard';

export default WantToCookCard;
