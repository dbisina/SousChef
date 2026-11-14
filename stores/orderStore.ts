import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ETA_BY_STATUS, STATUS_AT_MS, nextStatus, orderService, statusAfter } from '@/services/orderService';
import type { CartTotals } from '@/services/orderService';
import { healthService } from '@/services/healthService';
import { useHealthStore } from '@/stores/healthStore';
import type { CartLine, Order } from '@/types/order';

interface AddOptions {
  qty?: number;
  extraIds?: string[];
  logToHealth?: boolean;
}

interface OrderState {
  cart: CartLine[];
  orders: Order[];

  addToOrder: (dishId: string, opts?: AddOptions) => void;
  setQty: (lineId: string, qty: number) => void;
  removeLine: (lineId: string) => void;
  setLogToHealth: (lineId: string, on: boolean) => void;
  clearCart: () => void;
  /** Place a demo order (no payment). Statuses then advance on a timer. */
  placeDemoOrder: () => Order | null;
  advanceOrder: (orderId: string) => void;
  /** Re-sync statuses from elapsed time and restart timers. Call on mount of tracking screens. */
  resumeOrderTimers: () => void;
}

const timers = new Map<string, ReturnType<typeof setTimeout>[]>();

function clearTimers(orderId: string) {
  (timers.get(orderId) ?? []).forEach(clearTimeout);
  timers.delete(orderId);
}

let lineSeq = 0;

export const useOrderStore = create<OrderState>()(
  persist(
    (set, get) => {
      const schedule = (order: Order) => {
        clearTimers(order.id);
        if (order.status === 'Arrived') return;
        const placed = new Date(order.placedAt).getTime();
        const handles: ReturnType<typeof setTimeout>[] = [];
        for (const status of ['Preparing', 'On the way', 'Arrived'] as const) {
          const delay = placed + STATUS_AT_MS[status] - Date.now();
          if (delay <= 0) continue;
          handles.push(setTimeout(() => get().advanceOrder(order.id), delay));
        }
        timers.set(order.id, handles);
      };

      return {
        cart: [],
        orders: [],

        addToOrder: (dishId, opts = {}) => {
          const dish = orderService.getDish(dishId);
          if (!dish) return;
          const extraIds = [...(opts.extraIds ?? [])].sort();
          const qty = Math.max(1, opts.qty ?? 1);
          set((s) => {
            // One restaurant per cart.
            const other = s.cart.some((l) => orderService.getDish(l.dishId)?.restaurantId !== dish.restaurantId);
            const base = other ? [] : s.cart;
            const same = base.find(
              (l) => l.dishId === dishId && [...l.extraIds].sort().join() === extraIds.join(),
            );
            if (same) {
              return {
                cart: base.map((l) =>
                  l.id === same.id
                    ? { ...l, qty: l.qty + qty, logToHealth: opts.logToHealth ?? l.logToHealth }
                    : l,
                ),
              };
            }
            return {
              cart: [
                ...base,
                { id: `line-${Date.now().toString(36)}-${lineSeq++}`, dishId, qty, extraIds, logToHealth: !!opts.logToHealth },
              ],
            };
          });
        },
        setQty: (lineId, qty) =>
          set((s) => ({
            cart:
              qty <= 0
                ? s.cart.filter((l) => l.id !== lineId)
                : s.cart.map((l) => (l.id === lineId ? { ...l, qty } : l)),
          })),
        removeLine: (lineId) => set((s) => ({ cart: s.cart.filter((l) => l.id !== lineId) })),
        setLogToHealth: (lineId, on) =>
          set((s) => ({ cart: s.cart.map((l) => (l.id === lineId ? { ...l, logToHealth: on } : l)) })),
        clearCart: () => set({ cart: [] }),

        placeDemoOrder: () => {
          const { cart } = get();
          const order = orderService.buildDemoOrder(cart);
          if (!order) return null;
          set((s) => ({ orders: [order, ...s.orders], cart: [] }));
          for (const line of cart.filter((l) => l.logToHealth)) {
            const dish = orderService.getDish(line.dishId);
            if (dish) useHealthStore.getState().logMeal(healthService.mealFromDish(dish, order.id));
          }
          schedule(order);
          return order;
        },

        advanceOrder: (orderId) => {
          const order = get().orders.find((o) => o.id === orderId);
          if (!order) return;
          const status = nextStatus(order.status);
          if (!status) return;
          set((s) => ({
            orders: s.orders.map((o) =>
              o.id === orderId ? { ...o, status, etaMin: ETA_BY_STATUS[status] } : o,
            ),
          }));
          if (status === 'Arrived') clearTimers(orderId);
        },

        resumeOrderTimers: () => {
          const now = Date.now();
          set((s) => ({
            orders: s.orders.map((o) => {
              const status = statusAfter(now - new Date(o.placedAt).getTime());
              return status === o.status ? o : { ...o, status, etaMin: ETA_BY_STATUS[status] };
            }),
          }));
          get().orders.forEach(schedule);
        },
      };
    },
    {
      name: 'souschef-orders-v1',
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
      onRehydrateStorage: () => (state) => state?.resumeOrderTimers(),
    },
  ),
);

export const selectCartTotals = (s: { cart: CartLine[] }): CartTotals => orderService.totals(s.cart);
/** Scalar selectors are safe with useOrderStore(sel). */
export const selectCartCount = (s: { cart: CartLine[] }): number => s.cart.reduce((n, l) => n + l.qty, 0);
export const selectCartSubtotalPence = (s: { cart: CartLine[] }): number =>
  orderService.totals(s.cart).subtotalPence;
export const selectOrder = (id: string) => (s: OrderState) => s.orders.find((o) => o.id === id);
export const selectLatestOrder = (s: OrderState): Order | undefined => s.orders[0];
