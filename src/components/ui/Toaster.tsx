import { CheckCircle2, Info, TriangleAlert, X, XCircle } from 'lucide-react';
import { useToastStore, type ToastKind } from '@/stores/toast';

const ICONS: Record<ToastKind, typeof CheckCircle2> = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
  warning: TriangleAlert,
};

const COLORS: Record<ToastKind, { ring: string; icon: string }> = {
  success: { ring: 'border-emerald-200 bg-emerald-50', icon: 'text-emerald-600' },
  error: { ring: 'border-rose-200 bg-rose-50', icon: 'text-rose-600' },
  info: { ring: 'border-sky-200 bg-sky-50', icon: 'text-sky-600' },
  warning: { ring: 'border-amber-200 bg-amber-50', icon: 'text-amber-600' },
};

/**
 * Stack de toasts no canto inferior-direito. Cada toast tem auto-dismiss
 * (TTL gerenciado pelo store).
 */
export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  return (
    <div
      className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-[360px] flex-col gap-2"
      aria-live="polite"
    >
      {toasts.map((t) => {
        const Icon = ICONS[t.kind];
        const colors = COLORS[t.kind];
        return (
          <div
            key={t.id}
            role="status"
            className={[
              'pointer-events-auto flex items-start gap-3 rounded-md border bg-white px-3 py-2 shadow-lg transition-all',
              colors.ring,
            ].join(' ')}
          >
            <Icon size={18} className={colors.icon + ' mt-0.5 shrink-0'} />
            <div className="flex-1 text-sm text-slate-800">{t.message}</div>
            {t.actionLabel && (
              <button
                type="button"
                onClick={() => {
                  t.onAction?.();
                  dismiss(t.id);
                }}
                className="text-xs font-semibold text-slate-700 hover:underline"
              >
                {t.actionLabel}
              </button>
            )}
            <button
              type="button"
              aria-label="Fechar"
              onClick={() => dismiss(t.id)}
              className="text-slate-400 hover:text-slate-600"
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
