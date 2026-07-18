import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertCircle, ArrowRight, CheckCircle2, Clock, ExternalLink, Inbox, LayoutGrid, LifeBuoy, RotateCw, Table as TableIcon, User, X } from 'lucide-react';
import { useTasks, useTask, useCompleteTask, useSaveTask, type TaskButton, type TaskListItem } from '@/lib/api/execution';
import { ReactForm, FormSkeleton, type ReactFormHandle } from '@/components/form/ReactForm';
import { openTab, navTo } from '@/lib/nav';
import { useDocumentTitle } from '@/lib/use-document-title';
import { toast } from '@/stores/toast';
import { ApiError } from '@/lib/api';
import { Dialog } from '@/components/ui/Dialog';
import { ExecutionHeader } from '@/components/execution/ExecutionHeader';
import { TaskActionFooter, type ExecutionAction } from '@/components/execution/TaskActionFooter';
import { renderIcon } from '@/lib/icon-catalog';
import '@/styles/task-index.css';

type TaskStatusFilter = 'pendentes' | 'concluidas';
const ALL_PROCESSES = 'todos';

export function TarefasPage() {
  const [params, setParams] = useSearchParams();
  const status: TaskStatusFilter = params.get('status') === 'concluidas' ? 'concluidas' : 'pendentes';
  const selectedProcess = params.get('process') || ALL_PROCESSES;
  const tasks = useTasks(status);
  const [view, setView] = useViewMode();
  const openTask = (task: TaskListItem) => openTab(status === 'concluidas' ? `/solicitacao/${task.executionId}` : `/tarefa/${task.id}`);
  const processes = useMemo(() => {
    const map = new Map<string, { key: string; label: string; count: number }>();
    for (const task of tasks.data ?? []) {
      if (!task.processKey) continue;
      const current = map.get(task.processKey);
      map.set(task.processKey, { key: task.processKey, label: task.process || task.processKey, count: (current?.count ?? 0) + 1 });
    }
    return [...map.values()].sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));
  }, [tasks.data]);
  const filtered = useMemo(() => selectedProcess === ALL_PROCESSES
    ? tasks.data ?? []
    : (tasks.data ?? []).filter((task) => task.processKey === selectedProcess), [selectedProcess, tasks.data]);

  useEffect(() => {
    if (!params.has('status')) setParams((current) => { current.set('status', status); return current; }, { replace: true });
  }, [params, setParams, status]);
  useEffect(() => {
    if (!tasks.isFetching && selectedProcess !== ALL_PROCESSES && !processes.some((item) => item.key === selectedProcess)) {
      setParams((current) => { current.delete('process'); return current; }, { replace: true });
    }
  }, [processes, selectedProcess, setParams, tasks.isFetching]);

  function selectStatus(next: TaskStatusFilter) {
    setParams((current) => { current.set('status', next); return current; });
  }
  function selectProcess(next: string) {
    setParams((current) => { if (next === ALL_PROCESSES) current.delete('process'); else current.set('process', next); return current; });
  }

  return (
    <div className="task-index-root flex h-full min-w-0 flex-col">
      <header className="flex items-center justify-between gap-4 border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
        <div className="min-w-0"><h1 className="text-lg font-semibold text-slate-900">Tarefas</h1><p className="mt-0.5 truncate text-sm text-slate-500">Itens que aguardam sua ação e histórico concluído.</p></div>
        <ViewToggle view={view} setView={setView} />
      </header>
      <div className="border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
        <div className="flex flex-wrap items-center gap-2" aria-label="Status das tarefas">
          <FilterPill active={status === 'pendentes'} onClick={() => selectStatus('pendentes')}>Pendentes</FilterPill>
          <FilterPill active={status === 'concluidas'} onClick={() => selectStatus('concluidas')}>Concluídas</FilterPill>
          <span className="mx-1 hidden h-6 w-px bg-slate-200 sm:block" aria-hidden="true" />
          <FilterPill active={selectedProcess === ALL_PROCESSES} onClick={() => selectProcess(ALL_PROCESSES)}>Todos</FilterPill>
          {processes.map((process) => <FilterPill key={process.key} active={selectedProcess === process.key} onClick={() => selectProcess(process.key)}>{process.label}{status === 'pendentes' && <span className="ml-1.5 opacity-70">{process.count}</span>}</FilterPill>)}
        </div>
      </div>
      <div className="flex-1 overflow-auto p-4 sm:p-6">
        {tasks.isLoading ? <TaskSkeletons /> : tasks.isError ? <ErrorState onRetry={() => tasks.refetch()} /> : filtered.length === 0 ? (
          <EmptyTasks status={status} filtered={selectedProcess !== ALL_PROCESSES} />
        ) : view === 'cards' ? <TaskCards tasks={filtered} onOpen={openTask} status={status} /> : <>
          <div className="md:hidden"><TaskCards tasks={filtered} onOpen={openTask} status={status} /></div>
          <div className="hidden md:block"><TaskTable tasks={filtered} onOpen={openTask} status={status} /></div>
        </>}
      </div>
    </div>
  );
}

