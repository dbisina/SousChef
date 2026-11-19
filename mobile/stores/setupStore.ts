import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface SetupState {
  /** True once the setup screen was finished or skipped. */
  setupDone: boolean;
  markSetupDone: () => void;
}

export const useSetupStore = create<SetupState>()(
  persist(
    (set) => ({
      setupDone: false,
      markSetupDone: () => set({ setupDone: true }),
    }),
    {
      name: '@souschef_setup',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
