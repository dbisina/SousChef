import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { MealPlanPreferences, MealType, DEFAULT_MEAL_PLAN_PREFERENCES } from '@/types/mealplan';
import { Button, Card } from '@/components/ui';

interface PlanGeneratorProps {
  visible: boolean;
  onClose: () => void;
  onGenerate: (preferences: MealPlanPreferences) => void;
  isGenerating: boolean;
  expiringItemsCount: number;
}

export const PlanGenerator: React.FC<PlanGeneratorProps> = ({
  visible,
  onClose,
  onGenerate,
  isGenerating,
  expiringItemsCount,
}) => {
  const [preferences, setPreferences] = useState<MealPlanPreferences>(
    DEFAULT_MEAL_PLAN_PREFERENCES
  );

  const handleMealTypeToggle = (mealType: MealType) => {
    const current = preferences.mealsToInclude;
    if (current.includes(mealType)) {
      // Don't allow removing all meal types
      if (current.length <= 1) return;
      setPreferences({
        ...preferences,
        mealsToInclude: current.filter((m) => m !== mealType),
      });
    } else {
      setPreferences({
        ...preferences,
        mealsToInclude: [...current, mealType],
      });
    }
  };

  const handleServingsChange = (delta: number) => {
    const newServings = Math.max(1, Math.min(10, preferences.servingsPerMeal + delta));
    setPreferences({ ...preferences, servingsPerMeal: newServings });
  };

  const handleDaysChange = (delta: number) => {
    const newDays = Math.max(1, Math.min(7, preferences.daysToGenerate + delta));
    setPreferences({ ...preferences, daysToGenerate: newDays });
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView className="flex-1 bg-white">
        {/* Header */}
        <View className="flex-row items-center justify-between px-4 py-3 border-b border-neutral-100">
          <TouchableOpacity onPress={onClose}>
            <Text className="text-neutral-500">Cancel</Text>
          </TouchableOpacity>
          <Text className="text-lg font-bold text-neutral-900">
            Generate Meal Plan
          </Text>
          <View style={{ width: 60 }} />
        </View>

        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
          <View className="p-4">
            {/* Expiring items alert */}
            {expiringItemsCount > 0 && (
              <Card className="mb-4 bg-amber-50 border border-amber-200">
                <View className="flex-row items-center">
                  <View className="w-10 h-10 rounded-full bg-amber-100 items-center justify-center">
                    <Ionicons name="warning" size={20} color="#D97706" />
                  </View>
                  <View className="flex-1 ml-3">
                    <Text className="text-amber-800 font-semibold">
                      {expiringItemsCount} Expiring Item{expiringItemsCount !== 1 ? 's' : ''}
                    </Text>
                    <Text className="text-amber-600 text-sm">
                      Will be prioritized in your meal plan
                    </Text>
                  </View>
                </View>
              </Card>
            )}

            {/* Servings */}
            <Card className="mb-4">
              <View className="flex-row items-center justify-between">
                <View>
                  <Text className="text-base font-medium text-neutral-900">
                    Servings per meal
                  </Text>
                  <Text className="text-sm text-neutral-500">
                    How many people are you cooking for?
                  </Text>
                </View>
                <View className="flex-row items-center">
                  <TouchableOpacity
                    onPress={() => handleServingsChange(-1)}
                    className="w-10 h-10 rounded-full bg-neutral-100 items-center justify-center"
                  >
                    <Ionicons name="remove" size={20} color="#404040" />
                  </TouchableOpacity>
                  <Text className="mx-4 text-xl font-bold text-neutral-900 w-8 text-center">
                    {preferences.servingsPerMeal}
                  </Text>
                  <TouchableOpacity
                    onPress={() => handleServingsChange(1)}
                    className="w-10 h-10 rounded-full bg-neutral-100 items-center justify-center"
                  >
                    <Ionicons name="add" size={20} color="#404040" />
                  </TouchableOpacity>
                </View>
              </View>
            </Card>

            {/* Days to plan */}
            <Card className="mb-4">
              <View className="flex-row items-center justify-between">
                <View>
                  <Text className="text-base font-medium text-neutral-900">
                    Days to plan
                  </Text>
                  <Text className="text-sm text-neutral-500">
                    How far ahead to plan?
                  </Text>
                </View>
                <View className="flex-row items-center">
                  <TouchableOpacity
                    onPress={() => handleDaysChange(-1)}
                    className="w-10 h-10 rounded-full bg-neutral-100 items-center justify-center"
                  >
                    <Ionicons name="remove" size={20} color="#404040" />
                  </TouchableOpacity>
                  <Text className="mx-4 text-xl font-bold text-neutral-900 w-8 text-center">
                    {preferences.daysToGenerate}
                  </Text>
                  <TouchableOpacity
                    onPress={() => handleDaysChange(1)}
                    className="w-10 h-10 rounded-full bg-neutral-100 items-center justify-center"
                  >
                    <Ionicons name="add" size={20} color="#404040" />
                  </TouchableOpacity>
                </View>
              </View>
            </Card>

            {/* Meals to include */}
            <Card className="mb-4">
              <Text className="text-base font-medium text-neutral-900 mb-3">
                Meals to include
              </Text>
              <View className="flex-row flex-wrap">
                {(['breakfast', 'lunch', 'dinner', 'snack'] as MealType[]).map(
                  (mealType) => {
                    const isSelected = preferences.mealsToInclude.includes(mealType);
                    return (
                      <TouchableOpacity
                        key={mealType}
                        onPress={() => handleMealTypeToggle(mealType)}
                        className={`mr-2 mb-2 px-4 py-2 rounded-full border ${
                          isSelected
                            ? 'bg-primary-500 border-primary-500'
                            : 'bg-white border-neutral-300'
                        }`}
                      >
                        <Text
                          className={`font-medium capitalize ${
                            isSelected ? 'text-white' : 'text-neutral-600'
                          }`}
                        >
                          {mealType}
                        </Text>
                      </TouchableOpacity>
                    );
                  }
                )}
              </View>
            </Card>

            {/* Optimization options */}
            <Card className="mb-4">
              <Text className="text-base font-medium text-neutral-900 mb-3">
                Optimization options
              </Text>

              <View className="flex-row items-center justify-between py-2 border-b border-neutral-100">
                <View className="flex-1">
                  <Text className="text-neutral-800">
                    Prioritize expiring items
                  </Text>
                  <Text className="text-sm text-neutral-500">
                    Use items about to expire first
                  </Text>
                </View>
                <Switch
                  value={preferences.prioritizeExpiring}
                  onValueChange={(value) =>
                    setPreferences({ ...preferences, prioritizeExpiring: value })
                  }
                  trackColor={{ false: '#E5E5E5', true: '#FF6B35' }}
                  thumbColor="white"
                />
              </View>

              <View className="flex-row items-center justify-between py-2 border-b border-neutral-100">
                <View className="flex-1">
                  <Text className="text-neutral-800">
                    Maximize ingredient overlap
                  </Text>
                  <Text className="text-sm text-neutral-500">
                    Reuse ingredients across meals
                  </Text>
                </View>
                <Switch
                  value={preferences.maximizeOverlap}
                  onValueChange={(value) =>
                    setPreferences({ ...preferences, maximizeOverlap: value })
                  }
                  trackColor={{ false: '#E5E5E5', true: '#FF6B35' }}
                  thumbColor="white"
                />
              </View>

              <View className="flex-row items-center justify-between py-2">
                <View className="flex-1">
                  <Text className="text-neutral-800">Budget-friendly</Text>
                  <Text className="text-sm text-neutral-500">
                    Prefer cheaper ingredients
                  </Text>
                </View>
                <Switch
                  value={preferences.budgetFriendly}
                  onValueChange={(value) =>
                    setPreferences({ ...preferences, budgetFriendly: value })
                  }
                  trackColor={{ false: '#E5E5E5', true: '#FF6B35' }}
                  thumbColor="white"
                />
              </View>
            </Card>

            {/* Info card */}
            <Card className="bg-primary-50 border border-primary-200">
              <View className="flex-row">
                <Ionicons name="sparkles" size={20} color="#FF6B35" />
                <View className="flex-1 ml-3">
                  <Text className="text-primary-800 font-medium">
                    AI-Powered Optimization
                  </Text>
                  <Text className="text-primary-600 text-sm mt-1">
                    Our AI will analyze your pantry, expiring items, and recipe
                    collection to create the most efficient meal plan possible.
                  </Text>
                </View>
              </View>
            </Card>
          </View>
        </ScrollView>

        {/* Generate button */}
        <View className="p-4 border-t border-neutral-100">
          <Button
            title={isGenerating ? 'Generating...' : 'Generate Meal Plan'}
            onPress={() => onGenerate(preferences)}
            isLoading={isGenerating}
            fullWidth
            leftIcon={
              !isGenerating && (
                <Ionicons name="sparkles" size={20} color="white" />
              )
            }
          />
        </View>
      </SafeAreaView>
    </Modal>
  );
};
