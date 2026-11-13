import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, Share, Alert, Pressable, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useRecipe, useRecipes } from '@/hooks/useRecipes';
import { useIngredientSubstitution } from '@/hooks/useAI';
import { useAuthStore } from '@/stores/authStore';
import { useRecipeStore } from '@/stores/recipeStore';
import { usePantry } from '@/hooks/usePantry';
import { useRemainingUsage } from '@/hooks/useSubscription';
import {
  Divider,
  FONT,
  H2,
  Icon,
  Muted,
  RatingTag,
  Screen,
  SectionLabel,
  Tag,
  UAvatar,
  UButton,
  UCard,
  UIconButton,
  useColor,
} from '@/components/ui';
import type { RatingLevel } from '@/components/ui/Chips';
import { InstructionList, NutritionCard, YouTubePlayer, ActionBar, DetailHero } from '@/components/recipe';
import { AllergenWarning } from '@/components/recipe/AllergenWarning';
import { RecipeComments } from '@/components/recipe/RecipeComments';
import { MadeThisGallery } from '@/components/recipe/MadeThisGallery';
import { Paywall } from '@/components/subscription';
import { formatRelativeTime } from '@/lib/utils';
import type { Ingredient } from '@/types';

// Loose name match between a recipe ingredient and a pantry item ("olive oil" ~ "extra virgin olive oil").
const normalise = (s: string) => s.toLowerCase().replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim();
const inPantry = (ingredient: Ingredient, pantryNames: string[]) => {
  const name = normalise(ingredient.name);
  if (name.length < 3) return false;
  return pantryNames.some((p) => p.length >= 3 && (p.includes(name) || name.includes(p)));
};

// Per-portion fat bands (g), mirroring the traffic-light labelling used on food packs.
const fatLevel = (g: number): { level: RatingLevel; word: string } =>
  g <= 3 ? { level: 'lo', word: 'Low' } : g <= 17.5 ? { level: 'md', word: 'Medium' } : { level: 'hi', word: 'High' };

