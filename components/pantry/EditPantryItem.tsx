import React, { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, ScrollView, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useForm, Controller } from 'react-hook-form';
import { PantryCategory, PantryItem } from '@/types';
import { CtaBar, Field, Screen, SectionLabel, TopBar, UButton, UIconButton } from '@/components/ui';
import { showErrorToast, showInfoToast } from '@/stores/toastStore';
import { CategoryChips, UnitPicker } from './shared';

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

export const EditPantryItemModal: React.FC<EditPantryItemProps> = ({ visible, item, onClose, onSave, onDelete }) => {
  const { t } = useTranslation();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<EditPantryItemFormData>({
    defaultValues: { name: '', amount: 1, unit: 'piece', category: 'other' },
  });

  // Reset form when item changes
  useEffect(() => {
    if (item) {
      reset({ name: item.name, amount: item.amount, unit: item.unit, category: item.category });
    }
  }, [item, reset]);

  const handleSave = async (data: EditPantryItemFormData) => {
    if (!item) return;
    if (!data.name?.trim()) {
      showInfoToast(
        t('pantryUi.missingNameBody', "Wait! Don't forget to name your ingredient."),
        t('pantryUi.missingName', 'Missing Name')
      );
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
    } catch {
      showErrorToast(
        t('pantryUi.saveFailed', "We couldn't save your changes. Let's try that again?"),
        t('pantryUi.updateProblem', 'Update Problem')
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = () => {
    if (!item || !onDelete) return;
    Alert.alert(
      t('pantryUi.removeTitle', 'Remove Ingredient?'),
      t('pantryUi.removeBody', 'Are you sure you want to remove {{name}}? You can always add it back later!', {
        name: item.name,
      }),
      [
        { text: t('general.cancel', 'Cancel'), style: 'cancel' },
        {
          text: t('general.delete', 'Delete'),
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
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <Screen
        bare
        footer={
          <CtaBar fade>
            <UButton label={t('pantryUi.saveChanges', 'Save Changes')} onPress={handleSubmit(handleSave)} loading={isSubmitting} />
          </CtaBar>
        }
      >
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <TopBar
            variant="compact"
            title={t('pantryUi.editTitle', 'Edit Pantry Item')}
            left={<UIconButton icon="close" label={t('general.close', 'Close')} onPress={onClose} />}
            right={
              onDelete ? (
                <UIconButton icon="trash" label={t('pantryUi.removeTitle', 'Remove Ingredient?')} onPress={handleDelete} />
              ) : undefined
            }
          />
          <ScrollView
            contentContainerStyle={{ paddingHorizontal: 20, gap: 14, paddingBottom: 140 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Controller
              control={control}
              name="name"
              rules={{ required: t('pantryUi.nameRequired', 'Name is required') }}
              render={({ field: { onChange, value } }) => (
                <Field
                  label={t('pantryUi.ingredientName', 'Ingredient Name')}
                  placeholder={t('pantryUi.ingredientPlaceholder', 'e.g., Olive Oil')}
                  value={value}
                  onChangeText={onChange}
                  error={errors.name?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="amount"
              rules={{ required: true, min: 0 }}
              render={({ field: { onChange, value } }) => (
                <Field
                  label={t('pantryUi.amount', 'Amount')}
                  placeholder="1"
                  keyboardType="decimal-pad"
                  value={value?.toString()}
                  onChangeText={(text) => onChange(parseFloat(text) || 0)}
                />
              )}
            />
            <View style={{ gap: 8 }}>
              <SectionLabel>{t('pantryUi.unit', 'Unit')}</SectionLabel>
              <Controller
                control={control}
                name="unit"
                render={({ field: { onChange, value } }) => (
                  <UnitPicker key={item.id} value={value} onChange={onChange} />
                )}
              />
            </View>
            <View style={{ gap: 8 }}>
              <SectionLabel>{t('pantryUi.category', 'Category')}</SectionLabel>
              <Controller
                control={control}
                name="category"
                render={({ field: { onChange, value } }) => <CategoryChips value={value} onChange={onChange} />}
              />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Screen>
    </Modal>
  );
};
