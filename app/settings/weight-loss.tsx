import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/stores/authStore';
import { useThemeColors } from '@/stores/themeStore';
import { Card, Button } from '@/components/ui';
import { showSuccessToast, showErrorToast } from '@/stores/toastStore';
import { ACTIVITY_MULTIPLIERS } from '@/types/weightLoss';

const ACTIVITY_LEVELS = [
  { id: 'sedentary', label: 'Sedentary', description: 'Little or no exercise' },
  { id: 'light', label: 'Light', description: 'Exercise 1-3 days/week' },
  { id: 'moderate', label: 'Moderate', description: 'Exercise 3-5 days/week' },
  { id: 'active', label: 'Active', description: 'Exercise 6-7 days/week' },
  { id: 'very-active', label: 'Very Active', description: 'Hard exercise daily' },
] as const;

const DEFICIT_OPTIONS = [
  { value: 250, label: '250 cal', description: '~0.5 lb/week' },
  { value: 500, label: '500 cal', description: '~1 lb/week' },
  { value: 750, label: '750 cal', description: '~1.5 lb/week' },
];

// Rough average BMR estimate (Mifflin-St Jeor simplified)
const estimateBMR = (weightLbs: number): number => {
  // Simplified: using average height/age assumptions
  // BMR ~ 10 * weight(kg) + 625 (simplified for demo)
  const weightKg = weightLbs * 0.453592;
  return Math.round(10 * weightKg + 625);
};

type ActivityLevelKey = keyof typeof ACTIVITY_MULTIPLIERS;

