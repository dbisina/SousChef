import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useForm, Controller } from 'react-hook-form';
import { PantryCategory, PantryItemFormData } from '@/types';
import { Button, Input } from '@/components/ui';
import { COMMON_PANTRY_ITEMS } from '@/stores/pantryStore';
import { useThemeColors } from '@/stores/themeStore';

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
  const colors = useThemeColors();
  const [isQuickAdd, setIsQuickAdd] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showUnitDropdown, setShowUnitDropdown] = useState(false);
  const [recentlyAdded, setRecentlyAdded] = useState<string | null>(null);
  const [showCustomUnitInput, setShowCustomUnitInput] = useState(false);
  const [customUnitValue, setCustomUnitValue] = useState('');

  const {
    control,
    handleSubmit,
    reset,
    setValue,
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
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onAdd({ name, amount: 1, unit, category });
      setRecentlyAdded(name);
      setTimeout(() => setRecentlyAdded(null), 1500);
    } catch (error) {
      console.error('Quick add error:', error);
      Alert.alert('Error', `Failed to add ${name}. Please try again.`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCustomAdd = async (data: PantryItemFormData) => {
    if (!data.name?.trim()) {
      Alert.alert('Error', 'Please enter an ingredient name.');
      return;
    }
    const finalAmount = data.amount && data.amount > 0 ? data.amount : 1;
    const finalUnit = data.unit?.trim() || 'piece';
    setIsSubmitting(true);
    try {
      await onAdd({
        name: data.name.trim(),
        amount: finalAmount,
        unit: finalUnit,
        category: data.category || 'other',
      });
      Alert.alert('Added!', `${data.name} has been added to your pantry.`);
      reset({ name: '', amount: 1, unit: 'piece', category: 'other' });
      setShowCustomUnitInput(false);
      setCustomUnitValue('');
    } catch (error) {
      console.error('Custom add error:', error);
      Alert.alert('Error', `Failed to add ${data.name}. Please try again.`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    reset({ name: '', amount: 1, unit: 'piece', category: 'other' });
    setSearchQuery('');
    setShowCustomUnitInput(false);
    setCustomUnitValue('');
    setShowUnitDropdown(false);
    onClose();
  };

  const filteredItems = COMMON_PANTRY_ITEMS.filter((item) =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={{ flex: 1, backgroundColor: colors.background }}>
          {/* Header */}
          <View
            className="flex-row items-center justify-between px-4 py-4"
            style={{ borderBottomWidth: 1, borderBottomColor: colors.border }}
          >
            <TouchableOpacity onPress={handleClose}>
              <Ionicons name="close" size={24} color={colors.icon} />
            </TouchableOpacity>
            <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text }}>
              Add to Pantry
            </Text>
            <View style={{ width: 24 }} />
          </View>

          {/* Toggle */}
          <View className="flex-row p-4">
            <TouchableOpacity
              onPress={() => setIsQuickAdd(true)}
              className="flex-1 py-2.5 rounded-l-xl"
              style={{
                backgroundColor: isQuickAdd ? colors.accent : colors.surfaceSecondary,
                borderWidth: isQuickAdd ? 0 : 1,
                borderColor: colors.border,
              }}
            >
              <Text
                style={{
                  textAlign: 'center',
                  fontWeight: '600',
                  color: isQuickAdd ? '#FFFFFF' : colors.textMuted,
                }}
              >
                Quick Add
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setIsQuickAdd(false)}
              className="flex-1 py-2.5 rounded-r-xl"
              style={{
                backgroundColor: !isQuickAdd ? colors.accent : colors.surfaceSecondary,
                borderWidth: !isQuickAdd ? 0 : 1,
                borderColor: colors.border,
              }}
            >
              <Text
                style={{
                  textAlign: 'center',
                  fontWeight: '600',
                  color: !isQuickAdd ? '#FFFFFF' : colors.textMuted,
                }}
              >
                Custom
              </Text>
            </TouchableOpacity>
          </View>

          {isQuickAdd ? (
            <>
              {/* Search */}
              <View className="px-4 mb-4">
                <View
                  className="flex-row items-center rounded-xl px-4 py-3"
                  style={{ backgroundColor: colors.surfaceSecondary }}
                >
                  <Ionicons name="search" size={20} color={colors.textMuted} />
                  <TextInput
                    placeholder="Search ingredients..."
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    className="flex-1 ml-2 text-base"
                    style={{ color: colors.text }}
                    placeholderTextColor={colors.textMuted}
                  />
                  {searchQuery.length > 0 && (
                    <TouchableOpacity onPress={() => setSearchQuery('')}>
                      <Ionicons name="close-circle" size={20} color={colors.textMuted} />
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              {/* Common items */}
              <ScrollView className="flex-1 px-4" showsVerticalScrollIndicator={false}>
                {CATEGORY_ORDER.map((category) => {
                  const items = filteredItems.filter(
                    (item) => item.category === category
                  );
                  if (items.length === 0) return null;

                  return (
                    <View key={category} className="mb-5">
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: '700',
                          color: colors.textMuted,
                          textTransform: 'uppercase',
                          letterSpacing: 0.5,
                          marginBottom: 10,
                        }}
                      >
                        {CATEGORY_EMOJI[category]} {category}
                      </Text>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                        {items.map((item) => {
                          const isAdded = recentlyAdded === item.name;
                          return (
                            <TouchableOpacity
                              key={item.name}
                              onPress={() =>
                                handleQuickAdd(item.name, item.category, item.unit)
                              }
                              disabled={isSubmitting}
                              activeOpacity={0.7}
                              style={{
                                paddingHorizontal: 14,
                                paddingVertical: 9,
                                borderRadius: 8,
                                backgroundColor: isAdded
                                  ? '#DCFCE7'
                                  : colors.surfaceSecondary,
                                borderWidth: isAdded ? 1 : 0,
                                borderColor: isAdded ? '#86EFAC' : 'transparent',
                              }}
                            >
                              <Text
                                style={{
                                  color: isAdded ? '#16A34A' : colors.text,
                                  fontWeight: isAdded ? '600' : '400',
                                  fontSize: 14,
                                }}
                              >
                                {isAdded ? '✓ ' : ''}{item.name}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>
                  );
                })}
                <View style={{ height: 40 }} />
              </ScrollView>
            </>
          ) : (
            <ScrollView className="flex-1 p-4" showsVerticalScrollIndicator={false}>
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
                    rules={{ required: true, min: 0.1 }}
                    render={({ field: { onChange, value } }) => (
                      <Input
                        label="Amount"
                        placeholder="1"
                        keyboardType="decimal-pad"
                        value={value ? value.toString() : ''}
                        onChangeText={(text) => {
                          const num = parseFloat(text);
                          onChange(isNaN(num) ? '' : num);
                        }}
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
                        <Text
                          style={{
                            marginBottom: 8,
                            fontSize: 14,
                            fontWeight: '500',
                            color: colors.textSecondary,
                          }}
                        >
                          Unit
                        </Text>
                        <View style={{ position: 'relative', zIndex: 50 }}>
                          <TouchableOpacity
                            onPress={() => {
                              setShowUnitDropdown(!showUnitDropdown);
                              setShowCustomUnitInput(false);
                            }}
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              paddingHorizontal: 16,
                              paddingVertical: 12,
                              backgroundColor: colors.surfaceSecondary,
                              borderRadius: 12,
                              borderWidth: 1,
                              borderColor: showUnitDropdown ? colors.accent : colors.border,
                            }}
                          >
                            <Text style={{ color: colors.text, fontSize: 16 }}>
                              {showCustomUnitInput ? customUnitValue || 'Custom...' : value || 'Select Unit'}
                            </Text>
                            <Ionicons
                              name={showUnitDropdown ? 'chevron-up' : 'chevron-down'}
                              size={20}
                              color={colors.textMuted}
                            />
                          </TouchableOpacity>

                          {showUnitDropdown && (
                            <View
                              style={{
                                position: 'absolute',
                                top: '100%',
                                left: 0,
                                right: 0,
                                marginTop: 8,
                                backgroundColor: colors.surface,
                                borderRadius: 12,
                                borderWidth: 1,
                                borderColor: colors.border,
                                maxHeight: 200,
                                zIndex: 50,
                                shadowColor: '#000',
                                shadowOffset: { width: 0, height: 4 },
                                shadowOpacity: 0.15,
                                shadowRadius: 8,
                                elevation: 8,
                              }}
                            >
                              <ScrollView nestedScrollEnabled style={{ flex: 1 }}>
                                {UNITS.map((unit) => (
                                  <TouchableOpacity
                                    key={unit}
                                    onPress={() => {
                                      onChange(unit);
                                      setShowUnitDropdown(false);
                                      setShowCustomUnitInput(false);
                                      setCustomUnitValue('');
                                    }}
                                    style={{
                                      paddingHorizontal: 16,
                                      paddingVertical: 12,
                                      borderBottomWidth: 1,
                                      borderBottomColor: colors.border,
                                      backgroundColor:
                                          value === unit ? colors.accent + '15' : 'transparent',
                                    }}
                                  >
                                    <Text
                                      style={{
                                        color: value === unit ? colors.accent : colors.text,
                                        fontWeight: value === unit ? '600' : '400',
                                      }}
                                    >
                                      {unit}
                                    </Text>
                                  </TouchableOpacity>
                                ))}
                                {/* Other option */}
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
                                backgroundColor: colors.surfaceSecondary,
                                borderRadius: 12,
                                borderWidth: 1,
                                borderColor: colors.accent,
                                color: colors.text,
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

              <Controller
                control={control}
                name="category"
                render={({ field: { onChange, value } }) => (
                  <View className="mb-4">
                    <Text
                      style={{
                        marginBottom: 8,
                        fontSize: 14,
                        fontWeight: '500',
                        color: colors.textSecondary,
                      }}
                    >
                      Category
                    </Text>
                    <View className="flex-row flex-wrap">
                      {CATEGORY_ORDER.map((cat) => (
                        <TouchableOpacity
                          key={cat}
                          onPress={() => onChange(cat)}
                          style={{
                            paddingHorizontal: 12,
                            paddingVertical: 8,
                            borderRadius: 8,
                            marginRight: 8,
                            marginBottom: 8,
                            backgroundColor: value === cat ? colors.accent : colors.surfaceSecondary,
                            borderWidth: value === cat ? 0 : 1,
                            borderColor: colors.border,
                          }}
                        >
                          <Text
                            style={{
                              textTransform: 'capitalize',
                              color: value === cat ? '#FFFFFF' : colors.text,
                              fontWeight: value === cat ? '600' : '400',
                            }}
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
              <View style={{ height: 40 }} />
            </ScrollView>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const CATEGORY_EMOJI: Record<string, string> = {
  produce: '🥬',
  dairy: '🥛',
  meat: '🥩',
  seafood: '🐟',
  grains: '🌾',
  spices: '🧂',
  condiments: '🫙',
  canned: '🥫',
  frozen: '🧊',
  beverages: '🥤',
  other: '📦',
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
