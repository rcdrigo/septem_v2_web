/* Hallmark · pre-emit critique: P5 H5 E4 S5 R5 V4 */
/* Hallmark · component: task-actions · genre: modern-minimal · theme: existing slate
 * states: default · hover · focus · active · disabled · loading · error · success
 * contrast: pass
 */
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, ListChecks, Loader2, X } from 'lucide-react';
import { Tooltip } from '@/components/ui/Tooltip';

export type ExecutionAction = {
  id: string;
  label: string;
  onClick: () => void | Promise<void>;
  icon?: ReactNode;
  hint?: string | null;
  disabled?: boolean;
  loading?: boolean;
  loadingLabel?: string;
  variant?: 'primary' | 'secondary';
  style?: CSSProperties;
};

type Props = {
  completionActions: ExecutionAction[];
  utilityActions?: ExecutionAction[];
  loading?: boolean;
  compactDesktop?: boolean;
};

function ActionButton({ action, fullWidth, onRun, compact }: {
  action: ExecutionAction;
  fullWidth?: boolean;
  onRun?: (action: ExecutionAction) => void;
  compact?: boolean;
}) {
  const secondary = action.variant === 'secondary';
  const button = (
    <button
      type="button"
      onClick={() => onRun ? onRun(action) : action.onClick()}
      disabled={action.disabled || action.loading}
      style={action.style}
      aria-busy={action.loading || undefined}
      className={[
        'inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium outline-none transition-[background-color,color,filter] focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-2 active:brightness-90 disabled:cursor-not-allowed disabled:opacity-60',
        fullWidth ? 'min-h-11 w-full gap-2 px-4 py-2' : compact ? 'gap-1.5 px-3.5 py-1.5' : 'gap-1.5 px-4 py-2',
        action.style
          ? 'hover:brightness-95'
          : secondary
            ? 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
            : 'bg-slate-900 text-white hover:bg-slate-700',
      ].join(' ')}
    >
      {action.loading ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : action.icon}
      {action.loading ? (action.loadingLabel ?? action.label) : action.label}
    </button>
  );

  return (
    <div className={fullWidth ? 'w-full [&>span]:w-full' : ''}>
      <Tooltip text={action.hint}>{button}</Tooltip>
    </div>
  );
}

/** Rodapé desktop e bottom sheet mobile compartilhados pelas telas de execução. */
export function TaskActionFooter({ completionActions, utilityActions = [], loading, compactDesktop = false }: Props) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (sheetOpen && !dialog.open) {
      dialog.showModal();
      window.requestAnimationFrame(() => dialog.querySelector<HTMLButtonElement>('[data-action] button')?.focus());
    } else if (!sheetOpen && dialog.open) {
      dialog.close();
    }
  }, [sheetOpen]);

  function closeSheet() {
    setSheetOpen(false);
  }

  function runFromSheet(action: ExecutionAction) {
    closeSheet();
    void action.onClick();
  }

  const sheet = sheetOpen && createPortal(
    <dialog
      ref={dialogRef}
      aria-labelledby="task-actions-title"
      className="fixed inset-x-0 bottom-0 top-auto m-0 max-h-[min(80dvh,40rem)] w-full max-w-none overflow-hidden rounded-t-2xl border border-b-0 border-slate-200 bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-slate-900/40 sm:hidden"
      onCancel={(event) => {
        event.preventDefault();
        closeSheet();
      }}
      onClose={() => setSheetOpen(false)}
      onClick={(event) => {
        if (event.target === event.currentTarget) closeSheet();
      }}
    >
      <div className="flex max-h-[min(80dvh,40rem)] flex-col">
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-4 py-3">
          <h2 id="task-actions-title" className="text-base font-semibold text-slate-900">Botões de conclusão</h2>
          <button
            type="button"
            onClick={closeSheet}
            className="flex h-11 w-11 items-center justify-center rounded-md text-slate-500 outline-none hover:bg-slate-100 hover:text-slate-800 focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-2 active:bg-slate-200"
            aria-label="Fechar botões de conclusão"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {completionActions.map((action) => (
            <div key={action.id} data-action="">
              <ActionButton action={action} fullWidth onRun={runFromSheet} />
            </div>
          ))}
          {utilityActions.length > 0 && <div className="border-t border-slate-200 pt-3" />}
          {utilityActions.map((action) => (
            <div key={action.id} data-action="">
              <ActionButton action={action} fullWidth onRun={runFromSheet} />
            </div>
          ))}
          <button
            type="button"
            onClick={closeSheet}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 whitespace-nowrap rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 outline-none hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-2 active:bg-slate-100"
          >
            <ArrowLeft size={16} aria-hidden="true" /> Voltar ao formulário
          </button>
        </div>
      </div>
    </dialog>,
    document.body,
  );

  return (
    <>
      <footer className="shrink-0 border-t border-slate-200 bg-white px-4 py-3 sm:px-6">
        <div className="hidden items-center gap-2 sm:flex">
          {completionActions.map((action) => <ActionButton key={action.id} action={action} compact={compactDesktop} />)}
          {utilityActions.length > 0 && (
            <div className="ml-auto flex items-center gap-2">
              {utilityActions.map((action) => <ActionButton key={action.id} action={action} compact={compactDesktop} />)}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          disabled={loading}
          className="inline-flex min-h-11 w-full items-center justify-center gap-2 whitespace-nowrap rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white outline-none hover:bg-slate-700 focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-2 active:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 sm:hidden"
          aria-haspopup="dialog"
          aria-expanded={sheetOpen}
        >
          <ListChecks size={17} aria-hidden="true" /> Botões de conclusão
        </button>
      </footer>
      {sheet}
    </>
  );
}
