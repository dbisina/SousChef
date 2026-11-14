import React, { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text as RNText,
  View,
  useWindowDimensions,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useForm, Controller } from 'react-hook-form';
import { PantryCategory, PantryItemFormData } from '@/types';
import {
  Chip,
  CtaBar,
  Field,
  FONT,
  Icon,
  PhotoCard,
  Screen,
  SectionLabel,
  Segmented,
  TopBar,
  UButton,
  UIconButton,
  UInput,
  useTokens,
} from '@/components/ui';
import { COMMON_PANTRY_ITEMS } from '@/stores/pantryStore';
import { showSuccessToast, showErrorToast, showInfoToast } from '@/stores/toastStore';
import { pantryPhoto } from './photos';
import { CATEGORY_ORDER, CategoryChips, UnitPicker, useCategoryLabel } from './shared';

interface AddPantryItemProps {
  visible: boolean;
  onClose: () => void;
  onAdd: (item: PantryItemFormData) => Promise<void>;
}

type Mode = 'quick' | 'custom';
type CommonItem = (typeof COMMON_PANTRY_ITEMS)[number];

const EMPTY_FORM: PantryItemFormData = { name: '', amount: 1, unit: 'piece', category: 'other' };

/** Selected-state check badge (.ck.on, top right of a tile). */
function TileCheck() {
  return (
    <View
      className="bg-ink items-center justify-center"
      style={{ width: 26, height: 26, borderRadius: 13 }}
    >
      <Icon name="check" size="sm" color="ink-inverse" />
    </View>
  );
}

interface TileProps {
  item: CommonItem;
  size: number;
  selected: boolean;
  onPress: () => void;
}

/** Ingredient tile (112px, radius 22): photo when we have one, plain surface otherwise. */
function IngredientTile({ item, size, selected, onPress }: TileProps) {
  const tokens = useTokens();
  const photo = pantryPhoto(item.name);
  const ring = { borderWidth: selected ? 2 : 0, borderColor: tokens.ink };

  if (photo) {
    return (
      <PhotoCard
        source={photo}
        width={size}
        height={112}
        radius={22}
        title={item.name}
        titleSize={13}
        captionInset={12}
        topRight={selected ? <TileCheck /> : undefined}
        onPress={onPress}
        accessibilityLabel={item.name}
        style={ring}
      />
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={item.name}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => ({ width: size, opacity: pressed ? 0.85 : 1 })}
    >
      <View
        className="bg-surface-2 justify-end"
        style={[{ height: 112, borderRadius: 22, padding: 12 }, ring]}
      >
        {selected ? (
          <View style={{ position: 'absolute', top: 8, right: 8 }}>
            <TileCheck />
          </View>
        ) : null}
        <RNText className="text-ink" numberOfLines={2} style={{ fontFamily: FONT.display, fontSize: 13, lineHeight: 16 }}>
          {item.name}
        </RNText>
      </View>
    </Pressable>
  );
}

