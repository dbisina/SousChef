import React, { useState, useCallback } from 'react';
import { Alert, Platform, Pressable, Share, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import { useShoppingList } from '@/hooks/useMealPlan';
import { ShoppingList } from '@/components/mealplan';
import { foodPhoto } from '@/components/mealplan/foodPhoto';
import {
  Chip,
  ChipRow,
  H2,
  LinkText,
  Muted,
  Screen,
  Segmented,
  Sheet,
  Stepper,
  Title,
  TopBar,
  UAvatar,
  UButton,
  UIconButton,
} from '@/components/ui';
import { SHOPPING_CATEGORY_LABELS, ShoppingCategory, ShoppingListItem } from '@/types/mealplan';
import { PantryCategory } from '@/types';
import { usePantryStore } from '@/stores/pantryStore';
import { useAuthStore } from '@/stores/authStore';
import { showErrorToast, showInfoToast } from '@/stores/toastStore';

const PANTRY_CATEGORIES: PantryCategory[] = [
  'produce', 'dairy', 'meat', 'seafood', 'grains',
  'spices', 'condiments', 'canned', 'frozen', 'beverages', 'other',
];

const BASE_UNITS = ['piece', 'g', 'kg', 'pack'];

// Map shopping categories to pantry categories
const shoppingToPantryCategory = (cat: ShoppingCategory): PantryCategory => {
  const map: Partial<Record<ShoppingCategory, PantryCategory>> = {
    produce: 'produce', dairy: 'dairy', meat: 'meat', seafood: 'seafood',
    grains: 'grains', spices: 'spices', condiments: 'condiments',
    canned: 'canned', frozen: 'frozen', beverages: 'beverages',
  };
  return map[cat] || 'other';
};

type FilterMode = 'all' | 'toBuy' | 'inPantry';

export default function ShoppingListScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const { addPantryItem } = usePantryStore();
  const {
    shoppingList,
    totalItems,
    checkedItems,
    itemsInPantry,
    totalToBuy,
    toggleItem,
    clearChecked,
  } = useShoppingList();

  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [pantryModalItem, setPantryModalItem] = useState<ShoppingListItem | null>(null);
  const [showPantryModal, setShowPantryModal] = useState(false);
  const [pantryAmount, setPantryAmount] = useState(1);
  const [pantryUnit, setPantryUnit] = useState('');
  const [pantryCategory, setPantryCategory] = useState<PantryCategory>('other');

  const filteredItems = React.useMemo(() => {
    switch (filterMode) {
      case 'toBuy':
        return shoppingList.filter((item) => item.toBuy > 0 && !item.checked);
      case 'inPantry':
        return shoppingList.filter((item) => item.inPantry);
      default:
        return shoppingList;
    }
  }, [shoppingList, filterMode]);

  // Checking an unchecked item opens the "Add to Pantry" sheet.
  const handleToggleItem = useCallback(
    (itemId: string) => {
      const item = shoppingList.find((i) => i.id === itemId);
      if (item && !item.checked) {
        setPantryModalItem(item);
        setPantryAmount(item.toBuy > 0 ? item.toBuy : item.amount);
        setPantryUnit(item.unit);
        setPantryCategory(shoppingToPantryCategory(item.category));
        setShowPantryModal(true);
      } else {
        toggleItem(itemId);
      }
    },
    [shoppingList, toggleItem]
  );

  const closePantrySheet = () => {
    setShowPantryModal(false);
    setPantryModalItem(null);
  };

  const handleConfirmPantryAdd = useCallback(async () => {
    if (!pantryModalItem || !user) return;

    const amount = pantryAmount > 0 ? pantryAmount : 1;
    try {
      await addPantryItem(user.id, {
        name: pantryModalItem.name,
        amount,
        unit: pantryUnit || pantryModalItem.unit,
        category: pantryCategory,
      });
      await toggleItem(pantryModalItem.id);
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (e) {
      console.warn('Failed to add to pantry:', e);
      showErrorToast(
        t('planShop.pantryErrBody', "We couldn't add {{name}} to your pantry. Let's try once more.", {
          name: pantryModalItem.name,
        }),
        t('planShop.pantryErrTitle', 'Pantry Problem')
      );
    }

    closePantrySheet();
  }, [pantryModalItem, user, pantryAmount, pantryUnit, pantryCategory, addPantryItem, toggleItem, t]);

  // Just check off without adding to pantry
  const handleSkipPantryAdd = useCallback(async () => {
    if (pantryModalItem) {
      await toggleItem(pantryModalItem.id);
    }
    closePantrySheet();
  }, [pantryModalItem, toggleItem]);

  const handleShare = async () => {
    const itemsToBuy = shoppingList.filter((item) => item.toBuy > 0 && !item.checked);

    if (itemsToBuy.length === 0) {
      showInfoToast(
        t('planShop.shareEmptyBody', 'Your shopping list is empty or all items are checked. Add some ingredients to share them.'),
        t('planShop.shareEmptyTitle', 'List is Empty')
      );
      return;
    }

    const grouped = new Map<ShoppingCategory, string[]>();
    itemsToBuy.forEach((item) => {
      const existing = grouped.get(item.category) || [];
      existing.push(`- ${item.toBuy} ${item.unit} ${item.name}`);
      grouped.set(item.category, existing);
    });

    let message = `${t('planShop.shareHeader', 'Shopping List from SousChef')}\n\n`;
    grouped.forEach((items, category) => {
      message += `${SHOPPING_CATEGORY_LABELS[category]}\n`;
      message += items.join('\n');
      message += '\n\n';
    });

    try {
      await Share.share({ message, title: t('planShop.title', 'Shopping List') });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const handleClearChecked = () => {
    if (checkedItems === 0) return;
    Alert.alert(
      t('planShop.clearTitle', 'Clear List?'),
      t('planShop.clearBody', 'Are you sure you want to remove {{n}} checked items from your list?', { n: checkedItems }),
      [
        { text: t('common.cancel', 'Cancel'), style: 'cancel' },
        { text: t('plan.clear', 'Clear'), style: 'destructive', onPress: () => clearChecked() },
      ]
    );
  };

  const units = pantryUnit && !BASE_UNITS.includes(pantryUnit) ? [pantryUnit, ...BASE_UNITS] : BASE_UNITS;

  return (
    <Screen bare>
      <TopBar
        variant="compact"
        title={t('planShop.title', 'Shopping List')}
        onBack={() => router.back()}
        right={
          <View className="flex-row" style={{ gap: 8 }}>
            {checkedItems > 0 ? (
              <UIconButton icon="trash" label={t('planShop.clearChecked', 'Clear checked items')} onPress={handleClearChecked} />
            ) : null}
            <UIconButton icon="share" label={t('planShop.share', 'Share list')} onPress={handleShare} />
          </View>
        }
      />

      <View style={{ paddingHorizontal: 20, paddingBottom: 6 }}>
        <Segmented<FilterMode>
          value={filterMode}
          onChange={setFilterMode}
          options={[
            { value: 'all', label: t('planShop.all', 'All {{n}}', { n: totalItems }) },
            { value: 'toBuy', label: t('planShop.toBuy', 'To buy {{n}}', { n: totalToBuy }) },
            { value: 'inPantry', label: t('planShop.inPantry', 'In pantry {{n}}', { n: itemsInPantry }) },
          ]}
        />
      </View>

      <ShoppingList
        items={filteredItems}
        onToggleItem={handleToggleItem}
        showPantryIndicator={filterMode !== 'inPantry'}
      />

      <Sheet visible={showPantryModal} onClose={closePantrySheet} title={t('planShop.addToPantry', 'Add to Pantry')}>
        <View className="flex-row items-center" style={{ gap: 14 }}>
          <UAvatar
            square
            size={64}
            name={pantryModalItem?.name ?? ''}
            source={pantryModalItem ? foodPhoto(pantryModalItem.name) : null}
          />
          <View className="flex-1" style={{ minWidth: 0 }}>
            <H2>{t('planShop.addToPantry', 'Add to Pantry')}</H2>
            <Muted small numberOfLines={1}>
              {pantryModalItem?.name}
            </Muted>
          </View>
          <UIconButton icon="close" label={t('common.close', 'Close')} onPress={closePantrySheet} />
        </View>

        <View className="flex-row items-center justify-between" style={{ gap: 12 }}>
          <Title>{t('planShop.qtyBought', 'Quantity bought')}</Title>
          <Stepper
            label={t('planShop.qtyBought', 'Quantity bought')}
            value={pantryAmount}
            min={0}
            max={999}
            onChange={setPantryAmount}
          />
        </View>

        <View style={{ marginHorizontal: -20 }}>
          <ChipRow>
            {units.map((u) => (
              <Chip key={u} label={u} outlined={pantryUnit === u} onPress={() => setPantryUnit(u)} />
            ))}
          </ChipRow>
        </View>
        <View style={{ marginHorizontal: -20 }}>
          <ChipRow>
            {PANTRY_CATEGORIES.map((cat) => (
              <Chip
                key={cat}
                label={cat.charAt(0).toUpperCase() + cat.slice(1)}
                outlined={pantryCategory === cat}
                onPress={() => setPantryCategory(cat)}
              />
            ))}
          </ChipRow>
        </View>

        <UButton label={t('planShop.addToPantry', 'Add to Pantry')} onPress={handleConfirmPantryAdd} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('planShop.justCheck', 'Just check off')}
          onPress={handleSkipPantryAdd}
          className="items-center justify-center"
          style={{ height: 44 }}
        >
          <LinkText>{t('planShop.justCheck', 'Just check off')}</LinkText>
        </Pressable>
      </Sheet>
    </Screen>
  );
}
