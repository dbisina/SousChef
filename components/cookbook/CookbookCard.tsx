import React from 'react';
import { Pressable, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Cookbook } from '@/types';
import { BookCover, Icon, ListRow, PhotoCard, Tag, Thumb, UIconButton } from '@/components/ui';

interface CookbookCardProps {
  cookbook: Cookbook;
  onPress?: () => void;
  onSave?: () => void;
  isSaved?: boolean;
}

function useOpenCookbook(cookbook: Cookbook, onPress?: () => void) {
  const router = useRouter();
  return () => {
    if (onPress) onPress();
    else router.push(`/cookbook/${cookbook.id}` as Href);
  };
}

export const CookbookCard: React.FC<CookbookCardProps> = ({ cookbook, onPress, onSave, isSaved = false }) => {
  const { t } = useTranslation();
  const open = useOpenCookbook(cookbook, onPress);

  return (
    <View style={{ marginBottom: 14 }}>
      <PhotoCard
        source={{ uri: cookbook.coverImageURL }}
        height={210}
        title={cookbook.title}
        subtitle={cookbook.description}
        topLeft={<Tag tone="glass" icon="book" label={t('cookbooks.card.cookbook', 'Cookbook')} />}
        topRight={
          onSave ? (
            <UIconButton
              icon="bookmark"
              tone="glass"
              size={44}
              filled={isSaved}
              label={isSaved ? t('cookbooks.card.unsave', 'Remove from saved') : t('cookbooks.card.save', 'Save cookbook')}
              onPress={onSave}
            />
          ) : null
        }
        onPress={open}
        accessibilityLabel={cookbook.title}
      />
      <View className="flex-row flex-wrap" style={{ gap: 6, marginTop: 10, paddingHorizontal: 4 }}>
        <Tag
          label={t('cookbooks.card.recipes', '{{count}} recipes', { count: cookbook.recipeIds.length })}
          icon="book"
        />
        <Tag label={t('cookbooks.card.likes', '{{count}} likes', { count: cookbook.likes })} icon="heart" />
        {cookbook.category ? <Tag tone="o" label={cookbook.category} /> : null}
      </View>
    </View>
  );
};

// Horizontal scrolling cookbook card: the BookCover primitive.
export const HorizontalCookbookCard: React.FC<CookbookCardProps> = ({ cookbook, onPress }) => {
  const { t } = useTranslation();
  const open = useOpenCookbook(cookbook, onPress);

  return (
    <View style={{ marginRight: 14, marginBottom: 8 }}>
      <BookCover
        source={{ uri: cookbook.coverImageURL }}
        title={cookbook.title}
        kicker={t('cookbooks.card.recipes', '{{count}} recipes', { count: cookbook.recipeIds.length })}
        width={150}
        height={210}
        onPress={open}
      />
    </View>
  );
};

// Compact cookbook row for lists
export const CompactCookbookCard: React.FC<CookbookCardProps> = ({ cookbook, onPress }) => {
  const { t } = useTranslation();
  const open = useOpenCookbook(cookbook, onPress);

  return (
    <Pressable accessibilityRole="button" accessibilityLabel={cookbook.title} onPress={open}>
      <ListRow
        tall
        title={cookbook.title}
        subtitle={t('cookbooks.card.recipesAndLikes', '{{recipes}} recipes · {{likes}} likes', {
          recipes: cookbook.recipeIds.length,
          likes: cookbook.likes,
        })}
        leading={<Thumb source={{ uri: cookbook.coverImageURL }} name={cookbook.title} size={52} />}
        right={<Icon name="chevronRight" color="subtle" />}
      />
    </Pressable>
  );
};