export const AddPantryItemModal: React.FC<AddPantryItemProps> = ({ visible, onClose, onAdd }) => {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const categoryLabel = useCategoryLabel();
  const [mode, setMode] = useState<Mode>('quick');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<PantryCategory | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [quickAmount, setQuickAmount] = useState('');
  const [quickUnit, setQuickUnit] = useState('');

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PantryItemFormData>({ defaultValues: EMPTY_FORM });

  const tileSize = Math.floor((width - 40 - 20) / 3);

  const visibleItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const filtered = COMMON_PANTRY_ITEMS.filter(
      (item) =>
        (!q || item.name.toLowerCase().includes(q)) && (!categoryFilter || item.category === categoryFilter)
    );
    // Items with a photo first, otherwise keep catalogue order.
    return [...filtered].sort((a, b) => Number(!!pantryPhoto(b.name)) - Number(!!pantryPhoto(a.name)));
  }, [searchQuery, categoryFilter]);

  const resetAll = () => {
    reset(EMPTY_FORM);
    setSearchQuery('');
    setCategoryFilter(null);
    setSelected([]);
    setQuickAmount('');
    setQuickUnit('');
    setMode('quick');
  };

  const handleClose = () => {
    resetAll();
    onClose();
  };

  const toggle = (name: string) =>
    setSelected((prev) => (prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]));

  const handleQuickAdd = async () => {
    if (isSubmitting || selected.length === 0) return;
    setIsSubmitting(true);
    const parsed = parseFloat(quickAmount);
    const amount = parsed > 0 ? parsed : 1;
    let added = 0;
    try {
      for (const name of selected) {
        const item = COMMON_PANTRY_ITEMS.find((c) => c.name === name);
        if (!item) continue;
        try {
          await onAdd({ name: item.name, amount, unit: quickUnit || item.unit, category: item.category });
          added++;
        } catch (error) {
          console.error('Quick add error:', error);
          showErrorToast(
            t('pantryUi.addFailed', "Something went wrong adding your {{name}}. Let's try that again?", { name: item.name }),
            t('pantryUi.pantryIssue', 'Pantry Issue')
          );
        }
      }
    } finally {
      setIsSubmitting(false);
    }
    if (added > 0) {
      showSuccessToast(
        t('pantryUi.addedMany', '{{n}} items added to your pantry.', { n: added }),
        t('pantryUi.added', 'Added!')
      );
      handleClose();
    }
  };

  const handleCustomAdd = async (data: PantryItemFormData) => {
    if (!data.name?.trim()) {
      showInfoToast(
        t('pantryUi.missingNameBody', "Wait! Don't forget to name your ingredient."),
        t('pantryUi.missingName', 'Missing Name')
      );
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
      showSuccessToast(
        t('pantryUi.addedOne', '{{name}} is now in your pantry!', { name: data.name }),
        t('pantryUi.added', 'Added!')
      );
      reset(EMPTY_FORM);
    } catch (error) {
      console.error('Custom add error:', error);
      showErrorToast(
        t('pantryUi.addOneFailed', "We couldn't add your {{name}} just yet. Please try again!", { name: data.name }),
        t('pantryUi.pantryIssue', 'Pantry Issue')
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const quickCta =
    selected.length === 1
      ? t('pantryUi.addOneItem', 'Add 1 item')
      : t('pantryUi.addNItems', 'Add {{n}} items', { n: selected.length });

  const footer =
    mode === 'quick' ? (
      <CtaBar fade>
        <UButton
          label={selected.length > 0 ? quickCta : t('pantryUi.selectItems', 'Select items to add')}
          onPress={handleQuickAdd}
          disabled={selected.length === 0}
          loading={isSubmitting}
        />
      </CtaBar>
    ) : (
      <CtaBar fade>
        <UButton
          label={t('pantryUi.addToPantry', 'Add to Pantry')}
          onPress={handleSubmit(handleCustomAdd)}
          loading={isSubmitting}
        />
      </CtaBar>
    );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <Screen bare footer={footer}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <TopBar
            variant="compact"
            title={t('pantryUi.addTitle', 'Add to Pantry')}
            left={<UIconButton icon="close" label={t('general.close', 'Close')} onPress={handleClose} />}
          />
          <ScrollView
            contentContainerStyle={{ paddingHorizontal: 20, gap: 14, paddingBottom: 140 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Segmented<Mode>
              value={mode}
              onChange={setMode}
              options={[
                { value: 'quick', label: t('pantryUi.quickAdd', 'Quick Add') },
                { value: 'custom', label: t('pantryUi.custom', 'Custom') },
              ]}
            />

            {mode === 'quick' ? (
              <>
                <UInput
                  icon="search"
                  label={t('pantryUi.searchIngredients', 'Search ingredients')}
                  placeholder={t('pantryUi.searchIngredientsPlaceholder', 'Search ingredients...')}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  autoCorrect={false}
                />
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={{ flexGrow: 0, marginHorizontal: -20 }}
                  contentContainerStyle={{ gap: 8, paddingHorizontal: 20 }}
                >
                  <Chip label={t('pantryUi.all', 'All')} on={categoryFilter === null} onPress={() => setCategoryFilter(null)} />
                  {CATEGORY_ORDER.map((cat) => (
                    <Chip
                      key={cat}
                      label={categoryLabel(cat)}
                      on={categoryFilter === cat}
                      onPress={() => setCategoryFilter(cat)}
                    />
                  ))}
                </ScrollView>

                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                  {visibleItems.map((item) => (
                    <IngredientTile
                      key={item.name}
                      item={item}
                      size={tileSize}
                      selected={selected.includes(item.name)}
                      onPress={() => toggle(item.name)}
                    />
                  ))}
                </View>

                {selected.length > 0 ? (
                  <>
                    <Field
                      label={t('pantryUi.amount', 'Amount')}
                      placeholder="1"
                      keyboardType="decimal-pad"
                      value={quickAmount}
                      onChangeText={setQuickAmount}
                    />
                    <View style={{ gap: 8 }}>
                      <SectionLabel>{t('pantryUi.unit', 'Unit')}</SectionLabel>
                      <UnitPicker value={quickUnit} onChange={setQuickUnit} allowNone />
                    </View>
                  </>
                ) : null}
              </>
            ) : (
              <>
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
                  rules={{ required: true, min: 0.1 }}
                  render={({ field: { onChange, value } }) => (
                    <Field
                      label={t('pantryUi.amount', 'Amount')}
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
                <View style={{ gap: 8 }}>
                  <SectionLabel>{t('pantryUi.unit', 'Unit')}</SectionLabel>
                  <Controller
                    control={control}
                    name="unit"
                    render={({ field: { onChange, value } }) => <UnitPicker value={value} onChange={onChange} />}
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
              </>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </Screen>
    </Modal>
  );
};
