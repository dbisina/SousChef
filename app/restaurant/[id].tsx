import React, { useMemo, useState } from 'react';
import { ScrollView, Text as RNText, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { SAMPLE } from '@/assets/sample';
import { Chip, ChipRow, Muted, PhotoCard, Screen, SheetPanel, Tag, UButton, UIconButton } from '@/components/ui';
import { FONT } from '@/components/ui/fonts';
import { DishRow } from '@/components/orders/DishRow';
import { PREVIEW_LABEL } from '@/constants/features';
import { formatPrice } from '@/lib/nutrition';
import { orderService } from '@/services/orderService';
import { useMessageStore } from '@/stores/messageStore';
import { selectCartCount, selectCartSubtotalPence, useOrderStore } from '@/stores/orderStore';

const POPULAR = 'Popular';

export default function RestaurantScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const restaurant = id ? orderService.getRestaurant(id) : undefined;
  const menu = useMemo(() => (restaurant ? orderService.getMenu(restaurant.id) : []), [restaurant]);
  const cart = useOrderStore((s) => s.cart);
  const count = useOrderStore(selectCartCount);
  const subtotal = useOrderStore(selectCartSubtotalPence);
  const thread = useMessageStore((s) => s.conversations.find((c) => c.kind === 'order' && c.title === restaurant?.name));

  const [category, setCategory] = useState(POPULAR);
  const [saved, setSaved] = useState(false);

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)'));
  const top = Math.max(insets.top, 20) + 14;

  if (!restaurant) {
    return (
      <Screen>
        <View style={{ paddingTop: top, gap: 24 }}>
          <UIconButton icon="back" label={t('restaurant.back', 'Back')} onPress={goBack} />
          <Muted center>{t('restaurant.notFound', 'This restaurant is not available')}</Muted>
        </View>
      </Screen>
    );
  }

  const visible = category === POPULAR ? menu : menu.filter((d) => d.category === category);
  const openDish = (dishId: string) => router.push({ pathname: '/order/sheet', params: { dishId } });
  const inCart = (dishId: string) => cart.some((l) => l.dishId === dishId);
  const bottom = Math.max(insets.bottom, 34);

  return (
    <Screen bare>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: count > 0 ? bottom + 58 + 24 : 40 }}>
        <PhotoCard source={SAMPLE[restaurant.photo]} height={300} radius={0} fade="both" accessibilityLabel={restaurant.name}>
          <View
            className="flex-row items-center justify-between"
            style={{ position: 'absolute', top, left: 20, right: 20, zIndex: 2 }}
          >
            <UIconButton tone="glassDark" icon="back" label={t('restaurant.back', 'Back')} onPress={goBack} />
            <View className="flex-row items-center" style={{ gap: 8 }}>
              <Tag tone="glassDark" label={PREVIEW_LABEL} />
              {thread ? (
                <UIconButton
                  tone="glassDark"
                  icon="chat"
                  label={t('restaurant.message', 'Message restaurant')}
                  onPress={() => router.push({ pathname: '/messages/[id]', params: { id: thread.id } })}
                />
              ) : null}
              <UIconButton
                tone="glassDark"
                icon="heart"
                filled={saved}
                label={saved ? t('restaurant.saved', 'Saved') : t('restaurant.save', 'Save')}
                onPress={() => setSaved((v) => !v)}
              />
            </View>
          </View>
          <View style={{ position: 'absolute', left: 22, right: 22, bottom: 54, gap: 8, zIndex: 1 }}>
            <RNText
              numberOfLines={2}
              accessibilityRole="header"
              className="text-paper"
              style={{ fontFamily: FONT.display, fontSize: 30, lineHeight: 34, letterSpacing: -0.6 }}
            >
              {restaurant.name}
            </RNText>
            <View className="flex-row flex-wrap" style={{ gap: 6 }}>
              <Tag tone="glassDark" icon="star" label={`${restaurant.rating.toFixed(1)} (${restaurant.ratingCount})`} />
              <Tag tone="glassDark" label={t('restaurant.distance', '{{km}} km', { km: restaurant.distanceKm })} />
              <Tag
                tone="glassDark"
                label={t('restaurant.eta', '{{from}}–{{to}} min', { from: restaurant.etaMin[0], to: restaurant.etaMin[1] })}
              />
              <Tag tone="glassDark" label={t('restaurant.hygiene', 'Hygiene {{score}}', { score: restaurant.hygiene })} />
            </View>
          </View>
        </PhotoCard>

        <SheetPanel>
          <View style={{ marginHorizontal: -20 }}>
            <ChipRow>
              {restaurant.categories.map((c) => (
                <Chip key={c} label={c} on={category === c} onPress={() => setCategory(c)} />
              ))}
            </ChipRow>
          </View>
          {visible.length === 0 ? (
            <Muted center style={{ paddingVertical: 32 }}>
              {t('restaurant.empty', 'Nothing in this section yet')}
            </Muted>
          ) : (
            <View>
              {visible.map((d, i) => (
                <View key={d.id} className={i > 0 ? 'border-t border-divider' : undefined}>
                  <DishRow dish={d} inCart={inCart(d.id)} onPress={() => openDish(d.id)} />
                </View>
              ))}
            </View>
          )}
        </SheetPanel>
      </ScrollView>

      {count > 0 ? (
        <View
          className="flex-row items-center justify-between bg-night"
          style={{ position: 'absolute', left: 20, right: 20, bottom, height: 58, borderRadius: 29, paddingStart: 22, paddingEnd: 7, zIndex: 3 }}
        >
          <RNText className="text-paper" style={{ fontFamily: FONT.display, fontSize: 15 }}>
            {t('restaurant.cartSummary', '{{items}} · {{price}}', {
              items: `${count} ${count === 1 ? t('restaurant.item', 'item') : t('restaurant.items', 'items')}`,
              price: formatPrice(subtotal),
            })}
          </RNText>
          <UButton
            size="sm"
            variant="accent"
            label={t('restaurant.viewOrder', 'View order')}
            onPress={() => router.push('/order/sheet')}
          />
        </View>
      ) : null}
    </Screen>
  );
}
