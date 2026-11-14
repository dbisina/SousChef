import { MENU, RESTAURANTS, RIDER } from '@/data/sample/restaurants';
import { ORDER_STATUSES } from '@/types/order';
import type {
  CartLine,
  MenuDish,
  Order,
  OrderLineSnapshot,
  OrderStatus,
  Restaurant,
} from '@/types/order';

export interface CartTotals {
  subtotalPence: number;
  deliveryPence: number;
  totalPence: number;
  itemCount: number;
}

export interface OrderService {
  getRestaurants(): Restaurant[];
  getRestaurant(id: string): Restaurant | undefined;
  getMenu(restaurantId: string): MenuDish[];
  getDish(id: string): MenuDish | undefined;
  unitPrice(dish: MenuDish, extraIds: string[]): number;
  totals(lines: CartLine[]): CartTotals;
  /** Build a demo order. No payment is taken and nothing is delivered. */
  buildDemoOrder(lines: CartLine[], now?: Date): Order | null;
}

/** Demo timings (ms after placing) at which each status begins. */
export const STATUS_AT_MS: Record<OrderStatus, number> = {
  Confirmed: 0,
  Preparing: 6_000,
  'On the way': 16_000,
  Arrived: 30_000,
};

/** Minutes remaining shown at each status. */
export const ETA_BY_STATUS: Record<OrderStatus, number> = {
  Confirmed: 28,
  Preparing: 22,
  'On the way': 12,
  Arrived: 0,
};

export function statusAfter(elapsedMs: number): OrderStatus {
  let current: OrderStatus = 'Confirmed';
  for (const s of ORDER_STATUSES) if (elapsedMs >= STATUS_AT_MS[s]) current = s;
  return current;
}

export function nextStatus(s: OrderStatus): OrderStatus | null {
  const i = ORDER_STATUSES.indexOf(s);
  return i >= 0 && i < ORDER_STATUSES.length - 1 ? ORDER_STATUSES[i + 1] : null;
}

let orderSeq = 2841;

export const localOrderService: OrderService = {
  getRestaurants: () => RESTAURANTS,
  getRestaurant: (id) => RESTAURANTS.find((r) => r.id === id),
  getMenu: (restaurantId) => MENU.filter((d) => d.restaurantId === restaurantId),
  getDish: (id) => MENU.find((d) => d.id === id),
  unitPrice(dish, extraIds) {
    const extras = dish.extras
      .filter((e) => extraIds.includes(e.id))
      .reduce((sum, e) => sum + e.pricePence, 0);
    return dish.pricePence + extras;
  },
  totals(lines) {
    let subtotal = 0;
    let count = 0;
    let restaurantId: string | undefined;
    for (const l of lines) {
      const dish = this.getDish(l.dishId);
      if (!dish) continue;
      restaurantId = dish.restaurantId;
      subtotal += this.unitPrice(dish, l.extraIds) * l.qty;
      count += l.qty;
    }
    const r = restaurantId ? this.getRestaurant(restaurantId) : undefined;
    const free = r?.freeDeliveryOverPence != null && subtotal > r.freeDeliveryOverPence;
    const delivery = count === 0 ? 0 : free ? 0 : (r?.deliveryPence ?? 0);
    return {
      subtotalPence: subtotal,
      deliveryPence: delivery,
      totalPence: subtotal + delivery,
      itemCount: count,
    };
  },
  buildDemoOrder(lines, now = new Date()) {
    const snapshots: OrderLineSnapshot[] = [];
    let restaurantId: string | undefined;
    for (const l of lines) {
      const dish = this.getDish(l.dishId);
      if (!dish) continue;
      restaurantId = dish.restaurantId;
      snapshots.push({
        dishId: dish.id,
        name: dish.name,
        qty: l.qty,
        extras: dish.extras.filter((e) => l.extraIds.includes(e.id)).map((e) => e.label),
        unitPence: this.unitPrice(dish, l.extraIds),
      });
    }
    const r = restaurantId ? this.getRestaurant(restaurantId) : undefined;
    if (!r || snapshots.length === 0) return null;
    const t = this.totals(lines);
    const n = orderSeq++;
    return {
      id: `order-${now.getTime().toString(36)}-${n}`,
      number: `${n}`,
      restaurantId: r.id,
      restaurantName: r.name,
      lines: snapshots,
      subtotalPence: t.subtotalPence,
      deliveryPence: t.deliveryPence,
      totalPence: t.totalPence,
      status: 'Confirmed',
      placedAt: now.toISOString(),
      etaMin: ETA_BY_STATUS.Confirmed,
      rider: { ...RIDER },
      loggedToHealth: lines.some((l) => l.logToHealth),
      demo: true,
    };
  },
};

export const orderService: OrderService = localOrderService;
