import { useEffect, useId, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  width?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  bodyClassName?: string;
};

/**
 * Dialog modal simples. Esc fecha; clique fora também. Não tenta resolver
 * acessibilidade total (focus trap, aria) — só o suficiente pra formulários
 * curtos das telas de Configurações.
 */
export function Dialog({ open, onClose, title, children, footer, width = 'md', bodyClassName }: Props) {
  const titleId = useId();
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const widthClass =
    width === 'sm' ? 'max-w-md'
    : width === 'lg' ? 'max-w-2xl'
    : width === 'xl' ? 'max-w-4xl'
    : width === '2xl' ? 'max-w-6xl'
    : 'max-w-lg';

  // Portal para o body: evita que o modal fique "preso" dentro de ancestrais com
  // transform (ex.: o sidenav off-canvas) — garante centralização na viewport.
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-900/40 px-4 py-4"
      onClick={onClose}
    >
      {/* max-h + corpo rolável: conteúdo maior que a viewport (comum no mobile) rola
          dentro do modal em vez de estourar — sem isso, título e rodapé ficam cortados
          e inacessíveis (o container centraliza e o overflow-hidden corta as pontas). */}
      <div
        className={`flex max-h-full w-full ${widthClass} flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-5 py-3">
          <h2 id={titleId} className="text-base font-semibold text-slate-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="relative rounded p-1 text-slate-400 before:absolute before:-inset-2 hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-700 active:bg-slate-200"
            aria-label="Fechar"
          >
            <X size={18} />
          </button>
        </div>
        <div className={bodyClassName ?? 'min-h-0 flex-1 overflow-y-auto px-5 py-4'}>{children}</div>
        {footer && <div className="flex shrink-0 items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
