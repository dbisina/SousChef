import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useForm, Controller } from 'react-hook-form';
import { PantryCategory, PantryItemFormData } from '@/types';
import { Button, Input } from '@/components/ui';
import { COMMON_PANTRY_ITEMS } from '@/stores/pantryStore';

interface AddPantryItemProps {
  visible: boolean;
  onClose: () => void;
  onAdd: (item: PantryItemFormData) => Promise<void>;
}

export const AddPantryItemModal: React.FC<AddPantryItemProps> = ({
  visible,
  onClose,
  onAdd,
}) => {
  const [isQuickAdd, setIsQuickAdd] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PantryItemFormData>({
    defaultValues: {
      name: '',
      amount: 1,
      unit: 'piece',
      category: 'other',
    },
  });

  const handleQuickAdd = async (
    name: string,
    category: PantryCategory,
    unit: string
  ) => {
    setIsSubmitting(true);
    try {
      await onAdd({ name, amount: 1, unit, category });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCustomAdd = async (data: PantryItemFormData) => {
    setIsSubmitting(true);
    try {
      await onAdd(data);
      reset();
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredItems = COMMON_PANTRY_ITEMS.filter((item) =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-white">
        {/* Header */}
        <View className="flex-row items-center justify-between px-4 py-4 border-b border-neutral-100">
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color="#404040" />
          </TouchableOpacity>
          <Text className="text-lg font-bold text-neutral-900">
            Add to Pantry
          </Text>
          <View className="w-6" />
        </View>

        {/* Toggle */}
        <View className="flex-row p-4">
          <TouchableOpacity
            onPress={() => setIsQuickAdd(true)}
            className={`flex-1 py-2 rounded-l-lg ${
              isQuickAdd ? 'bg-primary-500' : 'bg-neutral-100'
            }`}
          >
            <Text
              className={`text-center font-medium ${
                isQuickAdd ? 'text-white' : 'text-neutral-600'
              }`}
            >
              Quick Add
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setIsQuickAdd(false)}
            className={`flex-1 py-2 rounded-r-lg ${
              !isQuickAdd ? 'bg-primary-500' : 'bg-neutral-100'
            }`}
          >
            <Text
              className={`text-center font-medium ${
                !isQuickAdd ? 'text-white' : 'text-neutral-600'
              }`}
            >
              Custom
            </Text>
          </TouchableOpacity>
        </View>

        {isQuickAdd ? (
          <>
            {/* Search */}
            <View className="px-4 mb-4">
              <View className="flex-row items-center bg-neutral-100 rounded-xl px-4 py-3">
                <Ionicons name="search" size={20} color="#737373" />
                <TextInput
                  placeholder="Search ingredients..."
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  className="flex-1 ml-2 text-base text-neutral-900"
                  placeholderTextColor="#A3A3A3"
                />
              </View>
            </View>

            {/* Common items */}
            <ScrollView className="flex-1 px-4">
              {CATEGORY_ORDER.map((category) => {
                const items = filteredItems.filter(
                  (item) => item.category === category
                );
                if (items.length === 0) return null;

                return (
                  <View key={category} className="mb-4">
                    <Text className="text-sm font-semibold text-neutral-500 uppercase mb-2">
                      {category}
                    </Text>
                    <View className="flex-row flex-wrap">
                      {items.map((item) => (
                        <TouchableOpacity
                          key={item.name}
                          onPress={() =>
                            handleQuickAdd(item.name, item.category, item.unit)
                          }
                          disabled={isSubmitting}
                          className="bg-neutral-100 px-3 py-2 rounded-full mr-2 mb-2"
                        >
                          <Text className="text-neutral-700">{item.name}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          </>
        ) : (
          <ScrollView className="flex-1 p-4">
            {/* Custom form */}
            <Controller
              control={control}
              name="name"
              rules={{ required: 'Name is required' }}
              render={({ field: { onChange, value } }) => (
                <Input
                  label="Ingredient Name"
                  placeholder="e.g., Olive Oil"
                  value={value}
                  onChangeText={onChange}
                  error={errors.name?.message}
                />
              )}
            />

            <View className="flex-row">
              <View className="flex-1 mr-2">
                <Controller
                  control={control}
                  name="amount"
                  rules={{ required: true, min: 0 }}
                  render={({ field: { onChange, value } }) => (
                    <Input
                      label="Amount"
                      placeholder="1"
                      keyboardType="decimal-pad"
                      value={value?.toString()}
                      onChangeText={(text) => onChange(parseFloat(text) || 0)}
                    />
                  )}
                />
              </View>
              <View className="flex-1 ml-2">
                <Controller
                  control={control}
                  name="unit"
                  render={({ field: { onChange, value } }) => (
                    <View className="mb-4">
                      <Text className="mb-2 text-sm font-medium text-neutral-700">
                        Unit
                      </Text>
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                      >
                        {UNITS.map((unit) => (
                          <TouchableOpacity
                            key={unit}
                            onPress={() => onChange(unit)}
                            className={`px-3 py-2 rounded-lg mr-2 ${
                              value === unit
                                ? 'bg-primary-500'
                                : 'bg-neutral-100'
                            }`}
                          >
                            <Text
                              className={
                                value === unit
                                  ? 'text-white'
                                  : 'text-neutral-700'
                              }
                            >
                              {unit}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  )}
                />
              </View>
            </View>

            <Controller
              control={control}
              name="category"
              render={({ field: { onChange, value } }) => (
                <View className="mb-4">
                  <Text className="mb-2 text-sm font-medium text-neutral-700">
                    Category
                  </Text>
                  <View className="flex-row flex-wrap">
                    {CATEGORY_ORDER.map((cat) => (
                      <TouchableOpacity
                        key={cat}
                        onPress={() => onChange(cat)}
                        className={`px-3 py-2 rounded-lg mr-2 mb-2 ${
                          value === cat ? 'bg-primary-500' : 'bg-neutral-100'
                        }`}
                      >
                        <Text
                          className={`capitalize ${
                            value === cat ? 'text-white' : 'text-neutral-700'
                          }`}
                        >
                          {cat}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}
            />

            <Button
              title="Add to Pantry"
              onPress={handleSubmit(handleCustomAdd)}
              isLoading={isSubmitting}
              fullWidth
            />
          </ScrollView>
        )}
      </View>
    </Modal>
  );
};

const CATEGORY_ORDER: PantryCategory[] = [
  'produce',
  'dairy',
  'meat',
  'seafood',
  'grains',
  'spices',
  'condiments',
  'canned',
  'frozen',
  'beverages',
  'other',
];

const UNITS = [
  'piece',
  'cup',
  'tbsp',
  'tsp',
  'oz',
  'lb',
  'g',
  'kg',
  'ml',
  'l',
  'can',
  'bottle',
  'bag',
  'bunch',
  'head',
  'clove',
  'slice',
];
