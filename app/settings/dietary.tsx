import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/stores/authStore';
import { useThemeColors } from '@/stores/themeStore';
import { Card, Button } from '@/components/ui';
import { showSuccessToast, showErrorToast } from '@/stores/toastStore';

const HEALTH_CONDITIONS = [
  { id: 'diabetic-type1', label: 'Type 1 Diabetes', icon: 'medical', color: '#DC2626' },
  { id: 'diabetic-type2', label: 'Type 2 Diabetes', icon: 'medical', color: '#DC2626' },
  { id: 'heart-disease', label: 'Heart Disease', icon: 'heart', color: '#EF4444' },
  { id: 'high-blood-pressure', label: 'High Blood Pressure', icon: 'pulse', color: '#F97316' },
  { id: 'high-cholesterol', label: 'High Cholesterol', icon: 'analytics', color: '#F59E0B' },
  { id: 'gerd', label: 'GERD / Acid Reflux', icon: 'flame', color: '#EAB308' },
  { id: 'ibs', label: 'IBS', icon: 'body', color: '#8B5CF6' },
  { id: 'celiac', label: 'Celiac Disease', icon: 'nutrition', color: '#A855F7' },
  { id: 'kidney-disease', label: 'Kidney Disease', icon: 'fitness', color: '#EC4899' },
  { id: 'gout', label: 'Gout', icon: 'walk', color: '#6366F1' },
  { id: 'pcos', label: 'PCOS', icon: 'female', color: '#D946EF' },
];

const DIETARY_OPTIONS = [
  { id: 'vegetarian', label: 'Vegetarian', icon: 'leaf', color: '#22C55E' },
  { id: 'vegan', label: 'Vegan', icon: 'leaf-outline', color: '#16A34A' },
  { id: 'gluten-free', label: 'Gluten-Free', icon: 'nutrition', color: '#F59E0B' },
  { id: 'dairy-free', label: 'Dairy-Free', icon: 'water', color: '#3B82F6' },
  { id: 'keto', label: 'Keto', icon: 'flame', color: '#EF4444' },
  { id: 'paleo', label: 'Paleo', icon: 'fish', color: '#8B5CF6' },
  { id: 'low-carb', label: 'Low Carb', icon: 'nutrition-outline', color: '#EC4899' },
  { id: 'halal', label: 'Halal', icon: 'checkmark-circle', color: '#10B981' },
  { id: 'kosher', label: 'Kosher', icon: 'star', color: '#6366F1' },
  { id: 'pescatarian', label: 'Pescatarian', icon: 'fish-outline', color: '#0EA5E9' },
  { id: 'whole30', label: 'Whole30', icon: 'calendar', color: '#F97316' },
  { id: 'low-fodmap', label: 'Low FODMAP', icon: 'shield-checkmark', color: '#14B8A6' },
  { id: 'anti-inflammatory', label: 'Anti-Inflammatory', icon: 'shield', color: '#6D28D9' },
  { id: 'low-sodium', label: 'Low Sodium', icon: 'water-outline', color: '#0284C7' },
  { id: 'mediterranean-diet', label: 'Mediterranean', icon: 'sunny', color: '#EA580C' },
];

const ALLERGY_OPTIONS = [
  { id: 'nuts', label: 'Tree Nuts', icon: 'alert-circle' },
  { id: 'peanuts', label: 'Peanuts', icon: 'alert-circle' },
  { id: 'shellfish', label: 'Shellfish', icon: 'alert-circle' },
  { id: 'fish', label: 'Fish', icon: 'alert-circle' },
  { id: 'eggs', label: 'Eggs', icon: 'alert-circle' },
  { id: 'soy', label: 'Soy', icon: 'alert-circle' },
  { id: 'wheat', label: 'Wheat', icon: 'alert-circle' },
  { id: 'sesame', label: 'Sesame', icon: 'alert-circle' },
  { id: 'milk', label: 'Milk / Lactose', icon: 'alert-circle' },
  { id: 'corn', label: 'Corn', icon: 'alert-circle' },
  { id: 'mustard', label: 'Mustard', icon: 'alert-circle' },
  { id: 'celery', label: 'Celery', icon: 'alert-circle' },
  { id: 'lupin', label: 'Lupin', icon: 'alert-circle' },
  { id: 'mollusks', label: 'Mollusks', icon: 'alert-circle' },
  { id: 'sulfites', label: 'Sulfites', icon: 'alert-circle' },
  { id: 'gluten', label: 'Gluten', icon: 'alert-circle' },
];

