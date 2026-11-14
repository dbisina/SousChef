import React, { memo, useMemo, useCallback, useState } from 'react';
import {
  View,
  Text as RNText,
  Pressable,
  Platform,
  Alert,
  Modal,
  KeyboardAvoidingView,
  ScrollView,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { useWantToCookStore } from '@/stores/wantToCookStore';
import { usePantryStore } from '@/stores/pantryStore';
import { useAuthStore } from '@/stores/authStore';
import { FIXED } from '@/stores/themeStore';
import { QuickShoppingItem } from '@/types/wantToCook';
import { PantryCategory } from '@/types';
import { pantryPhoto } from '@/components/pantry/photos';
import { CategoryChips, useCategoryLabel } from '@/components/pantry/shared';
import {
  Check,
  Field,
  FONT,
  Icon,
  LinkText,
  Muted,
  PhotoCard,
  Rows,
  SectionLabel,
  Tag,
  Thumb,
  Title,
  ToneBlock,
  UButton,
  UIconButton,
  useTone,
} from '@/components/ui';
import { SAMPLE } from '@/assets/sample';

interface ShoppingListViewProps {
  compact?: boolean;
  onViewFull?: () => void;
}

const ShoppingItem = memo<{
  item: QuickShoppingItem;
  onToggle: () => void;
  onRemove: () => void;
}>(({ item, onToggle, onRemove }) => {
  const { t } = useTranslation();

  const handlePress = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onToggle();
  };

  const quantity = `${item.amount} ${item.unit}`;

  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={item.name}
      accessibilityState={{ checked: item.checked }}
      accessibilityHint={t('shoppingUi.itemHint', 'Long press to remove')}
      accessibilityActions={[{ name: 'delete', label: t('shoppingUi.remove', 'Remove') }]}
      onAccessibilityAction={(e) => {
        if (e.nativeEvent.actionName === 'delete') onRemove();
      }}
      onPress={handlePress}
      onLongPress={onRemove}
      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
    >
      <View className="flex-row items-center" style={{ minHeight: 64, gap: 14 }}>
        <Thumb source={pantryPhoto(item.name)} name={item.name} size={44} />
        <Title
          numberOfLines={1}
          className={item.checked ? 'flex-1 text-subtle' : 'flex-1'}
          style={[{ minWidth: 0 }, item.checked ? { textDecorationLine: 'line-through' } : undefined]}
        >
          {item.name}
        </Title>
        <Muted small numberOfLines={1}>
          {quantity}
        </Muted>
        <View pointerEvents="none">
          <Check checked={item.checked} label={item.name} />
        </View>
      </View>
    </Pressable>
  );
});

ShoppingItem.displayName = 'ShoppingItem';

// ── Add-to-Pantry sheet shown when user checks off a shopping item ──
interface AddToPantryModalProps {
  visible: boolean;
  item: QuickShoppingItem | null;
  onConfirm: (amount: number, unit: string, category: PantryCategory) => void;
  onSkip: () => void;
  onClose: () => void;
}

const PANTRY_CATEGORIES: PantryCategory[] = [
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

const AddToPantryModal: React.FC<AddToPantryModalProps> = ({ visible, item, onConfirm, onSkip, onClose }) => {
  const { t } = useTranslation();
  const tone = useTone();
  const [amount, setAmount] = useState('');
  const [unit, setUnit] = useState('');
  const [category, setCategory] = useState<PantryCategory>('other');

  React.useEffect(() => {
    if (item) {
      setAmount(item.amount?.toString() || '1');
      setUnit(item.unit || 'piece');
      // Try to guess category from item.category
      const cat = (item.category || 'other') as PantryCategory;
      setCategory(PANTRY_CATEGORIES.includes(cat) ? cat : 'other');
    }
  }, [item]);

  if (!item) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose} statusBarTranslucent>
      <ToneBlock tone={tone} style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('general.close', 'Close')}
          onPress={onClose}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: FIXED.scrim }}
        />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View
            accessibilityViewIsModal
            className="bg-ground"
            style={{
              borderTopLeftRadius: 34,
              borderTopRightRadius: 34,
              paddingTop: 24,
              paddingHorizontal: 20,
              paddingBottom: Platform.OS === 'ios' ? 40 : 24,
              gap: 16,
              maxHeight: '88%',
            }}
          >
            <ScrollView
              contentContainerStyle={{ gap: 16 }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={{ gap: 4 }}>
                <RNText
                  accessibilityRole="header"
                  className="text-ink"
                  style={{ fontFamily: FONT.display, fontSize: 19, letterSpacing: -0.285 }}
                >
                  {t('shoppingUi.addToPantry', 'Add to Pantry')}
                </RNText>
                <Muted small>
                  {t('shoppingUi.howMuch', 'Specify how much of "{{name}}" you bought', { name: item.name })}
                </Muted>
              </View>

              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Field
                    label={t('shoppingUi.quantity', 'Quantity Bought')}
                    value={amount}
                    onChangeText={setAmount}
                    keyboardType="decimal-pad"
                    placeholder="1"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Field
                    label={t('shoppingUi.unit', 'Unit')}
                    value={unit}
                    onChangeText={setUnit}
                    placeholder="piece"
                  />
                </View>
              </View>

              <View style={{ gap: 8 }}>
                <SectionLabel>{t('shoppingUi.category', 'Category')}</SectionLabel>
                <CategoryChips value={category} onChange={setCategory} />
              </View>

              <View style={{ gap: 10 }}>
                <UButton
                  label={t('shoppingUi.addToPantry', 'Add to Pantry')}
                  onPress={() => {
                    const parsedAmount = parseFloat(amount) || 1;
                    onConfirm(parsedAmount, unit || 'piece', category);
                  }}
                />
                <UButton
                  variant="ghost"
                  label={t('shoppingUi.justCheck', "Just check off (don't add to pantry)")}
                  onPress={onSkip}
                />
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </ToneBlock>
    </Modal>
  );
};

