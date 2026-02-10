import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useMealPlan, useMealPlanStats, useMealPlanAccess } from '@/hooks/useMealPlan';
import { usePantryStore } from '@/stores/pantryStore';
import { useRecipeStore } from '@/stores/recipeStore';
import { useThemeColors } from '@/stores/themeStore';
import { WeekView, PlanGenerator, SavingsDisplay } from '@/components/mealplan';
import { Loading, Empty, Card, Button } from '@/components/ui';
import { Paywall, FeatureGate } from '@/components/subscription';
import { getWeekStartDate } from '@/services/mealPlanService';
import { MealType } from '@/types/mealplan';

export default function MealPlanScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const { getExpiringItems, getExpiredItems } = usePantryStore();
  const { recipes } = useRecipeStore();

  const {
    currentPlan,
    isLoading,
    isGenerating,
    error,
    selectedWeekStart,
    canView,
    canGenerate,
    generate,
    clear,
    goToWeek,
    setSelectedWeek,
    updatePreferences,
  } = useMealPlan();

  const stats = useMealPlanStats();
  const { isPremium, isPro } = useMealPlanAccess();

  const [showGenerator, setShowGenerator] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);

  const expiringItems = [...getExpiringItems(), ...getExpiredItems()];
  const isCurrentWeek = selectedWeekStart === getWeekStartDate();

  // Handle week navigation
  const handlePreviousWeek = () => {
    const prev = new Date(selectedWeekStart);
    prev.setDate(prev.getDate() - 7);
    const prevWeek = prev.toISOString().split('T')[0];
    goToWeek(prevWeek);
  };

  const handleNextWeek = () => {
    const next = new Date(selectedWeekStart);
    next.setDate(next.getDate() + 7);
    const nextWeek = next.toISOString().split('T')[0];
    goToWeek(nextWeek);
  };

  // Handle meal press
  const handleMealPress = (date: string, mealType: string, recipeId?: string) => {
    if (recipeId) {
      router.push(`/recipe/${recipeId}`);
    }
  };

  // Handle add meal
  const handleAddMeal = (date: string, mealType: string) => {
    // Navigate to recipe browser with meal selection mode
    router.push({
      pathname: '/browse',
      params: { selectForMeal: mealType, date },
    });
  };

  // Handle generate
  const handleGenerate = async () => {
    if (!canGenerate.allowed) {
      setShowPaywall(true);
      return;
    }

    if (recipes.length === 0) {
      Alert.alert(
        'No Recipes',
        'Add some recipes first to generate a meal plan.',
        [{ text: 'OK' }]
      );
      return;
    }

    setShowGenerator(true);
  };

  const handleGenerateConfirm = async (preferences: any) => {
    updatePreferences(preferences);
    setShowGenerator(false);
    await generate();
  };

  // Handle clear plan
  const handleClearPlan = () => {
    Alert.alert(
      'Clear Meal Plan',
      'Are you sure you want to clear this week\'s meal plan?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => clear(),
        },
      ]
    );
  };

  // Show paywall for free users
  if (!canView) {
    return (
      <SafeAreaView className="flex-1 bg-neutral-50 dark:bg-neutral-900">
        <View className="flex-1 items-center justify-center p-8">
          <View className="w-20 h-20 rounded-full items-center justify-center mb-6" style={{ backgroundColor: colors.accent + '20' }}>
            <Ionicons name="calendar-outline" size={40} color={colors.accent} />
          </View>
          <Text className="text-2xl font-bold text-neutral-900 dark:text-neutral-50 text-center mb-2">
            Meal Planning
          </Text>
          <Text className="text-neutral-500 dark:text-neutral-400 text-center mb-6">
            Plan your meals for the week, reduce food waste, and save money with
            smart shopping lists.
          </Text>
          <Button
            title="Upgrade to Premium"
            onPress={() => setShowPaywall(true)}
            leftIcon={<Ionicons name="star" size={20} color="white" />}
          />
          <Paywall
            visible={showPaywall}
            onClose={() => setShowPaywall(false)}
            feature="Meal Planning"
            requiredTier="premium"
          />
        </View>
      </SafeAreaView>
    );
  }

  if (isLoading) {
    return <Loading fullScreen message="Loading meal plan..." />;
  }

  return (
    <SafeAreaView className="flex-1 bg-neutral-50 dark:bg-neutral-900" edges={['top']}>
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-3 bg-white dark:bg-neutral-800 border-b border-neutral-100 dark:border-neutral-700">
        <Text className="text-2xl font-bold text-neutral-900 dark:text-neutral-50">Meal Plan</Text>
        <View className="flex-row">
          {/* Shopping list button */}
          {currentPlan && currentPlan.shoppingList.length > 0 && (
            <TouchableOpacity
              onPress={() => router.push('/mealplan/shopping')}
              className="mr-2 p-2"
            >
              <View className="relative">
                <Ionicons name="cart-outline" size={24} color={colors.accent} />
                <View className="absolute -top-1 -right-1 w-4 h-4 rounded-full items-center justify-center" style={{ backgroundColor: colors.accent }}>
                  <Text className="text-white text-xs font-bold">
                    {currentPlan.shoppingList.filter((i) => !i.checked).length}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          )}

          {/* Waste tracking button */}
          <TouchableOpacity
            onPress={() => router.push('/mealplan/waste')}
            className="p-2"
          >
            <Ionicons name="leaf-outline" size={24} color="#22C55E" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Error display */}
      {error && (
        <View className="mx-4 mt-4 p-4 bg-red-50 dark:bg-red-900/30 rounded-xl border border-red-200 dark:border-red-800">
          <Text className="text-red-600 dark:text-red-400">{error}</Text>
        </View>
      )}

      {/* Savings display */}
      {currentPlan && stats.estimatedSavings > 0 && (
        <View className="px-4 pt-4">
          <SavingsDisplay
            savedByPlanning={stats.estimatedSavings}
            expiringItemsUsed={stats.expiringItemsUsed}
          />
        </View>
      )}

      {/* Main content */}
      {currentPlan ? (
        <ScrollView 
          className="flex-1"
          contentContainerStyle={{ paddingBottom: 120 }}
        >
          <WeekView
            days={currentPlan.days}
            selectedWeekStart={selectedWeekStart}
            onPreviousWeek={handlePreviousWeek}
            onNextWeek={handleNextWeek}
            onMealPress={handleMealPress}
            onAddMeal={handleAddMeal}
            isCurrentWeek={isCurrentWeek}
          />

          {/* Stats summary */}
          <View className="px-4 py-3 bg-white dark:bg-neutral-800 border-t border-neutral-100 dark:border-neutral-700">
            <View className="flex-row justify-between items-center">
              <View className="items-center">
                <Text className="text-lg font-bold text-neutral-900 dark:text-neutral-50">
                  {stats.totalMeals}
                </Text>
                <Text className="text-xs text-neutral-500 dark:text-neutral-400">Meals</Text>
              </View>
              <View className="items-center">
                <Text className="text-lg font-bold text-neutral-900 dark:text-neutral-50">
                  {stats.uniqueRecipes}
                </Text>
                <Text className="text-xs text-neutral-500 dark:text-neutral-400">Recipes</Text>
              </View>
              <View className="items-center">
                <Text className="text-lg font-bold text-secondary-600 dark:text-secondary-400">
                  {stats.ingredientOverlap}%
                </Text>
                <Text className="text-xs text-neutral-500 dark:text-neutral-400">Overlap</Text>
              </View>
              <TouchableOpacity onPress={handleClearPlan}>
                <View className="flex-row items-center">
                  <Ionicons name="refresh-outline" size={20} color={colors.textMuted} />
                  <Text className="text-neutral-500 dark:text-neutral-400 ml-1">Reset</Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      ) : (
        <View className="flex-1 items-center justify-center p-8">
          <View className="w-24 h-24 rounded-full bg-neutral-100 dark:bg-neutral-800 items-center justify-center mb-6">
            <Ionicons name="restaurant-outline" size={48} color={colors.textMuted} />
          </View>
          <Text className="text-xl font-bold text-neutral-900 dark:text-neutral-50 text-center mb-2">
            No Meal Plan Yet
          </Text>
          <Text className="text-neutral-500 dark:text-neutral-400 text-center mb-6">
            Generate an AI-optimized meal plan based on your pantry and
            preferences.
          </Text>

          {/* Expiring items alert */}
          {expiringItems.length > 0 && (
            <Card className="w-full mb-6 bg-amber-50 border border-amber-200">
              <View className="flex-row items-center">
                <Ionicons name="warning" size={20} color="#D97706" />
                <Text className="text-amber-700 ml-2">
                  {expiringItems.length} item{expiringItems.length !== 1 ? 's' : ''}{' '}
                  expiring soon
                </Text>
              </View>
            </Card>
          )}

          <Button
            title={canGenerate.allowed ? 'Generate Meal Plan' : 'Upgrade to Generate'}
            onPress={handleGenerate}
            leftIcon={
              <Ionicons
                name={canGenerate.allowed ? 'sparkles' : 'lock-closed'}
                size={20}
                color="white"
              />
            }
          />

          {!canGenerate.allowed && (
            <Text className="text-neutral-400 dark:text-neutral-500 text-sm mt-2 text-center">
              Pro subscription required for AI generation
            </Text>
          )}
        </View>
      )}

      {/* Floating generate button when plan exists */}
      {currentPlan && canGenerate.allowed && (
        <TouchableOpacity
          onPress={() => setShowGenerator(true)}
          className="absolute bottom-6 right-6 w-14 h-14 rounded-full items-center justify-center shadow-lg"
          style={{ backgroundColor: colors.accent }}
        >
          <Ionicons name="sparkles" size={24} color="white" />
        </TouchableOpacity>
      )}

      {/* Plan generator modal */}
      <PlanGenerator
        visible={showGenerator}
        onClose={() => setShowGenerator(false)}
        onGenerate={handleGenerateConfirm}
        isGenerating={isGenerating}
        expiringItemsCount={expiringItems.length}
      />

      {/* Paywall */}
      <Paywall
        visible={showPaywall}
        onClose={() => setShowPaywall(false)}
        feature="AI Meal Plan Generation"
        requiredTier="pro"
      />
    </SafeAreaView>
  );
}
