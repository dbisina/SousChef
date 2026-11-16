import React, { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Chip, Field } from '@/components/ui';
import { PantryCategory } from '@/types';

export const CATEGORY_ORDER: PantryCategory[] = [
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

export const UNITS = [
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

/** Localised, capitalised category name. */
export function useCategoryLabel() {
  const { t } = useTranslation();
  return (cat: string) => t(`pantryUi.cat.${cat}`, cat.charAt(0).toUpperCase() + cat.slice(1));
}

interface CategoryChipsProps {
  value: PantryCategory;
  onChange: (c: PantryCategory) => void;
}

/** Wrapping single-select category chips (form use). */
export function CategoryChips({ value, onChange }: CategoryChipsProps) {
  const label = useCategoryLabel();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {CATEGORY_ORDER.map((cat) => (
        <Chip key={cat} label={label(cat)} outlined={value === cat} onPress={() => onChange(cat)} />
      ))}
    </View>
  );
}

interface UnitPickerProps {
  value: string;
  onChange: (unit: string) => void;
  /** Allow clearing the unit (quick add: empty = each item's own default unit). */
  allowNone?: boolean;
}

/** Unit chips plus an "Other (custom)" chip that reveals a free-text field. */
export function UnitPicker({ value, onChange, allowNone }: UnitPickerProps) {
  const { t } = useTranslation();
  const isCustomValue = value !== '' && !UNITS.includes(value);
  const [otherOn, setOtherOn] = useState(isCustomValue);
  const showCustom = otherOn || isCustomValue;

  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {UNITS.map((u) => (
          <Chip
            key={u}
            label={u}
            outlined={!showCustom && value === u}
            onPress={() => {
              setOtherOn(false);
              onChange(allowNone && value === u ? '' : u);
            }}
          />
        ))}
        <Chip
          label={t('pantryUi.otherUnit', 'Other (custom)')}
          icon="edit"
          outlined={showCustom}
          onPress={() => {
            setOtherOn(true);
            if (!isCustomValue) onChange('');
          }}
        />
      </View>
      {showCustom ? (
        <Field
          label={t('pantryUi.customUnit', 'Custom unit')}
          placeholder={t('pantryUi.customUnitPlaceholder', 'Enter custom unit...')}
          value={isCustomValue ? value : ''}
          onChangeText={onChange}
          autoFocus
        />
      ) : null}
    </View>
  );
}
