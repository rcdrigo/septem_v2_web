import { ExecutionSummary } from '@/components/execution/ExecutionSummary';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { ExecutionFilters, useExecutionFilters } from '@/components/execution/ExecutionFilters';
import { AlertCircle, ArrowRight, CheckCircle2, Clock, ExternalLink, FileSignature, Inbox, LayoutGrid, LifeBuoy, RotateCw, Table as TableIcon, User, X } from 'lucide-react';
import { useTasks, useTask, useCompleteTask, useSaveTask, useTaskSignatures, useSignAll, type TaskButton, type TaskListItem } from '@/lib/api/execution';
import { estaAssinado } from '@/lib/upload';
import { CardAccess, ExecutionIndicators, ExecutionNumber, ExecutionProcessPill } from '@/components/execution/ExecutionListParts';
import { ReactForm, FormSkeleton, type ReactFormHandle } from '@/components/form/ReactForm';
import { openTab, navTo } from '@/lib/nav';
import { useDocumentTitle } from '@/lib/use-document-title';
import { toast } from '@/stores/toast';
import { ApiError } from '@/lib/api';
import { Dialog } from '@/components/ui/Dialog';
import { ExecutionHeader } from '@/components/execution/ExecutionHeader';
import { TaskActionFooter, type ExecutionAction } from '@/components/execution/TaskActionFooter';
import { processMessagesExtra } from '@/components/execution/ProcessMessages';
import { queryClient } from '@/lib/queryClient';
import '@/styles/task-index.css';
import { routes } from '@/lib/routes';
import { ContextHelp } from '@/components/guide/ContextHelp';
import { TagsButton, useTagsAccess } from '@/components/tags';

export function TarefasPage() {
  const canUseTags = useTagsAccess();
  const { filters, patch, clear } = useExecutionFilters('tasks', canUseTags);
  // Preserva links diretos para a caixa de concluídas; a lista padrão é a de pendentes.
  const [params] = useSearchParams();
  const situacao: 'pendentes' | 'concluidas' = params.get('caixa') === 'concluidas' ? 'concluidas' : 'pendentes';
  const tasks = useTasks(situacao, filters);
  const [view, setView] = useViewMode();
  const openTask = (task: TaskListItem) => openTab(routes.task(task.id));
  const items = tasks.data?.items ?? [];
  const hasFilters = Boolean(filters.q || filters.number || filters.processes?.length || filters.tagNames?.length || filters.requestedFrom || filters.requestedTo || filters.receivedFrom || filters.receivedTo || filters.sort);

  // Sempre que a página de Tarefas entra em foco (montagem + volta de aba/janela),
  // atualiza a lista E o summary de pendentes (prefixo ['workflow','tasks'] cobre os dois).
  useEffect(() => {
    const refresh = () => queryClient.invalidateQueries({ queryKey: ['workflow', 'tasks'] });
    refresh();
    const onFocus = () => { if (document.visibilityState === 'visible') refresh(); };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, []);

  return (
    <div className="task-index-root flex h-full min-w-0 flex-col">
      <header className="flex items-center justify-between gap-4 border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <h1 className="text-lg font-semibold text-slate-900">Tarefas</h1>
            <ContextHelp manual="operacao-tarefas-requisicoes" section="localizar-tarefas" label="Ajuda sobre tarefas" />
          </div>
          <p className="mt-0.5 truncate text-sm text-slate-500">
            {situacao === 'pendentes' ? 'Tarefas em andamento que aguardam sua ação.' : 'Tarefas que você concluiu.'}
          </p>
        </div>
        <ViewToggle view={view} setView={setView} />
      </header>
      <div className="border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
        <ExecutionFilters kind="tasks" filters={filters} processes={tasks.data?.processes ?? []} tagNames={canUseTags ? (tasks.data?.tagNames ?? []) : undefined} busy={tasks.isFetching} onChange={patch} onClear={clear} />
      </div>
      <div className="flex-1 overflow-auto p-4 sm:p-6">
        {tasks.isLoading ? <TaskSkeletons /> : tasks.isError ? <ErrorState onRetry={() => tasks.refetch()} /> : items.length === 0 ? (
          <EmptyTasks filtered={hasFilters} />
        ) : view === 'cards' ? <TaskCards tasks={items} onOpen={openTask} /> : <>
          <div className="md:hidden"><TaskCards tasks={items} onOpen={openTask} /></div>
          <div className="hidden md:block"><TaskTable tasks={items} onOpen={openTask} /></div>
        </>}
      </div>
    </div>
  );
}

function EmptyTasks({ filtered }: { filtered: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-400"><Inbox size={26} /></div>
      <p className="text-sm font-medium text-slate-700">Nenhuma tarefa em andamento</p>
      <p className="mt-1 max-w-sm text-sm text-slate-500">{filtered ? 'Nenhuma tarefa corresponde aos filtros aplicados.' : 'Quando uma tarefa for atribuída a você, ela aparecerá aqui.'}</p>
    </div>
  );
}

function TaskCards({ tasks, onOpen }: { tasks: TaskListItem[]; onOpen: (task: TaskListItem) => void }) {
  return <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-3">{tasks.map((task) => <TaskCard key={task.id} task={task} onOpen={() => onOpen(task)} />)}</div>;
}

function TaskCard({ task, onOpen }: { task: TaskListItem; onOpen: () => void }) {
  return (
    <article role="link" aria-label={task.name || 'Tarefa'} tabIndex={0} onClick={onOpen} onKeyDown={(event) => { if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); onOpen(); } }} className="task-card group relative flex min-w-0 cursor-pointer flex-col rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition-colors hover:border-slate-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-700">
      <div className="flex min-w-0 items-start justify-between gap-3"><div className="min-w-0"><ExecutionProcessPill item={task} /></div><ExecutionNumber executionId={task.executionId} number={task.processNumber} /></div>
      <div className="task-card-main relative mt-3 flex-1">
        <h2 title={task.name || 'Tarefa'} className="truncate text-sm font-bold text-slate-900">{task.name || 'Tarefa'}</h2>
        <ExecutionSummary html={task.inboxHtml} text={task.inboxText} className="mt-1 line-clamp-3 min-h-12 text-xs leading-4 text-slate-500" />
        <CardAccess />
      </div>
      <div className="mt-4 flex min-w-0 items-center justify-between gap-3 text-xs">
        <span title={task.requester || undefined} className="flex min-w-0 items-center gap-1 text-slate-500"><User size={12} className="shrink-0" /><span className="truncate">{task.requester || 'Requisitante não informado'}</span></span>
        <div className="task-card-deadline min-w-0 shrink-0 text-right"><DuePill plain dueAt={task.dueAt} createdAt={task.createdAt} /></div>
      </div>
      <ExecutionIndicators isTest={task.isTest} absentUserName={task.absentUserName} tags={task.tags} className="mt-3 border-t border-slate-100 pt-2" />
    </article>
  );
}

