import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const DEFAULT_DELIVERY_RADIUS_KM = 5;
export const MIN_DELIVERY_RADIUS_KM = 1;
export const MAX_DELIVERY_RADIUS_KM = 20;

interface SetupState {
  /** Food-delivery search radius used by the Home feed. */
  deliveryRadiusKm: number;
  /** True once the setup screen was finished or skipped. */
  setupDone: boolean;
  setDeliveryRadiusKm: (km: number) => void;
  markSetupDone: () => void;
}

export const useSetupStore = create<SetupState>()(
  persist(
    (set) => ({
      deliveryRadiusKm: DEFAULT_DELIVERY_RADIUS_KM,
      setupDone: false,
      setDeliveryRadiusKm: (km) =>
        set({
          deliveryRadiusKm: Math.min(MAX_DELIVERY_RADIUS_KM, Math.max(MIN_DELIVERY_RADIUS_KM, Math.round(km))),
        }),
      markSetupDone: () => set({ setupDone: true }),
    }),
    {
      name: '@souschef_setup',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
