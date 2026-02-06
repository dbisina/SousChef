import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Modal, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RecipeFilters as FiltersType, RecipeCategory, Cuisine, Difficulty } from '@/types';
import { Button } from '@/components/ui';

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

  return (
    <>
      <View className="py-2">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, alignItems: 'center' }}
        >
          {/* Main Filter Button */}
          <TouchableOpacity
            onPress={() => setModalVisible(true)}
            style={styles.filterBtn}
            className={`flex-row items-center px-4 py-2.5 rounded-full mr-3 border ${
              activeFilterCount > 0 
                ? 'bg-primary-50 border-primary-200' 
                : 'bg-white border-neutral-200'
            }`}
          >
            <View className={`rounded-full p-1 mr-2 ${activeFilterCount > 0 ? 'bg-primary-500' : 'bg-neutral-100'}`}>
               <Ionicons
                name="options"
                size={14}
                color={activeFilterCount > 0 ? 'white' : '#525252'}
              />
            </View>
           
            <Text
              className={`font-semibold ${activeFilterCount > 0 ? 'text-primary-700' : 'text-neutral-700'}`}
            >
              Filters
            </Text>
            {activeFilterCount > 0 && (
              <View className="ml-2 bg-primary-500 rounded-full w-5 h-5 items-center justify-center">
                 <Text className="text-white text-xs font-bold">{activeFilterCount}</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Vertical Divider */}
          <View className="h-6 w-[1px] bg-neutral-200 mr-3" />

          {/* Quick Filter Chips */}
          <FilterChip
            label="Easy"
            icon="happy-outline"
            isActive={filters.difficulty === 'easy'}
            onPress={() =>
              onApplyFilters({
                ...filters,
                difficulty: filters.difficulty === 'easy' ? undefined : 'easy',
              })
            }
            className="mr-2"
          />
          <FilterChip
            label="Under 30m"
            icon="time-outline"
            isActive={filters.maxPrepTime === 30}
            onPress={() =>
              onApplyFilters({
                ...filters,
                maxPrepTime: filters.maxPrepTime === 30 ? undefined : 30,
              })
            }
            className="mr-2"
          />
          <FilterChip
            label="Low Cal"
            icon="flame-outline"
            isActive={filters.maxCalories === 400}
            onPress={() =>
              onApplyFilters({
                ...filters,
                maxCalories: filters.maxCalories === 400 ? undefined : 400,
              })
            }
            className="mr-2"
          />
          <FilterChip
            label="Chef Picks"
            icon="ribbon-outline"
            isActive={filters.isOfficial === true}
            onPress={() =>
              onApplyFilters({
                ...filters,
                isOfficial: filters.isOfficial ? undefined : true,
              })
            }
            className="mr-2"
          />
        </ScrollView>
      </View>

      {/* Filter modal (unchanged implementation details, just re-rendering) */}
      <Modal
        visible={isModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setModalVisible(false)}
      >
        <View className="flex-1 bg-white">
          {/* Header */}
          <View className="flex-row items-center justify-between px-4 py-4 border-b border-neutral-100">
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Text className="text-primary-500 text-base">Cancel</Text>
            </TouchableOpacity>
            <Text className="text-lg font-bold text-neutral-900">Filters</Text>
            <TouchableOpacity onPress={handleClear}>
              <Text className="text-primary-500 text-base">Clear</Text>
            </TouchableOpacity>
          </View>

          <ScrollView className="flex-1 p-4">
            {/* Category */}
            <FilterSection title="Category">
              <View className="flex-row flex-wrap gap-2">
                {CATEGORIES.map((cat) => (
                  <FilterChip
                    key={cat.value}
                    label={cat.label}
                    isActive={tempFilters.category === cat.value}
                    onPress={() =>
                      setTempFilters({
                        ...tempFilters,
                        category:
                          tempFilters.category === cat.value
                            ? undefined
                            : cat.value,
                      })
                    }
                  />
                ))}
              </View>
            </FilterSection>

            {/* Cuisine */}
            <FilterSection title="Cuisine">
              <View className="flex-row flex-wrap gap-2">
                {CUISINES.map((cuisine) => (
                  <FilterChip
                    key={cuisine.value}
                    label={cuisine.label}
                    isActive={tempFilters.cuisine === cuisine.value}
                    onPress={() =>
                      setTempFilters({
                        ...tempFilters,
                        cuisine:
                          tempFilters.cuisine === cuisine.value
                            ? undefined
                            : cuisine.value,
                      })
                    }
                  />
                ))}
              </View>
            </FilterSection>

            {/* Difficulty */}
            <FilterSection title="Difficulty">
              <View className="flex-row flex-wrap gap-2">
                {DIFFICULTIES.map((diff) => (
                  <FilterChip
                    key={diff.value}
                    label={diff.label}
                    isActive={tempFilters.difficulty === diff.value}
                    onPress={() =>
                      setTempFilters({
                        ...tempFilters,
                        difficulty:
                          tempFilters.difficulty === diff.value
                            ? undefined
                            : diff.value,
                      })
                    }
                  />
                ))}
              </View>
            </FilterSection>

            {/* Max Calories */}
            <FilterSection title="Max Calories per Serving">
              <View className="flex-row flex-wrap gap-2">
                {CALORIE_OPTIONS.map((option) => (
                  <FilterChip
                    key={option.value}
                    label={option.label}
                    isActive={tempFilters.maxCalories === option.value}
                    onPress={() =>
                      setTempFilters({
                        ...tempFilters,
                        maxCalories:
                          tempFilters.maxCalories === option.value
                            ? undefined
                            : option.value,
                      })
                    }
                  />
                ))}
              </View>
            </FilterSection>

            {/* Max Prep Time */}
            <FilterSection title="Max Prep Time">
              <View className="flex-row flex-wrap gap-2">
                {TIME_OPTIONS.map((option) => (
                  <FilterChip
                    key={option.value}
                    label={option.label}
                    isActive={tempFilters.maxPrepTime === option.value}
                    onPress={() =>
                      setTempFilters({
                        ...tempFilters,
                        maxPrepTime:
                          tempFilters.maxPrepTime === option.value
                            ? undefined
                            : option.value,
                      })
                    }
                  />
                ))}
              </View>
            </FilterSection>
          </ScrollView>

          {/* Apply button */}
          <View className="p-4 border-t border-neutral-100">
            <Button title="Apply Filters" onPress={handleApply} fullWidth />
          </View>
        </View>
      </Modal>
    </>
  );
};

interface FilterChipProps {
  label: string;
  isActive: boolean;
  onPress: () => void;
  className?: string;
  icon?: keyof typeof Ionicons.glyphMap;
}

const FilterChip: React.FC<FilterChipProps> = ({ label, isActive, onPress, className = '', icon }) => {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={styles.chipShadow}
      className={`
        flex-row items-center px-3.5 py-2 rounded-full border
        ${isActive 
          ? 'bg-primary-500 border-primary-600' 
          : 'bg-white border-neutral-200'}
        ${className}
      `}
    >
      {icon && (
        <Ionicons 
          name={icon} 
          size={16} 
          color={isActive ? 'white' : '#737373'} 
          style={{ marginRight: 6 }}
        />
      )}
      <Text
        className={`font-medium text-sm ${isActive ? 'text-white' : 'text-neutral-700'}`}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
};

interface FilterSectionProps {
  title: string;
  children: React.ReactNode;
}

const FilterSection: React.FC<FilterSectionProps> = ({ title, children }) => {
  return (
    <View className="mb-6">
      <Text className="text-base font-semibold text-neutral-900 mb-3">
        {title}
      </Text>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  filterBtn: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  chipShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
});

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
