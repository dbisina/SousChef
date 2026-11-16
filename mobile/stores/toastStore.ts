import { create } from 'zustand';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastState {
    visible: boolean;
    message: string;
    type: ToastType;
    title?: string;
    duration?: number;
    showToast: (message: string, options?: { type?: ToastType; title?: string; duration?: number }) => void;
    hideToast: () => void;
}

export const useToastStore = create<ToastState>((set) => ({
    visible: false,
    message: '',
    type: 'info',
    title: undefined,
    duration: 3000,

    showToast: (message, options = {}) => {
        const { type = 'info', title, duration = 3000 } = options;
        set({
            visible: true,
            message,
            type,
            title,
            duration,
        });

        // Auto-hide after duration
        if (duration > 0) {
            setTimeout(() => {
                set({ visible: false });
            }, duration);
        }
    },

    hideToast: () => set({ visible: false }),
}));

// Helper functions for easier access
export const showSuccessToast = (message: string, title: string = 'Success!') =>
    useToastStore.getState().showToast(message, { type: 'success', title });

export const showErrorToast = (message: string, title: string = 'Oops!') =>
    useToastStore.getState().showToast(message, { type: 'error', title });

export const showInfoToast = (message: string, title?: string) =>
    useToastStore.getState().showToast(message, { type: 'info', title });

export const showWarningToast = (message: string, title: string = 'Wait!') =>
    useToastStore.getState().showToast(message, { type: 'warning', title });
