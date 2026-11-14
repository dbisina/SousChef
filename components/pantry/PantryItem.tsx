import React from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { PantryItem as PantryItemType } from '@/types';
import { Chip, Icon, Muted, SectionLabel, Tag, Thumb, Title } from '@/components/ui';
import type { TagTone } from '@/components/ui/Chips';
import { isExpired, isExpiringSoon } from '@/lib/utils';
import { pantryPhoto } from './photos';
import { useCategoryLabel } from './shared';

type Expiry = PantryItemType['expiryDate'];

const DAY = 24 * 60 * 60 * 1000;

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

/** Freshness tag for an expiry date (same thresholds as isExpired / isExpiringSoon in lib/utils). */
export function getFreshness(expiryDate: Expiry, t: TFunction): { label: string; tone: TagTone } | null {
  if (!expiryDate) return null;
  if (isExpired(expiryDate)) return { label: t('pantryUi.expired', 'Expired'), tone: 'r' };
  const days = Math.round((startOfDay(expiryDate.toDate()) - startOfDay(new Date())) / DAY);
  if (isExpiringSoon(expiryDate)) {
    if (days <= 0) return { label: t('pantryUi.today', 'Today'), tone: 'r' };
    if (days === 1) return { label: t('pantryUi.tomorrow', 'Tomorrow'), tone: 'r' };
    return { label: t('pantryUi.inDays', '{{days}} days', { days }), tone: 'o' };
  }
  return { label: t('pantryUi.fresh', 'Fresh'), tone: 'g' };
}

interface PantryItemProps {
  item: PantryItemType;
  onPress?: () => void;
  /** Long-press shortcut for delete (the edit sheet also exposes delete). */
  onDelete?: () => void;
  showExpiry?: boolean;
}

/** Pantry row: photo thumb, name + "amount unit · Category", freshness tag. */
export const PantryItemCard: React.FC<PantryItemProps> = ({ item, onPress, onDelete, showExpiry = true }) => {
  const { t } = useTranslation();
  const categoryLabel = useCategoryLabel();
  const fresh = showExpiry ? getFreshness(item.expiryDate, t) : null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={item.name}
      disabled={!onPress && !onDelete}
      onPress={onPress}
      onLongPress={onDelete}
      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
    >
      <View className="flex-row items-center" style={{ minHeight: 64, gap: 14, paddingVertical: 2 }}>
        <Thumb source={pantryPhoto(item.name)} name={item.name} />
        <View className="flex-1" style={{ minWidth: 0, gap: 2 }}>
          <Title numberOfLines={1}>{item.name}</Title>
          <Muted small numberOfLines={1}>
            {`${item.amount} ${item.unit} · ${categoryLabel(item.category)}`}
          </Muted>
        </View>
        {fresh ? (
          <View style={{ justifyContent: 'center', flexShrink: 0 }}>
            <Tag label={fresh.label} tone={fresh.tone} />
          </View>
        ) : null}
      </View>
    </Pressable>
  );
};

interface CompactPantryItemProps {
  item: PantryItemType;
  onPress?: () => void;
  selected?: boolean;
}

/** Compact selectable pantry item (chip). */
export const CompactPantryItem: React.FC<CompactPantryItemProps> = ({ item, onPress, selected = false }) => (
  <Chip label={item.name} on={selected} onPress={onPress} />
);

interface CategoryHeaderProps {
  category: string;
  itemCount: number;
}

/** Category header for grouped lists. */
export const CategoryHeader: React.FC<CategoryHeaderProps> = ({ category, itemCount }) => {
  const categoryLabel = useCategoryLabel();
  return (
    <View className="flex-row items-center" style={{ gap: 8, paddingVertical: 8 }}>
      <Icon name="leaf" size="sm" color="muted" />
      <SectionLabel>{`${categoryLabel(category)} · ${itemCount}`}</SectionLabel>
    </View>
  );
};
