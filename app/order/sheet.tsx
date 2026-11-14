import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text as RNText, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SAMPLE } from '@/assets/sample';
import {
  Chip,
  Display,
  Icon,
  ListRow,
  Muted,
  PhotoCard,
  Rows,
  Screen,
  Stepper,
  Tag,
  Thumb,
  Title,
  UButton,
  USwitch,
} from '@/components/ui';
import { FONT } from '@/components/ui/fonts';
import { FIXED } from '@/stores/themeStore';
import { NutritionTags } from '@/components/orders/NutritionTags';
import { allergenName, focusNutrient, matchingAllergens } from '@/components/orders/dishInfo';
import { PREVIEW_LABEL } from '@/constants/features';
import { formatPrice } from '@/lib/nutrition';
import { orderService } from '@/services/orderService';
import { useAuthStore } from '@/stores/authStore';
import { useOrderStore } from '@/stores/orderStore';
import type { CartLine, MenuDish } from '@/types/order';

export default function OrderSheetScreen() {
  const { dishId } = useLocalSearchParams<{ dishId?: string }>();
  const router = useRouter();
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const insets = useSafeAreaInsets();
  const cart = useOrderStore((s) => s.cart);
  const addToOrder = useOrderStore((s) => s.addToOrder);
  const setQty = useOrderStore((s) => s.setQty);
  const setLogToHealth = useOrderStore((s) => s.setLogToHealth);
  const placeDemoOrder = useOrderStore((s) => s.placeDemoOrder);

  // Add mode (a dish was chosen) or review mode (View order from the restaurant page).
  const dish: MenuDish | undefined = dishId ? orderService.getDish(dishId) : undefined;
  const reviewing = !dish;

  const [extraIds, setExtraIds] = useState<string[]>([]);
  const [qty, setQtyLocal] = useState(1);
  const [logHealth, setLogHealth] = useState(true);
  const [paying, setPaying] = useState(false);

  const close = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)'));

  const cartDishes = useMemo(
    () => cart.map((l) => ({ line: l, dish: orderService.getDish(l.dishId) })).filter((x): x is { line: CartLine; dish: MenuDish } => !!x.dish),
    [cart],
  );
  const hero = dish ?? cartDishes[0]?.dish;

  // Lines that make up the order: the cart (same restaurant) plus the dish being configured.
  const lines = useMemo<CartLine[]>(() => {
    const kept = cartDishes.filter((x) => !dish || x.dish.restaurantId === dish.restaurantId).map((x) => x.line);
    if (!dish) return kept;
    return [...kept, { id: 'draft', dishId: dish.id, qty, extraIds, logToHealth: logHealth }];
  }, [cartDishes, dish, qty, extraIds, logHealth]);
  const totals = useMemo(() => orderService.totals(lines), [lines]);
  const restaurant = hero ? orderService.getRestaurant(hero.restaurantId) : undefined;

  const allLogged = cart.length > 0 && cart.every((l) => l.logToHealth);
  const toggleAll = (on: boolean) => cart.forEach((l) => setLogToHealth(l.id, on));

  const toggleExtra = (id: string) =>
    setExtraIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

  const commit = () => {
    if (dish) addToOrder(dish.id, { qty, extraIds, logToHealth: logHealth });
  };

  const pay = () => {
    if (paying || totals.itemCount === 0) return;
    setPaying(true);
    commit();
    const order = placeDemoOrder();
    if (!order) {
      setPaying(false);
      return;
    }
    router.replace({ pathname: '/order/[id]', params: { id: order.id } });
  };

  const addOnly = () => {
    commit();
    close();
  };

  const deliveryText = totals.deliveryPence === 0 ? t('orders.sheet.deliveryFree', 'free') : formatPrice(totals.deliveryPence);
  const mine = user?.allergies;

  const allergyLine = (d: MenuDish) => {
    const list = d.allergens.map(allergenName).join(', ');
    if (!mine) return { text: list ? t('orders.sheet.contains', 'Contains {{list}}.', { list }) : '', bad: false };
    const hits = matchingAllergens(d.allergens, mine);
    if (hits.length) {
      return {
        text: `${t('orders.sheet.contains', 'Contains {{list}}.', { list })} ${t('orders.sheet.matches', 'Matches your allergies: {{list}}.', { list: hits.join(', ') })}`,
        bad: true,
      };
    }
    if (!d.allergens.length) return { text: t('orders.sheet.noAllergens', 'No allergens match your profile.'), bad: false };
    return {
      text: `${t('orders.sheet.contains', 'Contains {{list}}.', { list })} ${t('orders.sheet.noneMatch', 'None match your allergies.')}`,
      bad: false,
    };
  };

  const header = (
    <View className="bg-line self-center" style={{ width: 40, height: 5, borderRadius: 3, marginTop: -10 }} />
  );

  return (
    <Screen bare>
      {hero ? <PhotoCard source={SAMPLE[hero.photo]} height={360} radius={0} fade="none" /> : null}
      {/* .scrim + .sheet (top:150): inline so the panel keeps the design's fixed top edge. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Close ${t('orders.sheet.title', 'Order sheet')}`}
        onPress={close}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: FIXED.scrim }}
      />
      <View
        accessibilityViewIsModal
        accessibilityLabel={t('orders.sheet.title', 'Order sheet')}
        className="bg-ground"
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          top: 150,
          borderTopLeftRadius: 34,
          borderTopRightRadius: 34,
          paddingTop: 24,
          paddingHorizontal: 20,
          paddingBottom: Math.max(insets.bottom, 20) + 14,
          gap: 14,
        }}
      >
        {header}
        {!hero ? (
          <View style={{ gap: 14 }}>
            <Muted center>{t('orders.sheet.empty', 'Your order is empty')}</Muted>
            <UButton label={t('orders.sheet.browse', 'Browse the menu')} onPress={close} />
          </View>
        ) : (
          <>
            <ScrollView style={{ flexGrow: 0, flexShrink: 1 }} contentContainerStyle={{ gap: 14 }} showsVerticalScrollIndicator={false}>
              {dish ? (
                <>
                  <View className="flex-row items-center" style={{ gap: 14 }}>
                    <Thumb source={SAMPLE[dish.photo]} name={dish.name} size={68} />
                    <View className="flex-1" style={{ minWidth: 0, gap: 2 }}>
                      <Title style={{ fontSize: 17 }} numberOfLines={2}>
                        {dish.name}
                      </Title>
                      <Muted small numberOfLines={2}>
                        {t('orders.sheet.meta', '{{restaurant}} · {{mins}} min · {{kcal}} kcal', {
                          restaurant: restaurant?.name ?? '',
                          mins: dish.prepMin,
                          kcal: dish.kcal,
                        })}
                      </Muted>
                    </View>
                    <Display size={20}>{formatPrice(orderService.unitPrice(dish, extraIds))}</Display>
                  </View>

                  <NutritionTags dish={dish} withWord emphasis={focusNutrient(user?.healthConditions)} />

                  {(() => {
                    const a = allergyLine(dish);
                    if (!a.text) return null;
                    return (
                      <View
                        accessible
                        className={`flex-row items-center ${a.bad ? 'bg-tag-r' : 'bg-tag-g'}`}
                        style={{ paddingVertical: 12, paddingHorizontal: 14, borderRadius: 20, gap: 10 }}
                      >
                        <Icon name={a.bad ? 'warning' : 'check'} size="sm" color={a.bad ? 'tag-r-fg' : 'tag-g-fg'} />
                        <RNText
                          className={`flex-1 ${a.bad ? 'text-tag-r-fg' : 'text-tag-g-fg'}`}
                          style={{ fontFamily: FONT.sans, fontSize: 12, lineHeight: 17 }}
                        >
                          {a.text}
                        </RNText>
                      </View>
                    );
                  })()}

                  {dish.extras.length ? (
                    <View style={{ gap: 8 }}>
                      <RNText className="text-muted" style={{ fontFamily: FONT.sansMedium, fontSize: 12, paddingStart: 4 }}>
                        {t('orders.sheet.makeItAMeal', 'Make it a meal')}
                      </RNText>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginHorizontal: -20 }} contentContainerStyle={{ gap: 8, paddingHorizontal: 20 }}>
                        <Chip
                          label={t('orders.sheet.justThe', 'Just the {{name}}', {
                            name: (dish.name.split(' ').pop() ?? dish.name).toLowerCase(),
                          })}
                          outlined={extraIds.length === 0}
                          onPress={() => setExtraIds([])}
                        />
                        {dish.extras.map((e) => (
                          <Chip
                            key={e.id}
                            label={t('orders.sheet.plusExtra', '+ {{label}} {{price}}', { label: e.label, price: formatPrice(e.pricePence) })}
                            outlined={extraIds.includes(e.id)}
                            onPress={() => toggleExtra(e.id)}
                          />
                        ))}
                      </ScrollView>
                    </View>
                  ) : null}

                  <View className="flex-row items-center justify-between">
                    <Title>{t('orders.sheet.quantity', 'Quantity')}</Title>
                    <Stepper label={dish.name} value={qty} min={1} max={20} onChange={setQtyLocal} />
                  </View>
                </>
              ) : (
                <>
                  <Title style={{ fontSize: 17 }}>{t('orders.sheet.yourOrder', 'Your order')}</Title>
                  <Rows>
                    {cartDishes.map(({ line, dish: d }) => (
                      <ListRow
                        key={line.id}
                        tall
                        title={d.name}
                        subtitle={[
                          ...d.extras.filter((e) => line.extraIds.includes(e.id)).map((e) => e.label),
                          formatPrice(orderService.unitPrice(d, line.extraIds) * line.qty),
                        ].join(' · ')}
                        leading={<Thumb source={SAMPLE[d.photo]} name={d.name} size={52} />}
                        right={<Stepper label={d.name} value={line.qty} min={0} max={20} onChange={(v) => setQty(line.id, v)} />}
                      />
                    ))}
                  </Rows>
                </>
              )}

              <Rows box>
                <ListRow
                  leading={
                    <View className="items-center justify-center bg-ground" style={{ width: 44, height: 44, borderRadius: 22 }}>
                      <Icon name="pin" />
                    </View>
                  }
                  title={t('orders.sheet.deliverTo', 'Deliver to')}
                  subtitle={t('orders.sheet.addAddress', 'Add your address')}
                />
                <ListRow
                  leading={
                    <View className="items-center justify-center bg-ground" style={{ width: 44, height: 44, borderRadius: 22 }}>
                      <Icon name="drop" />
                    </View>
                  }
                  title={t('orders.sheet.logToHealth', 'Log to Health')}
                  subtitle={t('orders.sheet.logToHealthHint', 'Adds this meal and reminds you to check')}
                  right={
                    <USwitch
                      label={t('orders.sheet.logToHealth', 'Log to Health')}
                      value={reviewing ? allLogged : logHealth}
                      onValueChange={(v) => (reviewing ? toggleAll(v) : setLogHealth(v))}
                    />
                  }
                />
              </Rows>
              <View className="flex-row items-center" style={{ gap: 8 }}>
                <Tag tone="o" label={PREVIEW_LABEL} />
                <Muted small style={{ flex: 1 }}>
                  {t('orders.demoNote', 'Demo order. No payment is taken and nothing is delivered.')}
                </Muted>
              </View>
              {dish ? (
                <UButton variant="ghost" size="sm" label={t('orders.sheet.addToOrder', 'Add to order')} onPress={addOnly} style={{ alignSelf: 'center' }} />
              ) : null}
            </ScrollView>

            <View className="flex-row items-center justify-between">
              <Muted style={{ flex: 1 }}>
                {t('orders.sheet.subtotalDelivery', 'Subtotal {{subtotal}} · delivery {{delivery}}', {
                  subtotal: formatPrice(totals.subtotalPence),
                  delivery: deliveryText,
                })}
              </Muted>
              <RNText className="text-ink" style={{ fontFamily: FONT.sansSemi, fontSize: 14 }}>
                {formatPrice(totals.totalPence)}
              </RNText>
            </View>
            <UButton
              label={t('orders.sheet.pay', 'Pay {{total}}', { total: formatPrice(totals.totalPence) })}
              onPress={pay}
              loading={paying}
              disabled={totals.itemCount === 0}
            />
          </>
        )}
      </View>
    </Screen>
  );
}
