import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, RefreshControl, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { usePantry, usePantrySearch, usePantryAlerts } from '@/hooks/usePantry';
import { useAuthStore } from '@/stores/authStore';
import { PantryItem, PantryCategory } from '@/types';
import { PantryItemCard, AddPantryItemModal, EditPantryItemModal } from '@/components/pantry';
import { CATEGORY_ORDER, useCategoryLabel } from '@/components/pantry/shared';
import {
  Chip,
  ChipRow,
  Muted,
  PhotoCard,
  Rows,
  Screen,
  Tag,
  Title,
  TopBar,
  UButton,
  UIconButton,
  UInput,
  useColor,
} from '@/components/ui';
import { SAMPLE } from '@/assets/sample';

export default function PantryScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const categoryLabel = useCategoryLabel();
  const spinner = useColor('muted');
  const { user } = useAuthStore();
  const { items, isLoading, itemsByCategory, addItem, updateItem, deleteItem, refresh } = usePantry();
  const { search, clear } = usePantrySearch();
  const { expiringItems, expiredItems, hasAlerts } = usePantryAlerts();

  const [isAddModalVisible, setAddModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<PantryItem | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<PantryCategory | null>(null);

  useEffect(() => {
    if (user) {
      refresh();
    }
  }, [user]);

  const onRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  const handleDelete = (itemId: string, itemName: string) => {
    Alert.alert(
      t('pantryUi.deleteTitle', 'Delete Item'),
      t('pantryUi.deleteBody', 'Are you sure you want to remove {{name}} from your pantry?', { name: itemName }),
      [
        { text: t('general.cancel', 'Cancel'), style: 'cancel' },
        {
          text: t('general.delete', 'Delete'),
          style: 'destructive',
          onPress: () => deleteItem(itemId),
        },
      ]
    );
  };

  const handleSearchChange = (text: string) => {
    setSearchText(text);
    if (text.trim()) search(text);
    else clear();
  };

  const getDisplayedItems = (): PantryItem[] => {
    if (searchText.trim()) {
      return items.filter((item) => item.name.toLowerCase().includes(searchText.toLowerCase()));
    }
    if (selectedCategory) {
      return itemsByCategory[selectedCategory] || [];
    }
    return items;
  };

  const displayedItems = getDisplayedItems();
  const alertItems = expiringItems.length > 0 ? expiringItems : expiredItems;
  const alertNames = alertItems
    .slice(0, 3)
    .map((i) => i.name)
    .join(', ');

  return (
    <Screen bare>
      <TopBar
        title={t('pantryUi.title', 'Pantry')}
        right={
          <UIconButton
            icon="plus"
            tone="black"
            label={t('pantryUi.addItem', 'Add item')}
            onPress={() => setAddModalVisible(true)}
          />
        }
      />
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, gap: 14, paddingBottom: 130 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <UInput
          icon="search"
          label={t('pantryUi.searchLabel', 'Search pantry')}
          placeholder={t('pantryUi.searchPlaceholder', 'Search {{n}} items', { n: items.length })}
          value={searchText}
          onChangeText={handleSearchChange}
          autoCorrect={false}
          returnKeyType="search"
        />

        {hasAlerts ? (
          <PhotoCard
            source={SAMPLE.spinach}
            height={168}
            accessibilityLabel={t('pantryUi.findRecipes', 'Find recipes')}
            onPress={() => router.push('/(tabs)/browse')}
            topLeft={
              <>
                {expiringItems.length > 0 ? (
                  <Tag
                    tone="glass"
                    large
                    icon="warning"
                    label={t('pantryUi.expiringCount', '{{n}} expiring soon', { n: expiringItems.length })}
                  />
                ) : null}
                {expiredItems.length > 0 ? (
                  <Tag
                    tone="glass"
                    large
                    label={t('pantryUi.expiredCount', '{{n}} expired', { n: expiredItems.length })}
                  />
                ) : null}
              </>
            }
            glassBar={
              <>
                <View className="flex-1" style={{ minWidth: 0 }}>
                  <Title numberOfLines={1}>{t('pantryUi.useTonight', 'Use them tonight')}</Title>
                  <Muted small numberOfLines={1}>
                    {alertNames}
                  </Muted>
                </View>
                <Tag tone="glass" large label={t('pantryUi.findRecipes', 'Find recipes')} />
              </>
            }
          />
        ) : null}

        <View style={{ marginHorizontal: -20 }}>
        <ChipRow>
          <Chip
            label={t('pantryUi.all', 'All')}
            on={selectedCategory === null}
            onPress={() => setSelectedCategory(null)}
          />
          {CATEGORY_ORDER.map((cat) => (
            <Chip key={cat} label={categoryLabel(cat)} on={selectedCategory === cat} onPress={() => setSelectedCategory(cat)} />
          ))}
        </ChipRow>
        </View>

        {isLoading && items.length === 0 ? (
          <View style={{ paddingVertical: 48 }}>
            <ActivityIndicator color={spinner} />
          </View>
        ) : items.length === 0 ? (
          <View className="items-center" style={{ gap: 12, paddingVertical: 40 }}>
            <Title>{t('pantryUi.emptyTitle', 'Your pantry is empty')}</Title>
            <Muted center>{t('pantryUi.emptyBody', 'Add what you have at home and we will suggest recipes.')}</Muted>
            <UButton size="sm" icon="plus" label={t('pantryUi.addItem', 'Add item')} onPress={() => setAddModalVisible(true)} />
          </View>
        ) : displayedItems.length === 0 ? (
          <View className="items-center" style={{ paddingVertical: 32 }}>
            <Muted>{t('pantryUi.noneFound', 'No items found')}</Muted>
          </View>
        ) : (
          <Rows>
            {displayedItems.map((item) => (
              <PantryItemCard
                key={item.id}
                item={item}
                onPress={() => setEditingItem(item)}
                onDelete={() => handleDelete(item.id, item.name)}
              />
            ))}
          </Rows>
        )}
      </ScrollView>

      <AddPantryItemModal visible={isAddModalVisible} onClose={() => setAddModalVisible(false)} onAdd={addItem} />

      <EditPantryItemModal
        visible={!!editingItem}
        item={editingItem}
        onClose={() => setEditingItem(null)}
        onSave={updateItem}
        onDelete={(itemId) => {
          const name = editingItem?.name || t('pantryUi.itemFallback', 'Item');
          handleDelete(itemId, name);
        }}
      />
    </Screen>
  );
}
