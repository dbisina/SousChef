import React, { useState } from 'react';
import { View, Text, ScrollView, Modal, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import { RecipeFilters as FiltersType, RecipeCategory, Cuisine, Difficulty } from '@/types';
import { Chip, LinkText, ToneScope, UButton, UIconButton, FONT, useTone } from '@/components/ui';

interface RecipeFiltersProps {
  filters: FiltersType;
  onApplyFilters: (filters: FiltersType) => void;
  onClearFilters: () => void;
}

export const RecipeFilters: React.FC<RecipeFiltersProps> = ({
  filters,
  onApplyFilters,
  onClearFilters,
}) => {
  const { t } = useTranslation();
  const tone = useTone();
  const [isModalVisible, setModalVisible] = useState(false);
  const [tempFilters, setTempFilters] = useState<FiltersType>(filters);

  const activeFilterCount = Object.values(filters).filter(
    (v) => v !== undefined && v !== ''
  ).length;

  const handleApply = () => {
    onApplyFilters(tempFilters);
    setModalVisible(false);
  };

  const handleClear = () => {
    setTempFilters({});
    onClearFilters();
    setModalVisible(false);
  };

  const section = <T,>(
    title: string,
    options: Array<{ label: string; value: T }>,
    key: keyof FiltersType
  ) => (
    <FilterSection title={title}>
      <View className="flex-row flex-wrap" style={{ gap: 8 }}>
        {options.map((o) => {
          const active = tempFilters[key] === o.value;
          return (
            <Chip
              key={String(o.value)}
              label={o.label}
              on={active}
              onPress={() => setTempFilters({ ...tempFilters, [key]: active ? undefined : o.value })}
            />
          );
        })}
      </View>
    </FilterSection>
  );

  return (
    <>
      <View style={{ paddingVertical: 8 }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, alignItems: 'center', gap: 8 }}
        >
          <Chip
            label={
              activeFilterCount > 0
                ? t('cooking.filtersCount', 'Filters ({{count}})', { count: activeFilterCount })
                : t('cooking.filters', 'Filters')
            }
            icon="filters"
            on={activeFilterCount > 0}
            onPress={() => setModalVisible(true)}
          />

          <Chip
            label={t('cooking.easy', 'Easy')}
            on={filters.difficulty === 'easy'}
            onPress={() =>
              onApplyFilters({ ...filters, difficulty: filters.difficulty === 'easy' ? undefined : 'easy' })
            }
          />
          <Chip
            label={t('cooking.under30', 'Under 30m')}
            icon="clock"
            on={filters.maxPrepTime === 30}
            onPress={() =>
              onApplyFilters({ ...filters, maxPrepTime: filters.maxPrepTime === 30 ? undefined : 30 })
            }
          />
          <Chip
            label={t('cooking.lowCal', 'Low Cal')}
            icon="flame"
            on={filters.maxCalories === 400}
            onPress={() =>
              onApplyFilters({ ...filters, maxCalories: filters.maxCalories === 400 ? undefined : 400 })
            }
          />
          <Chip
            label={t('cooking.chefPicks', 'Chef Picks')}
            icon="award"
            on={filters.isOfficial === true}
            onPress={() =>
              onApplyFilters({ ...filters, isOfficial: filters.isOfficial ? undefined : true })
            }
          />
        </ScrollView>
      </View>

      <Modal
        visible={isModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setModalVisible(false)}
      >
        <ToneScope tone={tone}>
          <View className="flex-row items-center justify-between" style={{ paddingHorizontal: 20, paddingVertical: 18 }}>
            <UIconButton icon="close" label={t('cooking.cancel', 'Cancel')} onPress={() => setModalVisible(false)} />
            <Text className="text-ink" style={{ fontFamily: FONT.display, fontSize: 17 }}>
              {t('cooking.filters', 'Filters')}
            </Text>
            <Pressable onPress={handleClear} accessibilityRole="button" style={{ minWidth: 46, minHeight: 44, justifyContent: 'center', alignItems: 'flex-end' }}>
                <LinkText accent>{t('cooking.clear', 'Clear')}</LinkText>
              </Pressable>
          </View>

          <ScrollView
            className="flex-1"
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24, gap: 22 }}
            showsVerticalScrollIndicator={false}
          >
            {section(t('cooking.category', 'Category'), CATEGORIES, 'category')}
            {section(t('cooking.cuisine', 'Cuisine'), CUISINES, 'cuisine')}
            {section(t('cooking.difficulty', 'Difficulty'), DIFFICULTIES, 'difficulty')}
            {section(t('cooking.maxCalories', 'Max Calories per Serving'), CALORIE_OPTIONS, 'maxCalories')}
            {section(t('cooking.maxPrep', 'Max Prep Time'), TIME_OPTIONS, 'maxPrepTime')}
          </ScrollView>

          <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 34 }}>
            <UButton label={t('cooking.applyFilters', 'Apply Filters')} variant="accent" onPress={handleApply} />
          </View>
        </ToneScope>
      </Modal>
    </>
  );
};

interface FilterSectionProps {
  title: string;
  children: React.ReactNode;
}

const FilterSection: React.FC<FilterSectionProps> = ({ title, children }) => (
  <View style={{ gap: 12 }}>
    <Text className="text-ink" style={{ fontFamily: FONT.display, fontSize: 15 }}>
      {title}
    </Text>
    {children}
  </View>
);


// Filter options
const CATEGORIES: Array<{ label: string; value: RecipeCategory }> = [
  { label: 'Breakfast', value: 'breakfast' },
  { label: 'Lunch', value: 'lunch' },
  { label: 'Dinner', value: 'dinner' },
  { label: 'Dessert', value: 'dessert' },
  { label: 'Snack', value: 'snack' },
  { label: 'Appetizer', value: 'appetizer' },
  { label: 'Beverage', value: 'beverage' },
  { label: 'Side', value: 'side' },
];

const CUISINES: Array<{ label: string; value: Cuisine }> = [
  { label: 'American', value: 'american' },
  { label: 'Italian', value: 'italian' },
  { label: 'Mexican', value: 'mexican' },
  { label: 'Chinese', value: 'chinese' },
  { label: 'Japanese', value: 'japanese' },
  { label: 'Indian', value: 'indian' },
  { label: 'Thai', value: 'thai' },
  { label: 'French', value: 'french' },
  { label: 'Mediterranean', value: 'mediterranean' },
  { label: 'Korean', value: 'korean' },
  { label: 'Vietnamese', value: 'vietnamese' },
];

const DIFFICULTIES: Array<{ label: string; value: Difficulty }> = [
  { label: 'Easy', value: 'easy' },
  { label: 'Medium', value: 'medium' },
  { label: 'Hard', value: 'hard' },
];

const CALORIE_OPTIONS = [
  { label: 'Under 300', value: 300 },
  { label: 'Under 400', value: 400 },
  { label: 'Under 500', value: 500 },
  { label: 'Under 600', value: 600 },
];

const TIME_OPTIONS = [
  { label: '15 min', value: 15 },
  { label: '30 min', value: 30 },
  { label: '45 min', value: 45 },
  { label: '60 min', value: 60 },
];
