import { useRef, useState } from 'react';
import { ArrowLeft, CheckCircle2, Inbox } from 'lucide-react';
import { useMyTasks, useTask, useCompleteTask, type MyTask, type TaskButton } from '@/lib/api/execution';
import { ReactForm, type ReactFormHandle } from '@/components/form/ReactForm';
import { toast } from '@/stores/toast';

/**
 * Geral › Tarefas pendentes (B3): inbox do executor — tarefas atribuídas a ele
 * para concluir (concluir avança o fluxo). Abrir renderiza o form-js em página
 * inteira (req. 3 — full-width) com os botões de conclusão sempre visíveis no
 * rodapé (req. 4).
 */
export function TarefasPage() {
  const tasks = useMyTasks();
  const [openId, setOpenId] = useState<string | null>(null);

  // Tarefa aberta ocupa toda a área de conteúdo (sem modal centralizado).
  if (openId) return <TaskView taskId={openId} onClose={() => setOpenId(null)} />;

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
                    <button type="button" onClick={() => setOpenId(t.id)} className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700">Abrir</button>
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

function TaskView({ taskId, onClose }: { taskId: string; onClose: () => void }) {
  const task = useTask(taskId);
  const complete = useCompleteTask();
  const fillRef = useRef<ReactFormHandle>(null);

  async function finish(button?: TaskButton) {
    const { data, errors } = fillRef.current?.submit() ?? { data: {}, errors: {} };
    if ((button?.validateForm ?? true) && Object.keys(errors).length) {
      toast.error('Preencha os campos obrigatórios.');
      return;
    }
    try {
      const r = await complete.mutateAsync({ id: taskId, data, action: button?.id });
      toast.success(r.executionStatus === 'concluido' ? 'Processo concluído.' : 'Tarefa concluída.');
      onClose();
    } catch { toast.error('Não foi possível concluir a tarefa.'); }
  }

  const buttons = task.data?.buttons ?? [];

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-3 border-b border-slate-200 bg-white px-6 py-4">
        <button type="button" onClick={onClose} className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800" title="Voltar para a lista">
          <ArrowLeft size={18} />
        </button>
        <h1 className="text-lg font-semibold text-slate-900">{task.data?.name ?? 'Tarefa'}</h1>
      </header>

      {/* Container ocupa toda a largura (req. 3) */}
      <main className="flex-1 overflow-auto p-6">
        <div className="rounded-md border border-slate-200 bg-white p-6">
          {task.isLoading ? <p className="text-sm text-slate-400">Carregando...</p> : <ReactForm ref={fillRef} schema={task.data?.formSchema} data={task.data?.data as Record<string, unknown> | undefined} />}
        </div>
      </main>

      {/* Botões de conclusão sempre visíveis no rodapé (req. 4) */}
      <footer className="flex justify-end gap-2 border-t border-slate-200 bg-white px-6 py-3">
        <button type="button" onClick={onClose} className="rounded-md border border-slate-300 px-3.5 py-1.5 text-sm">Fechar</button>
        {buttons.length === 0 ? (
          <button type="button" onClick={() => finish()} disabled={complete.isPending || task.isLoading} className="inline-flex items-center gap-1.5 rounded-md bg-slate-900 px-3.5 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60">
            <CheckCircle2 size={15} /> Concluir
          </button>
        ) : buttons.map((b) => (
          <button key={b.id} type="button" onClick={() => finish(b)} disabled={complete.isPending || task.isLoading}
            style={b.primaryColor ? { backgroundColor: b.primaryColor, color: b.textColor ?? '#fff' } : undefined}
            className={`rounded-md px-3.5 py-1.5 text-sm font-medium disabled:opacity-60 ${b.primaryColor ? '' : 'bg-slate-900 text-white hover:bg-slate-700'}`}>
            {b.label}
          </button>
        ))}
      </footer>
    </div>
  );
}