function FilterPill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" aria-pressed={active} onClick={onClick} className={`min-h-11 max-w-full truncate whitespace-nowrap rounded-full border px-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-700 ${active ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'}`}>{children}</button>;
}

function EmptyTasks({ status, filtered }: { status: TaskStatusFilter; filtered: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-400"><Inbox size={26} /></div>
      <p className="text-sm font-medium text-slate-700">Nenhuma tarefa {status === 'pendentes' ? 'pendente' : 'concluída'}</p>
      <p className="mt-1 max-w-sm text-sm text-slate-500">{filtered ? 'Este processo não possui tarefas no status selecionado.' : status === 'pendentes' ? 'Quando uma tarefa for atribuída a você, ela aparecerá aqui.' : 'Suas tarefas concluídas aparecerão neste histórico.'}</p>
    </div>
  );
}

function ProcessPill({ task }: { task: TaskListItem }) {
  const icon = task.processIcon ? renderIcon(task.processIcon, 13) : null;
  return <span title={task.categoryName || task.process || undefined} className="inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700"><span className="h-2 w-2 shrink-0 rounded-full bg-slate-400" style={task.categoryColor ? { backgroundColor: task.categoryColor } : undefined} />{icon}<span className="truncate">{task.process || 'Processo'}</span></span>;
}

function TaskCards({ tasks, onOpen, status }: { tasks: TaskListItem[]; onOpen: (task: TaskListItem) => void; status: TaskStatusFilter }) {
  return <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-3">{tasks.map((task) => <TaskCard key={task.id} task={task} onOpen={() => onOpen(task)} status={status} />)}</div>;
}

function TaskCard({ task, onOpen, status }: { task: TaskListItem; onOpen: () => void; status: TaskStatusFilter }) {
  return (
    <article role="link" tabIndex={0} onClick={onOpen} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onOpen(); } }} className="group relative flex min-w-0 cursor-pointer flex-col rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-700">
      <div className="flex min-w-0 items-start justify-between gap-3"><ProcessPill task={task} />{task.processNumber != null && <span className="shrink-0 text-xs font-semibold tabular-nums text-slate-500">#{task.processNumber}</span>}</div>
      <h2 title={task.name || 'Tarefa'} className="mt-3 truncate text-sm font-bold text-slate-900">{task.name || 'Tarefa'}</h2>
      <p title={task.inboxText || undefined} className="mt-1 line-clamp-2 min-h-10 overflow-hidden text-sm leading-5 text-slate-500">{task.inboxText || 'Sem resumo disponível.'}</p>
      <div className="mt-4 flex min-w-0 flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
        <DuePill dueAt={task.dueAt} createdAt={task.createdAt} completedAt={task.completedAt} completed={status === 'concluidas'} />
        <span title={task.requester || undefined} className="inline-flex min-w-0 items-center gap-1 truncate text-xs text-slate-500"><User size={12} className="shrink-0" />{task.requester || 'Requisitante não informado'}</span>
        <span className="task-access ml-auto inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-slate-700 md:opacity-0 md:transition-opacity md:group-hover:opacity-100 md:group-focus-within:opacity-100">Acessar <ArrowRight size={14} /></span>
      </div>
    </article>
  );
}

