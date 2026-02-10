import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  TouchableOpacity,
  Share,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRecipe, useRecipes } from '@/hooks/useRecipes';
import { useIngredientSubstitution } from '@/hooks/useAI';
import { useAuthStore } from '@/stores/authStore';
import { usePantry } from '@/hooks/usePantry';
import { useRemainingUsage } from '@/hooks/useSubscription';
import {
  DifficultyBadge,
  TimeBadge,
  Badge,
  Loading,
  Card,
  Button,
} from '@/components/ui';
import {
  SimpleIngredientList,
  InstructionList,
  NutritionCard,
  YouTubePlayer,
} from '@/components/recipe';
import { Paywall, UsageBadge } from '@/components/subscription';
import { useThemeColors } from '@/stores/themeStore';
import { formatTime, formatRelativeTime, getCategoryEmoji } from '@/lib/utils';

export default function RecipeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuthStore();
  const { recipe, isLoading, error, refetch } = useRecipe(id);
  const { toggleSave, isRecipeSaved, toggleLike } = useRecipes();
  const { itemNames } = usePantry();
  const {
    result: substitutionResult,
    isAnalyzing,
    analyzeWithPantry,
    analyzeWithIngredients,
    accessDenied,
  } = useIngredientSubstitution();
  const { remainingAI } = useRemainingUsage();

  const [showNutrition, setShowNutrition] = useState(false);
  const [servings, setServings] = useState(4);
  const [showPaywall, setShowPaywall] = useState(false);

  const colors = useThemeColors();

  useEffect(() => {
    if (recipe) {
      setServings(recipe.servings);
    }
  }, [recipe]);

  const handleShare = async () => {
    if (!recipe) return;
    try {
      await Share.share({
        message: `Check out this recipe: ${recipe.title}\n\nFrom SousChef App`,
      });
    } catch (error) {
      console.error(error);
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
    return <Loading fullScreen message="Loading recipe..." />;
  }

  if (error || !recipe) {
    return (
      <SafeAreaView className="flex-1 bg-white dark:bg-neutral-900 items-center justify-center px-4">
        <Ionicons name="alert-circle-outline" size={64} color="#EF4444" />
        <Text className="text-xl font-semibold text-neutral-900 dark:text-neutral-50 mt-4">
          Recipe not found
        </Text>
        <Text className="text-neutral-500 dark:text-neutral-400 text-center mt-2">
          {error || "This recipe doesn't exist or has been removed."}
        </Text>
        <Button
          title="Go Back"
          onPress={() => router.back()}
          className="mt-6"
        />
      </SafeAreaView>
    );
  }

  const isSaved = isRecipeSaved(recipe.id);
  const totalTime = recipe.prepTime + recipe.cookTime;

  return (
    <View className="flex-1 bg-white dark:bg-neutral-900">
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Hero Image */}
        <View className="relative">
          <Image
            source={{ uri: recipe.imageURL }}
            className="w-full h-72"
            resizeMode="cover"
          />

          {/* Overlay gradient */}
          <View className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />

          {/* Back button */}
          <SafeAreaView className="absolute top-0 left-0 right-0">
            <View className="flex-row items-center justify-between px-4 pt-2">
              <TouchableOpacity
                onPress={() => router.back()}
                className="w-10 h-10 rounded-full bg-black/30 items-center justify-center"
              >
                <Ionicons name="arrow-back" size={24} color="white" />
              </TouchableOpacity>

              <View className="flex-row space-x-2">
                <TouchableOpacity
                  onPress={() => toggleSave(recipe.id)}
                  className="w-10 h-10 rounded-full bg-black/30 items-center justify-center"
                >
                  <Ionicons
                    name={isSaved ? 'bookmark' : 'bookmark-outline'}
                    size={22}
                    color={isSaved ? colors.accent : 'white'}
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleShare}
                  className="w-10 h-10 rounded-full bg-black/30 items-center justify-center"
                >
                  <Ionicons name="share-outline" size={22} color="white" />
                </TouchableOpacity>
              </View>
            </View>
          </SafeAreaView>

          {/* Official badge */}
          {recipe.isOfficial && (
            <View className="absolute bottom-4 left-4 px-3 py-1 rounded-full flex-row items-center" style={{ backgroundColor: colors.accent }}>
              <Ionicons name="checkmark-circle" size={16} color="white" />
              <Text className="text-white font-medium ml-1">Chef Recipe</Text>
            </View>
          )}
        </View>

        {/* Content */}
        <View className="px-4 py-6">
          {/* YouTube Video */}
          {recipe.youtubeURL && (
            <View className="mb-6">
              <Text className="text-xl font-bold text-neutral-900 mb-3">
                Recipe Video
              </Text>
              <YouTubePlayer videoUrl={recipe.youtubeURL} />
            </View>
          )}

          {/* Title and meta */}
          <Text className="text-2xl font-bold text-neutral-900 dark:text-neutral-50">
            {recipe.title}
          </Text>

          <View className="flex-row items-center mt-2">
            <Text className="text-neutral-500 dark:text-neutral-400">by {recipe.authorName}</Text>
            <Text className="text-neutral-300 dark:text-neutral-600 mx-2">|</Text>
            <Text className="text-neutral-500 dark:text-neutral-400">
              {formatRelativeTime(recipe.createdAt)}
            </Text>
          </View>

          {/* Badges */}
          <View className="flex-row flex-wrap gap-2 mt-4">
            <DifficultyBadge difficulty={recipe.difficulty} />
            <TimeBadge minutes={totalTime} />
            <Badge
              label={`${recipe.nutrition?.caloriesPerServing || 0} cal/serving`}
              variant="info"
            />
            <Badge
              label={`${getCategoryEmoji(recipe.category)} ${recipe.category}`}
              variant="default"
            />
          </View>

          {/* Description */}
          <Text className="text-neutral-600 dark:text-neutral-400 mt-4 leading-relaxed">
            {recipe.description}
          </Text>

          {/* Quick stats */}
          <View className="flex-row justify-around mt-6 py-4 bg-neutral-50 dark:bg-neutral-800 rounded-xl">
            <View className="items-center">
              <Text className="text-xl font-bold text-neutral-900 dark:text-neutral-50">
                {recipe.prepTime}
              </Text>
              <Text className="text-sm text-neutral-500 dark:text-neutral-400">Prep (min)</Text>
            </View>
            <View className="w-px bg-neutral-200 dark:bg-neutral-700" />
            <View className="items-center">
              <Text className="text-xl font-bold text-neutral-900 dark:text-neutral-50">
                {recipe.cookTime}
              </Text>
              <Text className="text-sm text-neutral-500 dark:text-neutral-400">Cook (min)</Text>
            </View>
            <View className="w-px bg-neutral-200 dark:bg-neutral-700" />
            <View className="items-center">
              <Text className="text-xl font-bold text-neutral-900 dark:text-neutral-50">
                {recipe.servings}
              </Text>
              <Text className="text-sm text-neutral-500 dark:text-neutral-400">Servings</Text>
            </View>
          </View>

          {/* AI Analysis */}
          {user && (
            <Card className="mt-6 border" style={{ backgroundColor: colors.accent + '15', borderColor: colors.accent + '40' }}>
              <View className="flex-row items-center justify-between mb-3">
                <View className="flex-row items-center">
                  <Ionicons name="sparkles" size={20} color={colors.accent} />
                  <Text className="font-semibold ml-2" style={{ color: colors.accent }}>
                    AI Assistant
                  </Text>
                </View>
                <View className="flex-row items-center">
                  <Text className="text-xs text-neutral-500 dark:text-neutral-400 mr-2">Uses left:</Text>
                  <UsageBadge remaining={remainingAI} size="small" />
                </View>
              </View>

              {substitutionResult ? (
                <View>
                  <View className="flex-row items-center mb-2">
                    <Text className="text-lg font-bold text-neutral-900 dark:text-neutral-50">
                      {substitutionResult.confidenceScore}% Match
                    </Text>
                    <Badge
                      label={substitutionResult.canMake ? 'Can Make!' : 'Need Items'}
                      variant={substitutionResult.canMake ? 'success' : 'warning'}
                      size="sm"
                      className="ml-2"
                    />
                  </View>

                  {substitutionResult.missingIngredients.length > 0 && (
                    <Text className="text-neutral-600 dark:text-neutral-400 mb-2">
                      Missing: {substitutionResult.missingIngredients.join(', ')}
                    </Text>
                  )}

                  {substitutionResult.substitutions.length > 0 && (
                    <View className="mt-2">
                      <Text className="font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                        Suggested Substitutions:
                      </Text>
                      {substitutionResult.substitutions.map((sub, idx) => (
                        <Text key={idx} className="text-neutral-600 dark:text-neutral-400">
                          • {sub.originalIngredient} → {sub.substitute}
                        </Text>
                      ))}
                    </View>
                  )}
                </View>
              ) : accessDenied ? (
                <View>
                  <Text className="text-neutral-600 dark:text-neutral-400 mb-3">
                    {accessDenied.reason === 'limit_reached'
                      ? `You've reached your daily limit of ${accessDenied.limit} AI substitutions.`
                      : 'Upgrade to Premium to use AI substitutions.'}
                  </Text>
                  <Button
                    title="Upgrade to Continue"
                    variant="primary"
                    size="sm"
                    onPress={() => setShowPaywall(true)}
                    leftIcon={<Ionicons name="star" size={16} color="white" />}
                  />
                </View>
              ) : (
                <View>
                  <Text className="text-neutral-600 dark:text-neutral-400 mb-3">
                    Check if you can make this recipe with your pantry ingredients
                  </Text>
                  <Button
                    title={isAnalyzing ? 'Analyzing...' : 'Check My Pantry'}
                    variant="primary"
                    size="sm"
                    onPress={handleAnalyzeWithPantry}
                    isLoading={isAnalyzing}
                  />
                </View>
              )}
            </Card>
          )}

          {/* Ingredients */}
          <View className="mt-6">
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-xl font-bold text-neutral-900 dark:text-neutral-50">
                Ingredients
              </Text>
              <Text className="text-neutral-500 dark:text-neutral-400">
                {recipe.ingredients.length} items
              </Text>
            </View>
            <Card variant="outlined" padding="md">
              <SimpleIngredientList ingredients={recipe.ingredients} />
            </Card>
          </View>

          {/* Instructions */}
          <View className="mt-6">
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-xl font-bold text-neutral-900 dark:text-neutral-50">
                Instructions
              </Text>
              <Text className="text-neutral-500 dark:text-neutral-400">
                {recipe.instructions.length} steps
              </Text>
            </View>
            <InstructionList instructions={recipe.instructions} />
          </View>

          {/* Nutrition */}
          <View className="mt-6">
            <TouchableOpacity
              onPress={() => setShowNutrition(!showNutrition)}
              className="flex-row items-center justify-between py-3"
            >
              <Text className="text-xl font-bold text-neutral-900 dark:text-neutral-50">
                Nutrition Facts
              </Text>
              <Ionicons
                name={showNutrition ? 'chevron-up' : 'chevron-down'}
                size={24}
                color={colors.textMuted}
              />
            </TouchableOpacity>
            {showNutrition && (
              <NutritionCard
                nutrition={recipe.nutrition}
                servings={recipe.servings}
              />
            )}
          </View>

          {/* Tags */}
          {recipe.tags.length > 0 && (
            <View className="mt-6">
              <Text className="text-sm font-medium text-neutral-500 dark:text-neutral-400 mb-2">
                Tags
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {recipe.tags.map((tag) => (
                  <Badge key={tag} label={`#${tag}`} variant="default" />
                ))}
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Bottom action bar */}
      <View className="px-4 py-4 bg-white dark:bg-neutral-800 border-t border-neutral-100 dark:border-neutral-700">
        <View className="flex-row space-x-3">
          <View className="flex-row items-center">
            <TouchableOpacity
              onPress={() => toggleLike(recipe.id)}
              className="flex-row items-center px-4 py-3 bg-neutral-100 dark:bg-neutral-700 rounded-xl"
            >
              <Ionicons name="heart-outline" size={20} color={colors.accent} />
              <Text className="ml-2 font-medium text-neutral-700 dark:text-neutral-300">
                {recipe.likes}
              </Text>
            </TouchableOpacity>
          </View>
          <Button
            title="Start Cooking"
            onPress={handleStartCooking}
            leftIcon={<Ionicons name="restaurant" size={20} color="white" />}
            className="flex-1"
          />
        </View>
      </View>

      <Paywall
        visible={showPaywall}
        onClose={() => setShowPaywall(false)}
        feature="AI Substitutions"
        requiredTier={accessDenied?.upgradeRequired || 'premium'}
      />
    </View>
  );
}
