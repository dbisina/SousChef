import React from 'react';
import { View, Text, ScrollView, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PortionAnalysis, DetectedItem } from '@/types';
import { Card } from '@/components/ui';
import { useThemeColors } from '@/stores/themeStore';

interface PortionAnalysisResultProps {
  imageUri: string;
  analysis: PortionAnalysis;
}

export const PortionAnalysisResult: React.FC<PortionAnalysisResultProps> = ({
  imageUri,
  analysis,
}) => {
  const colors = useThemeColors();

  return (
    <ScrollView className="flex-1 bg-neutral-50 dark:bg-neutral-950">
      {/* Captured image */}
      <View className="px-4 pt-4">
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
      </View>
    </ScrollView>
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
