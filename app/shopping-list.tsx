import React from 'react';
import { ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ShoppingListView } from '@/components/import';
import { Muted, Screen, TopBar } from '@/components/ui';

export default function WantToCookShoppingScreen() {
  const router = useRouter();
  const { t } = useTranslation();

  return (
    <Screen bare>
      <TopBar variant="compact" title={t('shoppingUi.listTitle', 'Shopping list')} onBack={() => router.back()} />
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, gap: 14, paddingBottom: 48 }}
        showsVerticalScrollIndicator={false}
      >
        <View>
          <Muted small>
            {t('shoppingUi.subtitle', 'Check items off, then move them to your pantry')}
          </Muted>
        </View>
        <ShoppingListView compact={false} />
      </ScrollView>
    </Screen>
  );
}
