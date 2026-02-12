import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Modal,
  Alert,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useForm, Controller } from 'react-hook-form';
import { PantryCategory, PantryItem } from '@/types';
import { Button, Input } from '@/components/ui';
import { useThemeColors } from '@/stores/themeStore';
import { showSuccessToast, showErrorToast, showInfoToast } from '@/stores/toastStore';

interface EditPantryItemFormData {
  name: string;
  amount: number;
  unit: string;
  category: PantryCategory;
}

interface EditPantryItemProps {
  visible: boolean;
  item: PantryItem | null;
  onClose: () => void;
  onSave: (itemId: string, data: Partial<PantryItem>) => Promise<void>;
  onDelete?: (itemId: string) => void;
}

export const EditPantryItemModal: React.FC<EditPantryItemProps> = ({
  visible,
  item,
  onClose,
  onSave,
  onDelete,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showUnitDropdown, setShowUnitDropdown] = useState(false);
  const [showCustomUnitInput, setShowCustomUnitInput] = useState(false);
  const [customUnitValue, setCustomUnitValue] = useState('');
  const colors = useThemeColors();

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<EditPantryItemFormData>({
    defaultValues: {
      name: '',
      amount: 1,
      unit: 'piece',
      category: 'other',
    },
  });

  // Reset form when item changes
  useEffect(() => {
    if (item) {
      const isCustomUnit = !UNITS.includes(item.unit);
      reset({
        name: item.name,
        amount: item.amount,
        unit: item.unit,
        category: item.category,
      });
      setShowCustomUnitInput(isCustomUnit);
      setCustomUnitValue(isCustomUnit ? item.unit : '');
    }
  }, [item, reset]);

  const handleSave = async (data: EditPantryItemFormData) => {
    if (!item) return;
    if (!data.name?.trim()) {
      showInfoToast('Wait! Don\'t forget to name your ingredient.', 'Missing Name');
      return;
    }
    setIsSubmitting(true);
    try {
      await onSave(item.id, {
        name: data.name.trim(),
        amount: data.amount || 1,
        unit: data.unit,
        category: data.category,
      });
      onClose();
    } catch (error) {
      showErrorToast('We couldn\'t save your changes. Let\'s try that again?', 'Update Problem');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = () => {
    if (!item || !onDelete) return;
    Alert.alert(
      'Remove Ingredient?',
      `Are you sure you want to remove ${item.name}? You can always add it back later!`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            onDelete(item.id);
            onClose();
          },
        },
      ]
    );
  };

  if (!item) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-white dark:bg-neutral-800">
        {/* Header */}
        <View className="flex-row items-center justify-between px-4 py-4 border-b border-neutral-100 dark:border-neutral-700">
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color={colors.icon} />
          </TouchableOpacity>
          <Text className="text-lg font-bold text-neutral-900 dark:text-neutral-50">
            Edit Pantry Item
          </Text>
          {onDelete ? (
            <TouchableOpacity onPress={handleDelete}>
              <Ionicons name="trash-outline" size={22} color="#EF4444" />
            </TouchableOpacity>
          ) : (
            <View className="w-6" />
          )}
        </View>

        <ScrollView className="flex-1 p-4">
          {/* Name */}
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

          {/* Amount & Unit */}
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
                    <Text className="mb-2 text-sm font-medium text-neutral-700 dark:text-neutral-300">
                      Unit
                    </Text>
                    <View className="relative z-50">
                      <TouchableOpacity
                        onPress={() => setShowUnitDropdown(!showUnitDropdown)}
                        className={`flex-row items-center justify-between px-4 py-3 bg-neutral-100 dark:bg-neutral-700 rounded-xl border ${
                          showUnitDropdown ? '' : 'border-neutral-200 dark:border-neutral-700'
                        }`}
                        style={showUnitDropdown ? { borderColor: colors.accent } : {}}
                      >
                        <Text className="text-neutral-900 dark:text-neutral-50 text-base">
                          {value || 'Select Unit'}
                        </Text>
                        <Ionicons
                          name={showUnitDropdown ? 'chevron-up' : 'chevron-down'}
                          size={20}
                          color={colors.textMuted}
                        />
                      </TouchableOpacity>

                      {showUnitDropdown && (
                        <View className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 shadow-lg max-h-48 z-50">
                          <ScrollView nestedScrollEnabled className="flex-1">
                            {UNITS.map((unit) => (
                              <TouchableOpacity
                                key={unit}
                                onPress={() => {
                                  onChange(unit);
                                  setShowUnitDropdown(false);
                                  setShowCustomUnitInput(false);
                                  setCustomUnitValue('');
                                }}
                                className={`px-4 py-3 border-b border-neutral-100 dark:border-neutral-700 ${
                                  value === unit ? '' : ''
                                }`}
                                style={value === unit ? { backgroundColor: colors.accent + '15' } : {}}
                              >
                                <Text
                                  className={`${
                                    value === unit
                                      ? 'font-semibold'
                                      : 'text-neutral-700 dark:text-neutral-300'
                                  }`}
                                  style={value === unit ? { color: colors.accent } : {}}
                                >
                                  {unit}
                                </Text>
                              </TouchableOpacity>
                            ))}
                            {/* Other custom unit option */}
                            <TouchableOpacity
                              onPress={() => {
                                setShowUnitDropdown(false);
                                setShowCustomUnitInput(true);
                                setCustomUnitValue('');
                              }}
                              style={{
                                paddingHorizontal: 16,
                                paddingVertical: 12,
                                flexDirection: 'row',
                                alignItems: 'center',
                              }}
                            >
                              <Ionicons
                                name="create-outline"
                                size={16}
                                color={colors.accent}
                                style={{ marginRight: 8 }}
                              />
                              <Text style={{ color: colors.accent, fontWeight: '600' }}>
                                Other (custom)
                              </Text>
                            </TouchableOpacity>
                          </ScrollView>
                        </View>
                      )}
                    </View>

                    {/* Custom unit input */}
                    {showCustomUnitInput && (
                      <View style={{ marginTop: 10 }}>
                        <TextInput
                          placeholder="Enter custom unit..."
                          value={customUnitValue}
                          onChangeText={(text) => {
                            setCustomUnitValue(text);
                            onChange(text);
                          }}
                          autoFocus
                          style={{
                            paddingHorizontal: 16,
                            paddingVertical: 12,
                            backgroundColor: colors.surfaceSecondary || '#F5F5F5',
                            borderRadius: 12,
                            borderWidth: 1,
                            borderColor: colors.accent,
                            color: colors.text || '#171717',
                            fontSize: 16,
                          }}
                          placeholderTextColor={colors.textMuted}
                        />
                      </View>
                    )}
                  </View>
                )}
              />
            </View>
          </View>

          {/* Category */}
          <Controller
            control={control}
            name="category"
            render={({ field: { onChange, value } }) => (
              <View className="mb-4">
                <Text className="mb-2 text-sm font-medium text-neutral-700 dark:text-neutral-300">
                  Category
                </Text>
                <View className="flex-row flex-wrap">
                  {CATEGORY_ORDER.map((cat) => (
                    <TouchableOpacity
                      key={cat}
                      onPress={() => onChange(cat)}
                      className={`px-3 py-2 rounded-lg mr-2 mb-2 ${
                        value === cat ? '' : 'bg-neutral-100 dark:bg-neutral-700'
                      }`}
                      style={value === cat ? { backgroundColor: colors.accent } : {}}
                    >
                      <Text
                        className={`capitalize ${
                          value === cat ? 'text-white' : 'text-neutral-700 dark:text-neutral-300'
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
            title="Save Changes"
            onPress={handleSubmit(handleSave)}
            isLoading={isSubmitting}
            fullWidth
          />
        </ScrollView>
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
