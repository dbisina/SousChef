import React, { useState, useCallback } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useCookbookLibraryStore } from '@/stores/cookbookLibraryStore';
import { usePantryStore } from '@/stores/pantryStore';
import { showErrorToast, showInfoToast } from '@/stores/toastStore';
import { lookupCookbook, fetchBookCoverImage } from '@/services/cookbookLibraryService';
import { CookbookEntry, CookbookSuggestion } from '@/types/cookbookLibrary';
import {
  BookCover,
  Dim,
  H1,
  H2,
  Muted,
  Screen,
  TopBar,
  UButton,
  UCard,
} from '@/components/ui';
import { CookbookPageScanner, CookbookSuggestionCarousel, coverPhoto } from '@/components/cookbook';
import { RaisedField } from '@/components/cookbook/RaisedField';

const COVER_WIDTH = 142;

export default function CookbookLibraryScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const {
    cookbooks,
    suggestions,
    isSuggesting,
    addCookbook,
    removeCookbook,
    getSuggestions,
    clearSuggestions,
    fetchRecipesForCookbook,
  } = useCookbookLibraryStore();
  const { items: pantryItems } = usePantryStore();

  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [scannerCookbookId, setScannerCookbookId] = useState<string | null>(null);

  const handleAdd = useCallback(async () => {
    if (!title.trim()) return;

    setIsLookingUp(true);
    let cookbookId: string;
    try {
      // Fetch cookbook details and cover image in parallel
      const [details, coverImageURL] = await Promise.all([
        lookupCookbook(title),
        fetchBookCoverImage(title, author || undefined),
      ]);

      if (details) {
        cookbookId = addCookbook(details.title, details.author, {
          description: details.description,
          coverColor: details.coverColor,
          coverImageURL: coverImageURL || undefined,
        });
      } else {
        cookbookId = addCookbook(title, author || undefined, {
          coverImageURL: coverImageURL || undefined,
        });
      }
    } catch {
      cookbookId = addCookbook(title, author || undefined);
    }
    setIsLookingUp(false);
    setTitle('');
    setAuthor('');

    // Auto-fetch recipes from AI, then offer to scan the physical copy if incomplete
    fetchRecipesForCookbook(cookbookId).then(({ isComplete }) => {
      if (!isComplete) {
        Alert.alert(
          t('cookbooks.library.missingTitle', "Wait, we're missing a few"),
          t(
            'cookbooks.library.missingBody',
            "We couldn't find all the recipes for this book online. Would you like to scan some pages from your physical copy to fill them in?"
          ),
          [
            {
              text: t('cookbooks.library.scanNow', 'Scan now'),
              onPress: () => {
                setScannerCookbookId(cookbookId);
                setShowScanner(true);
              },
            },
            { text: t('cookbooks.library.later', 'Later'), style: 'cancel' },
          ]
        );
      }
    });

    // Navigate immediately to the cookbook detail (shows loading)
    router.push(`/shelf-cookbook/${cookbookId}` as Href);
  }, [title, author, addCookbook, fetchRecipesForCookbook, router, t]);

  const handleRemove = useCallback(
    (cookbook: CookbookEntry) => {
      Alert.alert(
        t('cookbooks.library.removeTitle', 'Remove cookbook?'),
        t(
          'cookbooks.library.removeBody',
          'Are you sure you want to remove "{{title}}"? You\'ll lose all its recipes from your shelf.',
          { title: cookbook.title }
        ),
        [
          { text: t('cookbooks.library.keepIt', 'Keep it'), style: 'cancel' },
          {
            text: t('cookbooks.library.remove', 'Remove'),
            style: 'destructive',
            onPress: () => removeCookbook(cookbook.id),
          },
        ]
      );
    },
    [removeCookbook, t]
  );

  const handleScanSuccess = useCallback(
    (recipeTitle: string) => {
      if (scannerCookbookId) {
        const store = useCookbookLibraryStore.getState();
        store.addScannedRecipe(scannerCookbookId, {
          id: `scanned-${Date.now()}`,
          name: recipeTitle,
          source: 'scanned',
        });
      }
    },
    [scannerCookbookId]
  );

  const handlePressSuggestion = useCallback(
    (suggestion: CookbookSuggestion) => {
      // Find the cookbook and recipe by name to navigate to the detail screen
      const cookbook = cookbooks.find(
        (c) => c.title.toLowerCase() === suggestion.cookbookTitle.toLowerCase()
      );
      if (!cookbook) {
        showErrorToast(
          t('cookbooks.library.bookMissingBody', '"{{title}}" isn\'t on your shelf anymore.', { title: suggestion.cookbookTitle }),
          t('cookbooks.library.bookMissingTitle', 'Book missing')
        );
        return;
      }
      const recipe = cookbook.recipes?.find(
        (r) => r.name.toLowerCase() === suggestion.recipeName.toLowerCase()
      );
      if (!recipe) {
        showErrorToast(
          t('cookbooks.library.recipeMissingBody', 'We couldn\'t find "{{name}}" in that book. It might have been removed.', { name: suggestion.recipeName }),
          t('cookbooks.library.recipeMissingTitle', 'Recipe missing')
        );
        return;
      }
      router.push({
        pathname: '/shelf-recipe/[id]',
        params: { id: recipe.id, cookbookId: cookbook.id },
      });
    },
    [cookbooks, router, t]
  );

  const handleGetSuggestions = useCallback(() => {
    if (cookbooks.length === 0) {
      showInfoToast(
        t('cookbooks.library.addBooksFirst', 'Add some cookbooks to your shelf so we can find the perfect recipe for you.'),
        t('cookbooks.library.addBooksFirstTitle', 'Add a book')
      );
      return;
    }
    if (pantryItems.length === 0) {
      showInfoToast(
        t('cookbooks.library.fillPantry', "Add some items to your pantry so we can match them with recipes you'll love."),
        t('cookbooks.library.fillPantryTitle', 'Fill your pantry')
      );
      return;
    }
    getSuggestions(pantryItems);
  }, [cookbooks, pantryItems, getSuggestions, t]);

  const kicker = (item: CookbookEntry) => {
    if (item.fetchStatus === 'fetching') return t('cookbooks.library.finding', 'Finding…');
    const n = item.recipes?.length || 0;
    return n > 0 ? t('cookbooks.library.recipeCount', '{{count}} recipes', { count: n }) : '';
  };

  return (
    <Screen bare>
      <CookbookPageScanner
        visible={showScanner}
        onClose={() => {
          setShowScanner(false);
          setScannerCookbookId(null);
        }}
        onSuccess={handleScanSuccess}
      />

      <TopBar
        variant="compact"
        title={t('cookbooks.library.title', 'My Shelf')}
        onBack={() => router.back()}
        backLabel={t('common.back', 'Back')}
      />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 20, gap: 16, paddingBottom: 60 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <H1>
            <Dim>{t('cookbooks.library.headlineTop', 'Your')}</Dim>
            {'\n'}
            {t('cookbooks.library.headlineBottom', 'cookbooks')}
          </H1>

          {cookbooks.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginHorizontal: -20, flexGrow: 0 }}
              contentContainerStyle={{ gap: 14, alignItems: 'flex-end', paddingHorizontal: 20, paddingBottom: 14 }}
            >
              {cookbooks.map((item, index) => (
                <Pressable
                  key={item.id}
                  accessibilityRole="button"
                  accessibilityLabel={item.title}
                  accessibilityHint={t('cookbooks.library.removeHint', 'Long press to remove')}
                  onPress={() => router.push(`/shelf-cookbook/${item.id}` as Href)}
                  onLongPress={() => handleRemove(item)}
                >
                  <BookCover
                    source={coverPhoto(item)}
                    title={item.title}
                    kicker={kicker(item)}
                    width={COVER_WIDTH}
                    height={index % 2 === 1 ? 186 : 200}
                  />
                </Pressable>
              ))}
            </ScrollView>
          ) : (
            <Muted>
              {t(
                'cookbooks.library.empty',
                "Your shelf is empty. Add a cookbook and we'll find its recipes online. If we can't, you can scan the pages."
              )}
            </Muted>
          )}

          {(suggestions.length > 0 || isSuggesting) && (
            <View style={{ marginHorizontal: -20 }}>
              <CookbookSuggestionCarousel
                suggestions={suggestions}
                onClear={clearSuggestions}
                onPressSuggestion={handlePressSuggestion}
                isSuggesting={isSuggesting}
              />
            </View>
          )}

          {cookbooks.length > 0 && (
            <UButton
              variant="ghost"
              icon={suggestions.length > 0 ? 'refresh' : undefined}
              loading={isSuggesting}
              disabled={isSuggesting}
              onPress={handleGetSuggestions}
              label={
                isSuggesting
                  ? t('cookbooks.library.findingRecipes', 'Finding recipes...')
                  : suggestions.length > 0
                    ? t('cookbooks.library.refreshSuggestions', 'Refresh suggestions')
                    : t('cookbooks.library.whatCanICook', 'What can I cook from my books?')
              }
            />
          )}

          <UCard style={{ borderRadius: 30, gap: 12 }}>
            <View style={{ gap: 4 }}>
              <H2>{t('cookbooks.library.addTitle', 'Add a cookbook')}</H2>
              <Muted small>{t('cookbooks.library.addSubtitle', "We'll find all the recipes in it online")}</Muted>
            </View>
            <RaisedField
              label={t('cookbooks.library.titleLabel', 'Cookbook title')}
              placeholder={t('cookbooks.library.titlePlaceholder', 'Cookbook title')}
              value={title}
              onChangeText={setTitle}
              returnKeyType="next"
            />
            <RaisedField
              label={t('cookbooks.library.authorLabel', 'Author (optional)')}
              placeholder={t('cookbooks.library.authorPlaceholder', 'Helps find the right book')}
              value={author}
              onChangeText={setAuthor}
              returnKeyType="done"
              onSubmitEditing={handleAdd}
            />
            <UButton
              label={t('cookbooks.library.addButton', 'Add & Fetch Recipes')}
              loading={isLookingUp}
              disabled={!title.trim()}
              onPress={handleAdd}
            />
          </UCard>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