function TaskTable({ tasks, onOpen }: { tasks: TaskListItem[]; onOpen: (task: TaskListItem) => void }) {
  return <div className="rounded-lg border border-slate-200 bg-white"><table className="w-full table-fixed text-sm">
    <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th scope="col" className="w-28 px-4 py-3 text-left">Nº</th><th scope="col" className="w-[22%] px-4 py-3 text-left">Processo</th><th scope="col" className="px-4 py-3 text-left">Tarefa / Resumo</th><th scope="col" className="w-[16%] px-4 py-3 text-left">Requisitante</th><th scope="col" className="w-[20%] px-4 py-3 text-left">Prazo</th></tr></thead>
    <tbody>{tasks.map((task) => <tr key={task.id} tabIndex={0} onClick={() => onOpen(task)} onKeyDown={(event) => { if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); onOpen(task); } }} className="group cursor-pointer border-t border-slate-100 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-slate-700">
      <td className="px-4 py-3 align-top"><ExecutionNumber executionId={task.executionId} number={task.processNumber} /></td>
      <td className="px-4 py-3 align-top"><ExecutionProcessPill item={task} /></td>
      <td className="px-4 py-3 align-top"><p title={task.name || undefined} className="truncate font-bold text-slate-900">{task.name || 'Tarefa'}</p><ExecutionSummary html={task.inboxHtml} text={task.inboxText} className="mt-1 line-clamp-3 text-xs leading-4 text-slate-500" /><ExecutionIndicators isTest={task.isTest} absentUserName={task.absentUserName} tags={task.tags} className="mt-2" /></td>
      <td title={task.requester || undefined} className="truncate px-4 py-3 align-top text-xs text-slate-500">{task.requester || '—'}</td>
      <td className="px-4 py-3 align-top"><DuePill plain dueAt={task.dueAt} createdAt={task.createdAt} /><span className="task-access mt-2 flex items-center gap-1 text-xs font-semibold text-slate-700 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">Acessar <ArrowRight size={14} /></span></td>
    </tr>)}</tbody>
  </table></div>;
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