export default function DietaryPreferencesScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const { user, updateUserProfile, isLoading } = useAuthStore();

  const [selectedConditions, setSelectedConditions] = useState<string[]>(
    user?.healthConditions || []
  );
  const [selectedDiets, setSelectedDiets] = useState<string[]>(
    user?.dietaryPreferences || []
  );
  const [selectedAllergies, setSelectedAllergies] = useState<string[]>(
    user?.allergies || []
  );

  const toggleCondition = (id: string) => {
    setSelectedConditions((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  };

  const toggleDiet = (id: string) => {
    setSelectedDiets((prev) =>
      prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]
    );
  };

  const toggleAllergy = (id: string) => {
    setSelectedAllergies((prev) =>
      prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]
    );
  };

  const handleSave = async () => {
    try {
      await updateUserProfile({
        dietaryPreferences: selectedDiets,
        allergies: selectedAllergies,
        healthConditions: selectedConditions,
      });
      showSuccessToast('All set! We\'ve updated your dietary preferences.', 'Preferences Saved');
      router.back();
    } catch (error) {
      showErrorToast('Hmm, we couldn\'t save your preferences. Want to try again?', 'Save Problem');
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
          Dietary Preferences
        </Text>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="p-4">
          {/* Health Conditions info card */}
          <Card className="bg-red-50 border border-red-200 mb-6">
            <View className="flex-row items-start">
              <Ionicons name="medical" size={20} color="#DC2626" />
              <Text className="flex-1 text-red-700 text-sm ml-2">
                Medical conditions help us flag recipes that may not be safe for you and generate condition-appropriate meal plans.
              </Text>
            </View>
          </Card>

          {/* Health Conditions */}
          <Text className="text-sm font-medium text-neutral-500 dark:text-neutral-400 uppercase mb-3">
            Health Conditions
          </Text>
          <View className="flex-row flex-wrap mb-6">
            {HEALTH_CONDITIONS.map((condition) => (
              <TouchableOpacity
                key={condition.id}
                onPress={() => toggleCondition(condition.id)}
                className={`mr-2 mb-2 px-4 py-2 rounded-full flex-row items-center ${
                  selectedConditions.includes(condition.id)
                    ? ''
                    : 'bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700'
                }`}
                style={selectedConditions.includes(condition.id) ? { backgroundColor: condition.color } : undefined}
              >
                <Ionicons
                  name={condition.icon as any}
                  size={16}
                  color={selectedConditions.includes(condition.id) ? 'white' : condition.color}
                />
                <Text
                  className={`ml-2 font-medium ${
                    selectedConditions.includes(condition.id) ? 'text-white' : 'text-neutral-700 dark:text-neutral-300'
                  }`}
                >
                  {condition.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Dietary Preferences info card */}
          <Card className="bg-blue-50 border border-blue-200 mb-6">
            <View className="flex-row items-start">
              <Ionicons name="information-circle" size={20} color="#3B82F6" />
              <Text className="flex-1 text-blue-700 text-sm ml-2">
                Your preferences help us recommend recipes and filter out ingredients you want to avoid.
              </Text>
            </View>
          </Card>

          {/* Dietary Preferences */}
          <Text className="text-sm font-medium text-neutral-500 dark:text-neutral-400 uppercase mb-3">
            Dietary Preferences
          </Text>
          <View className="flex-row flex-wrap mb-6">
            {DIETARY_OPTIONS.map((diet) => (
              <TouchableOpacity
                key={diet.id}
                onPress={() => toggleDiet(diet.id)}
                className={`mr-2 mb-2 px-4 py-2 rounded-full flex-row items-center ${
                  selectedDiets.includes(diet.id)
                    ? ''
                    : 'bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700'
                }`}
                style={selectedDiets.includes(diet.id) ? { backgroundColor: colors.accent } : undefined}
              >
                <Ionicons
                  name={diet.icon as any}
                  size={16}
                  color={selectedDiets.includes(diet.id) ? 'white' : diet.color}
                />
                <Text
                  className={`ml-2 font-medium ${
                    selectedDiets.includes(diet.id) ? 'text-white' : 'text-neutral-700 dark:text-neutral-300'
                  }`}
                >
                  {diet.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Allergies & Intolerances */}
          <Text className="text-sm font-medium text-neutral-500 dark:text-neutral-400 uppercase mb-3">
            Allergies & Intolerances
          </Text>
          <Card padding="none" className="mb-6">
            {ALLERGY_OPTIONS.map((allergy, index) => (
              <TouchableOpacity
                key={allergy.id}
                onPress={() => toggleAllergy(allergy.id)}
                className={`flex-row items-center justify-between px-4 py-3 ${
                  index < ALLERGY_OPTIONS.length - 1 ? 'border-b border-neutral-100 dark:border-neutral-700' : ''
                }`}
              >
                <View className="flex-row items-center">
                  <View
                    className={`w-8 h-8 rounded-full items-center justify-center ${
                      selectedAllergies.includes(allergy.id)
                        ? 'bg-red-100 dark:bg-red-900/30'
                        : 'bg-neutral-100 dark:bg-neutral-700'
                    }`}
                  >
                    <Ionicons
                      name={allergy.icon as any}
                      size={16}
                      color={selectedAllergies.includes(allergy.id) ? '#EF4444' : '#737373'}
                    />
                  </View>
                  <Text className="ml-3 text-neutral-900 dark:text-neutral-100">{allergy.label}</Text>
                </View>
                <View
                  className={`w-6 h-6 rounded-full border-2 items-center justify-center ${
                    selectedAllergies.includes(allergy.id)
                      ? 'bg-red-500 border-red-500'
                      : 'border-neutral-300 dark:border-neutral-600'
                  }`}
                >
                  {selectedAllergies.includes(allergy.id) && (
                    <Ionicons name="checkmark" size={14} color="white" />
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </Card>

          {/* Summary */}
          {(selectedConditions.length > 0 || selectedDiets.length > 0 || selectedAllergies.length > 0) && (
            <Card className="bg-neutral-100 dark:bg-neutral-800 mb-6">
              <Text className="font-semibold text-neutral-900 dark:text-neutral-100 mb-2">Summary</Text>
              {selectedConditions.length > 0 && (
                <Text className="text-neutral-600 dark:text-neutral-400 text-sm">
                  Conditions: {selectedConditions.map((c) => HEALTH_CONDITIONS.find((o) => o.id === c)?.label).join(', ')}
                </Text>
              )}
              {selectedDiets.length > 0 && (
                <Text className="text-neutral-600 dark:text-neutral-400 text-sm mt-1">
                  Diets: {selectedDiets.map((d) => DIETARY_OPTIONS.find((o) => o.id === d)?.label).join(', ')}
                </Text>
              )}
              {selectedAllergies.length > 0 && (
                <Text className="text-neutral-600 dark:text-neutral-400 text-sm mt-1">
                  Allergies: {selectedAllergies.map((a) => ALLERGY_OPTIONS.find((o) => o.id === a)?.label).join(', ')}
                </Text>
              )}
            </Card>
          )}

          {/* Save button */}
          <Button
            title="Save Preferences"
            onPress={handleSave}
            isLoading={isLoading}
            fullWidth
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
