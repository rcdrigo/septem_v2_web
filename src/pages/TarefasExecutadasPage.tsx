import { ClipboardCheck, User } from 'lucide-react';
import { useExecutedTasks, type ExecutedTask } from '@/lib/api/execution';
import { openTab } from '@/lib/nav';
import { useViewMode, ViewToggle } from '@/pages/TarefasPage';
import { TestBadge } from '@/components/execution/TestBadge';

/**
 * Geral › Tarefas executadas: tarefas que o usuário concluiu (não estão mais com
 * ele). Clicar abre o relatório da instância em nova aba (sem menus).
 */
export function TarefasExecutadasPage() {
  const tasks = useExecutedTasks();
  const [view, setView] = useViewMode();
  const openReport = (id: string) => openTab(`/solicitacao/${id}`);
  const empty = !tasks.isLoading && (tasks.data?.length ?? 0) === 0;

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
        <h1 className="text-lg font-semibold text-slate-900">Tarefas executadas</h1>
        <ViewToggle view={view} setView={setView} />
      </header>
      <div className="flex-1 overflow-auto p-6">
        {empty ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-400"><ClipboardCheck size={26} /></div>
            <p className="text-sm font-medium text-slate-700">Nenhuma tarefa executada</p>
            <p className="mt-1 text-sm text-slate-500">As tarefas que você concluir aparecem aqui.</p>
          </div>
        ) : view === 'cards' ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {tasks.data?.map((t) => (
              <div key={t.id} className="flex h-full flex-col rounded-lg border border-slate-200 bg-white shadow-sm">
                <header className="flex items-start justify-between gap-2 border-b border-slate-100 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-800">{t.name ?? 'Tarefa'}</p>
                    <p className="truncate text-xs text-slate-500">{t.process ?? 'Processo'}</p>
                    {t.isTest && <div className="mt-1"><TestBadge compact /></div>}
                  </div>
                  {t.processNumber != null && (
                    <button type="button" onClick={() => openReport(t.executionId)} title="Ver relatório do processo"
                      className="shrink-0 rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600 hover:bg-slate-200">#{t.processNumber}</button>
                  )}
                </header>
                <div className="flex-1 space-y-1 px-4 py-2 text-xs">
                  <div className="text-slate-500">
                    Concluída {t.completedAt ? new Date(t.completedAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—'}
                    {t.action && <span className="ml-1 rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-500">{t.action}</span>}
                  </div>
                  {t.summary && t.summary.length > 0 && (
                    <dl className="mt-1 space-y-0.5">
                      {t.summary.map((s, i) => (
                        <div key={i} className="flex gap-1.5">
                          <dt className="shrink-0 text-slate-400">{s.label}:</dt>
                          <dd className="truncate text-slate-700">{s.value}</dd>
                        </div>
                      ))}
                    </dl>
                  )}
                </div>
                <footer className="flex flex-wrap items-center gap-2 border-t border-slate-100 px-4 py-3">
                  {t.requester && <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600"><User size={11} /> {t.requester}</span>}
                  <button type="button" onClick={() => openReport(t.executionId)} className="ml-auto rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">Ver relatório</button>
                </footer>
              </div>
            ))}
          </div>
        ) : (
          <table className="w-full overflow-hidden rounded-md border border-slate-200 bg-white text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2 text-left w-16">#</th>
                <th className="px-4 py-2 text-left">Processo</th>
                <th className="px-4 py-2 text-left">Tarefa</th>
                <th className="px-4 py-2 text-left">Ação</th>
                <th className="px-4 py-2 text-left">Inbox</th>
                <th className="px-4 py-2 text-left">Concluída em</th>
                <th className="px-4 py-2 w-20" />
              </tr>
            </thead>
            <tbody>
              {tasks.isLoading && <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">Carregando...</td></tr>}
              {tasks.data?.map((t: ExecutedTask) => (
                <tr key={t.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-2">
                    {t.processNumber != null
                      ? <button type="button" onClick={() => openReport(t.executionId)} title="Ver relatório do processo" className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-semibold text-slate-600 hover:bg-slate-200">#{t.processNumber}</button>
                      : <span className="text-slate-400">—</span>}
                  </td>
                  <td className="px-4 py-2 font-medium text-slate-800">{t.process ?? '—'}{t.isTest && <div className="mt-1"><TestBadge compact /></div>}</td>
                  <td className="px-4 py-2 text-slate-600">{t.name ?? 'Tarefa'}</td>
                  <td className="px-4 py-2 text-slate-500">{t.action ?? '—'}</td>
                  <td className="px-4 py-2 text-xs text-slate-500">
                    {t.summary && t.summary.length > 0
                      ? <dl className="space-y-0.5">{t.summary.map((s, i) => (<div key={i} className="flex gap-1.5"><dt className="shrink-0 text-slate-400">{s.label}:</dt><dd className="truncate text-slate-700">{s.value}</dd></div>))}</dl>
                      : '—'}
                  </td>
                  <td className="px-4 py-2 text-slate-500">{t.completedAt ? new Date(t.completedAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—'}</td>
                  <td className="px-4 py-2 text-right">
                    <button type="button" onClick={() => openReport(t.executionId)} className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50">Ver</button>
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
