import { useRef, useState } from 'react';
import { CheckCircle2, Inbox } from 'lucide-react';
import { useMyTasks, useTask, useCompleteTask, type MyTask, type TaskButton } from '@/lib/api/execution';
import { FormFill, type FormFillHandle } from '@/components/form/FormFill';
import { Dialog } from '@/components/ui/Dialog';
import { toast } from '@/stores/toast';

/**
 * Geral › Tarefas (B3): tarefas pendentes do usuário. Abrir renderiza o form-js
 * com os dados atuais; concluir (por botão) avança o fluxo.
 */
export function TarefasPage() {
  const tasks = useMyTasks();
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-slate-200 bg-white px-6 py-4">
        <h1 className="text-lg font-semibold text-slate-900">Tarefas</h1>
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
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-2 text-left">Tarefa</th><th className="px-4 py-2 text-left">Recebida</th><th className="px-4 py-2 w-24" /></tr></thead>
            <tbody>
              {tasks.isLoading && <tr><td colSpan={3} className="px-4 py-8 text-center text-slate-400">Carregando...</td></tr>}
              {tasks.data?.map((t: MyTask) => (
                <tr key={t.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-2 font-medium text-slate-800">{t.name ?? 'Tarefa'}</td>
                  <td className="px-4 py-2 text-slate-500">{new Date(t.createdAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</td>
                  <td className="px-4 py-2 text-right">
                    <button type="button" onClick={() => setOpenId(t.id)} className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700">Abrir</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {openId && <TaskDialog taskId={openId} onClose={() => setOpenId(null)} />}
    </div>
  );
}

function TaskDialog({ taskId, onClose }: { taskId: string; onClose: () => void }) {
  const task = useTask(taskId);
  const complete = useCompleteTask();
  const fillRef = useRef<FormFillHandle>(null);

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
    <Dialog open onClose={onClose} width="lg" title={task.data?.name ?? 'Tarefa'} footer={
      <>
        <button onClick={onClose} className="rounded-md border border-slate-300 px-3.5 py-1.5 text-sm">Fechar</button>
        {buttons.length === 0 ? (
          <button onClick={() => finish()} disabled={complete.isPending} className="inline-flex items-center gap-1.5 rounded-md bg-slate-900 px-3.5 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60">
            <CheckCircle2 size={15} /> Concluir
          </button>
        ) : buttons.map((b) => (
          <button key={b.id} onClick={() => finish(b)} disabled={complete.isPending}
            style={b.primaryColor ? { backgroundColor: b.primaryColor, color: b.textColor ?? '#fff' } : undefined}
            className={`rounded-md px-3.5 py-1.5 text-sm font-medium disabled:opacity-60 ${b.primaryColor ? '' : 'bg-slate-900 text-white hover:bg-slate-700'}`}>
            {b.label}
          </button>
        ))}
      </>
    }>
      {task.isLoading ? <p className="text-sm text-slate-400">Carregando...</p> : <FormFill ref={fillRef} schema={task.data?.formSchema} data={task.data?.data} />}
    </Dialog>
  );
}