export default function WeightLossScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const { user, updateUserProfile, isLoading } = useAuthStore();

  const existing = (user as any)?.weightLossGoal;

  const [currentWeight, setCurrentWeight] = useState<string>(
    existing?.currentWeight?.toString() || ''
  );
  const [targetWeight, setTargetWeight] = useState<string>(
    existing?.targetWeight?.toString() || ''
  );
  const [unit, setUnit] = useState<'lbs' | 'kg'>(existing?.unit || 'lbs');
  const [activityLevel, setActivityLevel] = useState<ActivityLevelKey>(
    existing?.activityLevel || 'moderate'
  );
  const [deficit, setDeficit] = useState<number>(
    existing?.dailyCalorieDeficit || 500
  );

  const weightNum = parseFloat(currentWeight) || 0;
  const weightInLbs = unit === 'kg' ? weightNum * 2.20462 : weightNum;

  const bmr = useMemo(() => estimateBMR(weightInLbs), [weightInLbs]);
  const tdee = useMemo(
    () => Math.round(bmr * ACTIVITY_MULTIPLIERS[activityLevel]),
    [bmr, activityLevel]
  );
  const calorieTarget = useMemo(
    () => Math.max(1200, tdee - deficit),
    [tdee, deficit]
  );

  const startDate = existing?.startDate;
  const daysOnPlan = startDate
    ? Math.floor((Date.now() - startDate) / (1000 * 60 * 60 * 24))
    : 0;

  const handleSave = async () => {
    if (!currentWeight || !targetWeight) {
      showErrorToast('Please enter both your current and target weight.', 'Missing Info');
      return;
    }

    try {
      await updateUserProfile({
        weightLossGoal: {
          currentWeight: parseFloat(currentWeight),
          targetWeight: parseFloat(targetWeight),
          startWeight: existing?.startWeight || parseFloat(currentWeight),
          unit,
          activityLevel,
          dailyCalorieTarget: calorieTarget,
          dailyCalorieDeficit: deficit,
          startDate: existing?.startDate || Date.now(),
        },
      } as any);
      showSuccessToast('Your weight loss goals have been saved!', 'Goals Updated');
      router.back();
    } catch (error) {
      showErrorToast('Could not save your goals. Please try again.', 'Save Problem');
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-neutral-50 dark:bg-neutral-900" edges={['top']}>
      {/* Header */}
      <View className="flex-row items-center px-4 py-3 border-b border-neutral-100 dark:border-neutral-700 bg-white dark:bg-neutral-800">
        <TouchableOpacity onPress={() => router.back()} className="p-2 -ml-2">
          <Ionicons name="arrow-back" size={24} color={colors.icon} />
        </TouchableOpacity>
        <Text className="flex-1 text-lg font-bold text-neutral-900 dark:text-neutral-50 ml-2">
          Weight Loss Journey
        </Text>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="p-4">
          {/* Info Card */}
          <Card className="bg-green-50 border border-green-200 mb-6">
            <View className="flex-row items-start">
              <Ionicons name="fitness" size={20} color="#16A34A" />
              <Text className="flex-1 text-green-700 text-sm ml-2">
                Set your goals and track your progress. We'll recommend meals that keep you on track.
              </Text>
            </View>
          </Card>

          {/* Current Stats Section */}
          <Text className="text-sm font-medium text-neutral-500 dark:text-neutral-400 uppercase mb-3">
            Current Stats
          </Text>

          {/* Unit Toggle */}
          <View className="flex-row mb-4">
            {(['lbs', 'kg'] as const).map((u) => (
              <TouchableOpacity
                key={u}
                onPress={() => setUnit(u)}
                className={`px-6 py-2 rounded-full mr-2 ${
                  unit === u
                    ? ''
                    : 'bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700'
                }`}
                style={unit === u ? { backgroundColor: colors.accent } : undefined}
              >
                <Text
                  className={`font-medium ${
                    unit === u ? 'text-white' : 'text-neutral-700 dark:text-neutral-300'
                  }`}
                >
                  {u.toUpperCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Weight Inputs */}
          <Card className="mb-4">
            <Text className="text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1.5">
              Current Weight ({unit})
            </Text>
            <TextInput
              className="bg-neutral-50 dark:bg-neutral-800 rounded-xl px-4 py-3 text-base text-neutral-800 dark:text-white border border-neutral-200 dark:border-neutral-700 mb-4"
              placeholder={`e.g. ${unit === 'lbs' ? '185' : '84'}`}
              placeholderTextColor="#9CA3AF"
              value={currentWeight}
              onChangeText={setCurrentWeight}
              keyboardType="numeric"
            />
            <Text className="text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1.5">
              Target Weight ({unit})
            </Text>
            <TextInput
              className="bg-neutral-50 dark:bg-neutral-800 rounded-xl px-4 py-3 text-base text-neutral-800 dark:text-white border border-neutral-200 dark:border-neutral-700"
              placeholder={`e.g. ${unit === 'lbs' ? '165' : '75'}`}
              placeholderTextColor="#9CA3AF"
              value={targetWeight}
              onChangeText={setTargetWeight}
              keyboardType="numeric"
            />
          </Card>

          {/* Activity Level */}
          <Text className="text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-2">
            Activity Level
          </Text>
          <View className="flex-row flex-wrap mb-6">
            {ACTIVITY_LEVELS.map((level) => (
              <TouchableOpacity
                key={level.id}
                onPress={() => setActivityLevel(level.id as ActivityLevelKey)}
                className={`mr-2 mb-2 px-4 py-2 rounded-full ${
                  activityLevel === level.id
                    ? ''
                    : 'bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700'
                }`}
                style={activityLevel === level.id ? { backgroundColor: colors.accent } : undefined}
              >
                <Text
                  className={`font-medium text-sm ${
                    activityLevel === level.id ? 'text-white' : 'text-neutral-700 dark:text-neutral-300'
                  }`}
                >
                  {level.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Daily Calorie Target Section */}
          <Text className="text-sm font-medium text-neutral-500 dark:text-neutral-400 uppercase mb-3">
            Daily Calorie Target
          </Text>

          <Card className="mb-4">
            {weightNum > 0 && (
              <View className="mb-4">
                <View className="flex-row justify-between mb-1">
                  <Text className="text-sm text-neutral-500 dark:text-neutral-400">Estimated TDEE</Text>
                  <Text className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">
                    {tdee} cal/day
                  </Text>
                </View>
                <View className="flex-row justify-between mb-1">
                  <Text className="text-sm text-neutral-500 dark:text-neutral-400">Deficit</Text>
                  <Text className="text-sm font-semibold text-red-500">-{deficit} cal</Text>
                </View>
                <View className="h-px bg-neutral-200 dark:bg-neutral-700 my-2" />
                <View className="flex-row justify-between">
                  <Text className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">
                    Daily Target
                  </Text>
                  <Text className="text-base font-bold text-green-600 dark:text-green-400">
                    {calorieTarget} cal/day
                  </Text>
                </View>
              </View>
            )}

            {/* Deficit Selector */}
            <Text className="text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-2">
              Calorie Deficit
            </Text>
            <View className="flex-row flex-wrap">
              {DEFICIT_OPTIONS.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  onPress={() => setDeficit(option.value)}
                  className={`mr-2 mb-2 px-4 py-2 rounded-full ${
                    deficit === option.value
                      ? ''
                      : 'bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700'
                  }`}
                  style={deficit === option.value ? { backgroundColor: colors.accent } : undefined}
                >
                  <Text
                    className={`font-medium text-sm ${
                      deficit === option.value ? 'text-white' : 'text-neutral-700 dark:text-neutral-300'
                    }`}
                  >
                    {option.label} ({option.description})
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </Card>

          {/* Progress Section */}
          <Text className="text-sm font-medium text-neutral-500 dark:text-neutral-400 uppercase mb-3">
            Progress
          </Text>

          <Card className="mb-6">
            {existing ? (
              <View>
                <View className="flex-row justify-between mb-3">
                  <View className="items-center flex-1">
                    <Text className="text-2xl font-bold text-neutral-900 dark:text-neutral-50">
                      {daysOnPlan}
                    </Text>
                    <Text className="text-xs text-neutral-500 dark:text-neutral-400">Days on Plan</Text>
                  </View>
                  <View className="items-center flex-1">
                    <Text className="text-2xl font-bold text-green-600 dark:text-green-400">
                      {existing.startWeight
                        ? Math.max(0, existing.startWeight - (parseFloat(currentWeight) || existing.startWeight)).toFixed(1)
                        : '0'}
                    </Text>
                    <Text className="text-xs text-neutral-500 dark:text-neutral-400">
                      {unit} Lost
                    </Text>
                  </View>
                  <View className="items-center flex-1">
                    <Text className="text-2xl font-bold text-neutral-900 dark:text-neutral-50">
                      {targetWeight
                        ? Math.max(0, (parseFloat(currentWeight) || 0) - parseFloat(targetWeight)).toFixed(1)
                        : '0'}
                    </Text>
                    <Text className="text-xs text-neutral-500 dark:text-neutral-400">
                      {unit} to Go
                    </Text>
                  </View>
                </View>
                <View className="bg-neutral-100 dark:bg-neutral-700 rounded-lg p-3 items-center">
                  <Ionicons name="bar-chart-outline" size={24} color="#9CA3AF" />
                  <Text className="text-sm text-neutral-400 dark:text-neutral-500 mt-1">
                    Weight chart coming soon
                  </Text>
                </View>
              </View>
            ) : (
              <View className="items-center py-4">
                <Ionicons name="trending-down" size={32} color="#9CA3AF" />
                <Text className="text-sm text-neutral-400 dark:text-neutral-500 mt-2 text-center">
                  Save your goals to start tracking progress
                </Text>
              </View>
            )}
          </Card>

          {/* Save Button */}
          <Button
            title="Save Goals"
            onPress={handleSave}
            isLoading={isLoading}
            fullWidth
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
