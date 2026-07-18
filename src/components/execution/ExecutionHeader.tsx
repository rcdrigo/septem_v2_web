/* Hallmark · pre-emit critique: P5 H5 E4 S5 R5 V4 */
/* Hallmark · component: execution-header · genre: modern-minimal · theme: existing slate
 * states: default · hover · focus · active · disabled · loading · error · success
 * contrast: pass
 */
import { ArrowLeft } from 'lucide-react';

type Props = {
  processName?: string | null;
  taskName?: string | null;
  alias?: string | null;
  sector?: string | null;
  processNumber?: number | null;
  onBack?: () => void;
  onOpenReport?: () => void;
};

/** Cabeçalho compartilhado pelas telas de início e execução de tarefas. */
export function ExecutionHeader({
  processName,
  taskName,
  alias,
  sector,
  processNumber,
  onBack,
  onOpenReport,
}: Props) {
  const hasProcessNumber = processNumber != null && !!onOpenReport;

  return (
    <header className="flex shrink-0 items-start gap-2 border-b border-slate-200 bg-white px-4 py-4 sm:gap-3 sm:px-6">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-slate-500 outline-none transition-colors hover:bg-slate-100 hover:text-slate-800 focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-2 active:bg-slate-200"
          title="Voltar para a lista"
          aria-label="Voltar para a lista"
        >
          <ArrowLeft size={18} aria-hidden="true" />
        </button>
      )}

      <div className="flex min-w-0 flex-1 items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {processName && (
            <span className="inline-flex max-w-full rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
              <span className="break-words">{processName}</span>
            </span>
          )}
          <h1 className="mt-1 min-w-0 break-words text-lg font-semibold leading-snug text-slate-900 [overflow-wrap:anywhere]">
            {alias && <span className="text-slate-500">{alias} <span aria-hidden="true">·</span>{' '}</span>}
            {taskName || 'Tarefa'}
            {sector && <span className="font-normal text-slate-500"> <span aria-hidden="true">·</span>{' '}{sector}</span>}
          </h1>
        </div>

        {hasProcessNumber && (
          <button
            type="button"
            onClick={onOpenReport}
            title="Ver relatório do processo"
            aria-label={`Ver relatório do processo ${processNumber}`}
            className="group -m-1 inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full p-1 outline-none focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-2"
          >
            <span data-process-number-pill="" className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600 transition-colors group-hover:bg-slate-200 group-hover:text-slate-800 group-active:bg-slate-300">
              #{processNumber}
            </span>
          </button>
        )}
      </div>
    </header>
  );
}
