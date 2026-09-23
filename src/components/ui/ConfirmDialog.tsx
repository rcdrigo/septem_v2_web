import { useRef } from 'react';
import { Dialog as BaseDialog } from '@base-ui/react/dialog';
import { create } from 'zustand';
import { TriangleAlert } from 'lucide-react';

type ConfirmState = {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  destructive: boolean;
  resolver: ((ok: boolean) => void) | null;
};

const useConfirmStore = create<ConfirmState & {
  ask: (opts: Omit<ConfirmState, 'open' | 'resolver'>) => Promise<boolean>;
  resolve: (ok: boolean) => void;
}>((set, get) => ({
  open: false,
  title: '',
  message: '',
  confirmLabel: 'Confirmar',
  cancelLabel: 'Cancelar',
  destructive: false,
  resolver: null,
  ask: (opts) => {
    return new Promise<boolean>((resolve) => {
      set({ ...opts, open: true, resolver: resolve });
    });
  },
  resolve: (ok) => {
    const r = get().resolver;
    if (r) r(ok);
    set({ open: false, resolver: null });
  },
}));

/**
 * Substitui `window.confirm()` por um modal estilizado. Retorna Promise<boolean>.
 *
 * @example
 *   const ok = await confirm({
 *     title: 'Descartar diagrama?',
 *     message: 'Esta ação não pode ser desfeita.',
 *     destructive: true,
 *   });
 *   if (!ok) return;
 */
export function confirm(opts: {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}): Promise<boolean> {
  return useConfirmStore.getState().ask({
    title: opts.title,
    message: opts.message,
    confirmLabel: opts.confirmLabel ?? 'Confirmar',
    cancelLabel: opts.cancelLabel ?? 'Cancelar',
    destructive: opts.destructive ?? false,
  });
}

export function ConfirmDialogHost() {
  const { open, title, message, confirmLabel, cancelLabel, destructive, resolve } = useConfirmStore();

  const cancelRef = useRef<HTMLButtonElement>(null);

  return (
    <BaseDialog.Root open={open} disablePointerDismissal onOpenChange={(next) => { if (!next) resolve(false); }}>
      <BaseDialog.Portal>
        <BaseDialog.Backdrop className="fixed inset-0 z-[1100] bg-slate-900/40" />
        <BaseDialog.Viewport className="fixed inset-0 z-[1100] flex items-center justify-center p-4">
          <BaseDialog.Popup initialFocus={cancelRef} className="max-h-full w-full max-w-md overflow-y-auto rounded-lg bg-white shadow-2xl">
            <div className="flex items-start gap-3 p-5">
              {destructive && (
                <div className="mt-0.5 rounded-full bg-rose-50 p-1.5 text-rose-600">
                  <TriangleAlert size={20} />
                </div>
              )}
              <div className="flex-1">
                <BaseDialog.Title className="text-base font-semibold text-slate-900">{title}</BaseDialog.Title>
                <BaseDialog.Description className="mt-1 text-sm text-slate-600">{message}</BaseDialog.Description>
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50 px-4 py-3">
              <BaseDialog.Close
                ref={cancelRef}
                type="button"
                className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                {cancelLabel}
              </BaseDialog.Close>
              <button
                type="button"
                onClick={() => resolve(true)}
                className={[
                  'rounded-md px-3 py-1.5 text-sm font-medium text-white',
                  destructive
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : 'bg-slate-900 hover:bg-slate-800',
                ].join(' ')}
              >
                {confirmLabel}
              </button>
            </div>
          </BaseDialog.Popup>
        </BaseDialog.Viewport>
      </BaseDialog.Portal>
    </BaseDialog.Root>
  );
}