function TaskTable({ tasks, onOpen, status }: { tasks: TaskListItem[]; onOpen: (task: TaskListItem) => void; status: TaskStatusFilter }) {
  return <div className="overflow-visible rounded-lg border border-slate-200 bg-white"><table className="w-full table-fixed text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="w-[24%] px-4 py-3 text-left">Processo</th><th className="w-[27%] px-4 py-3 text-left">Tarefa</th><th className="w-[21%] px-4 py-3 text-left">Requisitante</th><th className="w-[20%] px-4 py-3 text-left">Prazo</th><th className="w-[8%] px-4 py-3" /></tr></thead><tbody>{tasks.map((task) => <tr key={task.id} tabIndex={0} onClick={() => onOpen(task)} onKeyDown={(event) => { if (event.key === 'Enter') onOpen(task); }} className="group cursor-pointer border-t border-slate-100 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-slate-700"><td className="px-4 py-3"><div className="min-w-0"><ProcessPill task={task} /><p className="mt-1 text-xs tabular-nums text-slate-500">{task.processNumber != null ? `#${task.processNumber}` : 'Sem número'}</p></div></td><td className="px-4 py-3"><p title={task.name || undefined} className="truncate font-bold text-slate-900">{task.name || 'Tarefa'}</p><p title={task.inboxText || undefined} className="mt-1 truncate text-xs text-slate-500">{task.inboxText || 'Sem resumo disponível.'}</p></td><td title={task.requester || undefined} className="truncate px-4 py-3 text-slate-500">{task.requester || '—'}</td><td className="px-4 py-3"><DuePill dueAt={task.dueAt} createdAt={task.createdAt} completedAt={task.completedAt} completed={status === 'concluidas'} /></td><td className="px-4 py-3 text-right"><span className="task-access inline-flex items-center gap-1 whitespace-nowrap text-xs font-semibold text-slate-700 opacity-0 transition-opacity group-hover:opacity-100 group-focus:opacity-100">Acessar <ArrowRight size={14} /></span></td></tr>)}</tbody></table></div>;
}

function useNow() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 60_000); return () => window.clearInterval(timer); }, []);
  return now;
}

