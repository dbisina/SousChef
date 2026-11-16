import React from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { CookbookSuggestion } from '@/types/cookbookLibrary';
import { Chip, H2, Muted, PhotoCard, Tag, UCard, useColor } from '@/components/ui';
import { dishPhoto } from './shelfPhotos';

interface SuggestionCardProps {
  suggestion: CookbookSuggestion;
  onPress?: (suggestion: CookbookSuggestion) => void;
}

const SuggestionCard = ({ suggestion, onPress }: SuggestionCardProps) => {
  const { t } = useTranslation();
  const missing = suggestion.missingIngredients?.length ?? 0;
  const matching = suggestion.matchingIngredients?.slice(0, 3) ?? [];
  const source = suggestion.imageURL
    ? { uri: suggestion.imageURL }
    : dishPhoto(`${suggestion.cookbookTitle}-${suggestion.recipeName}`);

  return (
    <View style={{ width: 288, gap: 10 }}>
      <PhotoCard
        source={source}
        height={170}
        radius={28}
        title={suggestion.recipeName}
        subtitle={suggestion.reason || undefined}
        topLeft={<Tag tone="glassDark" icon="book" label={suggestion.cookbookTitle} />}
        topRight={<Tag tone="g" label={`${Math.round(suggestion.confidence * 100)}%`} />}
        onPress={onPress ? () => onPress(suggestion) : undefined}
        accessibilityLabel={`${suggestion.recipeName}, ${suggestion.cookbookTitle}`}
      />
      {(matching.length > 0 || missing > 0) && (
        <View className="flex-row flex-wrap" style={{ gap: 6 }}>
          {matching.map((ing) => (
            <Tag key={ing} tone="g" label={ing} />
          ))}
          {missing > 0 && (
            <Tag tone="r" label={t('cookbooks.suggestions.needed', '+{{n}} needed', { n: missing })} />
          )}
        </View>
      )}
    </View>
  );
};

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
  const { t } = useTranslation();
  const spinner = useColor('muted');

  if (suggestions.length === 0 && !isSuggesting) return null;

  return (
    <View style={{ gap: 12 }}>
      <View className="flex-row items-center justify-between" style={{ paddingHorizontal: 20, gap: 12 }}>
        <View className="flex-1" style={{ gap: 2 }}>
          <H2>{t('cookbooks.suggestions.title', 'Recipes you can make')}</H2>
          <Muted small>{t('cookbooks.suggestions.subtitle', 'Based on your pantry and cookbooks')}</Muted>
        </View>
        {suggestions.length > 0 && (
          <Chip icon="close" label={t('cookbooks.suggestions.clear', 'Clear')} onPress={onClear} />
        )}
      </View>

      {isSuggesting && suggestions.length === 0 && (
        <View style={{ paddingHorizontal: 20 }}>
          <UCard style={{ alignItems: 'center', gap: 10 }}>
            <ActivityIndicator size="small" color={spinner} />
            <Muted>{t('cookbooks.suggestions.searching', 'Searching your cookbooks...')}</Muted>
          </UCard>
        </View>
      )}

      {suggestions.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, gap: 14, paddingBottom: 4 }}
        >
          {suggestions.map((s, i) => (
            <SuggestionCard
              key={`${s.cookbookTitle}-${s.recipeName}-${i}`}
              suggestion={s}
              onPress={onPressSuggestion}
            />
          ))}
        </ScrollView>
      )}
    </View>
  );
};
