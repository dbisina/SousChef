import React, { useCallback, useMemo, useState } from 'react';
import { Alert, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useWantToCookStore } from '@/stores/wantToCookStore';
import { WantToCookCard } from '@/components/import';
import { WantToCookItem } from '@/types/wantToCook';
import { showSuccessToast } from '@/stores/toastStore';
import { Chip, ChipRow, Icon, Screen, TopBar, UIconButton, H2, Muted } from '@/components/ui';

type Filter = 'all' | 'imported' | 'cookbook' | 'cooked';
type Sort = 'recent' | 'match';

const isCookbook = (item: WantToCookItem) => {
  const platform = item.importedRecipe?.sourcePlatform?.toLowerCase() ?? '';
  return platform.includes('cookbook') || (!!item.importedRecipe && !item.importedRecipe.sourceURL);
};

export default function WantToCookScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { items, addToShoppingList, markAsCooked, removeFromWantToCook } = useWantToCookStore();
  const [filter, setFilter] = useState<Filter>('all');
  const [sort, setSort] = useState<Sort>('recent');

  const handleAddToShoppingList = useCallback(
    (item: WantToCookItem) => {
      if (!item.importedRecipe) return;

      const ingredients =
        item.missingIngredients?.map((name) => ({
          name,
          amount: 1,
          unit: 'item',
          recipeId: item.id,
          recipeName: item.importedRecipe?.title,
        })) ||
        item.importedRecipe.ingredients.map((ing) => ({
          name: ing.name,
          amount: ing.amount,
          unit: ing.unit,
          recipeId: item.id,
          recipeName: item.importedRecipe?.title,
        }));

      addToShoppingList(ingredients);
      showSuccessToast('Ingredients are on your list! See you at the store.', 'Added!');
    },
    [addToShoppingList]
  );

  const handleRemove = useCallback(
    (item: WantToCookItem) => {
      Alert.alert(
        'Remove Recipe?',
        'Are you sure you want to remove this recipe? You can always add it back later if you change your mind!',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Remove', style: 'destructive', onPress: () => removeFromWantToCook(item.id) },
        ]
      );
    },
    [removeFromWantToCook]
  );

  const visible = useMemo(() => {
    const filtered = items.filter((item) => {
      if (filter === 'cooked') return item.status === 'cooked';
      if (filter === 'cookbook') return isCookbook(item);
      if (filter === 'imported') return !isCookbook(item);
      return true;
    });
    if (sort === 'match') {
      return [...filtered].sort((a, b) => (b.pantryMatchPercent ?? 0) - (a.pantryMatchPercent ?? 0));
    }
    return filtered;
  }, [items, filter, sort]);

  const card = (item: WantToCookItem, variant: 'hero' | 'tile' | 'row') => (
    <WantToCookCard
      key={item.id}
      item={item}
      variant={variant}
      onPress={() => router.push(`/imported-recipe/${item.id}` as never)}
      onAddToShoppingList={() => handleAddToShoppingList(item)}
      onMarkAsCooked={() => markAsCooked(item.id)}
      onRemove={() => handleRemove(item)}
    />
  );

  const [hero, ...rest] = visible;
  const tiles = rest.slice(0, 2);
  const rows = rest.slice(2);

  return (
    <Screen scroll bottomSpace={40}>
      <TopBar
        variant="compact"
        title={t('cooking.wantToCook', 'Want to Cook')}
        onBack={() => router.back()}
        right={
          <UIconButton
            icon="filters"
            label={sort === 'recent' ? t('cooking.sortByMatch', 'Sort by pantry match') : t('cooking.sortByRecent', 'Sort by recently saved')}
            onPress={() => setSort(sort === 'recent' ? 'match' : 'recent')}
            tone={sort === 'match' ? 'black' : 'default'}
          />
        }
      />

      <View style={{ marginHorizontal: -20 }}>
        <ChipRow>
          <Chip
            label={t('cooking.filterAll', 'All {{count}}', { count: items.length })}
            on={filter === 'all'}
            onPress={() => setFilter('all')}
          />
          <Chip label={t('cooking.filterImported', 'Imported')} on={filter === 'imported'} onPress={() => setFilter('imported')} />
          <Chip
            label={t('cooking.filterCookbooks', 'From cookbooks')}
            on={filter === 'cookbook'}
            onPress={() => setFilter('cookbook')}
          />
          <Chip label={t('cooking.filterCooked', 'Cooked')} on={filter === 'cooked'} onPress={() => setFilter('cooked')} />
        </ChipRow>
      </View>

      {hero ? (
        <>
          {card(hero, 'hero')}
          {tiles.length > 0 ? (
            <View className="flex-row" style={{ gap: 12 }}>
              {tiles.map((item) => (
                <View key={item.id} className="flex-1" style={{ minWidth: 0 }}>
                  {card(item, 'tile')}
                </View>
              ))}
              {tiles.length === 1 ? <View className="flex-1" /> : null}
            </View>
          ) : null}
          {rows.length > 0 ? <View style={{ gap: 4 }}>{rows.map((item) => card(item, 'row'))}</View> : null}
        </>
      ) : (
        <View className="items-center" style={{ paddingTop: 72, paddingHorizontal: 12, gap: 12 }}>
          <View className="items-center justify-center bg-surface" style={{ width: 88, height: 88, borderRadius: 44 }}>
            <Icon name="bookmark" size="lg" color="muted" />
          </View>
          <H2 center>{t('cooking.noSaved', 'No saved recipes yet')}</H2>
          <Muted center>
            {t('cooking.noSavedHelp', 'Import recipes from URLs or scan them from cookbooks to add them here')}
          </Muted>
        </View>
      )}
    </Screen>
  );
}