export const ShoppingListView: React.FC<ShoppingListViewProps> = ({ compact = false, onViewFull }) => {
  const { t } = useTranslation();
  const categoryLabel = useCategoryLabel();
  const { shoppingList, toggleShoppingItem, removeFromShoppingList, clearCheckedItems, clearShoppingList } =
    useWantToCookStore();
  const { addPantryItem } = usePantryStore();
  const pantryItems = usePantryStore((s) => s.items);
  const { user } = useAuthStore();

  // State for the add-to-pantry modal
  const [pantryModalItem, setPantryModalItem] = useState<QuickShoppingItem | null>(null);
  const [showPantryModal, setShowPantryModal] = useState(false);

  // When user taps an unchecked item, show the pantry modal
  const handleToggle = useCallback(
    (item: QuickShoppingItem) => {
      if (!item.checked) {
        // Item is being checked OFF (bought) — show pantry modal
        setPantryModalItem(item);
        setShowPantryModal(true);
      } else {
        // Item is already checked, just uncheck it
        toggleShoppingItem(item.id);
      }
    },
    [toggleShoppingItem]
  );

  // Confirm adding to pantry with user-specified quantity
  const handleConfirmPantryAdd = useCallback(
    async (amount: number, unit: string, category: PantryCategory) => {
      if (!pantryModalItem || !user) return;

      try {
        await addPantryItem(user.id, {
          name: pantryModalItem.name,
          amount,
          unit,
          category,
        });
        toggleShoppingItem(pantryModalItem.id);
        if (Platform.OS !== 'web') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      } catch (e) {
        console.warn('Failed to add to pantry:', pantryModalItem.name, e);
        Alert.alert(
          t('shoppingUi.errorTitle', 'Error'),
          t('shoppingUi.addFailed', 'Failed to add {{name}} to pantry.', { name: pantryModalItem.name })
        );
      }

      setShowPantryModal(false);
      setPantryModalItem(null);
    },
    [pantryModalItem, user, addPantryItem, toggleShoppingItem, t]
  );

  // Skip pantry add, just check the item off
  const handleSkipPantryAdd = useCallback(() => {
    if (pantryModalItem) {
      toggleShoppingItem(pantryModalItem.id);
    }
    setShowPantryModal(false);
    setPantryModalItem(null);
  }, [pantryModalItem, toggleShoppingItem]);

  // Batch-move all checked items to pantry, then clear them from the list
  const handleMoveCheckedToPantry = useCallback(async () => {
    const checkedItems = shoppingList.filter((i) => i.checked);
    if (checkedItems.length === 0) return;

    Alert.alert(
      t('shoppingUi.moveTitle', 'Move to Pantry'),
      t('shoppingUi.moveBody', 'Add {{n}} checked items to your pantry?', { n: checkedItems.length }),
      [
        { text: t('general.cancel', 'Cancel'), style: 'cancel' },
        {
          text: t('shoppingUi.moveTitle', 'Move to Pantry'),
          onPress: async () => {
            if (!user) return;
            let added = 0;
            for (const item of checkedItems) {
              try {
                await addPantryItem(user.id, {
                  name: item.name,
                  amount: item.amount,
                  unit: item.unit,
                  category: 'other',
                });
                added++;
              } catch (e) {
                console.warn('Failed to add to pantry:', item.name, e);
              }
            }
            clearCheckedItems();
            if (Platform.OS !== 'web') {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }
            Alert.alert(
              t('shoppingUi.movedTitle', 'Added to Pantry'),
              t('shoppingUi.movedBody', '{{n}} items moved to your pantry.', { n: added })
            );
          },
        },
      ]
    );
  }, [shoppingList, user, addPantryItem, clearCheckedItems, t]);

  // Group items by category (seafood sits with meat, as in the design)
  const groupedItems = useMemo(() => {
    const groups: Record<string, QuickShoppingItem[]> = {};
    shoppingList.forEach((item) => {
      const cat = item.category === 'seafood' ? 'meat' : item.category || 'other';
      const key = cat === 'meat' ? t('shoppingUi.meatFish', 'Meat & fish') : categoryLabel(cat);
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    });
    return groups;
  }, [shoppingList, t, categoryLabel]);

  const checkedCount = shoppingList.filter((i) => i.checked).length;
  const totalCount = shoppingList.length;
  const progress = totalCount > 0 ? checkedCount / totalCount : 0;

  // How many list items are already in the pantry (name match).
  const inPantryCount = useMemo(() => {
    const names = new Set(pantryItems.map((p) => p.name.trim().toLowerCase()));
    return shoppingList.filter((i) => names.has(i.name.trim().toLowerCase())).length;
  }, [shoppingList, pantryItems]);

  if (totalCount === 0) {
    return (
      <View className="items-center" style={{ paddingVertical: 40, gap: 6 }}>
        <Title>{t('shoppingUi.noItems', 'No items yet')}</Title>
        <Muted center>{t('shoppingUi.noItemsBody', 'Import a recipe and add ingredients to your shopping list')}</Muted>
      </View>
    );
  }

  const renderItem = (item: QuickShoppingItem) => (
    <ShoppingItem
      key={item.id}
      item={item}
      onToggle={() => handleToggle(item)}
      onRemove={() => removeFromShoppingList(item.id)}
    />
  );

  const pantryModal = (
    <AddToPantryModal
      visible={showPantryModal}
      item={pantryModalItem}
      onConfirm={handleConfirmPantryAdd}
      onSkip={handleSkipPantryAdd}
      onClose={() => {
        setShowPantryModal(false);
        setPantryModalItem(null);
      }}
    />
  );

  if (compact) {
    return (
      <View style={{ gap: 8 }}>
        <View className="flex-row items-center justify-between">
          <SectionLabel>{t('shoppingUi.title', 'Shopping')}</SectionLabel>
          <Muted small>
            {t('shoppingUi.countOf', '{{done}} of {{total}} items', { done: checkedCount, total: totalCount })}
          </Muted>
        </View>
        <View>{shoppingList.slice(0, 5).map(renderItem)}</View>
        {totalCount > 5 ? (
          <Pressable
            accessibilityRole="button"
            onPress={onViewFull}
            className="flex-row items-center justify-center"
            style={{ minHeight: 44, gap: 4 }}
          >
            <LinkText accent>{t('shoppingUi.viewAll', 'View all {{n}} items', { n: totalCount })}</LinkText>
            <Icon name="chevronRight" size="sm" color="accent-text" />
          </Pressable>
        ) : null}
        {pantryModal}
      </View>
    );
  }

  return (
    <View style={{ gap: 14 }}>
      <PhotoCard source={SAMPLE.grocery} height={150}>
        <View style={{ position: 'absolute', left: 18, right: 18, bottom: 16, gap: 10, zIndex: 1 }}>
          <View className="flex-row items-center justify-between" style={{ gap: 8 }}>
            <RNText
              numberOfLines={1}
              style={{ flexShrink: 1, fontFamily: FONT.display, fontSize: 20, letterSpacing: -0.4, color: FIXED.paper }}
            >
              {t('shoppingUi.countOf', '{{done}} of {{total}} items', { done: checkedCount, total: totalCount })}
            </RNText>
            {inPantryCount > 0 ? (
              <Tag tone="glass" label={t('shoppingUi.inPantry', '{{n}} in pantry', { n: inPantryCount })} />
            ) : null}
          </View>
          <View
            accessibilityRole="progressbar"
            accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }}
            className="bg-paper/30 overflow-hidden"
            style={{ height: 6, borderRadius: 3 }}
          >
            <View className="bg-paper" style={{ height: 6, borderRadius: 3, width: `${progress * 100}%` }} />
          </View>
        </View>
      </PhotoCard>

      {Object.entries(groupedItems).map(([groupName, items]) => (
        <View key={groupName} style={{ gap: 14 }}>
          <SectionLabel>{groupName}</SectionLabel>
          <Rows>{items.map(renderItem)}</Rows>
        </View>
      ))}

      {checkedCount > 0 ? (
        <View className="flex-row items-center" style={{ gap: 10 }}>
          <View style={{ flex: 1 }}>
            <UButton
              label={t('shoppingUi.moveCount', 'Move to Pantry ({{n}})', { n: checkedCount })}
              onPress={handleMoveCheckedToPantry}
            />
          </View>
          <UIconButton
            icon="trash"
            size={58}
            label={t('shoppingUi.clearAll', 'Clear all')}
            onPress={clearShoppingList}
          />
        </View>
      ) : null}

      {pantryModal}
    </View>
  );
};

export default ShoppingListView;
