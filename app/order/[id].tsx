import React, { useEffect } from 'react';
import { Text as RNText, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { SAMPLE } from '@/assets/sample';
import {
  Display,
  Muted,
  ProgressBar,
  Screen,
  SheetPanel,
  Tag,
  Thumb,
  Title,
  UAvatar,
  UButton,
  UIconButton,
} from '@/components/ui';
import { FONT } from '@/components/ui/fonts';
import { OrderMap } from '@/components/orders/OrderMap';
import { PREVIEW_LABEL } from '@/constants/features';
import { orderService } from '@/services/orderService';
import { useMessageStore } from '@/stores/messageStore';
import { selectOrder, useOrderStore } from '@/stores/orderStore';
import { ORDER_STATUSES, type OrderStatus } from '@/types/order';

const STATUS_KEY: Record<OrderStatus, { key: string; fallback: string }> = {
  Confirmed: { key: 'orders.track.confirmed', fallback: 'Confirmed' },
  Preparing: { key: 'orders.track.preparing', fallback: 'Preparing' },
  'On the way': { key: 'orders.track.onTheWay', fallback: 'On the way' },
  Arrived: { key: 'orders.track.arrived', fallback: 'Arrived' },
};

export default function OrderTrackingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const order = useOrderStore(selectOrder(id ?? ''));
  const resumeOrderTimers = useOrderStore((s) => s.resumeOrderTimers);
  const thread = useMessageStore((s) =>
    s.conversations.find((c) => c.kind === 'order' && (c.orderId === id || c.title === order?.restaurantName)),
  );

  // Re-sync statuses from elapsed time and restart the demo timers.
  useEffect(() => {
    resumeOrderTimers();
  }, [resumeOrderTimers]);

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)'));
  const top = Math.max(insets.top, 20) + 14;

  if (!order) {
    return (
      <Screen>
        <View style={{ paddingTop: top, gap: 24 }}>
          <UIconButton icon="back" label={t('orders.track.back', 'Back')} onPress={goBack} />
          <Muted center>{t('orders.track.notFound', 'We could not find this order')}</Muted>
          <UButton
            label={t('orders.track.browse', 'Browse restaurants')}
            onPress={() => router.replace({ pathname: '/restaurant/[id]', params: { id: orderService.getRestaurants()[0]?.id ?? 'smash' } })}
          />
        </View>
      </Screen>
    );
  }

  const step = ORDER_STATUSES.indexOf(order.status);
  const arrived = order.status === 'Arrived';
  const firstDish = order.lines[0] ? orderService.getDish(order.lines[0].dishId) : undefined;

  return (
    <Screen bare>
      <OrderMap status={order.status} />
      <View
        className="flex-row items-center justify-between"
        style={{ position: 'absolute', top, left: 20, right: 20, zIndex: 2 }}
      >
        <UIconButton tone="white" icon="back" label={t('orders.track.back', 'Back')} onPress={goBack} />
        <Tag large tone="glass" label={t('orders.track.number', 'Order #{{number}}', { number: order.number })} />
      </View>

      <View style={{ flex: 1, marginTop: 434 }}>
        <SheetPanel>
          <View className="flex-row items-center justify-between">
            <View style={{ paddingTop: 2, paddingBottom: 4 }} accessible accessibilityLabel={t('orders.track.status', 'Order status: {{status}}', { status: t(STATUS_KEY[order.status].key, STATUS_KEY[order.status].fallback) })}>
              {arrived ? null : <Muted small>{t('orders.track.arrivingIn', 'Arriving in')}</Muted>}
              <Display size={36} style={{ lineHeight: 45, marginTop: 4 }}>
                {arrived
                  ? t('orders.track.arrivedTitle', 'Arrived')
                  : t('orders.track.minutes', '{{count}} min', { count: order.etaMin })}
              </Display>
            </View>
            {firstDish ? <Thumb source={SAMPLE[firstDish.photo]} name={firstDish.name} size={60} /> : null}
          </View>

          <View
            accessibilityRole="progressbar"
            accessibilityLabel={t(STATUS_KEY[order.status].key, STATUS_KEY[order.status].fallback)}
            accessibilityValue={{ min: 1, max: ORDER_STATUSES.length, now: step + 1 }}
            className="flex-row"
            style={{ gap: 6 }}
          >
            {ORDER_STATUSES.map((s, i) => (
              <View key={s} className="flex-1">
                <ProgressBar
                  variant={i === step && !arrived ? 'accent' : 'auto'}
                  value={i < step ? 1 : i === step ? (arrived ? 1 : 0.6) : 0}
                />
              </View>
            ))}
          </View>
          <View className="flex-row justify-between">
            {ORDER_STATUSES.map((s, i) => (
              <RNText
                key={s}
                className={i === step ? 'text-ink' : 'text-muted'}
                style={{ fontFamily: i === step ? FONT.sansSemi : FONT.sans, fontSize: 12 }}
              >
                {t(STATUS_KEY[s].key, STATUS_KEY[s].fallback)}
              </RNText>
            ))}
          </View>

          <View className="flex-row items-center" style={{ gap: 12 }}>
            <UAvatar name={order.rider.name} source={SAMPLE[order.rider.photo]} size={44} />
            <View className="flex-1" style={{ minWidth: 0, gap: 2 }}>
              <Title>{order.rider.name}</Title>
              <Muted small>
                {t('orders.track.yourRider', 'Your rider')} · ★ {order.rider.rating.toFixed(1)}
              </Muted>
            </View>
            {thread ? (
              <UIconButton
                icon="chat"
                label={t('orders.track.messageRider', 'Message rider')}
                onPress={() => router.push({ pathname: '/messages/[id]', params: { id: thread.id } })}
              />
            ) : null}
          </View>

          <View className="flex-row items-center" style={{ gap: 8 }}>
            <Tag tone="o" label={PREVIEW_LABEL} />
            <Muted small style={{ flex: 1 }}>
              {t('orders.demoNote', 'Demo order. No payment is taken and nothing is delivered.')}
            </Muted>
          </View>
        </SheetPanel>
      </View>
    </Screen>
  );
}
