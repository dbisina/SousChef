import React, { useState } from 'react';
import { View, Text, ScrollView, Image, TouchableOpacity, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PortionAnalysis, DetectedItem } from '@/types';
import { Card, Button } from '@/components/ui';
import { useThemeColors } from '@/stores/themeStore';

interface PortionAnalysisResultProps {
  imageUri: string;
  analysis: PortionAnalysis;
  onClose: () => void;
  onRescan?: (ingredientHints: string[]) => void;
  isRescanning?: boolean;
}

export const PortionAnalysisResult: React.FC<PortionAnalysisResultProps> = ({
  imageUri,
  analysis,
  onClose,
  onRescan,
  isRescanning,
}) => {
  const colors = useThemeColors();
  const [showCorrection, setShowCorrection] = useState(false);
  const [ingredientInput, setIngredientInput] = useState('');
  const [ingredientHints, setIngredientHints] = useState<string[]>([]);

  const addIngredient = () => {
    const trimmed = ingredientInput.trim();
    if (trimmed && !ingredientHints.includes(trimmed)) {
      setIngredientHints((prev) => [...prev, trimmed]);
      setIngredientInput('');
    }
  };

  const removeIngredient = (index: number) => {
    setIngredientHints((prev) => prev.filter((_, i) => i !== index));
  };

  const handleRescan = () => {
    if (onRescan && ingredientHints.length > 0) {
      onRescan(ingredientHints);
    }
  };

  return (
    <View className="flex-1 bg-neutral-50 dark:bg-neutral-950">
      {/* Close / Back button */}
      <View className="flex-row items-center px-4 pt-2 pb-1">
        <TouchableOpacity
          onPress={onClose}
          className="flex-row items-center py-2 pr-4"
        >
          <Ionicons name="close-circle" size={28} color={colors.accent} />
          <Text className="ml-2 font-semibold text-base" style={{ color: colors.accent }}>
            Dismiss
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Captured image */}
        <View className="px-4">
          <Image
            source={{ uri: imageUri }}
            className="w-full h-64"
            style={{ borderRadius: 20 }}
            resizeMode="cover"
          />
        </View>

        <View className="p-4">
          {/* Summary */}
          <Card variant="elevated" className="mb-4">
            <View className="flex-row items-center justify-between">
              <View className="items-center flex-1">
                <Text className="text-2xl font-bold" style={{ color: colors.accent }}>
                  {analysis.detectedItems?.length ?? 0}
                </Text>
                <Text className="text-sm text-neutral-500 dark:text-neutral-400">Items Found</Text>
              </View>
              <View className="w-px h-12 bg-neutral-200 dark:bg-neutral-700" />
              <View className="items-center flex-1">
                <Text className="text-2xl font-bold text-secondary-500">
                  {analysis.suggestedServings}
                </Text>
                <Text className="text-sm text-neutral-500 dark:text-neutral-400">Servings</Text>
              </View>
              <View className="w-px h-12 bg-neutral-200 dark:bg-neutral-700" />
              <View className="items-center flex-1">
                <Text className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
                  {analysis.totalEstimatedCalories}
                </Text>
                <Text className="text-sm text-neutral-500 dark:text-neutral-400">Total Cal</Text>
              </View>
            </View>
          </Card>

          {/* Detected items */}
          <Text className="text-lg font-bold text-neutral-900 dark:text-neutral-100 mb-3">
            Detected Food Items
          </Text>

          {analysis.detectedItems?.length > 0 ? (
            analysis.detectedItems.map((item, index) => (
              <DetectedItemCard key={index} item={item} />
            ))
          ) : (
            <Card className="items-center py-6">
              <Ionicons name="camera-outline" size={40} color={colors.textMuted} />
              <Text className="text-neutral-600 dark:text-neutral-400 font-medium mt-2">
                Could not identify food items
              </Text>
              <Text className="text-neutral-400 dark:text-neutral-500 text-sm mt-1 text-center px-4">
                Try taking a clearer photo with better lighting, or move closer to the food
              </Text>
            </Card>
          )}

          {/* Ingredient correction / Rescan section */}
          {onRescan && (
            <View className="mt-6">
              <TouchableOpacity
                onPress={() => setShowCorrection(!showCorrection)}
                className="flex-row items-center justify-between py-2"
              >
                <View className="flex-row items-center">
                  <Ionicons name="create-outline" size={20} color={colors.accent} />
                  <Text className="ml-2 font-semibold text-neutral-900 dark:text-neutral-100">
                    Wrong ingredients? Help improve results
                  </Text>
                </View>
                <Ionicons
                  name={showCorrection ? 'chevron-up' : 'chevron-down'}
                  size={20}
                  color={colors.textMuted}
                />
              </TouchableOpacity>

              {showCorrection && (
                <Card variant="outlined" className="mt-2">
                  <Text className="text-sm text-neutral-500 dark:text-neutral-400 mb-3">
                    List the actual ingredients in your food. The AI will rescan with this context for better accuracy.
                  </Text>

                  {/* Ingredient chips */}
                  {ingredientHints.length > 0 && (
                    <View className="flex-row flex-wrap mb-3">
                      {ingredientHints.map((hint, index) => (
                        <View
                          key={index}
                          className="flex-row items-center bg-primary-100 dark:bg-primary-900 rounded-full px-3 py-1.5 mr-2 mb-2"
                        >
                          <Text className="text-sm font-medium" style={{ color: colors.accent }}>
                            {hint}
                          </Text>
                          <TouchableOpacity onPress={() => removeIngredient(index)} className="ml-1.5">
                            <Ionicons name="close-circle" size={16} color={colors.accent} />
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  )}

                  {/* Input row */}
                  <View className="flex-row items-center">
                    <TextInput
                      className="flex-1 bg-neutral-100 dark:bg-neutral-800 rounded-xl px-4 py-2.5 text-neutral-900 dark:text-neutral-100"
                      placeholder="e.g. chicken, rice, broccoli"
                      placeholderTextColor={colors.textMuted}
                      value={ingredientInput}
                      onChangeText={setIngredientInput}
                      onSubmitEditing={addIngredient}
                      returnKeyType="done"
                    />
                    <TouchableOpacity
                      onPress={addIngredient}
                      className="ml-2 w-10 h-10 rounded-full items-center justify-center"
                      style={{ backgroundColor: colors.accent }}
                    >
                      <Ionicons name="add" size={22} color="white" />
                    </TouchableOpacity>
                  </View>

                  {/* Rescan button */}
                  {ingredientHints.length > 0 && (
                    <Button
                      title={isRescanning ? 'Rescanning...' : 'Rescan with these ingredients'}
                      onPress={handleRescan}
                      isLoading={isRescanning}
                      fullWidth
                      leftIcon={<Ionicons name="refresh" size={18} color="white" />}
                      style={{ marginTop: 12 }}
                    />
                  )}
                </Card>
              )}
            </View>
          )}

          {/* Recommendations */}
          {analysis.recommendations?.length > 0 && (
            <>
              <Text className="text-lg font-bold text-neutral-900 dark:text-neutral-100 mt-6 mb-3">
                Recommendations
              </Text>
              <Card variant="outlined">
                {analysis.recommendations.map((rec, index) => (
                  <View
                    key={index}
                    className={`flex-row items-start py-2 ${
                      index > 0 ? 'border-t border-neutral-100 dark:border-neutral-800' : ''
                    }`}
                  >
                    <Ionicons
                      name="bulb-outline"
                      size={18}
                      color="#F59E0B"
                      style={{ marginTop: 2 }}
                    />
                    <Text className="flex-1 text-neutral-700 dark:text-neutral-300 ml-2">{rec}</Text>
                  </View>
                ))}
              </Card>
            </>
          )}

          {/* Bottom spacing */}
          <View className="h-4" />
        </View>
      </ScrollView>
    </View>
  );
};

interface DetectedItemCardProps {
  item: DetectedItem;
}

const DetectedItemCard: React.FC<DetectedItemCardProps> = ({ item }) => {
  const confidenceColor =
    item.confidence >= 80
      ? 'text-green-600'
      : item.confidence >= 50
      ? 'text-amber-600'
      : 'text-red-600';

  const confidenceBg =
    item.confidence >= 80
      ? 'bg-green-100'
      : item.confidence >= 50
      ? 'bg-amber-100'
      : 'bg-red-100';

  return (
    <Card className="mb-2 flex-row items-center">
      <View className="flex-1">
        <Text className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
          {item.name}
        </Text>
        <Text className="text-sm text-neutral-500 dark:text-neutral-400">
          ~{item.estimatedAmount} {item.unit}
        </Text>
      </View>

      <View className="items-end">
        <Text className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
          {item.estimatedCalories} cal
        </Text>
        <View className={`mt-1 px-2 py-0.5 rounded-full ${confidenceBg}`}>
          <Text className={`text-xs font-medium ${confidenceColor}`}>
            {item.confidence}% sure
          </Text>
        </View>
      </View>
    </Card>
  );
};

// Loading state for analysis
export const PortionAnalysisLoading: React.FC = () => {
  const colors = useThemeColors();

  return (
    <View className="flex-1 items-center justify-center bg-white dark:bg-neutral-900 p-8">
      <View className="w-20 h-20 rounded-full bg-primary-100 dark:bg-neutral-800 items-center justify-center mb-4">
        <Ionicons name="scan-outline" size={40} color={colors.accent} />
      </View>
      <Text className="text-xl font-bold text-neutral-900 dark:text-neutral-100 mb-2">
        Analyzing Image...
      </Text>
      <Text className="text-neutral-500 dark:text-neutral-400 text-center">
        Our AI is identifying ingredients and estimating portions
      </Text>
    </View>
  );
};