export function deadlineState(dueAt: string | null, completedAt: string | null | undefined, completed: boolean, now = Date.now()) {
  if (!dueAt) return { label: completed ? 'Prazo não informado' : 'Sem prazo', cls: 'bg-slate-100 text-slate-600' };
  const due = new Date(dueAt).getTime();
  if (completed) {
    if (!completedAt) return { label: 'Conclusão sem data', cls: 'bg-slate-100 text-slate-600' };
    const delay = new Date(completedAt).getTime() - due;
    if (delay <= 0) return { label: 'Concluída no prazo', cls: 'bg-slate-100 text-slate-700' };
    const days = Math.max(1, Math.ceil(delay / 86_400_000));
    return { label: `Concluída com ${days} ${days === 1 ? 'dia' : 'dias'} de atraso`, cls: 'bg-slate-100 text-slate-700' };
  }
  const diff = due - now;
  const days = Math.max(1, Math.ceil(Math.abs(diff) / 86_400_000));
  return diff < 0
    ? { label: `Em atraso: ${days} ${days === 1 ? 'dia' : 'dias'}`, cls: 'bg-rose-100 text-rose-700' }
    : { label: `Prazo: ${days} ${days === 1 ? 'dia' : 'dias'}`, cls: diff <= 72 * 3_600_000 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-700' };
}

export function DuePill({ dueAt, createdAt, completedAt, completed = false }: { dueAt: string | null; createdAt?: string | null; completedAt?: string | null; completed?: boolean }) {
  const now = useNow();
  const state = deadlineState(dueAt, completedAt, completed, now);
  const id = useMemo(() => `deadline-${Math.random().toString(36).slice(2)}`, []);
  return <span className="group/deadline relative inline-flex" onClick={(event) => event.stopPropagation()}><button type="button" aria-describedby={id} className={`inline-flex min-h-7 items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-700 ${state.cls}`}><Clock size={12} />{state.label}</button><span id={id} role="tooltip" className="pointer-events-none invisible absolute bottom-full left-0 z-30 mb-2 w-64 rounded-md bg-slate-900 p-3 text-left text-xs font-normal leading-5 text-white opacity-0 shadow-xl transition-opacity delay-700 duration-150 group-hover/deadline:visible group-hover/deadline:opacity-100 group-focus-within/deadline:visible group-focus-within/deadline:opacity-100 group-focus-within/deadline:delay-0"><strong className="block font-semibold">Datas da tarefa</strong><span className="block">Recebimento: {formatDate(createdAt)}</span><span className="block">Conclusão estimada: {formatDate(dueAt)}</span>{completedAt && <span className="block">Conclusão efetiva: {formatDate(completedAt)}</span>}</span></span>;
}

function formatDate(value?: string | null) { return value ? new Date(value).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : 'Não informada'; }

function TaskSkeletons() { return <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-label="Carregando tarefas">{[0, 1, 2].map((item) => <div key={item} className="h-48 animate-pulse rounded-lg border border-slate-200 bg-white p-4"><div className="h-6 w-32 rounded-full bg-slate-100" /><div className="mt-4 h-4 w-2/3 rounded bg-slate-100" /><div className="mt-3 h-10 rounded bg-slate-100" /></div>)}</div>; }
function ErrorState({ onRetry }: { onRetry: () => void }) { return <div role="alert" className="mx-auto flex max-w-md flex-col items-center py-16 text-center"><AlertCircle className="text-rose-600" /><p className="mt-3 font-semibold text-slate-900">Não foi possível carregar as tarefas</p><p className="mt-1 text-sm text-slate-500">Verifique sua conexão e tente novamente.</p><button type="button" onClick={onRetry} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-md bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-700"><RotateCw size={15} />Tentar novamente</button></div>; }

/** Alterna entre visão de cards e tabela (preferência em localStorage, padrão cards). */
export function useViewMode(storageKey = 'septem.tasks.view'): ['cards' | 'table', (v: 'cards' | 'table') => void] {
  const [view, setViewState] = useState<'cards' | 'table'>(() => (localStorage.getItem(storageKey) === 'table' ? 'table' : 'cards'));
  const setView = (v: 'cards' | 'table') => { localStorage.setItem(storageKey, v); setViewState(v); };
  return [view, setView];
}

export function ViewToggle({ view, setView }: { view: 'cards' | 'table'; setView: (v: 'cards' | 'table') => void }) {
  return (
    <div className="flex overflow-hidden rounded-md border border-slate-300">
      <button type="button" aria-pressed={view === 'cards'} onClick={() => setView('cards')} title="Cards" className={`flex h-11 w-11 items-center justify-center focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-slate-500 ${view === 'cards' ? 'bg-slate-900 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'}`}><LayoutGrid size={16} /></button>
      <button type="button" aria-pressed={view === 'table'} onClick={() => setView('table')} title="Tabela" className={`flex h-11 w-11 items-center justify-center focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-slate-500 ${view === 'table' ? 'bg-slate-900 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'}`}><TableIcon size={16} /></button>
    </div>
  );
}

export function TaskView({ taskId, onClose }: { taskId: string; onClose: () => void }) {
  const task = useTask(taskId);
  const complete = useCompleteTask();
  const save = useSaveTask();
  const fillRef = useRef<ReactFormHandle>(null);
  const [done, setDone] = useState<{ nextTaskForMe?: string | null; executionId?: string } | null>(null);
  // Botão com "Obrigar justificativa": guarda o contexto até o usuário digitar e confirmar.
  const [justify, setJustify] = useState<{ button?: TaskButton; data: unknown } | null>(null);
  useDocumentTitle(task.data?.name ?? 'Tarefa');

  async function finish(button?: TaskButton) {
    const { data, errors } = fillRef.current?.submit() ?? { data: {}, errors: {} };
    if ((button?.validateForm ?? true) && Object.keys(errors).length) {
      toast.error('Preencha os campos obrigatórios.');
      return;
    }
    if (button?.requireJustification) { setJustify({ button, data }); return; }
    await doComplete(data, button?.id);
  }

  async function doComplete(data: unknown, action?: string, justification?: string) {
    try {
      const r = await complete.mutateAsync({ id: taskId, data, action, justification });
      setJustify(null);
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
    // Salvar rascunho NÃO valida nem pinta obrigatórios — usa getData() (sem submit()).
    const data = fillRef.current?.getData() ?? {};
    try { await save.mutateAsync({ id: taskId, data }); toast.success('Rascunho salvo.'); }
    catch { toast.error('Não foi possível salvar.'); }
  }

  if (done) return <CompletionScreen kind="task" next={done.nextTaskForMe} executionId={done.executionId} onClose={onClose} />;

  const buttons = task.data?.buttons ?? [];
  const completionActions: ExecutionAction[] = buttons.length === 0
    ? [{
        id: '__complete',
        label: 'Concluir',
        loadingLabel: 'Concluindo…',
        icon: <CheckCircle2 size={15} aria-hidden="true" />,
        onClick: () => finish(),
        disabled: complete.isPending || task.isLoading,
        loading: complete.isPending,
      }]
    : buttons.map((button) => ({
        id: button.id,
        label: button.label,
        hint: button.hint,
        icon: button.icon ? <i className={button.icon} aria-hidden="true" /> : undefined,
        onClick: () => finish(button),
        disabled: complete.isPending || task.isLoading,
        loading: complete.isPending,
        loadingLabel: 'Concluindo…',
        style: button.primaryColor ? { backgroundColor: button.primaryColor, color: button.textColor ?? '#fff' } : undefined,
      }));
  const utilityActions: ExecutionAction[] = [
    {
      id: '__save',
      label: 'Salvar',
      loadingLabel: 'Salvando…',
      onClick: saveDraft,
      disabled: save.isPending || task.isLoading,
      loading: save.isPending,
      variant: 'secondary',
    },
    { id: '__cancel', label: 'Cancelar', onClick: onClose, variant: 'secondary' },
  ];

  return (
    <div className="flex h-full flex-col">
      <ExecutionHeader
        processName={task.data?.process}
        taskName={task.data?.name}
        alias={task.data?.alias}
        sector={task.data?.sector}
        processNumber={task.data?.processNumber}
        onBack={onClose}
        onOpenReport={task.data?.executionId ? () => openTab(`/solicitacao/${task.data!.executionId}`) : undefined}
      />

      {/* Cada grupo renderiza seu próprio card (sem container único). */}
      <main className="flex-1 overflow-auto p-4 sm:p-6">
        {task.isLoading ? <FormSkeleton /> : <ReactForm ref={fillRef} schema={task.data?.formSchema} data={task.data?.data as Record<string, unknown> | undefined} optionsByField={task.data?.fieldOptions} uploadContext={{ taskId }} />}
      </main>

      <TaskActionFooter completionActions={completionActions} utilityActions={utilityActions} loading={task.isLoading} compactDesktop />

      {justify && (
        <JustifyDialog
          label={justify.button?.label}
          pending={complete.isPending}
          onCancel={() => setJustify(null)}
          onConfirm={(texto) => doComplete(justify.data, justify.button?.id, texto)}
        />
      )}
    </div>
  );
}

/** Área de texto obrigatória exibida ao concluir por um botão que exige justificativa. */
function JustifyDialog({ label, pending, onCancel, onConfirm }: {
  label?: string; pending: boolean; onCancel: () => void; onConfirm: (texto: string) => void;
}) {
  const [texto, setTexto] = useState('');
  const valido = texto.trim().length > 0;
  return (
    <Dialog open onClose={onCancel} width="md" title={`Justificar: ${label ?? 'concluir'}`}
      footer={
        <>
          <button type="button" onClick={onCancel} className="rounded-md border border-slate-300 px-3.5 py-1.5 text-sm">Cancelar</button>
          <button type="button" disabled={!valido || pending} onClick={() => onConfirm(texto.trim())} data-testid="justify-confirm"
            className="rounded-md bg-slate-900 px-3.5 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60">Confirmar</button>
        </>
      }>
      <p className="mb-2 text-sm text-slate-600">Descreva o motivo desta decisão. A justificativa fica registrada na tarefa.</p>
      <textarea autoFocus rows={4} value={texto} onChange={(e) => setTexto(e.target.value)} data-testid="justify-text"
        placeholder="Justificativa…"
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none" />
    </Dialog>
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
