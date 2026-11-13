import React, { useEffect, useState, useCallback } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Share, Text as RNText, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useCookbookLibraryStore } from '@/stores/cookbookLibraryStore';
import { CookbookRecipeContent } from '@/types/cookbookLibrary';
import {
  Body,
  Check,
  CtaBar,
  Display,
  H2,
  Icon,
  Muted,
  PhotoCard,
  Screen,
  SheetPanel,
  Segmented,
  Tag,
  Tile,
  Title,
  UButton,
  UIconButton,
  useColor,
} from '@/components/ui';
import { FONT } from '@/components/ui/fonts';
import { recipePhoto } from '@/components/cookbook';

type DetailTab = 'ingredients' | 'instructions';

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={{ flex: 1 }}>
      <Tile style={{ padding: 12 }}>
        <RNText className="text-ink" style={{ fontFamily: FONT.display, fontSize: 18, lineHeight: 21, letterSpacing: -0.36 }}>
          {value}
        </RNText>
        <Muted small>{label}</Muted>
      </Tile>
    </View>
  );
}

export default function ShelfRecipeScreen() {
  const { id, cookbookId } = useLocalSearchParams<{ id: string; cookbookId: string }>();
  const router = useRouter();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const spinner = useColor('muted');

  const cookbooks = useCookbookLibraryStore((s) => s.cookbooks);
  const fetchFullRecipe = useCookbookLibraryStore((s) => s.fetchFullRecipe);

  const cookbook = cookbooks.find((c) => c.id === cookbookId);
  const recipe = cookbook?.recipes.find((r) => r.id === id);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(false);
  const [checkedSteps, setCheckedSteps] = useState<Set<number>>(new Set());
  const [tab, setTab] = useState<DetailTab>('ingredients');

  const content: CookbookRecipeContent | undefined = recipe?.fullContent;
  const needsContent = !!recipe && !recipe.fullContent;

  const loadFullRecipe = useCallback(async () => {
    if (!cookbookId || !id) return;
    setIsLoading(true);
    setError(false);
    try {
      const success = await fetchFullRecipe(cookbookId, id);
      if (!success) setError(true);
    } catch {
      setError(true);
    } finally {
      setIsLoading(false);
    }
  }, [cookbookId, id, fetchFullRecipe]);

  useEffect(() => {
    if (needsContent) {
      loadFullRecipe();
    }
    // Load once per recipe; loadFullRecipe changes identity only with the route params.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recipe?.id, needsContent]);

  const handleShare = async () => {
    if (!recipe || !cookbook) return;
    try {
      await Share.share({
        message: t('cookbooks.shelfRecipe.shareMessage', 'Check out "{{recipe}}" from {{book}}!\n\nFound on SousChef App', {
          recipe: recipe.name,
          book: cookbook.title,
        }),
      });
    } catch (e) {
      console.error(e);
    }
  };

  const toggleStep = (index: number) => {
    setCheckedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  if (!cookbook || !recipe) {
    return (
      <Screen bare>
        <View className="flex-1 items-center justify-center" style={{ paddingHorizontal: 32, gap: 14 }}>
          <Icon name="warning" size="lg" color="muted" />
          <H2 center>{t('cookbooks.shelfRecipe.notFound', 'Recipe not found')}</H2>
          <UButton label={t('cookbooks.shelfRecipe.goBack', 'Go back')} size="sm" onPress={() => router.back()} />
        </View>
      </Screen>
    );
  }

  const topInset = Math.max(insets.top, 20) + 14;
  const totalMin = content ? content.prepTime + content.cookTime : 0;
  const startCooking = () =>
    router.push({ pathname: '/cook/[id]', params: { id: recipe.id, cookbookId: cookbook.id } });

  return (
    <Screen
      bare
      footer={
        content ? (
          <CtaBar fade>
            <UButton
              label={t('cookbooks.shelfRecipe.startCooking', 'Start Cooking')}
              icon="play"
              variant="accent"
              onPress={startCooking}
            />
          </CtaBar>
        ) : null
      }
    >
      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingBottom: 140 }} showsVerticalScrollIndicator={false}>
        <PhotoCard source={recipePhoto(recipe)} height={360} radius={0} fade="both" accessibilityLabel={recipe.name}>
          <View
            className="flex-row items-center justify-between"
            style={{ position: 'absolute', top: topInset, left: 20, right: 20, zIndex: 2 }}
          >
            <UIconButton icon="back" tone="glass" label={t('common.back', 'Back')} onPress={() => router.back()} />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('cookbooks.shelfRecipe.openBook', 'Open {{title}}', { title: cookbook.title })}
              onPress={() => router.back()}
              style={{ flexShrink: 1, marginHorizontal: 8 }}
            >
              <Tag tone="glass" large icon="book" label={cookbook.title} />
            </Pressable>
            <UIconButton icon="share" tone="glass" label={t('cookbooks.shelfRecipe.share', 'Share')} onPress={handleShare} />
          </View>
          <View style={{ position: 'absolute', left: 22, right: 22, bottom: 54, gap: 4 }}>
            <Display size={30} numberOfLines={3}>
              {recipe.name}
            </Display>
            {recipe.pageNumber ? (
              <Muted small>{t('cookbooks.shelfRecipe.page', 'Page {{n}}', { n: recipe.pageNumber })}</Muted>
            ) : null}
          </View>
        </PhotoCard>

        <SheetPanel>
          {isLoading && (
            <View className="items-center" style={{ paddingVertical: 40, gap: 10 }}>
              <ActivityIndicator size="large" color={spinner} />
              <Title>{t('cookbooks.shelfRecipe.loading', 'Loading full recipe...')}</Title>
              <Muted small>
                {t('cookbooks.shelfRecipe.fetchingFrom', 'Fetching from {{title}}', { title: cookbook.title })}
              </Muted>
            </View>
          )}

          {error && !isLoading && (
            <View className="items-center" style={{ paddingVertical: 32, paddingHorizontal: 12, gap: 12 }}>
              <Icon name="warning" size="lg" color="muted" />
              <H2 center>{t('cookbooks.shelfRecipe.errorTitle', "Couldn't load recipe")}</H2>
              <Muted center>
                {t('cookbooks.shelfRecipe.errorBody', 'We had trouble fetching the full recipe details. Try again?')}
              </Muted>
              <UButton
                label={t('cookbooks.shelfRecipe.retry', 'Retry')}
                icon="refresh"
                size="sm"
                onPress={loadFullRecipe}
              />
            </View>
          )}

          {content && !isLoading && (
            <>
              <View className="flex-row" style={{ gap: 8 }}>
                <Stat value={String(totalMin)} label={t('cookbooks.shelfRecipe.min', 'min')} />
                <Stat value={String(content.servings)} label={t('cookbooks.shelfRecipe.serves', 'serves')} />
                {content.nutrition ? (
                  <>
                    <Stat
                      value={String(content.nutrition.caloriesPerServing)}
                      label={t('cookbooks.shelfRecipe.kcal', 'kcal')}
                    />
                    <Stat
                      value={`${content.nutrition.protein}g`}
                      label={t('cookbooks.shelfRecipe.protein', 'protein')}
                    />
                  </>
                ) : (
                  <Stat
                    value={t(`cookbooks.shelfRecipe.difficulty_${content.difficulty}`, content.difficulty)}
                    label={t('cookbooks.shelfRecipe.level', 'level')}
                  />
                )}
              </View>

              {content.description ? <Muted>{content.description}</Muted> : null}

              {content.tips ? (
                <View className="flex-row items-start" style={{ gap: 12 }}>
                  <View className="items-center justify-center bg-accent" style={{ width: 44, height: 44, borderRadius: 22 }}>
                    <Icon name="bulb" color="accent-ink" />
                  </View>
                  <View className="flex-1" style={{ gap: 2 }}>
                    <Title>{t('cookbooks.shelfRecipe.tip', "Chef's Tip")}</Title>
                    <Muted style={{ fontSize: 13 }}>{content.tips}</Muted>
                  </View>
                </View>
              ) : null}

              <Segmented<DetailTab>
                value={tab}
                onChange={setTab}
                options={[
                  { value: 'ingredients', label: t('cookbooks.shelfRecipe.ingredients', 'Ingredients') },
                  { value: 'instructions', label: t('cookbooks.shelfRecipe.instructions', 'Instructions') },
                ]}
              />

              {tab === 'ingredients' ? (
                <View style={{ gap: 0 }}>
                  {content.ingredients.map((ing, index) => (
                    <View
                      key={`${ing.name}-${index}`}
                      className={`flex-row items-center ${index > 0 ? 'border-t border-divider' : ''}`}
                      style={{ minHeight: 52, gap: 12 }}
                    >
                      <View className="bg-accent" style={{ width: 8, height: 8, borderRadius: 4 }} />
                      <Body className="flex-1">{ing.name}</Body>
                      <Muted small>{`${ing.amount} ${ing.unit}`.trim()}</Muted>
                    </View>
                  ))}
                </View>
              ) : (
                <View style={{ gap: 14 }}>
                  {content.instructions.map((step, index) => {
                    const done = checkedSteps.has(index);
                    return (
                      <Pressable
                        key={index}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: done }}
                        accessibilityLabel={t('cookbooks.shelfRecipe.stepN', 'Step {{n}}: {{text}}', {
                          n: index + 1,
                          text: step,
                        })}
                        onPress={() => toggleStep(index)}
                        className="flex-row items-start"
                        style={{ gap: 14, minHeight: 44 }}
                      >
                        <Check checked={done} label={t('cookbooks.shelfRecipe.stepDone', 'Step {{n}} done', { n: index + 1 })} />
                        <Body className={done ? 'flex-1 text-subtle line-through' : 'flex-1'}>{step}</Body>
                      </Pressable>
                    );
                  })}
                </View>
              )}

              {content.nutrition ? (
                <Muted small>
                  {t('cookbooks.shelfRecipe.macros', 'Per serving: {{carbs}}g carbs, {{fat}}g fat', {
                    carbs: content.nutrition.carbs,
                    fat: content.nutrition.fat,
                  })}
                </Muted>
              ) : null}

              <Muted small>
                {t('cookbooks.shelfRecipe.fromBook', 'From "{{title}}"{{author}}', {
                  title: cookbook.title,
                  author: cookbook.author
                    ? t('cookbooks.shelfRecipe.byAuthor', ' by {{author}}', { author: cookbook.author })
                    : '',
                })}
              </Muted>
              <Muted small>
                {t('cookbooks.shelfRecipe.disclaimer', 'Recipe details generated from the book — may differ slightly.')}
              </Muted>
            </>
          )}
        </SheetPanel>
      </ScrollView>
    </Screen>
  );
}
