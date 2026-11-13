import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { PortionAnalysis, DetectedItem } from '@/types';
import {
  H2,
  Icon,
  Muted,
  RatingTag,
  Tile,
  UButton,
  UCard,
  UIconButton,
  UInput,
  Rows,
  Tag,
  FONT,
} from '@/components/ui';

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
  const { t } = useTranslation();
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
    <View className="flex-1 bg-ground">
      <View className="flex-row items-center" style={{ paddingVertical: 4 }}>
        <View className="flex-row items-center" style={{ minHeight: 44, gap: 8 }}>
          <UIconButton icon="close" label={t('cooking.dismiss', 'Dismiss')} size={44} onPress={onClose} />
          <Text className="text-accent-text" style={{ fontFamily: FONT.sansMedium, fontSize: 13 }}>
            {t('cooking.dismiss', 'Dismiss')}
          </Text>
        </View>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 18 }}>
        <Image source={{ uri: imageUri }} style={{ width: '100%', height: 220, borderRadius: 30 }} contentFit="cover" />

        <View className="flex-row" style={{ gap: 10 }}>
          <View className="flex-1">
            <Tile value={analysis.detectedItems?.length ?? 0} label={t('cooking.itemsFound', 'Items found')} />
          </View>
          <View className="flex-1">
            <Tile value={analysis.suggestedServings} label={t('cooking.servings', 'Servings')} />
          </View>
          <View className="flex-1">
            <Tile tone="accent" value={analysis.totalEstimatedCalories} label={t('cooking.totalCal', 'Total cal')} />
          </View>
        </View>

        <H2>{t('cooking.detectedItems', 'Detected Food Items')}</H2>

        {analysis.detectedItems?.length > 0 ? (
          <View style={{ gap: 8 }}>
            {analysis.detectedItems.map((item, index) => (
              <DetectedItemCard key={index} item={item} />
            ))}
          </View>
        ) : (
          <UCard>
            <View className="items-center" style={{ gap: 8, paddingVertical: 8 }}>
              <Icon name="camera" size="lg" color="muted" />
              <Text className="text-ink" style={{ fontFamily: FONT.display, fontSize: 15 }}>
                {t('cooking.couldNotIdentify', 'Could not identify food items')}
              </Text>
              <Muted small center>
                {t('cooking.tryClearer', 'Try taking a clearer photo with better lighting, or move closer to the food')}
              </Muted>
            </View>
          </UCard>
        )}

        {onRescan ? (
          <View style={{ gap: 12 }}>
            <Pressable
              onPress={() => setShowCorrection(!showCorrection)}
              accessibilityRole="button"
              accessibilityState={{ expanded: showCorrection }}
              className="flex-row items-center justify-between"
              style={{ minHeight: 44, gap: 12 }}
            >
              <View className="flex-row items-center flex-1" style={{ gap: 10 }}>
                <Icon name="edit" color="accent-text" />
                <Text className="text-ink flex-1" style={{ fontFamily: FONT.display, fontSize: 15 }}>
                  {t('cooking.wrongIngredients', 'Wrong ingredients? Help improve results')}
                </Text>
              </View>
              <Icon name={showCorrection ? 'chevronDown' : 'chevronRight'} color="muted" />
            </Pressable>

            {showCorrection ? (
              <UCard>
                <View style={{ gap: 12 }}>
                  <Muted small>
                    {t(
                      'cooking.rescanHelp',
                      'List the actual ingredients in your food. The AI will rescan with this context for better accuracy.'
                    )}
                  </Muted>

                  {ingredientHints.length > 0 ? (
                    <View className="flex-row flex-wrap" style={{ gap: 8 }}>
                      {ingredientHints.map((hint, index) => (
                        <Pressable
                          key={index}
                          onPress={() => removeIngredient(index)}
                          accessibilityRole="button"
                          accessibilityLabel={t('cooking.removeHint', 'Remove {{name}}', { name: hint })}
                          className="flex-row items-center bg-tag-o"
                          style={{ height: 36, borderRadius: 18, paddingHorizontal: 14, gap: 6 }}
                        >
                          <Text className="text-tag-o-fg" style={{ fontFamily: FONT.sansMedium, fontSize: 13 }}>
                            {hint}
                          </Text>
                          <Icon name="close" size="sm" color="tag-o-fg" />
                        </Pressable>
                      ))}
                    </View>
                  ) : null}

                  <UInput
                    label={t('cooking.addIngredientHint', 'Add an ingredient')}
                    placeholder={t('cooking.ingredientExample', 'e.g. chicken, rice, broccoli')}
                    value={ingredientInput}
                    onChangeText={setIngredientInput}
                    onSubmitEditing={addIngredient}
                    returnKeyType="done"
                    right={
                      <UIconButton
                        icon="plus"
                        label={t('cooking.addIngredientHint', 'Add an ingredient')}
                        tone="accent"
                        size={44}
                        onPress={addIngredient}
                      />
                    }
                  />

                  {ingredientHints.length > 0 ? (
                    <UButton
                      label={isRescanning ? t('cooking.rescanning', 'Rescanning...') : t('cooking.rescan', 'Rescan with these ingredients')}
                      variant="accent"
                      icon="refresh"
                      loading={isRescanning}
                      onPress={handleRescan}
                    />
                  ) : null}
                </View>
              </UCard>
            ) : null}
          </View>
        ) : null}

        {analysis.recommendations?.length > 0 ? (
          <View style={{ gap: 12 }}>
            <H2>{t('cooking.recommendations', 'Recommendations')}</H2>
            <Rows box>
              {analysis.recommendations.map((rec, index) => (
                <View key={index} className="flex-row items-start" style={{ paddingVertical: 14, gap: 12 }}>
                  <Icon name="bulb" size="sm" color="accent-text" />
                  <Text className="flex-1 text-ink" style={{ fontFamily: FONT.sans, fontSize: 14, lineHeight: 20 }}>
                    {rec}
                  </Text>
                </View>
              ))}
            </Rows>
          </View>
        ) : null}

        <View style={{ height: 16 }} />
      </ScrollView>
    </View>
  );
};