export function DuePill({ dueAt, createdAt, completedAt, completed = false, plain = false }: { plain?: boolean; dueAt: string | null; createdAt?: string | null; completedAt?: string | null; completed?: boolean }) {
  const now = useNow();
  const state = deadlineState(dueAt, completedAt, completed, now);
  const id = useMemo(() => `deadline-${Math.random().toString(36).slice(2)}`, []);
  const btnRef = useRef<HTMLButtonElement>(null);
  const timer = useRef<number | undefined>(undefined);
  // Posição calculada na abertura: o popover é renderizado em PORTAL (position:fixed)
  // para NÃO ser recortado pelo container com overflow-auto da lista (bug: o balão
  // subia e ficava "atrás/abaixo" do header). Vira acima ou abaixo conforme o espaço.
  const [pos, setPos] = useState<{ left: number; top: number; place: 'top' | 'bottom' } | null>(null);
  const milestones = [
    { label: 'Recebimento', value: createdAt, kind: 'start' },
    { label: 'Conclusão estimada', value: dueAt, kind: 'due' },
    ...(completedAt ? [{ label: 'Conclusão efetiva', value: completedAt, kind: 'done' }] : []),
  ];

  const locate = () => {
    const el = btnRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const place: 'top' | 'bottom' = r.top > 240 ? 'top' : 'bottom';
    // Alinhar pela esquerda do gatilho sozinho estoura a tela quando a pílula está à
    // direita (no 375 dá para passar dos 555px de `right`): a largura do cartão é fixa
    // (w-72 = 288px, limitada por max-w-[calc(100vw-2rem)]). Prender dentro do viewport.
    const largura = Math.min(288, window.innerWidth - 32);
    const left = Math.max(8, Math.min(r.left, window.innerWidth - largura - 8));
    setPos({ left, top: place === 'top' ? r.top - 12 : r.bottom + 12, place });
  };
  const openSoon = () => { window.clearTimeout(timer.current); timer.current = window.setTimeout(locate, 500); };
  const openNow = () => { window.clearTimeout(timer.current); locate(); };
  const close = () => { window.clearTimeout(timer.current); setPos(null); };
  useEffect(() => () => window.clearTimeout(timer.current), []);

  return (
    <span
      className="relative inline-flex"
      onClick={(event) => event.stopPropagation()}
      onMouseEnter={openSoon}
      onMouseLeave={close}
      onFocus={openNow}
      onBlur={close}
    >
      <button ref={btnRef} type="button" aria-describedby={id} className={`inline-flex min-h-7 items-center gap-1 text-xs font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-700 ${plain ? `text-left ${state.cls.split(' ').filter((name) => name.startsWith('text-')).join(' ')}` : `whitespace-nowrap rounded-full px-2.5 py-1 ${state.cls}`}`}><Clock size={12} className="shrink-0" /><span>{state.label}</span></button>
      {pos && createPortal(
        <span
          id={id}
          role="tooltip"
          data-testid="due-popover"
          style={{ position: 'fixed', left: pos.left, top: pos.top, transform: pos.place === 'top' ? 'translateY(-100%)' : undefined }}
          className="pointer-events-none z-[1000] block w-72 max-w-[calc(100vw-2rem)] rounded-lg bg-slate-950 p-4 text-left font-normal text-white shadow-xl ring-1 ring-white/10"
        >
          <span className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Prazo da tarefa</span>
          <span className="sr-only">{milestones.map((milestone) => `${milestone.label}: ${formatDate(milestone.value)}`).join('. ')}</span>
          <span aria-hidden="true" className="mt-3 block">
            {milestones.map((milestone, index) => (
              <span key={milestone.label} className={`grid grid-cols-[1.25rem_minmax(0,1fr)] gap-x-3 ${index < milestones.length - 1 ? 'pb-4' : ''}`}>
                <span className="relative flex justify-center pt-1">
                  {index < milestones.length - 1 && <span className="absolute bottom-[-1rem] top-4 w-px bg-slate-700" />}
                  {milestone.kind === 'done'
                    ? <CheckCircle2 size={16} className="relative z-10 text-emerald-400" />
                    : <span className={`relative z-10 mt-0.5 block h-2.5 w-2.5 rounded-full ${milestone.kind === 'due' ? 'border-2 border-slate-300 bg-slate-950' : 'bg-slate-400'}`} />}
                </span>
                <span className="min-w-0">
                  <strong className="block text-sm font-semibold leading-5 text-white">{formatDate(milestone.value)}</strong>
                  <span className="mt-0.5 block text-[11px] leading-4 text-slate-400">{milestone.label}</span>
                </span>
              </span>
            ))}
          </span>
        </span>,
        document.body,
      )}
    </span>
  );
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
    <div className="flex rounded-md bg-slate-100">
      <button type="button" aria-pressed={view === 'cards'} onClick={() => setView('cards')} title="Cards" className={`flex h-7 w-8 items-center justify-center rounded focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-slate-500 ${view === 'cards' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}><LayoutGrid size={14} /></button>
      <button type="button" aria-pressed={view === 'table'} onClick={() => setView('table')} title="Tabela" className={`flex h-7 w-8 items-center justify-center rounded focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-slate-500 ${view === 'table' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}><TableIcon size={14} /></button>
    </div>
  );
}

