import { create } from 'zustand';
import { uid } from '@/lib/uid';

export type ToastKind = 'success' | 'error' | 'info' | 'warning';

export type Toast = {
  id: string;
  kind: ToastKind;
  message: string;
  /** Texto opcional do botão de ação (ex: "Desfazer"). */
  actionLabel?: string;
  onAction?: () => void;
};

type ToastState = {
  toasts: Toast[];
  push: (t: Omit<Toast, 'id'>) => string;
  dismiss: (id: string) => void;
};

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push: (t) => {
    const id = uid('toast');
    set((s) => ({ toasts: [...s.toasts, { id, ...t }] }));
    return id;
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

/**
 * API ergonômica usada em qualquer lugar do app sem ter que importar o store.
 */
export const toast = {
  success: (msg: string) => pushAndAutoDismiss('success', msg),
  error: (msg: string) => pushAndAutoDismiss('error', msg),
  info: (msg: string) => pushAndAutoDismiss('info', msg),
  warning: (msg: string) => pushAndAutoDismiss('warning', msg),
};

function pushAndAutoDismiss(kind: ToastKind, message: string) {
  const id = useToastStore.getState().push({ kind, message });
  const ttl = kind === 'error' ? 6000 : 3500;
  window.setTimeout(() => useToastStore.getState().dismiss(id), ttl);
  return id;
}