export default function RecipeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const { recipe, isLoading, error } = useRecipe(id);
  const { toggleSave, isRecipeSaved, toggleLike } = useRecipes();
  const { items: pantryItems } = usePantry();
  const {
    result: substitutionResult,
    isAnalyzing,
    analyzeWithPantry,
    accessDenied,
  } = useIngredientSubstitution();
  const { remainingAI } = useRemainingUsage();

  const [showNutrition, setShowNutrition] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const spinner = useColor('muted');

  const pantryNames = useMemo(() => pantryItems.map((p) => normalise(p.name)), [pantryItems]);
  const haveFlags = useMemo(
    () => (recipe ? recipe.ingredients.map((ing) => inPantry(ing, pantryNames)) : []),
    [recipe, pantryNames]
  );

  const handleShare = async () => {
    if (!recipe) return;
    try {
      await Share.share({
        message: `Check out this recipe: ${recipe.title}\n\nFrom SousChef App`,
      });
    } catch (e) {
      console.error(e);
    }
  };

  const handleAnalyzeWithPantry = async () => {
    if (!recipe || !user) return;
    const result = await analyzeWithPantry(recipe);
    // If access was denied, show the paywall
    if (!result && accessDenied) {
      setShowPaywall(true);
    }
  };

  const handleStartCooking = () => {
    if (!recipe) return;
    router.push(`/cook/${recipe.id}`);
  };

  if (isLoading) {
    return (
      <Screen bare>
        <View className="flex-1 items-center justify-center" style={{ gap: 12 }}>
          <ActivityIndicator color={spinner} />
          <Muted>{t('cooking.loadingRecipe', 'Loading recipe...')}</Muted>
        </View>
      </Screen>
    );
  }

  if (error || !recipe) {
    return (
      <Screen bare>
        <View className="flex-1 items-center justify-center" style={{ paddingHorizontal: 32, gap: 12 }}>
          <View className="items-center justify-center bg-surface" style={{ width: 88, height: 88, borderRadius: 44 }}>
            <Icon name="warning" size="lg" color="muted" />
          </View>
          <H2 center>{t('cooking.recipeNotFound', 'Recipe not found')}</H2>
          <Muted center>{error || t('cooking.recipeGone', "This recipe doesn't exist or has been removed.")}</Muted>
          <View style={{ alignSelf: 'stretch', marginTop: 12 }}>
            <UButton label={t('cooking.goBack', 'Go Back')} onPress={() => router.back()} />
          </View>
        </View>
      </Screen>
    );
  }

  const isSaved = isRecipeSaved(recipe.id);
  const totalTime = recipe.prepTime + recipe.cookTime;
  const haveCount = haveFlags.filter(Boolean).length;
  const nutrition = recipe.nutrition;
  const fat = nutrition ? fatLevel(nutrition.fat) : null;
  const aiLeft = remainingAI === 'unlimited' ? null : remainingAI;

  const reportRecipe = () => {
    Alert.alert('Report Recipe', 'Why are you reporting this recipe?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Inappropriate Content', onPress: () => useRecipeStore.getState().flagRecipe(recipe.id, 'inappropriate') },
      { text: 'Not a Recipe', onPress: () => useRecipeStore.getState().flagRecipe(recipe.id, 'not-a-recipe') },
      { text: 'Spam', onPress: () => useRecipeStore.getState().flagRecipe(recipe.id, 'spam') },
    ]);
  };

  return (
    <Screen
      bare
      footer={
        <ActionBar>
          <UIconButton
            icon="heart"
            label={t('cooking.likeRecipe', 'Like recipe')}
            size={58}
            onPress={() => toggleLike(recipe.id)}
          />
          <UButton
            label={t('cooking.startCooking', 'Start Cooking')}
            variant="accent"
            icon="play"
            onPress={handleStartCooking}
            style={{ flex: 1 }}
          />
        </ActionBar>
      }
    >
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 150 }}>
        <DetailHero
          source={{ uri: recipe.imageURL }}
          onBack={() => router.back()}
          backLabel={t('cooking.back', 'Back')}
          actions={
            <>
              <UIconButton icon="share" label={t('cooking.share', 'Share')} tone="glassDark" onPress={handleShare} />
              <UIconButton
                icon="bookmark"
                label={isSaved ? t('cooking.unsave', 'Remove from saved') : t('cooking.save', 'Save recipe')}
                tone="glassDark"
                filled={isSaved}
                onPress={() => toggleSave(recipe.id)}
              />
            </>
          }
          caption={
            <>
              <Pressable
                onPress={() => router.push(`/user/${recipe.authorId}` as never)}
                accessibilityRole="button"
                accessibilityLabel={recipe.authorName}
                className="flex-row items-center"
                style={{ gap: 10, minHeight: 30 }}
              >
                <UAvatar
                  source={recipe.authorPhotoURL ? { uri: recipe.authorPhotoURL } : null}
                  name={recipe.authorName}
                  size={30}
                />
                <Text className="text-paper" style={{ fontFamily: FONT.sans, fontSize: 12 }}>
                  {recipe.isOfficial
                    ? t('cooking.chefRecipe', '{{name}} · Chef Recipe', { name: recipe.authorName })
                    : `${recipe.authorName} · ${formatRelativeTime(recipe.createdAt)}`}
                </Text>
              </Pressable>
              <Text
                className="text-paper"
                numberOfLines={3}
                style={{ fontFamily: FONT.display, fontSize: 32, lineHeight: 34, letterSpacing: -0.64 }}
              >
                {recipe.title}
              </Text>
            </>
          }
        />

        <View
          className="bg-ground"
          style={{ marginTop: -34, borderTopLeftRadius: 34, borderTopRightRadius: 34, paddingTop: 24, paddingHorizontal: 20, gap: 18 }}
        >
          <View className="flex-row flex-wrap" style={{ gap: 8 }}>
            <Tag large icon="clock" label={t('cooking.minutes', '{{count}} min', { count: totalTime })} />
            <Tag large icon="people" label={t('cooking.servingsCount', '{{count}} servings', { count: recipe.servings })} />
            {recipe.rating && recipe.ratingCount ? (
              <Tag large icon="star" label={recipe.rating.toFixed(1)} />
            ) : null}
            <Tag large icon="heart" label={`${recipe.likes}`} />
          </View>

          <AllergenWarning recipe={recipe} user={user} />

          {recipe.description ? <Muted style={{ fontSize: 15, lineHeight: 22 }}>{recipe.description}</Muted> : null}

          {nutrition ? (
            <View style={{ gap: 8 }}>
              <SectionLabel>{t('cooking.perPortion', 'Per portion')}</SectionLabel>
              <View className="flex-row flex-wrap" style={{ gap: 8 }}>
                <Tag label={`${t('cooking.calories', 'Calories')} ${nutrition.caloriesPerServing}`} />
                <Tag label={`${t('cooking.carbs', 'Carbs')} ${nutrition.carbs} g`} />
                <Tag label={`${t('cooking.protein', 'Protein')} ${nutrition.protein} g`} />
                {fat ? (
                  <RatingTag
                    level={fat.level}
                    label={`${t('cooking.fat', 'Fat')} ${t(`cooking.level${fat.word}`, fat.word)}`}
                  />
                ) : null}
              </View>
            </View>
          ) : null}

          {recipe.youtubeURL ? (
            <View style={{ gap: 12 }}>
              <H2>{t('cooking.recipeVideo', 'Recipe Video')}</H2>
              <YouTubePlayer videoUrl={recipe.youtubeURL} />
            </View>
          ) : null}

          {/* Ingredients with pantry match */}
          <View style={{ gap: 4 }}>
            <View className="flex-row items-center justify-between" style={{ marginBottom: 6 }}>
              <H2>{t('cooking.ingredients', 'Ingredients')}</H2>
              {user && pantryItems.length > 0 ? (
                <Tag
                  tone="g"
                  label={t('cooking.youHave', 'You have {{have}} of {{total}}', {
                    have: haveCount,
                    total: recipe.ingredients.length,
                  })}
                />
              ) : (
                <Muted small>{t('cooking.itemCount', '{{count}} items', { count: recipe.ingredients.length })}</Muted>
              )}
            </View>
            {recipe.ingredients.map((ing, idx) => {
              const have = haveFlags[idx];
              const dim = pantryItems.length > 0 && !have;
              return (
                <View key={`${ing.name}-${idx}`}>
                  {idx > 0 ? <Divider /> : null}
                  <View className="flex-row items-center" style={{ minHeight: 56, gap: 14 }}>
                    <View
                      className={have ? 'items-center justify-center bg-accent' : 'items-center justify-center bg-surface-3'}
                      style={{ width: 26, height: 26, borderRadius: 13 }}
                    >
                      {have ? <Icon name="check" size="sm" color="accent-ink" /> : null}
                    </View>
                    <Text
                      className={dim ? 'flex-1 text-muted' : 'flex-1 text-ink'}
                      style={{ fontFamily: FONT.sans, fontSize: 15 }}
                    >
                      {ing.name}
                      {ing.optional ? ` (${t('cooking.optional', 'optional')})` : ''}
                    </Text>
                    <Text className="text-ink" style={{ fontFamily: FONT.sansSemi, fontSize: 15 }}>
                      {ing.amount} {ing.unit}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>

          {/* Substitution / pantry analysis (usage-limited) */}
          {user ? (
            <UCard>
              <View style={{ gap: 12 }}>
                <View className="flex-row items-center justify-between" style={{ gap: 8 }}>
                  <Text className="text-ink" style={{ fontFamily: FONT.display, fontSize: 17 }}>
                    {t('cooking.pantryCheck', 'Pantry check')}
                  </Text>
                  <Tag
                    tone={aiLeft === 0 ? 'r' : 'default'}
                    label={
                      aiLeft === null
                        ? t('cooking.unlimited', 'Unlimited')
                        : t('cooking.usesLeft', '{{count}} left', { count: aiLeft })
                    }
                  />
                </View>

                {substitutionResult ? (
                  <View style={{ gap: 10 }}>
                    <View className="flex-row items-center" style={{ gap: 10 }}>
                      <Text className="text-ink" style={{ fontFamily: FONT.display, fontSize: 22, letterSpacing: -0.44 }}>
                        {t('cooking.matchPercent', '{{n}}% match', { n: substitutionResult.confidenceScore })}
                      </Text>
                      <Tag
                        tone={substitutionResult.canMake ? 'g' : 'o'}
                        label={substitutionResult.canMake ? t('cooking.canMake', 'Can make') : t('cooking.needItems', 'Need items')}
                      />
                    </View>

                    {substitutionResult.missingIngredients.length > 0 ? (
                      <Muted>
                        {t('cooking.missing', 'Missing: {{list}}', { list: substitutionResult.missingIngredients.join(', ') })}
                      </Muted>
                    ) : null}

                    {substitutionResult.substitutions.length > 0 ? (
                      <View style={{ gap: 4 }}>
                        <SectionLabel>{t('cooking.substitutions', 'Suggested substitutions')}</SectionLabel>
                        {substitutionResult.substitutions.map((sub, idx) => (
                          <Text key={idx} className="text-ink" style={{ fontFamily: FONT.sans, fontSize: 14 }}>
                            {sub.originalIngredient} → {sub.substitute}
                          </Text>
                        ))}
                      </View>
                    ) : null}
                  </View>
                ) : accessDenied ? (
                  <View style={{ gap: 12 }}>
                    <Muted>
                      {accessDenied.reason === 'limit_reached'
                        ? t('cooking.subLimit', "You've reached your daily limit of {{limit}} AI substitutions.", {
                            limit: accessDenied.limit,
                          })
                        : t('cooking.subPremium', 'Upgrade to Premium to use AI substitutions.')}
                    </Muted>
                    <UButton
                      label={t('cooking.upgrade', 'Upgrade to Continue')}
                      variant="accent"
                      size="sm"
                      icon="star"
                      onPress={() => setShowPaywall(true)}
                    />
                  </View>
                ) : (
                  <View style={{ gap: 12 }}>
                    <Muted>
                      {t('cooking.pantryCheckHelp', 'Check if you can make this recipe with your pantry ingredients')}
                    </Muted>
                    <UButton
                      label={isAnalyzing ? t('cooking.analyzingShort', 'Analyzing...') : t('cooking.checkPantry', 'Check My Pantry')}
                      variant="primary"
                      size="sm"
                      loading={isAnalyzing}
                      onPress={handleAnalyzeWithPantry}
                    />
                  </View>
                )}
              </View>
            </UCard>
          ) : null}

          {/* Instructions */}
          <View style={{ gap: 14 }}>
            <View className="flex-row items-center justify-between">
              <H2>{t('cooking.instructions', 'Instructions')}</H2>
              <Muted small>{t('cooking.stepCount', '{{count}} steps', { count: recipe.instructions.length })}</Muted>
            </View>
            <InstructionList instructions={recipe.instructions} />
          </View>

          {/* Nutrition facts */}
          {nutrition ? (
            <View style={{ gap: 12 }}>
              <Pressable
                onPress={() => setShowNutrition(!showNutrition)}
                accessibilityRole="button"
                accessibilityState={{ expanded: showNutrition }}
                className="flex-row items-center justify-between"
                style={{ minHeight: 44 }}
              >
                <H2>{t('cooking.nutritionFacts', 'Nutrition Facts')}</H2>
                <Icon name={showNutrition ? 'minus' : 'chevronDown'} color="muted" />
              </Pressable>
              {showNutrition ? <NutritionCard nutrition={nutrition} servings={recipe.servings} /> : null}
            </View>
          ) : null}

          {/* Tags */}
          {recipe.tags.length > 0 ? (
            <View style={{ gap: 8 }}>
              <SectionLabel>{t('cooking.tags', 'Tags')}</SectionLabel>
              <View className="flex-row flex-wrap" style={{ gap: 8 }}>
                {recipe.tags.map((tag) => (
                  <Tag key={tag} label={`#${tag}`} />
                ))}
              </View>
            </View>
          ) : null}

          <MadeThisGallery recipeId={recipe.id} />

          <RecipeComments recipeId={recipe.id} />

          {user && user.id !== recipe.authorId ? (
            <Pressable
              onPress={reportRecipe}
              accessibilityRole="button"
              className="flex-row items-center"
              style={{ minHeight: 44, gap: 6 }}
            >
              <Icon name="warning" size="sm" color="subtle" />
              <Text className="text-subtle" style={{ fontFamily: FONT.sans, fontSize: 13 }}>
                {t('cooking.report', 'Report')}
              </Text>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>

      <Paywall
        visible={showPaywall}
        onClose={() => setShowPaywall(false)}
        feature="AI Substitutions"
        requiredTier={accessDenied?.upgradeRequired || 'premium'}
      />
    </Screen>
  );
}
