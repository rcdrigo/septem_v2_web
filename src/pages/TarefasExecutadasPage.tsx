import { useState } from 'react';
import { ClipboardCheck } from 'lucide-react';
import { useExecutedTasks, type ExecutedTask } from '@/lib/api/execution';
import { InstanceDialog } from '@/pages/InstanciasPage';

/**
 * Geral › Tarefas executadas: tarefas que o usuário concluiu (não estão mais com
 * ele). Clicar abre o detalhe da instância a que a tarefa pertence.
 */
export function TarefasExecutadasPage() {
  const tasks = useExecutedTasks();
  const [openInstance, setOpenInstance] = useState<string | null>(null);
  const empty = !tasks.isLoading && (tasks.data?.length ?? 0) === 0;

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-slate-200 bg-white px-6 py-4">
        <h1 className="text-lg font-semibold text-slate-900">Tarefas executadas</h1>
      </header>
      <div className="flex-1 overflow-auto p-6">
        {empty ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-400"><ClipboardCheck size={26} /></div>
            <p className="text-sm font-medium text-slate-700">Nenhuma tarefa executada</p>
            <p className="mt-1 text-sm text-slate-500">As tarefas que você concluir aparecem aqui.</p>
          </div>
        ) : (
          <table className="w-full overflow-hidden rounded-md border border-slate-200 bg-white text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2 text-left">Processo</th>
                <th className="px-4 py-2 text-left">Tarefa</th>
                <th className="px-4 py-2 text-left">Ação</th>
                <th className="px-4 py-2 text-left">Concluída em</th>
                <th className="px-4 py-2 w-20" />
              </tr>
            </thead>
            <tbody>
              {tasks.isLoading && <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">Carregando...</td></tr>}
              {tasks.data?.map((t: ExecutedTask) => (
                <tr key={t.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-2 font-medium text-slate-800">{t.process ?? '—'}</td>
                  <td className="px-4 py-2 text-slate-600">{t.name ?? 'Tarefa'}</td>
                  <td className="px-4 py-2 text-slate-500">{t.action ?? '—'}</td>
                  <td className="px-4 py-2 text-slate-500">{t.completedAt ? new Date(t.completedAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—'}</td>
                  <td className="px-4 py-2 text-right">
                    <button type="button" onClick={() => setOpenInstance(t.executionId)} className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50">Ver</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {openInstance && <InstanceDialog id={openInstance} onClose={() => setOpenInstance(null)} />}
    </div>
  );
}
