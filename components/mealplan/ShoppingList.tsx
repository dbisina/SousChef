import React, { memo } from 'react';
import { Pressable, SectionList, SectionListData, Text as RNText, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  Check,
  Divider,
  Icon,
  Muted,
  ProgressBar,
  SectionLabel,
  Title,
  UAvatar,
  FONT,
} from '@/components/ui';
import { ShoppingListItem, ShoppingCategory, SHOPPING_CATEGORY_LABELS } from '@/types/mealplan';
import { foodPhoto } from './foodPhoto';

interface ShoppingListProps {
  items: ShoppingListItem[];
  onToggleItem: (itemId: string) => void;
  onItemPress?: (item: ShoppingListItem) => void;
  showPantryIndicator?: boolean;
  /** Extra space under the list so the last row clears a bottom bar. */
  bottomSpace?: number;
}

export const ShoppingList: React.FC<ShoppingListProps> = ({
  items,
  onToggleItem,
  onItemPress,
  showPantryIndicator = true,
  bottomSpace = 120,
}) => {
  const { t } = useTranslation();

  const sections = React.useMemo(() => {
    const grouped = new Map<ShoppingCategory, ShoppingListItem[]>();
    items.forEach((item) => {
      const existing = grouped.get(item.category) || [];
      existing.push(item);
      grouped.set(item.category, existing);
    });
    const result: SectionListData<ShoppingListItem>[] = [];
    grouped.forEach((data, category) => {
      result.push({ title: SHOPPING_CATEGORY_LABELS[category] || category, data });
    });
    return result.sort((a, b) => a.title.localeCompare(b.title));
  }, [items]);

  if (items.length === 0) {
    return (
      <View className="flex-1 items-center justify-center" style={{ paddingVertical: 48, gap: 8 }}>
        <Icon name="cart" size="lg" color="subtle" />
        <Title center>{t('planShop.empty', 'No items in your shopping list')}</Title>
        <Muted small center>
          {t('planShop.emptyHint', 'Generate a meal plan to create your list')}
        </Muted>
      </View>
    );
  }

  return (
    <SectionList
      sections={sections}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <ShoppingListRow
          item={item}
          onToggle={() => onToggleItem(item.id)}
          onPress={onItemPress ? () => onItemPress(item) : undefined}
          showPantryIndicator={showPantryIndicator}
        />
      )}
      renderSectionHeader={({ section }) => (
        <View className="bg-ground" style={{ paddingTop: 18, paddingBottom: 6 }}>
          <SectionLabel>{section.title}</SectionLabel>
        </View>
      )}
      ItemSeparatorComponent={Divider}
      stickySectionHeadersEnabled={false}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: bottomSpace }}
      removeClippedSubviews
      maxToRenderPerBatch={20}
      updateCellsBatchingPeriod={50}
      initialNumToRender={10}
    />
  );
};

interface ShoppingListRowProps {
  item: ShoppingListItem;
  onToggle: () => void;
  onPress?: () => void;
  showPantryIndicator: boolean;
}

const ShoppingListRow: React.FC<ShoppingListRowProps> = memo(
  ({ item, onToggle, onPress, showPantryIndicator }) => {
    const { t } = useTranslation();
    const needsToBuy = item.toBuy > 0;
    const parts = [needsToBuy ? `${item.toBuy} ${item.unit}` : `${item.amount} ${item.unit}`];
    if (showPantryIndicator && item.inPantry) {
      parts.push(t('planShop.inPantryAmt', '{{amt}} {{unit}} in pantry', { amt: item.pantryAmount, unit: item.unit }));
    }
    if (item.recipeNames.length > 0) {
      parts.push(t('planShop.forRecipes', 'For: {{names}}', { names: item.recipeNames.join(', ') }));
    }

    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={item.name}
        accessibilityState={{ checked: item.checked }}
        onPress={onPress || onToggle}
        className="flex-row items-center"
        style={({ pressed }) => ({ minHeight: 64, gap: 14, opacity: item.checked ? 0.55 : pressed ? 0.7 : 1 })}
      >
        <UAvatar name={item.name} source={foodPhoto(item.name)} size={44} />
        <View className="flex-1" style={{ minWidth: 0, gap: 2 }}>
          <RNText
            className="text-ink"
            numberOfLines={1}
            style={{
              fontFamily: FONT.display,
              fontSize: 15,
              textDecorationLine: item.checked ? 'line-through' : 'none',
            }}
          >
            {item.name}
          </RNText>
          <Muted small numberOfLines={2}>
            {parts.join(' · ')}
          </Muted>
        </View>
        {item.recipes.length > 1 ? (
          <RNText className="text-muted" style={{ fontFamily: FONT.sansMedium, fontSize: 12 }}>
            x{item.recipes.length}
          </RNText>
        ) : null}
        <Check checked={item.checked} onChange={onToggle} label={item.name} />
      </Pressable>
    );
  },
  (prev, next) =>
    prev.item.id === next.item.id &&
    prev.item.checked === next.item.checked &&
    prev.item.name === next.item.name &&
    prev.item.amount === next.item.amount &&
    prev.item.toBuy === next.item.toBuy &&
    prev.showPantryIndicator === next.showPantryIndicator &&
    prev.onToggle === next.onToggle &&
    prev.onPress === next.onPress
);

ShoppingListRow.displayName = 'ShoppingListRow';

interface ShoppingListSummaryProps {
  totalItems: number;
  checkedItems: number;
  itemsInPantry: number;
  itemsToBuy: number;
}

/** Progress bar with a one-line count; the filter counts themselves live in the screen's segmented control. */
export const ShoppingListSummary: React.FC<ShoppingListSummaryProps> = ({ totalItems, checkedItems, itemsToBuy }) => {
  const { t } = useTranslation();
  return (
    <View style={{ gap: 8 }}>
      <ProgressBar
        value={totalItems > 0 ? checkedItems / totalItems : 0}
        variant="accent"
        label={t('planShop.progress', 'Checked off')}
      />
      <View className="flex-row items-center justify-between">
        <Muted small>{t('planShop.checkedOf', '{{a}} of {{b}} checked', { a: checkedItems, b: totalItems })}</Muted>
        <Muted small>{t('planShop.toBuyN', '{{n}} to buy', { n: itemsToBuy })}</Muted>
      </View>
    </View>
  );
};
