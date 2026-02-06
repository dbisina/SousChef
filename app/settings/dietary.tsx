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
import { Card, Button } from '@/components/ui';

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
];

export default function DietaryPreferencesScreen() {
  const router = useRouter();
  const { user, updateUserProfile, isLoading } = useAuthStore();

  const [selectedDiets, setSelectedDiets] = useState<string[]>(
    user?.dietaryPreferences || []
  );
  const [selectedAllergies, setSelectedAllergies] = useState<string[]>(
    user?.allergies || []
  );

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
      });
      Alert.alert('Success', 'Dietary preferences updated!', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (error) {
      Alert.alert('Error', 'Failed to save preferences. Please try again.');
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-neutral-50" edges={['top']}>
      {/* Header */}
      <View className="flex-row items-center px-4 py-3 border-b border-neutral-100 bg-white">
        <TouchableOpacity onPress={() => router.back()} className="p-2 -ml-2">
          <Ionicons name="arrow-back" size={24} color="#404040" />
        </TouchableOpacity>
        <Text className="flex-1 text-lg font-bold text-neutral-900 ml-2">
          Dietary Preferences
        </Text>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="p-4">
          {/* Info card */}
          <Card className="bg-blue-50 border border-blue-200 mb-6">
            <View className="flex-row items-start">
              <Ionicons name="information-circle" size={20} color="#3B82F6" />
              <Text className="flex-1 text-blue-700 text-sm ml-2">
                Your preferences help us recommend recipes and filter out ingredients you want to avoid.
              </Text>
            </View>
          </Card>

          {/* Dietary Preferences */}
          <Text className="text-sm font-medium text-neutral-500 uppercase mb-3">
            Dietary Preferences
          </Text>
          <View className="flex-row flex-wrap mb-6">
            {DIETARY_OPTIONS.map((diet) => (
              <TouchableOpacity
                key={diet.id}
                onPress={() => toggleDiet(diet.id)}
                className={`mr-2 mb-2 px-4 py-2 rounded-full flex-row items-center ${
                  selectedDiets.includes(diet.id)
                    ? 'bg-primary-500'
                    : 'bg-white border border-neutral-200'
                }`}
              >
                <Ionicons
                  name={diet.icon as any}
                  size={16}
                  color={selectedDiets.includes(diet.id) ? 'white' : diet.color}
                />
                <Text
                  className={`ml-2 font-medium ${
                    selectedDiets.includes(diet.id) ? 'text-white' : 'text-neutral-700'
                  }`}
                >
                  {diet.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Allergies */}
          <Text className="text-sm font-medium text-neutral-500 uppercase mb-3">
            Allergies & Intolerances
          </Text>
          <Card padding="none" className="mb-6">
            {ALLERGY_OPTIONS.map((allergy, index) => (
              <TouchableOpacity
                key={allergy.id}
                onPress={() => toggleAllergy(allergy.id)}
                className={`flex-row items-center justify-between px-4 py-3 ${
                  index < ALLERGY_OPTIONS.length - 1 ? 'border-b border-neutral-100' : ''
                }`}
              >
                <View className="flex-row items-center">
                  <View
                    className={`w-8 h-8 rounded-full items-center justify-center ${
                      selectedAllergies.includes(allergy.id)
                        ? 'bg-red-100'
                        : 'bg-neutral-100'
                    }`}
                  >
                    <Ionicons
                      name={allergy.icon as any}
                      size={16}
                      color={selectedAllergies.includes(allergy.id) ? '#EF4444' : '#737373'}
                    />
                  </View>
                  <Text className="ml-3 text-neutral-900">{allergy.label}</Text>
                </View>
                <View
                  className={`w-6 h-6 rounded-full border-2 items-center justify-center ${
                    selectedAllergies.includes(allergy.id)
                      ? 'bg-red-500 border-red-500'
                      : 'border-neutral-300'
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
          {(selectedDiets.length > 0 || selectedAllergies.length > 0) && (
            <Card className="bg-neutral-100 mb-6">
              <Text className="font-semibold text-neutral-900 mb-2">Summary</Text>
              {selectedDiets.length > 0 && (
                <Text className="text-neutral-600 text-sm">
                  Diets: {selectedDiets.map((d) => DIETARY_OPTIONS.find((o) => o.id === d)?.label).join(', ')}
                </Text>
              )}
              {selectedAllergies.length > 0 && (
                <Text className="text-neutral-600 text-sm mt-1">
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
