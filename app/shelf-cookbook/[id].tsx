import React, { useState, useCallback } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text as RNText, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Image } from 'expo-image';
import { useCookbookLibraryStore } from '@/stores/cookbookLibraryStore';
import { FIXED } from '@/stores/themeStore';
import {
  BookCover,
  Body,
  H1,
  H2,
  Icon,
  LinkText,
  ListRow,
  Muted,
  Rows,
  Screen,
  Tag,
  Thumb,
  Title,
  ToneBlock,
  UButton,
  UCard,
  UIconButton,
  SheetPanel,
  useColor,
} from '@/components/ui';
import { CookbookPageScanner, coverPhoto, recipePhoto } from '@/components/cookbook';

export default function ShelfCookbookDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const spinner = useColor('muted');
  const { cookbooks, fetchRecipesForCookbook, addScannedRecipe, removeCookbook } =
    useCookbookLibraryStore();

  const cookbook = cookbooks.find((c) => c.id === id);

  const [showScanner, setShowScanner] = useState(false);

  const handleRetryFetch = useCallback(async () => {
    if (!id) return;
    const { isComplete } = await fetchRecipesForCookbook(id);
    if (!isComplete) {
      Alert.alert(
        t('cookbooks.shelfBook.stillIncompleteTitle', 'Still incomplete'),
        t(
          'cookbooks.shelfBook.stillIncompleteBody',
          'Would you like to scan your physical cookbook to add the missing recipes?'
        ),
        [
          { text: t('cookbooks.shelfBook.scanPages', 'Scan pages'), onPress: () => setShowScanner(true) },
          { text: t('cookbooks.shelfBook.notNow', 'Not now'), style: 'cancel' },
        ]
      );
    }
  }, [id, fetchRecipesForCookbook, t]);

  const handleScanSuccess = useCallback(
    (recipeTitle: string) => {
      if (id) {
        addScannedRecipe(id, {
          id: `scanned-${Date.now()}`,
          name: recipeTitle,
          source: 'scanned',
        });
      }
    },
    [id, addScannedRecipe]
  );

  const handleDelete = useCallback(() => {
    if (!cookbook) return;
    Alert.alert(
      t('cookbooks.shelfBook.removeTitle', 'Remove cookbook'),
      t('cookbooks.shelfBook.removeBody', 'Remove "{{title}}" from your shelf?', { title: cookbook.title }),
      [
        { text: t('cookbooks.shelfBook.cancel', 'Cancel'), style: 'cancel' },
        {
          text: t('cookbooks.shelfBook.remove', 'Remove'),
          style: 'destructive',
          onPress: () => {
            removeCookbook(cookbook.id);
            router.back();
          },
        },
      ]
    );
  }, [cookbook, removeCookbook, router, t]);

  if (!cookbook) {
    return (
      <Screen bare>
        <View className="flex-1 items-center justify-center" style={{ paddingHorizontal: 32, gap: 14 }}>
          <Icon name="warning" size="lg" color="muted" />
          <H2 center>{t('cookbooks.shelfBook.notFound', 'Cookbook not found')}</H2>
          <UButton
            label={t('cookbooks.shelfBook.goBack', 'Go back')}
            size="sm"
            onPress={() => router.back()}
          />
        </View>
      </Screen>
    );
  }

  const isFetching = cookbook.fetchStatus === 'fetching';
  const needsScan = cookbook.fetchStatus === 'failed' || cookbook.fetchStatus === 'partial';
  const recipes = cookbook.recipes || [];
  const photo = coverPhoto(cookbook);
  const topInset = Math.max(insets.top, 20) + 14;

  return (
    <Screen bare>
      <CookbookPageScanner
        visible={showScanner}
        onClose={() => setShowScanner(false)}
        onSuccess={handleScanSuccess}
      />

      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 60 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero: blurred cover with the book on top */}
        <ToneBlock tone="dark" className="bg-night" style={{ height: 300, overflow: 'hidden' }}>
          <Image
            source={photo}
            blurRadius={18}
            contentFit="cover"
            style={[StyleSheet.absoluteFill, { transform: [{ scale: 1.2 }] }]}
            accessible={false}
          />
          <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: FIXED.scrim }]} />

          <View
            className="flex-row items-center justify-between"
            style={{ position: 'absolute', top: topInset, left: 20, right: 20 }}
          >
            <UIconButton icon="back" tone="glass" label={t('common.back', 'Back')} onPress={() => router.back()} />
            <UIconButton
              icon="trash"
              tone="glass"
              label={t('cookbooks.shelfBook.removeLabel', 'Remove cookbook')}
              onPress={handleDelete}
            />
          </View>

          <View
            className="flex-row items-end"
            style={{ position: 'absolute', left: 24, right: 24, bottom: 56, gap: 18 }}
          >
            <BookCover
              source={photo}
              title={cookbook.title}
              kicker={t('cookbooks.shelfBook.coverKicker', 'Cookbook')}
              width={104}
              height={146}
            />
            <View className="flex-1" style={{ gap: 6, minWidth: 0 }}>
              <H1 numberOfLines={3} style={{ fontSize: 26, lineHeight: 28, letterSpacing: -0.78 }}>
                {cookbook.title}
              </H1>
              {cookbook.author ? (
                <RNText numberOfLines={1} style={{ color: FIXED.captionSub, fontSize: 14 }}>
                  {cookbook.author}
                </RNText>
              ) : null}
              <View className="flex-row flex-wrap" style={{ gap: 8 }}>
                <Tag
                  tone="glass"
                  large
                  label={t('cookbooks.shelfBook.recipeCount', '{{count}} recipes', { count: recipes.length })}
                />
                {isFetching && (
                  <Tag tone="glassDark" large label={t('cookbooks.shelfBook.findingMore', 'Finding more…')} />
                )}
              </View>
            </View>
          </View>
        </ToneBlock>

        <SheetPanel>
          {needsScan && (
            <UCard style={{ borderRadius: 24, paddingVertical: 12, paddingStart: 16, paddingEnd: 12, gap: 8 }}>
              <View className="flex-row items-center" style={{ gap: 12 }}>
                <Icon name="warning" />
                <View className="flex-1" style={{ gap: 2 }}>
                  <Title>{t('cookbooks.shelfBook.missingTitle', 'Some recipes may be missing')}</Title>
                </View>
                <UButton
                  label={t('cookbooks.shelfBook.scanCopy', 'Scan copy')}
                  size="sm"
                  onPress={() => setShowScanner(true)}
                />
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('cookbooks.shelfBook.retryAi', 'Try the AI search again')}
                onPress={handleRetryFetch}
                disabled={isFetching}
                style={{ minHeight: 44, justifyContent: 'center', paddingStart: 32 }}
              >
                <LinkText accent>{t('cookbooks.shelfBook.retryAi', 'Try the AI search again')}</LinkText>
              </Pressable>
            </UCard>
          )}

          {isFetching && recipes.length === 0 && (
            <View className="items-center" style={{ paddingVertical: 48, gap: 10 }}>
              <ActivityIndicator size="large" color={spinner} />
              <Body center>{t('cookbooks.shelfBook.findingAll', 'Finding all recipes in this cookbook...')}</Body>
              <Muted small center>{t('cookbooks.shelfBook.mayTakeAMoment', 'This may take a moment')}</Muted>
            </View>
          )}

          {!isFetching && recipes.length === 0 && (
            <View className="items-center" style={{ paddingVertical: 36, paddingHorizontal: 12, gap: 12 }}>
              <View className="items-center justify-center bg-surface-2" style={{ width: 64, height: 64, borderRadius: 32 }}>
                <Icon name="book" size="lg" />
              </View>
              <H2 center>{t('cookbooks.shelfBook.noneTitle', 'No recipes found yet')}</H2>
              <Muted center>
                {t(
                  'cookbooks.shelfBook.noneBody',
                  "We couldn't find recipes for this cookbook online. Scan pages from your physical copy to add them."
                )}
              </Muted>
              <UButton
                label={t('cookbooks.shelfBook.scanYourCopy', 'Scan your copy')}
                icon="camera"
                size="sm"
                onPress={() => setShowScanner(true)}
              />
            </View>
          )}

          {recipes.length > 0 && (
            <Rows>
              {recipes.map((recipe) => (
                <ListRow
                  key={recipe.id}
                  tall
                  title={recipe.name}
                  subtitle={[
                    recipe.fullContent
                      ? t('cookbooks.shelfBook.loaded', 'Loaded')
                      : t('cookbooks.shelfBook.tapToLoad', 'Tap to load'),
                    recipe.pageNumber
                      ? t('cookbooks.shelfBook.page', 'p.{{n}}', { n: recipe.pageNumber })
                      : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                  leading={<Thumb source={recipePhoto(recipe)} name={recipe.name} size={52} />}
                  onPress={() =>
                    router.push({
                      pathname: '/shelf-recipe/[id]',
                      params: { id: recipe.id, cookbookId: cookbook.id },
                    })
                  }
                />
              ))}
            </Rows>
          )}
        </SheetPanel>
      </ScrollView>
    </Screen>
  );
}
