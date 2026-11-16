import { create } from 'zustand';

interface ShareIntentState {
  sharedURL: string | null;
  setSharedURL: (url: string | null) => void;
  consumeSharedURL: () => string | null;
}

export const useShareIntentStore = create<ShareIntentState>((set, get) => ({
  sharedURL: null,

  setSharedURL: (url) => set({ sharedURL: url }),

  consumeSharedURL: () => {
    const url = get().sharedURL;
    set({ sharedURL: null });
    return url;
  },
}));
