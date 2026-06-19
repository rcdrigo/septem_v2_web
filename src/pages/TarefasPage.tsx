import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, CheckCircle2, Inbox, LifeBuoy, ExternalLink, X } from 'lucide-react';
import { useMyTasks, useTask, useCompleteTask, type MyTask, type TaskButton } from '@/lib/api/execution';
import { ReactForm, FormSkeleton, type ReactFormHandle } from '@/components/form/ReactForm';
import { Tooltip } from '@/components/ui/Tooltip';
import { renderIcon } from '@/lib/icon-catalog';
import { toast } from '@/stores/toast';

/**
 * Geral › Tarefas pendentes (B3): inbox do executor — tarefas atribuídas a ele
 * para concluir (concluir avança o fluxo). Abrir renderiza o form-js em página
 * inteira (req. 3 — full-width) com os botões de conclusão sempre visíveis no
 * rodapé (req. 4).
 */
export function TarefasPage() {
  const tasks = useMyTasks();

  // Abrir uma tarefa: nova aba, sem menus laterais (rota /tarefa/:id), como a de início.
  const openTask = (id: string) => window.open(`/tarefa/${id}`, '_blank', 'noopener');

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-slate-200 bg-white px-6 py-4">
        <h1 className="text-lg font-semibold text-slate-900">Tarefas pendentes</h1>
      </header>
      <div className="flex-1 overflow-auto p-6">
        {!tasks.isLoading && (tasks.data?.length ?? 0) === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-400"><Inbox size={26} /></div>
            <p className="text-sm font-medium text-slate-700">Nenhuma tarefa pendente</p>
            <p className="mt-1 text-sm text-slate-500">Tarefas atribuídas a você aparecem aqui.</p>
          </div>
        ) : (
          <table className="w-full overflow-hidden rounded-md border border-slate-200 bg-white text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-2 text-left">Tarefa</th><th className="px-4 py-2 text-left">Recebida</th><th className="px-4 py-2 text-left">Prazo</th><th className="px-4 py-2 w-24" /></tr></thead>
            <tbody>
              {tasks.isLoading && <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400">Carregando...</td></tr>}
              {tasks.data?.map((t: MyTask) => (
                <tr key={t.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-2 font-medium text-slate-800">{t.name ?? 'Tarefa'}</td>
                  <td className="px-4 py-2 text-slate-500">{new Date(t.createdAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</td>
                  <td className="px-4 py-2"><Prazo dueAt={t.dueAt} /></td>
                  <td className="px-4 py-2 text-right">
                    <button type="button" onClick={() => openTask(t.id)} className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700">Abrir</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

/** Prazo da tarefa com destaque de atrasado. */
function Prazo({ dueAt }: { dueAt: string | null }) {
  if (!dueAt) return <span className="text-xs text-slate-400">—</span>;
  const due = new Date(dueAt);
  const overdue = due.getTime() < Date.now();
  return (
    <span className={`text-xs font-medium ${overdue ? 'text-rose-600' : 'text-slate-500'}`}>
      {overdue && '⚠ '}{due.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
    </span>
  );
}

export function TaskView({ taskId, onClose }: { taskId: string; onClose: () => void }) {
  const task = useTask(taskId);
  const complete = useCompleteTask();
  const fillRef = useRef<ReactFormHandle>(null);
  const [done, setDone] = useState<{ nextTaskForMe?: string | null; executionId?: string } | null>(null);

  async function finish(button?: TaskButton) {
    const { data, errors } = fillRef.current?.submit() ?? { data: {}, errors: {} };
    if ((button?.validateForm ?? true) && Object.keys(errors).length) {
      toast.error('Preencha os campos obrigatórios.');
      return;
    }
    try {
      const r = await complete.mutateAsync({ id: taskId, data, action: button?.id });
      setDone({ nextTaskForMe: r.nextTaskForMe, executionId: r.executionId });
    } catch { toast.error('Não foi possível concluir a tarefa.'); }
  }

  if (done) return <CompletionScreen next={done.nextTaskForMe} executionId={done.executionId} onClose={onClose} />;

  const buttons = task.data?.buttons ?? [];

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-3 border-b border-slate-200 bg-white px-6 py-4">
        <button type="button" onClick={onClose} className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800" title="Voltar para a lista">
          <ArrowLeft size={18} />
        </button>
        <div className="flex flex-col">
          {task.data?.process && <span className="text-sm font-medium text-slate-500">{task.data.process}</span>}
          <h1 className="text-lg font-semibold text-slate-900">{task.data?.name ?? 'Tarefa'}</h1>
        </div>
      </header>

      {/* Cada grupo renderiza seu próprio card (sem container único). */}
      <main className="flex-1 overflow-auto p-6">
        {task.data?.documentationUrl && <DocBanner url={task.data.documentationUrl} />}
        {task.isLoading ? <FormSkeleton /> : <ReactForm ref={fillRef} schema={task.data?.formSchema} data={task.data?.data as Record<string, unknown> | undefined} />}
      </main>

      {/* Botões de conclusão sempre visíveis no rodapé (req. 4) */}
      <footer className="flex justify-start gap-2 border-t border-slate-200 bg-white px-6 py-3">
        {buttons.length === 0 ? (
          <button type="button" onClick={() => finish()} disabled={complete.isPending || task.isLoading} className="inline-flex items-center gap-1.5 rounded-md bg-slate-900 px-3.5 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60">
            <CheckCircle2 size={15} /> Concluir
          </button>
        ) : buttons.map((b) => (
          <Tooltip key={b.id} text={b.hint}>
            <button type="button" onClick={() => finish(b)} disabled={complete.isPending || task.isLoading}
              style={b.primaryColor ? { backgroundColor: b.primaryColor, color: b.textColor ?? '#fff' } : undefined}
              className={`inline-flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-sm font-medium disabled:opacity-60 ${b.primaryColor ? '' : 'bg-slate-900 text-white hover:bg-slate-700'}`}>
              {renderIcon(b.icon, 15)}
              {b.label}
            </button>
          </Tooltip>
        ))}
        <button type="button" onClick={onClose} className="rounded-md border border-slate-300 px-3.5 py-1.5 text-sm">Fechar</button>
      </footer>
    </div>
  );
}

/**
 * Tela de conclusão (#37): se a próxima tarefa é do mesmo usuário, avisa e
 * carrega-a em segundos; senão, oferece fechar ou acompanhar o processo (relatório
 * da instância em nova aba).
 */
export function CompletionScreen({ next, executionId, onClose }: { next?: string | null; executionId?: string; onClose: () => void }) {
  useEffect(() => {
    if (!next) return;
    const t = setTimeout(() => window.location.assign(`/tarefa/${next}`), 2500);
    return () => clearTimeout(t);
  }, [next]);

  return (
    <div className="flex h-full items-center justify-center bg-slate-100 p-6">
      <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
          <CheckCircle2 size={28} />
        </div>
        <h2 className="text-lg font-semibold text-slate-900">Solicitação iniciada com sucesso!</h2>
        {next ? (
          <p className="mt-2 text-sm text-slate-600">Uma nova tarefa é sua responsabilidade e será carregada em poucos segundos…</p>
        ) : (
          <>
            <p className="mt-2 text-sm text-slate-600">Você pode acompanhar o andamento do processo a qualquer momento.</p>
            <div className="mt-5 flex justify-center gap-2">
              <button type="button" onClick={onClose} className="rounded-md border border-slate-300 px-3.5 py-1.5 text-sm">Fechar</button>
              {executionId && (
                <button type="button" onClick={() => window.open(`/solicitacao/${executionId}`, '_blank', 'noopener')}
                  className="inline-flex items-center gap-1.5 rounded-md bg-slate-900 px-3.5 py-1.5 text-sm font-medium text-white hover:bg-slate-700">
                  <ExternalLink size={14} /> Acompanhar processo
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/** Aviso de documentação do processo (dispensável); abre o guia em nova aba. */
function DocBanner({ url }: { url: string }) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;
  return (
    <div className="mb-4 flex items-center gap-4 rounded-lg border border-sky-200 bg-sky-50 p-4">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sky-600">
        <LifeBuoy size={26} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-slate-800">Está com dúvidas de como iniciar este serviço?</p>
        <p className="text-sm text-slate-600">Acesse nosso guia e entenda como solicitar o serviço de forma fácil e rápida!</p>
      </div>
      <a href={url} target="_blank" rel="noopener noreferrer"
        className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-sky-600 px-3.5 py-1.5 text-sm font-medium text-white hover:bg-sky-700">
        <ExternalLink size={14} /> Abrir guia
      </a>
      <button type="button" onClick={() => setDismissed(true)} aria-label="Dispensar" className="rounded p-1 text-slate-400 hover:bg-sky-100 hover:text-slate-600">
        <X size={16} />
      </button>
    </div>
  );
}