export function TaskView({ taskId, onClose }: { taskId: string; onClose: () => void }) {
  const task = useTask(taskId);
  const complete = useCompleteTask();
  const save = useSaveTask();
  const signAll = useSignAll();
  const canUseTags = useTagsAccess();
  // ── Assinatura na conclusão (Fase 7c) ────────────────────────────────────
  // Mesmo cache que o ícone do anexo lê, de propósito: dois fetches dariam dois
  // estados e o botão poderia continuar bloqueado com tudo já assinado.
  //
  // ⚠️ Fica AQUI, junto dos outros hooks: abaixo há um `return` antecipado (tela de
  // conclusão) e um hook depois dele quebra a ordem — "Rendered fewer hooks than
  // expected", com a tela inteira caindo assim que a tarefa é concluída.
  const assinaturas = useTaskSignatures(taskId);
  const fillRef = useRef<ReactFormHandle>(null);
  const [done, setDone] = useState<{ nextTaskForMe?: string | null; executionId?: string } | null>(null);
  const [tagsOpen, setTagsOpen] = useState(false);
  // Botão com "Obrigar justificativa": guarda o contexto até o usuário digitar e confirmar.
  const [justify, setJustify] = useState<{ button?: TaskButton; data: unknown; formState?: unknown } | null>(null);
  useDocumentTitle(task.data?.name ?? 'Tarefa');

  async function finish(button?: TaskButton) {
    const { data, errors, formState } = await fillRef.current?.submit() ?? { data: {}, errors: {} };
    if (errors._automation || ((button?.validateForm ?? true) && Object.keys(errors).length)) {
      toast.error(errors._automation ? 'O envio foi bloqueado pela automação.' : 'Preencha os campos obrigatórios.');
      return;
    }
    if (button?.requireJustification) { setJustify({ button, data, formState }); return; }
    await doComplete(data, button?.id, undefined, formState);
  }

  async function doComplete(data: unknown, action?: string, justification?: string, formState?: unknown) {
    try {
      await fillRef.current?.checkAutomation();
      const r = await complete.mutateAsync({ id: taskId, data, action, justification, formState });
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

  const pendentes = (assinaturas.data?.documentos ?? [])
    .filter((d) => d.fileUrl && !estaAssinado(d))
    .map((d) => d.fieldKey);
  const exigeAssinatura = !!assinaturas.data?.required && pendentes.length > 0;
  const podeLote = !!assinaturas.data?.batch;
  const avisoAssinatura = 'Assine os documentos para poder concluir esta tarefa.';

  async function assinarLote() {
    try {
      await signAll.mutateAsync(taskId);
      toast.success('Documentos assinados.');
    } catch {
      toast.error('Não foi possível assinar os documentos.');
    }
  }

  const completionActions: ExecutionAction[] = buttons.length === 0
    ? [{
        id: '__complete',
        label: 'Concluir',
        loadingLabel: 'Concluindo…',
        icon: <CheckCircle2 size={15} aria-hidden="true" />,
        // Sem botões configurados a conclusão VALIDA o formulário (default do
        // servidor), então o bloqueio vale aqui também.
        hint: exigeAssinatura ? avisoAssinatura : undefined,
        onClick: () => finish(),
        disabled: exigeAssinatura || complete.isPending || task.isLoading,
        loading: complete.isPending,
      }]
    : buttons.map((button) => {
        // Só os botões que VALIDAM o formulário são bloqueados. Devolução e pedido de
        // ajuste continuam clicáveis — é o requisito literal, e é o que permite
        // devolver um documento justamente por não querer assiná-lo.
        const bloqueado = exigeAssinatura && (button.validateForm ?? true);
        return {
          id: button.id,
          label: button.label,
          hint: bloqueado ? avisoAssinatura : button.hint,
          icon: button.icon ? <i className={button.icon} aria-hidden="true" /> : undefined,
          onClick: () => finish(button),
          disabled: bloqueado || complete.isPending || task.isLoading,
          loading: complete.isPending,
          loadingLabel: 'Concluindo…',
          style: button.primaryColor ? { backgroundColor: button.primaryColor, color: button.textColor ?? '#fff' } : undefined,
        };
      });
  // "deve ser adicionado um novo botão de conclusão chamado 'Assinar documentos em
  // lote', ANTES de todos os botões existentes" — requisito literal.
  if (podeLote) {
    completionActions.unshift({
      id: '__sign_all',
      label: 'Assinar documentos em lote',
      loadingLabel: 'Assinando…',
      icon: <FileSignature size={15} aria-hidden="true" />,
      hint: pendentes.length === 0 ? 'Todos os documentos já estão assinados.' : undefined,
      onClick: assinarLote,
      // Assinado tudo, o lote desativa e os demais liberam.
      disabled: pendentes.length === 0 || signAll.isPending || task.isLoading,
      loading: signAll.isPending,
      variant: 'secondary',
    });
  }

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
  const tagsExecutionId = task.data?.executionId;
  const mobileUtilityActions: ExecutionAction[] = canUseTags && tagsExecutionId
    ? [{ id: '__tags', label: 'Tags', onClick: () => setTagsOpen(true), variant: 'secondary' }]
    : [];
  const showMessages = (task.data?.messages?.count ?? 0) > 0 || task.data?.messages?.canPost === true;
  const messageExtra = showMessages && task.data?.executionId
    ? processMessagesExtra({ executionId: task.data.executionId, originType: 'task', taskId })
    : null;

  return (
    <div className="flex h-full flex-col">
      <ExecutionHeader
        processName={task.data?.process}
        taskName={task.data?.name}
        alias={task.data?.alias}
        sector={task.data?.sector}
        processNumber={task.data?.processNumber}
        isTest={task.data?.isTest}
        onBack={onClose}
        onOpenReport={task.data?.executionId ? () => openTab(routes.request(task.data!.executionId)) : undefined}
      />

      {/* Cada grupo renderiza seu próprio card (sem container único). */}
      <main className="flex-1 overflow-auto p-4 sm:p-6">
        {task.isLoading ? <FormSkeleton /> : <ReactForm key={taskId} ref={fillRef} automationScripts={task.data?.automationScripts} schema={task.data?.formSchema} data={task.data?.data as Record<string, unknown> | undefined} optionsByField={task.data?.fieldOptions} uploadContext={{ taskId }} extraTabs={messageExtra ? { trailing: [messageExtra] } : undefined} />}
      </main>

      <TaskActionFooter
        completionActions={completionActions}
        utilityActions={utilityActions}
        mobileUtilityActions={mobileUtilityActions}
        utilityContent={tagsExecutionId ? <TagsButton executionId={tagsExecutionId} /> : undefined}
        loading={task.isLoading}
        compactDesktop
      />
      {tagsExecutionId && (
        <TagsButton
          executionId={tagsExecutionId}
          open={tagsOpen}
          onOpenChange={setTagsOpen}
          trigger={false}
        />
      )}

      {justify && (
        <JustifyDialog
          label={justify.button?.label}
          pending={complete.isPending}
          onCancel={() => setJustify(null)}
          onConfirm={(texto) => doComplete(justify.data, justify.button?.id, texto, justify.formState)}
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
    const t = setTimeout(() => navTo(routes.task(next)), 2500);
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
                <button type="button" onClick={() => openTab(routes.request(executionId))}
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
