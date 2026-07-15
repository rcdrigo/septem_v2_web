import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, CheckCircle2, Inbox, LifeBuoy, ExternalLink, X, LayoutGrid, Table as TableIcon, Clock, User } from 'lucide-react';
import { useMyTasks, useTask, useCompleteTask, useSaveTask, type MyTask, type TaskButton } from '@/lib/api/execution';
import { ReactForm, FormSkeleton, type ReactFormHandle } from '@/components/form/ReactForm';
import { Tooltip } from '@/components/ui/Tooltip';
import { openTab, navTo } from '@/lib/nav';
import { useDocumentTitle } from '@/lib/use-document-title';
import { toast } from '@/stores/toast';
import { ApiError } from '@/lib/api';

/**
 * Geral › Tarefas pendentes (B3): inbox do executor — tarefas atribuídas a ele
 * para concluir (concluir avança o fluxo). Abrir renderiza o form-js em página
 * inteira (req. 3 — full-width) com os botões de conclusão sempre visíveis no
 * rodapé (req. 4).
 */
export function TarefasPage() {
  const tasks = useMyTasks();
  const [view, setView] = useViewMode();
  const openTask = (id: string) => openTab(`/tarefa/${id}`);

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
        <h1 className="text-lg font-semibold text-slate-900">Tarefas pendentes</h1>
        <ViewToggle view={view} setView={setView} />
      </header>
      <div className="flex-1 overflow-auto p-6">
        {!tasks.isLoading && (tasks.data?.length ?? 0) === 0 ? (
          <EmptyTasks />
        ) : view === 'cards' ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {tasks.data?.map((t) => <TaskCard key={t.id} t={t} onOpen={() => openTask(t.id)} />)}
          </div>
        ) : (
          <table className="w-full overflow-hidden rounded-md border border-slate-200 bg-white text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-2 text-left w-16">#</th><th className="px-4 py-2 text-left">Tarefa</th><th className="px-4 py-2 text-left">Processo</th><th className="px-4 py-2 text-left">Requisitante</th><th className="px-4 py-2 text-left">Inbox</th><th className="px-4 py-2 text-left">Prazo</th><th className="px-4 py-2 w-24" /></tr></thead>
            <tbody>
              {tasks.isLoading && <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">Carregando...</td></tr>}
              {tasks.data?.map((t: MyTask) => (
                <tr key={t.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-2">
                    {t.processNumber != null
                      ? <button type="button" onClick={() => openTab(`/solicitacao/${t.executionId}`)} title="Ver relatório do processo" className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-semibold text-slate-600 hover:bg-slate-200">#{t.processNumber}</button>
                      : <span className="text-slate-400">—</span>}
                  </td>
                  <td className="px-4 py-2 font-medium text-slate-800">{t.name ?? 'Tarefa'}</td>
                  <td className="px-4 py-2 text-slate-500">{t.process ?? '—'}</td>
                  <td className="px-4 py-2 text-slate-500">{t.requester ?? '—'}</td>
                  <td className="px-4 py-2 text-xs text-slate-500">
                    {t.summary && t.summary.length > 0
                      ? <dl className="space-y-0.5">{t.summary.map((s, i) => (<div key={i} className="flex gap-1.5"><dt className="shrink-0 text-slate-400">{s.label}:</dt><dd className="truncate text-slate-700">{s.value}</dd></div>))}</dl>
                      : '—'}
                  </td>
                  <td className="px-4 py-2"><DuePill dueAt={t.dueAt} /></td>
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

function EmptyTasks() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-400"><Inbox size={26} /></div>
      <p className="text-sm font-medium text-slate-700">Nenhuma tarefa pendente</p>
      <p className="mt-1 text-sm text-slate-500">Tarefas atribuídas a você aparecem aqui.</p>
    </div>
  );
}

/** Card de tarefa do inbox: header (tarefa/processo/nº) · footer (prazo, requisitante, acessar). */
function TaskCard({ t, onOpen }: { t: MyTask; onOpen: () => void }) {
  return (
    <div className="flex h-full flex-col rounded-lg border border-slate-200 bg-white shadow-sm">
      <header className="flex items-start justify-between gap-2 border-b border-slate-100 px-4 py-3">
        <div className="min-w-0">
          <p className="truncate font-medium text-slate-800">{t.name ?? 'Tarefa'}</p>
          <p className="truncate text-xs text-slate-500">{t.process ?? 'Processo'}</p>
        </div>
        {t.processNumber != null && (
          <button type="button" onClick={() => openTab(`/solicitacao/${t.executionId}`)} title="Ver relatório do processo"
            className="shrink-0 rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600 hover:bg-slate-200">#{t.processNumber}</button>
        )}
      </header>
      <div className="flex-1 space-y-1 px-4 py-2 text-xs">
        <span className="inline-flex items-center gap-1 text-slate-500"><Clock size={12} /> Recebida {new Date(t.createdAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</span>
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
        <DuePill dueAt={t.dueAt} />
        {t.requester && <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600"><User size={11} /> {t.requester}</span>}
        <button type="button" onClick={onOpen} className="ml-auto rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700">Acessar</button>
      </footer>
    </div>
  );
}

/** Pill de prazo com cor: verde (no prazo), laranja (vence em <24h), vermelho (vencido). */
export function DuePill({ dueAt }: { dueAt: string | null }) {
  if (!dueAt) return <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">Sem prazo</span>;
  const due = new Date(dueAt).getTime();
  const diff = due - Date.now();
  const cls = diff < 0 ? 'bg-rose-100 text-rose-700' : diff < 24 * 3600_000 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700';
  const label = new Date(dueAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}><Clock size={11} /> {diff < 0 ? 'Vencida' : 'Prazo'}: {label}</span>;
}

/** Alterna entre visão de cards e tabela (preferência em localStorage, padrão cards). */
export function useViewMode(): ['cards' | 'table', (v: 'cards' | 'table') => void] {
  const [view, setViewState] = useState<'cards' | 'table'>(() => (localStorage.getItem('septem.tasks.view') === 'table' ? 'table' : 'cards'));
  const setView = (v: 'cards' | 'table') => { localStorage.setItem('septem.tasks.view', v); setViewState(v); };
  return [view, setView];
}

export function ViewToggle({ view, setView }: { view: 'cards' | 'table'; setView: (v: 'cards' | 'table') => void }) {
  return (
    <div className="flex overflow-hidden rounded-md border border-slate-300">
      <button type="button" onClick={() => setView('cards')} title="Cards" className={`flex items-center justify-center px-2 py-1.5 ${view === 'cards' ? 'bg-slate-900 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'}`}><LayoutGrid size={15} /></button>
      <button type="button" onClick={() => setView('table')} title="Tabela" className={`flex items-center justify-center px-2 py-1.5 ${view === 'table' ? 'bg-slate-900 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'}`}><TableIcon size={15} /></button>
    </div>
  );
}

export function TaskView({ taskId, onClose }: { taskId: string; onClose: () => void }) {
  const task = useTask(taskId);
  const complete = useCompleteTask();
  const save = useSaveTask();
  const fillRef = useRef<ReactFormHandle>(null);
  const [done, setDone] = useState<{ nextTaskForMe?: string | null; executionId?: string } | null>(null);
  useDocumentTitle(task.data?.name ?? 'Tarefa');

  async function finish(button?: TaskButton) {
    const { data, errors } = fillRef.current?.submit() ?? { data: {}, errors: {} };
    if ((button?.validateForm ?? true) && Object.keys(errors).length) {
      toast.error('Preencha os campos obrigatórios.');
      return;
    }
    try {
      const r = await complete.mutateAsync({ id: taskId, data, action: button?.id });
      setDone({ nextTaskForMe: r.nextTaskForMe, executionId: r.executionId });
    } catch (err) {
      // O servidor valida de novo (autoritativo): 422 traz os campos inválidos —
      // pinta cada um e avisa, em vez de um erro genérico.
      const body = err instanceof ApiError ? (err.body as { error?: string; fields?: Record<string, string> } | undefined) : undefined;
      if (body?.error === 'validation' && body.fields) {
        fillRef.current?.setServerErrors(body.fields);
        toast.error('Há campos com valor inválido.');
      } else {
        toast.error('Não foi possível concluir a tarefa.');
      }
    }
  }

  async function saveDraft() {
    const { data } = fillRef.current?.submit() ?? { data: {} };
    try { await save.mutateAsync({ id: taskId, data }); toast.success('Rascunho salvo.'); }
    catch { toast.error('Não foi possível salvar.'); }
  }

  if (done) return <CompletionScreen kind="task" next={done.nextTaskForMe} executionId={done.executionId} onClose={onClose} />;

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
        {task.isLoading ? <FormSkeleton /> : <ReactForm ref={fillRef} schema={task.data?.formSchema} data={task.data?.data as Record<string, unknown> | undefined} optionsByField={task.data?.fieldOptions} uploadContext={{ taskId }} />}
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
              {b.icon && <i className={b.icon} />}
              {b.label}
            </button>
          </Tooltip>
        ))}
        <div className="ml-auto flex gap-2">
          <button type="button" onClick={saveDraft} disabled={save.isPending || task.isLoading} className="rounded-md border border-slate-300 px-3.5 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60">Salvar</button>
          <button type="button" onClick={onClose} className="rounded-md border border-slate-300 px-3.5 py-1.5 text-sm">Cancelar</button>
        </div>
      </footer>
    </div>
  );
}

/**
 * Tela de conclusão (#37): se a próxima tarefa é do mesmo usuário, avisa e
 * carrega-a em segundos; senão, oferece fechar ou acompanhar o processo (relatório
 * da instância em nova aba).
 */
/**
 * Tela de sucesso — compartilhada pelo INÍCIO do serviço e pela conclusão de uma
 * tarefa. O texto muda conforme a origem: "Solicitação iniciada" só quando a
 * requisição acabou de ser criada; nas demais tarefas, "Tarefa concluída".
 */
export function CompletionScreen({ next, executionId, onClose, kind = 'task' }: {
  next?: string | null;
  executionId?: string;
  onClose: () => void;
  /** 'start' = tarefa de início (nova solicitação) · 'task' = demais tarefas. */
  kind?: 'start' | 'task';
}) {
  useEffect(() => {
    if (!next) return;
    const t = setTimeout(() => navTo(`/tarefa/${next}`), 2500);
    return () => clearTimeout(t);
  }, [next]);

  return (
    <div className="flex h-full items-center justify-center bg-slate-100 p-6">
      <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
          <CheckCircle2 size={28} />
        </div>
        <h2 className="text-lg font-semibold text-slate-900">
          {kind === 'start' ? 'Solicitação iniciada com sucesso!' : 'Tarefa concluída com sucesso!'}
        </h2>
        {next ? (
          <p className="mt-2 text-sm text-slate-600">Uma nova tarefa é sua responsabilidade e será carregada em poucos segundos…</p>
        ) : (
          <>
            <p className="mt-2 text-sm text-slate-600">Você pode acompanhar o andamento do processo a qualquer momento.</p>
            <div className="mt-5 flex justify-center gap-2">
              <button type="button" onClick={onClose} className="rounded-md border border-slate-300 px-3.5 py-1.5 text-sm">Fechar</button>
              {executionId && (
                <button type="button" onClick={() => openTab(`/solicitacao/${executionId}`)}
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
export function DocBanner({ url }: { url: string }) {
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