interface DetectedItemCardProps {
  item: DetectedItem;
}

const DetectedItemCard: React.FC<DetectedItemCardProps> = ({ item }) => {
  const { t } = useTranslation();
  const level = item.confidence >= 80 ? 'lo' : item.confidence >= 50 ? 'md' : 'hi';

  return (
    <UCard>
      <View className="flex-row items-center" style={{ gap: 12 }}>
        <View className="flex-1" style={{ gap: 2 }}>
          <Text className="text-ink" style={{ fontFamily: FONT.display, fontSize: 15 }}>
            {item.name}
          </Text>
          <Muted small>
            ~{item.estimatedAmount} {item.unit}
          </Muted>
        </View>

        <View className="items-end" style={{ gap: 6 }}>
          <Tag label={`${item.estimatedCalories} ${t('cooking.cal', 'cal')}`} />
          <RatingTag small level={level} label={t('cooking.percentSure', '{{n}}% sure', { n: item.confidence })} />
        </View>
      </View>
    </UCard>
  );
};

// Loading state for analysis
export const PortionAnalysisLoading: React.FC = () => {
  const { t } = useTranslation();

  return (
    <View className="flex-1 items-center justify-center bg-ground" style={{ padding: 32, gap: 12 }}>
      <View className="items-center justify-center bg-tag-o" style={{ width: 80, height: 80, borderRadius: 40 }}>
        <Icon name="scan" size="lg" color="tag-o-fg" />
      </View>
      <Text className="text-ink" style={{ fontFamily: FONT.display, fontSize: 22 }}>
        {t('cooking.analyzing', 'Analyzing Image...')}
      </Text>
      <Muted center>
        {t('cooking.analyzingHelp', 'Our AI is identifying ingredients and estimating portions')}
      </Muted>
    </View>
  );
};
