import React from 'react';
import { Alert, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { useWantToCookStore } from '@/stores/wantToCookStore';
import { ShoppingListView } from '@/components/import';
import { Muted, Rows, ListRow, Screen, Title, TopBar, UIconButton } from '@/components/ui';

export default function ShoppingTab() {
  const router = useRouter();
  const { t } = useTranslation();
  const { shoppingList, clearShoppingList } = useWantToCookStore();

  const totalCount = shoppingList.length;

  const handleClearList = () => {
    if (shoppingList.length === 0) return;
    Alert.alert(
      t('shoppingUi.clearTitle', 'Clear Shopping List'),
      t('shoppingUi.clearBody', 'Remove all items from your shopping list?'),
      [
        { text: t('general.cancel', 'Cancel'), style: 'cancel' },
        {
          text: t('shoppingUi.clearConfirm', 'Clear All'),
          style: 'destructive',
          onPress: () => {
            clearShoppingList();
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          },
        },
      ]
    );
  };

  return (
    <Screen bare>
      <TopBar
        title={t('shoppingUi.title', 'Shopping')}
        right={
          totalCount > 0 ? (
            <UIconButton icon="trash" label={t('shoppingUi.clearAll', 'Clear all')} onPress={handleClearList} />
          ) : undefined
        }
      />
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, gap: 14, paddingBottom: 130 }}
        showsVerticalScrollIndicator={false}
      >
        {totalCount > 0 ? (
          <ShoppingListView compact={false} />
        ) : (
          <View style={{ gap: 20 }}>
            <View className="items-center" style={{ gap: 6, paddingTop: 24 }}>
              <Title>{t('shoppingUi.emptyTitle', 'Your shopping list is empty')}</Title>
              <Muted center>
                {t(
                  'shoppingUi.emptyBody',
                  'Import a recipe, then tap "Add to Shopping List" to automatically generate your grocery list'
                )}
              </Muted>
            </View>
            <Rows box>
              <ListRow
                icon="bookmark"
                title={t('shoppingUi.viewSaved', 'View Saved Recipes')}
                subtitle={t('shoppingUi.viewSavedBody', 'Add ingredients from your saved recipes')}
                onPress={() => router.push('/want-to-cook' as never)}
              />
              <ListRow
                icon="kitchen"
                title={t('shoppingUi.checkPantry', 'Check Your Pantry')}
                subtitle={t('shoppingUi.checkPantryBody', 'See what you already have at home')}
                onPress={() => router.push('/(tabs)/pantry' as never)}
              />
            </Rows>
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}
