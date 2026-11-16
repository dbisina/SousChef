import React from 'react';
import { View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { NutritionInfo } from '@/types';
import { calculateDailyValues, formatNutrition } from '@/services/calorieService';
import { FONT } from '@/components/ui';

interface NutritionCardProps {
  nutrition: NutritionInfo;
  servings?: number;
  showDailyValues?: boolean;
  compact?: boolean;
}

export const NutritionCard: React.FC<NutritionCardProps> = ({
  nutrition,
  servings = 1,
  showDailyValues = true,
  compact = false,
}) => {
  const { t } = useTranslation();
  const dailyValues = calculateDailyValues(nutrition);

  if (compact) {
    return (
      <View className="flex-row items-center justify-between bg-surface" style={{ borderRadius: 24, padding: 14 }}>
        <NutritionBadge label={t('cooking.cal', 'cal')} value={nutrition.caloriesPerServing} unit="" />
        <NutritionBadge label={t('cooking.protein', 'Protein')} value={nutrition.protein} unit="g" />
        <NutritionBadge label={t('cooking.carbs', 'Carbs')} value={nutrition.carbs} unit="g" />
        <NutritionBadge label={t('cooking.fat', 'Fat')} value={nutrition.fat} unit="g" />
      </View>
    );
  }

  return (
    <View className="bg-surface" style={{ borderRadius: 28, padding: 18, gap: 10 }}>
      {servings > 1 ? (
        <Text className="text-muted" style={{ fontFamily: FONT.sans, fontSize: 12 }}>
          {t('cooking.perServingOf', 'Per serving ({{count}} servings total)', { count: servings })}
        </Text>
      ) : null}

      <View className="flex-row items-baseline justify-between">
        <Text className="text-ink" style={{ fontFamily: FONT.display, fontSize: 19 }}>
          {t('cooking.calories', 'Calories')}
        </Text>
        <Text className="text-ink" style={{ fontFamily: FONT.display, fontSize: 32, letterSpacing: -0.6 }}>
          {nutrition.caloriesPerServing}
        </Text>
      </View>
      <View className="bg-divider" style={{ height: 1 }} />

      <NutritionRow
        label={t('cooking.totalFat', 'Total fat')}
        value={nutrition.fat}
        unit="g"
        dailyValue={showDailyValues ? dailyValues.fat : undefined}
        isBold
      />
      <NutritionRow
        label={t('cooking.totalCarbs', 'Total carbohydrates')}
        value={nutrition.carbs}
        unit="g"
        dailyValue={showDailyValues ? dailyValues.carbs : undefined}
        isBold
      />
      <NutritionRow
        label={t('cooking.fiber', 'Dietary fiber')}
        value={nutrition.fiber}
        unit="g"
        dailyValue={showDailyValues ? dailyValues.fiber : undefined}
        isIndented
      />
      <NutritionRow
        label={t('cooking.protein', 'Protein')}
        value={nutrition.protein}
        unit="g"
        dailyValue={showDailyValues ? dailyValues.protein : undefined}
        isBold
      />

      {showDailyValues ? (
        <Text className="text-subtle" style={{ fontFamily: FONT.sans, fontSize: 11 }}>
          {t('cooking.dailyValueNote', '* Percent daily values are based on a 2,000 calorie diet.')}
        </Text>
      ) : null}
    </View>
  );
};

interface NutritionRowProps {
  label: string;
  value: number;
  unit: string;
  dailyValue?: number;
  isBold?: boolean;
  isIndented?: boolean;
}

const NutritionRow: React.FC<NutritionRowProps> = ({
  label,
  value,
  unit,
  dailyValue,
  isBold = false,
  isIndented = false,
}) => {
  const font = isBold ? FONT.sansSemi : FONT.sans;
  return (
    <View className="flex-row items-center justify-between" style={{ minHeight: 32, marginLeft: isIndented ? 16 : 0 }}>
      <Text className="text-ink" style={{ fontFamily: font, fontSize: 14 }}>
        {label}
      </Text>
      <View className="flex-row items-center">
        <Text className="text-ink" style={{ fontFamily: font, fontSize: 14 }}>
          {value}
          {unit}
        </Text>
        {dailyValue !== undefined ? (
          <Text className="text-muted text-right" style={{ fontFamily: FONT.sans, fontSize: 12, width: 48 }}>
            {dailyValue}%
          </Text>
        ) : null}
      </View>
    </View>
  );
};

interface NutritionBadgeProps {
  label: string;
  value: number;
  unit: string;
}

const NutritionBadge: React.FC<NutritionBadgeProps> = ({ label, value, unit }) => (
  <View className="items-center">
    <Text className="text-ink" style={{ fontFamily: FONT.display, fontSize: 22, letterSpacing: -0.4 }}>
      {value}
      {unit}
    </Text>
    <Text className="text-muted" style={{ fontFamily: FONT.sans, fontSize: 12 }}>
      {label}
    </Text>
  </View>
);

// Mini nutrition display for cards
interface MiniNutritionProps {
  nutrition: NutritionInfo;
}

export const MiniNutrition: React.FC<MiniNutritionProps> = ({ nutrition }) => (
  <Text className="text-muted" style={{ fontFamily: FONT.sans, fontSize: 12 }}>
    {formatNutrition(nutrition)}
  </Text>
);

// Calorie summary for meal planning
interface CalorieSummaryProps {
  items: Array<{
    name: string;
    calories: number;
    servings: number;
  }>;
}

export const CalorieSummary: React.FC<CalorieSummaryProps> = ({ items }) => {
  const { t } = useTranslation();
  const total = items.reduce((sum, item) => sum + item.calories * item.servings, 0);

  return (
    <View className="bg-surface" style={{ borderRadius: 28, padding: 18 }}>
      <Text className="text-ink" style={{ fontFamily: FONT.display, fontSize: 19, marginBottom: 8 }}>
        {t('cooking.calorieSummary', 'Calorie summary')}
      </Text>

      {items.map((item, index) => (
        <View
          key={index}
          className="flex-row items-center justify-between border-divider"
          style={{ minHeight: 44, borderTopWidth: index > 0 ? 1 : 0 }}
        >
          <Text className="text-ink" style={{ fontFamily: FONT.sans, fontSize: 14 }}>
            {item.name}
          </Text>
          <Text className="text-muted" style={{ fontFamily: FONT.sans, fontSize: 13 }}>
            {item.servings > 1 ? `${item.servings} x ` : ''}
            {item.calories} {t('cooking.cal', 'cal')}
          </Text>
        </View>
      ))}

      <View className="flex-row items-center justify-between" style={{ paddingTop: 12 }}>
        <Text className="text-ink" style={{ fontFamily: FONT.display, fontSize: 17 }}>
          {t('cooking.total', 'Total')}
        </Text>
        <Text className="text-accent-text" style={{ fontFamily: FONT.display, fontSize: 19 }}>
          {total} {t('cooking.cal', 'cal')}
        </Text>
      </View>
    </View>
  );
};
