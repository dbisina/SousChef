import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, Share, Alert, Linking } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import { useWantToCookStore } from '@/stores/wantToCookStore';
import {
  FONT,
  H2,
  Icon,
  Muted,
  Rows,
  Screen,
  Segmented,
  Tag,
  Tile,
  UButton,
  UIconButton,
} from '@/components/ui';
import { InstructionList, ActionBar, DetailHero } from '@/components/recipe';
import { sourceLabel } from '@/components/import/WantToCookCard';
import { showSuccessToast } from '@/stores/toastStore';
import { SAMPLE } from '@/assets/sample';

type Panel = 'ingredients' | 'steps' | 'tags';

export default function ImportedRecipeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t } = useTranslation();
  const { items, addToShoppingList, markAsCooked, removeFromWantToCook } = useWantToCookStore();
  const [panel, setPanel] = useState<Panel>('ingredients');

  const item = useMemo(() => items.find((i) => i.id === id), [items, id]);
  const recipe = item?.importedRecipe;

  if (!item || !recipe) {
    return (
      <Screen bare>
        <View className="flex-1 items-center justify-center" style={{ paddingHorizontal: 32, gap: 12 }}>
          <View className="items-center justify-center bg-surface" style={{ width: 88, height: 88, borderRadius: 44 }}>
            <Icon name="warning" size="lg" color="muted" />
          </View>
          <H2 center>{t('cooking.recipeNotFound', 'Recipe not found')}</H2>
          <Muted center>{t('cooking.recipeRemoved', 'This recipe may have been removed.')}</Muted>
          <View style={{ alignSelf: 'stretch', marginTop: 12 }}>
            <UButton label={t('cooking.goBack', 'Go Back')} onPress={() => router.back()} />
          </View>
        </View>
      </Screen>
    );
  }

  const source = sourceLabel(recipe.sourcePlatform);
  const missing = new Set((item.missingIngredients ?? []).map((m) => m.toLowerCase()));
  const cooked = item.status === 'cooked';

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Check out this recipe: ${recipe.title}\n${recipe.sourceURL || ''}`.trim(),
      });
    } catch (e) {
      console.error(e);
    }
  };

  const handleOpenSource = () => {
    if (recipe.sourceURL) Linking.openURL(recipe.sourceURL);
  };

  const handleAddToShoppingList = () => {
    const ingredients =
      item.missingIngredients?.map((name) => ({
        name,
        amount: 1,
        unit: 'item',
        recipeId: item.id,
        recipeName: recipe.title,
      })) ||
      recipe.ingredients.map((ing) => ({
        name: ing.name,
        amount: ing.amount,
        unit: ing.unit,
        recipeId: item.id,
        recipeName: recipe.title,
      }));

    addToShoppingList(ingredients);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    showSuccessToast('Ingredients are on your list! See you at the store.', 'Added!');
  };

  const handleMarkCooked = () => {
    markAsCooked(item.id);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    showSuccessToast('Boom! Cooked it. Hope it was delicious!', 'Nice!');
  };

  const handleRemove = () => {
    Alert.alert(
      'Remove Recipe?',
      `Are you sure you want to remove "${recipe.title}"? You can always import it again later if you miss it!`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            removeFromWantToCook(item.id);
            router.back();
          },
        },
      ]
    );
  };

  const detailTags = [
    recipe.difficulty ? recipe.difficulty.charAt(0).toUpperCase() + recipe.difficulty.slice(1) : null,
    recipe.category ?? null,
    recipe.cuisine ?? null,
  ].filter((x): x is string => !!x);

  return (
    <Screen
      bare
      footer={
        <ActionBar>
          <UButton
            label={t('cooking.shop', 'Shop')}
            variant="ghost"
            icon="cart"
            onPress={handleAddToShoppingList}
            style={{ width: 120 }}
          />
          {!cooked ? (
            <UButton
              label={t('cooking.markCooked', 'Mark as Cooked')}
              onPress={handleMarkCooked}
              style={{ flex: 1 }}
            />
          ) : (
            <View className="flex-1 flex-row items-center justify-center bg-tag-g" style={{ height: 58, borderRadius: 29, gap: 8 }}>
              <Icon name="check" color="tag-g-fg" />
              <Text className="text-tag-g-fg" style={{ fontFamily: FONT.display, fontSize: 16 }}>
                {t('cooking.cooked', 'Cooked')}
              </Text>
            </View>
          )}
        </ActionBar>
      }
    >
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 150 }}>
        <DetailHero
          source={recipe.imageURL ? { uri: recipe.imageURL } : SAMPLE.bowl}
          height={360}
          onBack={() => router.back()}
          backLabel={t('cooking.back', 'Back')}
          actions={
            <>
              <UIconButton icon="share" label={t('cooking.share', 'Share')} tone="glassDark" onPress={handleShare} />
              <UIconButton icon="trash" label={t('cooking.remove', 'Remove')} tone="glassDark" onPress={handleRemove} />
            </>
          }
          caption={
            <>
              {source ? (
                <Pressable
                  onPress={handleOpenSource}
                  disabled={!recipe.sourceURL}
                  accessibilityRole="link"
                  accessibilityLabel={t('cooking.viewOriginal', 'View original on {{source}}', { source })}
                  style={{ alignSelf: 'flex-start' }}
                >
                  <Tag large tone="glassDark" icon="play" label={t('cooking.importedFrom', 'Imported from {{source}}', { source })} />
                </Pressable>
              ) : null}
              <Text
                className="text-paper"
                numberOfLines={3}
                style={{ fontFamily: FONT.display, fontSize: 30, lineHeight: 32, letterSpacing: -0.6 }}
              >
                {recipe.title}
              </Text>
            </>
          }
        />

        <View
          className="bg-ground"
          style={{ marginTop: -34, borderTopLeftRadius: 34, borderTopRightRadius: 34, paddingTop: 24, paddingHorizontal: 20, gap: 16 }}
        >
          <View className="flex-row" style={{ gap: 10 }}>
            <View className="flex-1">
              <Tile label={t('cooking.prep', 'Prep')} value={recipe.prepTime ? t('cooking.minutes', '{{count}} min', { count: recipe.prepTime }) : '-'} />
            </View>
            <View className="flex-1">
              <Tile label={t('cooking.cook', 'Cook')} value={recipe.cookTime ? t('cooking.minutes', '{{count}} min', { count: recipe.cookTime }) : '-'} />
            </View>
            <View className="flex-1">
              <Tile label={t('cooking.serves', 'Serves')} value={`${recipe.servings}`} />
            </View>
          </View>

          {recipe.description ? <Muted style={{ fontSize: 15, lineHeight: 22 }}>{recipe.description}</Muted> : null}

          {/* Pantry match + extraction confidence */}
          <View className="flex-row flex-wrap" style={{ gap: 8 }}>
            {item.pantryMatchPercent !== undefined ? (
              <Tag
                tone="g"
                icon="check"
                label={
                  item.missingIngredients && item.missingIngredients.length > 0
                    ? t('cooking.pantryMatchMissing', '{{n}}% pantry match · missing {{list}}', {
                        n: item.pantryMatchPercent,
                        list: item.missingIngredients.join(', '),
                      })
                    : t('cooking.pantryMatch', '{{n}}% pantry match', { n: item.pantryMatchPercent })
                }
              />
            ) : null}
            <Tag
              tone="o"
              label={t('cooking.extractionMatch', '{{n}}% match', { n: Math.round(recipe.extractionConfidence * 100) })}
            />
            {detailTags.map((d) => (
              <Tag key={d} label={d} />
            ))}
          </View>

          <Segmented<Panel>
            value={panel}
            onChange={setPanel}
            options={[
              { value: 'ingredients', label: t('cooking.ingredients', 'Ingredients') },
              { value: 'steps', label: t('cooking.steps', 'Steps') },
              { value: 'tags', label: t('cooking.tags', 'Tags') },
            ]}
          />

          {panel === 'ingredients' ? (
            <Rows>
              {recipe.ingredients.map((ing, idx) => {
                const isMissing = missing.has(ing.name.toLowerCase());
                return (
                  <View key={`${ing.name}-${idx}`} className="flex-row items-center" style={{ minHeight: 64, gap: 14 }}>
                    <View
                      className="items-center justify-center bg-surface-3"
                      style={{ width: 44, height: 44, borderRadius: 22 }}
                    >
                      <Icon name="leaf" color={isMissing ? 'subtle' : 'ink'} />
                    </View>
                    <Text
                      className={isMissing ? 'flex-1 text-muted' : 'flex-1 text-ink'}
                      style={{ fontFamily: FONT.sans, fontSize: 15 }}
                    >
                      {ing.name}
                    </Text>
                    <Text className="text-ink" style={{ fontFamily: FONT.sansSemi, fontSize: 15 }}>
                      {ing.amount} {ing.unit}
                    </Text>
                  </View>
                );
              })}
            </Rows>
          ) : null}

          {panel === 'steps' ? <InstructionList instructions={recipe.instructions} /> : null}

          {panel === 'tags' ? (
            <View style={{ gap: 16 }}>
              {recipe.tags && recipe.tags.length > 0 ? (
                <View className="flex-row flex-wrap" style={{ gap: 8 }}>
                  {recipe.tags.map((tag) => (
                    <Tag key={tag} label={`#${tag}`} large />
                  ))}
                </View>
              ) : (
                <Muted>{t('cooking.noTags', 'No tags on this recipe.')}</Muted>
              )}

              {recipe.sourceURL ? (
                <Rows box>
                  <Pressable
                    onPress={handleOpenSource}
                    accessibilityRole="link"
                    className="flex-row items-center"
                    style={{ minHeight: 64, gap: 14 }}
                  >
                    <View className="items-center justify-center bg-surface-3" style={{ width: 44, height: 44, borderRadius: 22 }}>
                      <Icon name="link" />
                    </View>
                    <Text className="flex-1 text-ink" numberOfLines={1} style={{ fontFamily: FONT.display, fontSize: 15 }}>
                      {t('cooking.viewOriginal', 'View original on {{source}}', { source: source ?? t('cooking.web', 'web') })}
                    </Text>
                    <Icon name="arrowUpRight" color="subtle" />
                  </Pressable>
                </Rows>
              ) : null}
            </View>
          ) : null}
        </View>
      </ScrollView>
    </Screen>
  );
}
