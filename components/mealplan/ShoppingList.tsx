import React, { memo } from 'react';
import { Pressable, SectionList, SectionListData, Text as RNText, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  Check,
  Divider,
  Icon,
  Muted,
  ProgressBar,
  Title,
  UAvatar,
  FONT,
} from '@/components/ui';
import { ShoppingListItem } from '@/types/mealplan';
import { foodPhoto } from './foodPhoto';

interface ShoppingListProps {
  items: ShoppingListItem[];
  onToggleItem: (itemId: string) => void;
  onItemPress?: (item: ShoppingListItem) => void;
  showPantryIndicator?: boolean;
  /** Extra space under the list so the last row clears a bottom bar. */
  bottomSpace?: number;
  /** Rendered under the last row (e.g. a clear-checked link). */
  footer?: React.ReactNode;
}

export const ShoppingList: React.FC<ShoppingListProps> = ({
  items,
  onToggleItem,
  onItemPress,
  showPantryIndicator = true,
  bottomSpace = 120,
  footer,
}) => {
  const { t } = useTranslation();

  const sections = React.useMemo(() => {
    // PlanShopping.html is one flat list with no category headings.
    const result: SectionListData<ShoppingListItem>[] = [{ title: '', data: items }];
    return result;
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
      ItemSeparatorComponent={Divider}
      ListFooterComponent={footer ? <View>{footer}</View> : null}
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
    // One short line like the design's single-line rows: the amount, plus a pantry marker.
    const parts = [needsToBuy ? `${item.toBuy} ${item.unit}` : `${item.amount} ${item.unit}`];
    if (showPantryIndicator && item.inPantry) {
      parts.push(t('planShop.inPantryShort', 'in pantry'));
    }

    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={item.name}
        accessibilityState={{ checked: item.checked }}
        onPress={onPress || onToggle}
        style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
      >
        <View className="flex-row items-center" style={{ minHeight: 64, gap: 14 }}>
          <UAvatar name={item.name} source={foodPhoto(item.name)} size={44} />
          <View className="flex-1" style={{ minWidth: 0, gap: 2 }}>
            <RNText
              className="text-ink"
              numberOfLines={1}
              style={{
                fontFamily: FONT.display,
                fontSize: 15,
              }}
            >
              {item.name}
            </RNText>
            <Muted small numberOfLines={1}>
              {parts.join(' · ')}
            </Muted>
          </View>
          {item.recipes.length > 1 ? (
            <RNText className="text-muted" style={{ fontFamily: FONT.sansMedium, fontSize: 12 }}>
              x{item.recipes.length}
            </RNText>
          ) : null}
          <Check checked={item.checked} onChange={onToggle} label={item.name} />
        </View>
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
