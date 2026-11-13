import React, { useEffect, useMemo } from 'react';
import { ScrollView, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SAMPLE } from '@/assets/sample';
import { usePantry } from '@/hooks/usePantry';
import { useAuthStore } from '@/stores/authStore';
import { useMealPlanStore } from '@/stores/mealPlanStore';
import { useWantToCookStore } from '@/stores/wantToCookStore';
import { useCookbookLibraryStore } from '@/stores/cookbookLibraryStore';
import { Chip, PhotoCard, Screen, Tag, TopBar, UIconButton } from '@/components/ui';

const todayKey = () => {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
};

export default function KitchenScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const { items: pantryItems, expiringItems } = usePantry();
  const currentPlan = useMealPlanStore((s) => s.currentPlan);
  const fetchCurrentPlan = useMealPlanStore((s) => s.fetchCurrentPlan);
  const wantToCookItems = useWantToCookStore((s) => s.items);
  const shoppingList = useWantToCookStore((s) => s.shoppingList);
  const cookbooks = useCookbookLibraryStore((s) => s.cookbooks);

  useEffect(() => {
    if (user && !currentPlan) {
      fetchCurrentPlan(user.id);
    }
  }, [user, currentPlan, fetchCurrentPlan]);

  const plannedCount = useMemo(
    () =>
      (currentPlan?.days ?? []).reduce(
        (sum, d) => sum + [d.breakfast, d.lunch, d.dinner, d.snack].filter(Boolean).length,
        0
      ),
    [currentPlan]
  );
  const tonight = currentPlan?.days.find((d) => d.date === todayKey())?.dinner?.recipeName;

  const planSubtitle =
    plannedCount > 0
      ? tonight
        ? t('kitchen.planTonight', 'Tonight: {{meal}} · {{n}} meals planned', { meal: tonight, n: plannedCount })
        : t('kitchen.planCount', '{{n}} meals planned', { n: plannedCount })
      : t('kitchen.planEmpty', 'Plan your week');

  const toBuy = shoppingList.filter((i) => !i.checked).length;
  const savedCount = wantToCookItems.filter((i) => i.status === 'saved').length;

  const go = (href: string) => router.push(href as Href);

  return (
    <Screen bare>
      <TopBar
        title={t('kitchen.title', 'Kitchen')}
        right={
          <UIconButton
            icon="search"
            label={t('kitchen.searchRecipes', 'Search recipes')}
            onPress={() => go('/(tabs)/browse')}
          />
        }
      />
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, gap: 12, paddingBottom: 130 }}
        showsVerticalScrollIndicator={false}
      >
        <PhotoCard
          source={SAMPLE.toast}
          height={170}
          title={t('kitchen.mealPlan', 'Meal plan')}
          subtitle={planSubtitle}
          topLeft={<Tag tone="glassDark" large label={t('kitchen.thisWeek', 'This week')} />}
          onPress={() => go('/(tabs)/mealplan')}
        />

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
          <PhotoCard
            source={SAMPLE.spinach}
            height={160}
            radius={26}
            width="48%"
            style={{ flexGrow: 1 }}
            title={t('kitchen.pantry', 'Pantry')}
            titleSize={17}
            subtitle={t('kitchen.pantryItems', '{{n}} items', { n: pantryItems.length })}
            captionInset={16}
            topLeft={
              expiringItems.length > 0 ? (
                <Tag tone="glass" label={t('kitchen.expiring', '{{n}} expiring', { n: expiringItems.length })} />
              ) : undefined
            }
            onPress={() => go('/(tabs)/pantry')}
          />
          <PhotoCard
            source={SAMPLE.grocery}
            height={160}
            radius={26}
            width="48%"
            style={{ flexGrow: 1 }}
            title={t('kitchen.shopping', 'Shopping')}
            titleSize={17}
            subtitle={t('kitchen.toBuy', '{{n}} to buy', { n: toBuy })}
            captionInset={16}
            onPress={() => go('/(tabs)/shopping')}
          />
          <PhotoCard
            source={SAMPLE.penne}
            height={160}
            radius={26}
            width="48%"
            style={{ flexGrow: 1 }}
            title={t('kitchen.saved', 'Saved')}
            titleSize={17}
            subtitle={t('kitchen.savedCount', '{{n}} recipes', { n: savedCount })}
            captionInset={16}
            onPress={() => go('/want-to-cook')}
          />
          <PhotoCard
            source={SAMPLE.cookbook}
            height={160}
            radius={26}
            width="48%"
            style={{ flexGrow: 1 }}
            title={t('kitchen.shelf', 'Cookbook shelf')}
            titleSize={17}
            subtitle={t('kitchen.books', '{{n}} books', { n: cookbooks.length })}
            captionInset={16}
            onPress={() => go('/cookbook-library')}
          />
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          <Chip icon="scan" label={t('kitchen.scanPlate', 'Scan plate')} onPress={() => go('/(tabs)/scan')} />
          <Chip icon="leaf" label={t('kitchen.waste', 'Waste')} onPress={() => go('/mealplan/waste')} />
          <Chip icon="camera" label={t('kitchen.scanBook', 'Scan book')} onPress={() => go('/cookbook-library')} />
        </View>
      </ScrollView>
    </Screen>
  );
}
