import { CheckCircle2, Info, TriangleAlert, X, XCircle } from 'lucide-react';
import { useToastStore, type ToastKind } from '@/stores/toast';

const ICONS: Record<ToastKind, typeof CheckCircle2> = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
  warning: TriangleAlert,
  neutral: Info,
};

const COLORS: Record<ToastKind, { ring: string; foreground: string }> = {
  success: { ring: 'border-emerald-200 bg-emerald-50', foreground: 'text-emerald-800' },
  error: { ring: 'border-rose-200 bg-rose-50', foreground: 'text-rose-800' },
  info: { ring: 'border-sky-200 bg-sky-50', foreground: 'text-sky-800' },
  warning: { ring: 'border-yellow-200 bg-yellow-50', foreground: 'text-yellow-800' },
  neutral: { ring: 'border-gray-200 bg-gray-50', foreground: 'text-gray-800' },
};

/**
 * Stack de toasts centralizada no topo da página. Cada toast tem auto-dismiss
 * (TTL gerenciado pelo store).
 */
export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  return (
    <div
      className="pointer-events-none fixed top-4 left-1/2 z-[1100] flex w-max max-w-[calc(100%-2rem)] -translate-x-1/2 flex-col items-center gap-2"
      aria-live="polite"
    >
      {toasts.map((t) => {
        const Icon = ICONS[t.kind] ?? ICONS.neutral;
        const colors = COLORS[t.kind] ?? COLORS.neutral;
        return (
          <div
            key={t.id}
            role="status"
            className={[
              'pointer-events-auto flex max-w-full items-start gap-3 rounded-md border px-3 py-2 shadow-lg transition-all',
              colors.ring,
              colors.foreground,
            ].join(' ')}
          >
            <Icon size={18} className="mt-0.5 shrink-0" />
            <div className="min-w-0 flex-1 break-words text-sm font-bold">{t.message}</div>
            {t.actionLabel && (
              <button
                type="button"
                onClick={() => {
                  t.onAction?.();
                  dismiss(t.id);
                }}
                className="shrink-0 text-xs font-bold hover:underline"
              >
                {t.actionLabel}
              </button>
            )}
            <button
              type="button"
              aria-label="Fechar"
              onClick={() => dismiss(t.id)}
              className="mt-0.5 shrink-0 hover:opacity-75"
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
