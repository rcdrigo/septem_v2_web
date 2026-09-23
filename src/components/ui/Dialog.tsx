import { type ReactNode } from 'react';
import { Dialog as BaseDialog } from '@base-ui/react/dialog';
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

/** Modal com foco contido, retorno ao disparador e fechamento por Escape. */
export function Dialog({ open, onClose, title, children, footer, width = 'md', bodyClassName }: Props) {
  const widthClass =
    width === 'sm' ? 'max-w-md'
    : width === 'lg' ? 'max-w-2xl'
    : width === 'xl' ? 'max-w-4xl'
    : width === '2xl' ? 'max-w-6xl'
    : 'max-w-lg';

  return (
    <BaseDialog.Root open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <BaseDialog.Portal>
        <BaseDialog.Backdrop className="fixed inset-0 z-[1000] bg-slate-900/40" />
        <BaseDialog.Viewport className="fixed inset-0 z-[1000] flex items-center justify-center px-4 py-4">
          {/* max-h + corpo rolável: conteúdo maior que a viewport (comum no mobile) rola
              dentro do modal em vez de estourar — sem isso, título e rodapé ficam cortados
              e inacessíveis (o container centraliza e o overflow-hidden corta as pontas). */}
          <BaseDialog.Popup
            className={`flex max-h-full w-full ${widthClass} flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg`}
          >
            <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-5 py-3">
              <BaseDialog.Title className="text-base font-semibold text-slate-900">{title}</BaseDialog.Title>
              <BaseDialog.Close
                type="button"
                className="relative rounded p-1 text-slate-400 before:absolute before:-inset-2 hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-700 active:bg-slate-200"
                aria-label="Fechar"
              >
                <X size={18} />
              </BaseDialog.Close>
            </div>
            <div className={bodyClassName ?? 'min-h-0 flex-1 overflow-y-auto px-5 py-4'}>{children}</div>
            {footer && <div className="flex shrink-0 items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3">{footer}</div>}
          </BaseDialog.Popup>
        </BaseDialog.Viewport>
      </BaseDialog.Portal>
    </BaseDialog.Root>
  );
}
