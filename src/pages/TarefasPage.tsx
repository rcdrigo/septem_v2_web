import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import { AlertCircle, ArrowDownAZ, ArrowRight, ArrowUpAZ, CheckCircle2, Clock, ExternalLink, FileSignature, Inbox, LayoutGrid, LifeBuoy, RotateCw, SlidersHorizontal, Table as TableIcon, User, X } from 'lucide-react';
import { useTasks, useTask, useCompleteTask, useSaveTask, useTaskSignatures, useSignAll, type TaskButton, type TaskFilters, type TaskListItem } from '@/lib/api/execution';
import { estaAssinado } from '@/lib/upload';
import { TestBadge } from '@/components/execution/TestBadge';
import { ReactForm, FormSkeleton, type ReactFormHandle } from '@/components/form/ReactForm';
import { openTab, navTo } from '@/lib/nav';
import { useDocumentTitle } from '@/lib/use-document-title';
import { toast } from '@/stores/toast';
import { ApiError } from '@/lib/api';
import { Dialog } from '@/components/ui/Dialog';
import { ExecutionHeader } from '@/components/execution/ExecutionHeader';
import { TaskActionFooter, type ExecutionAction } from '@/components/execution/TaskActionFooter';
import { processMessagesExtra } from '@/components/execution/ProcessMessages';
import { renderIcon } from '@/lib/icon-catalog';
import { queryClient } from '@/lib/queryClient';
import '@/styles/task-index.css';
import { routes } from '@/lib/routes';

type TaskStatusFilter = 'pendentes' | 'concluidas';
const ALL_PROCESSES = 'todos';
/** Campos de filtro que vivem na URL (compartilháveis e sobrevivem ao refresh). */
const TEXT_FILTERS = ['q', 'number'] as const;
const DATE_FILTERS = ['requestedFrom', 'requestedTo', 'receivedFrom', 'receivedTo'] as const;
type TextFilter = (typeof TEXT_FILTERS)[number];
type DateFilter = (typeof DATE_FILTERS)[number];

export function TarefasPage() {
  const [params, setParams] = useSearchParams();
  const status: TaskStatusFilter = params.get('status') === 'concluidas' ? 'concluidas' : 'pendentes';
  const selectedProcess = params.get('process') || ALL_PROCESSES;
  const filters = useMemo<TaskFilters>(() => ({
    q: params.get('q') ?? undefined,
    process: selectedProcess === ALL_PROCESSES ? undefined : selectedProcess,
    number: params.get('number') ?? undefined,
    requestedFrom: params.get('requestedFrom') ?? undefined,
    requestedTo: params.get('requestedTo') ?? undefined,
    receivedFrom: params.get('receivedFrom') ?? undefined,
    receivedTo: params.get('receivedTo') ?? undefined,
    sort: (params.get('sort') as TaskFilters['sort']) ?? undefined,
    dir: (params.get('dir') as TaskFilters['dir']) ?? undefined,
  }), [params, selectedProcess]);
  const tasks = useTasks(status, filters);
  const [view, setView] = useViewMode();
  const [panelOpen, setPanelOpen] = useState(false);
  const openTask = (task: TaskListItem) => openTab(status === 'concluidas' ? routes.request(task.executionId) : routes.task(task.id));
  const processes = tasks.data?.processes ?? [];
  const items = tasks.data?.items ?? [];

  useEffect(() => {
    if (!params.has('status')) setParams((current) => { current.set('status', status); return current; }, { replace: true });
  }, [params, setParams, status]);
  useEffect(() => {
    // Filtro de processo órfão (o processo sumiu da faceta) limparia a lista sem
    // explicação — as facetas vêm do servidor já ignorando o filtro de processo.
    if (!tasks.isFetching && selectedProcess !== ALL_PROCESSES && processes.length > 0 && !processes.some((item) => item.key === selectedProcess)) {
      setParams((current) => { current.delete('process'); return current; }, { replace: true });
    }
  }, [processes, selectedProcess, setParams, tasks.isFetching]);

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

  function patchParams(changes: Record<string, string | undefined>) {
    setParams((current) => {
      for (const [key, value] of Object.entries(changes)) {
        if (value == null || value === '') current.delete(key);
        else current.set(key, value);
      }
      return current;
    });
  }
  const selectStatus = (next: TaskStatusFilter) => patchParams({ status: next });
  const selectProcess = (next: string) => patchParams({ process: next === ALL_PROCESSES ? undefined : next });

  const applied = describeFilters(filters, processes);
  const hasFilters = applied.length > 0;

  return (
    <div className="task-index-root flex h-full min-w-0 flex-col">
      <header className="flex items-center justify-between gap-4 border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
        <div className="min-w-0"><h1 className="text-lg font-semibold text-slate-900">Tarefas</h1><p className="mt-0.5 truncate text-sm text-slate-500">Itens que aguardam sua ação e histórico concluído.</p></div>
        <ViewToggle view={view} setView={setView} />
      </header>
      <div className="border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
        <div className="flex flex-wrap items-center" aria-label="Status das tarefas">
          <FilterPill active={status === 'pendentes'} onClick={() => selectStatus('pendentes')}>Pendentes</FilterPill>
          <FilterPill active={status === 'concluidas'} onClick={() => selectStatus('concluidas')}>Concluídas</FilterPill>
          <span className="mx-1 hidden h-6 w-px bg-slate-200 sm:block" aria-hidden="true" />
          <FilterPill active={selectedProcess === ALL_PROCESSES} onClick={() => selectProcess(ALL_PROCESSES)}>Todos</FilterPill>
          {processes.map((process) => <FilterPill key={process.key} active={selectedProcess === process.key} onClick={() => selectProcess(process.key)}>{process.name}<span data-testid="contador-processo" className="ml-1.5 opacity-70">{process.count}</span></FilterPill>)}
          <button
            type="button"
            onClick={() => setPanelOpen((open) => !open)}
            aria-expanded={panelOpen}
            data-testid="abrir-filtros"
            className="ml-auto inline-flex min-h-9 items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-700"
          >
            <SlidersHorizontal size={14} aria-hidden="true" />
            Filtros{hasFilters && <span className="rounded-full bg-slate-900 px-1.5 text-[11px] text-white">{applied.length}</span>}
          </button>
        </div>

        {panelOpen && <TaskFilterPanel filters={filters} onChange={patchParams} />}

        {hasFilters && (
          <div data-testid="filtros-aplicados" className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1.5 border-t border-slate-100 pt-3 text-xs text-slate-600">
            <span className="font-semibold text-slate-500">Filtros aplicados:</span>
            {applied.map((item) => (
              <span key={item.key} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1">
                {item.label}
                <button type="button" aria-label={`Remover filtro ${item.label}`} onClick={() => patchParams(item.clear)} className="rounded-full p-0.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700">
                  <X size={12} />
                </button>
              </span>
            ))}
            <button type="button" data-testid="limpar-filtros" onClick={() => patchParams(clearAll())} className="font-semibold text-slate-700 underline underline-offset-2 hover:text-slate-900">Limpar tudo</button>
          </div>
        )}
      </div>
      <div className="flex-1 overflow-auto p-4 sm:p-6">
        {tasks.isLoading ? <TaskSkeletons /> : tasks.isError ? <ErrorState onRetry={() => tasks.refetch()} /> : items.length === 0 ? (
          <EmptyTasks status={status} filtered={hasFilters} />
        ) : view === 'cards' ? <TaskCards tasks={items} onOpen={openTask} status={status} /> : <>
          <div className="md:hidden"><TaskCards tasks={items} onOpen={openTask} status={status} /></div>
          <div className="hidden md:block"><TaskTable tasks={items} onOpen={openTask} status={status} /></div>
        </>}
      </div>
    </div>
  );
}

/** Limpa todos os campos de filtro de uma vez (status e visão continuam). */
function clearAll(): Record<string, undefined> {
  return Object.fromEntries([...TEXT_FILTERS, ...DATE_FILTERS, 'process', 'sort', 'dir'].map((key) => [key, undefined]));
}

/** Descreve, em português, cada filtro ativo — o texto exibido acima da lista. */
function describeFilters(filters: TaskFilters, processes: { key: string; name: string }[]) {
  const applied: { key: string; label: string; clear: Record<string, undefined> }[] = [];
  const day = (value?: string) => (value ? new Date(`${value}T00:00:00`).toLocaleDateString('pt-BR') : '');
  const range = (from?: string, to?: string) => (from && to ? `de ${day(from)} até ${day(to)}` : from ? `a partir de ${day(from)}` : `até ${day(to)}`);

  if (filters.process) {
    const name = processes.find((p) => p.key === filters.process)?.name ?? filters.process;
    applied.push({ key: 'process', label: `Processo: ${name}`, clear: { process: undefined } });
  }
  if (filters.q) applied.push({ key: 'q', label: `Palavra-chave: “${filters.q}”`, clear: { q: undefined } });
  if (filters.number) applied.push({ key: 'number', label: `Nº do processo: ${filters.number}`, clear: { number: undefined } });
  if (filters.requestedFrom || filters.requestedTo) {
    applied.push({ key: 'requested', label: `Requisição ${range(filters.requestedFrom, filters.requestedTo)}`, clear: { requestedFrom: undefined, requestedTo: undefined } });
  }
  if (filters.receivedFrom || filters.receivedTo) {
    applied.push({ key: 'received', label: `Recebimento ${range(filters.receivedFrom, filters.receivedTo)}`, clear: { receivedFrom: undefined, receivedTo: undefined } });
  }
  if (filters.sort) {
    const campo = filters.sort === 'prazo' ? 'prazo' : 'nº do processo';
    const sentido = filters.dir === 'asc' ? 'crescente' : 'decrescente';
    applied.push({ key: 'sort', label: `Ordenado por ${campo} (${sentido})`, clear: { sort: undefined, dir: undefined } });
  }
  return applied;
}

/**
 * Painel de filtros. Os textos são aplicados com atraso (o usuário ainda está
 * digitando); datas e ordenação valem no ato.
 */
function TaskFilterPanel({ filters, onChange }: { filters: TaskFilters; onChange: (changes: Record<string, string | undefined>) => void }) {
  const [text, setText] = useState({ q: filters.q ?? '', number: filters.number ?? '' });
  const committed = useRef(text);
  // onChange nasce de novo a cada render do pai; guardado em ref, um refetch no meio
  // da digitação não reinicia o atraso e engole a busca.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    const pending: Record<string, string | undefined> = {};
    for (const field of TEXT_FILTERS) if (text[field] !== committed.current[field]) pending[field] = text[field] || undefined;
    if (Object.keys(pending).length === 0) return;
    const timer = window.setTimeout(() => { committed.current = text; onChangeRef.current(pending); }, 400);
    return () => window.clearTimeout(timer);
  }, [text]);

  // Filtro removido por fora (chip "×" ou "Limpar tudo"): sem isto o campo continuaria
  // exibindo um texto que já não filtra nada — e redigitá-lo não reaplicaria o filtro.
  useEffect(() => {
    const incoming = { q: filters.q ?? '', number: filters.number ?? '' };
    if (incoming.q === committed.current.q && incoming.number === committed.current.number) return;
    committed.current = incoming;
    setText(incoming);
  }, [filters.q, filters.number]);

  const field = 'min-h-9 w-full rounded-md border border-slate-300 px-2.5 text-sm text-slate-800 focus:border-slate-500 focus:outline-none';
  // Campo de data tem largura mínima própria (Chrome desenha dd/mm/aaaa + ícone).
  // Sem piso + wrap, os dois campos do intervalo se espremem, se sobrepõem e o
  // segundo sai da tela quando a coluna é estreita.
  const dateField = `${field} min-w-[8.75rem] flex-1`;
  const label = 'block text-[11px] font-semibold uppercase tracking-wide text-slate-500';
  const setDate = (name: DateFilter) => (event: React.ChangeEvent<HTMLInputElement>) => onChange({ [name]: event.target.value || undefined });
  const setTextField = (name: TextFilter) => (event: React.ChangeEvent<HTMLInputElement>) => setText((current) => ({ ...current, [name]: event.target.value }));

  return (
    <div data-testid="painel-filtros" className="mt-3 grid gap-3 border-t border-slate-100 pt-3 sm:grid-cols-2 xl:grid-cols-3">
      <label className="min-w-0">
        <span className={label}>Processo, tarefa ou palavra-chave</span>
        <input type="search" data-testid="filtro-q" value={text.q} onChange={setTextField('q')} placeholder="Ex.: compra de material" className={`mt-1 ${field}`} />
      </label>
      <label className="min-w-0">
        <span className={label}>Nº do processo</span>
        <input type="text" inputMode="numeric" data-testid="filtro-numero" value={text.number} onChange={setTextField('number')} placeholder="Ex.: 42" className={`mt-1 ${field}`} />
      </label>
      <fieldset className="min-w-0">
        <legend className={label}>Data de requisição</legend>
        <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1.5">
          <input type="date" aria-label="Requisição de" data-testid="filtro-req-de" value={filters.requestedFrom ?? ''} onChange={setDate('requestedFrom')} className={dateField} />
          <span className="text-xs text-slate-400">até</span>
          <input type="date" aria-label="Requisição até" data-testid="filtro-req-ate" value={filters.requestedTo ?? ''} onChange={setDate('requestedTo')} className={dateField} />
        </div>
      </fieldset>
      <fieldset className="min-w-0">
        <legend className={label}>Data de recebimento</legend>
        <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1.5">
          <input type="date" aria-label="Recebimento de" data-testid="filtro-rec-de" value={filters.receivedFrom ?? ''} onChange={setDate('receivedFrom')} className={dateField} />
          <span className="text-xs text-slate-400">até</span>
          <input type="date" aria-label="Recebimento até" data-testid="filtro-rec-ate" value={filters.receivedTo ?? ''} onChange={setDate('receivedTo')} className={dateField} />
        </div>
      </fieldset>
      <div className="flex min-w-0 items-end gap-2 sm:col-span-2 xl:col-span-1">
        <label className="min-w-0 flex-1">
          <span className={label}>Ordenar por</span>
          <select data-testid="filtro-ordenar" value={filters.sort ?? ''} onChange={(event) => onChange({ sort: event.target.value || undefined, dir: event.target.value ? (filters.dir ?? 'asc') : undefined })} className={`mt-1 ${field}`}>
            <option value="">Mais recentes</option>
            <option value="prazo">Prazo</option>
            <option value="numero">Nº do processo</option>
          </select>
        </label>
        <button
          type="button"
          data-testid="filtro-direcao"
          disabled={!filters.sort}
          onClick={() => onChange({ dir: filters.dir === 'asc' ? 'desc' : 'asc' })}
          title={filters.dir === 'asc' ? 'Crescente' : 'Decrescente'}
          aria-label={`Inverter ordem (atual: ${filters.dir === 'asc' ? 'crescente' : 'decrescente'})`}
          className="inline-flex min-h-9 items-center gap-1 rounded-md border border-slate-300 px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          {filters.dir === 'asc' ? <ArrowUpAZ size={15} /> : <ArrowDownAZ size={15} />}
        </button>
      </div>
    </div>
  );
}

function FilterPill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" aria-pressed={active} onClick={onClick} className={`max-w-full truncate whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-700 ${active ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'}`}>{children}</button>;
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
      {task.isTest && <div className="mt-2"><TestBadge compact /></div>}
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
  return <div className="overflow-visible rounded-lg border border-slate-200 bg-white"><table className="w-full table-fixed text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="w-[24%] px-4 py-3 text-left">Processo</th><th className="w-[27%] px-4 py-3 text-left">Tarefa</th><th className="w-[21%] px-4 py-3 text-left">Requisitante</th><th className="w-[20%] px-4 py-3 text-left">Prazo</th><th className="w-[8%] px-4 py-3" /></tr></thead><tbody>{tasks.map((task) => <tr key={task.id} tabIndex={0} onClick={() => onOpen(task)} onKeyDown={(event) => { if (event.key === 'Enter') onOpen(task); }} className="group cursor-pointer border-t border-slate-100 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-slate-700"><td className="px-4 py-3"><div className="min-w-0"><ProcessPill task={task} />{task.isTest && <div className="mt-1"><TestBadge compact /></div>}<p className="mt-1 text-xs tabular-nums text-slate-500">{task.processNumber != null ? `#${task.processNumber}` : 'Sem número'}</p></div></td><td className="px-4 py-3"><p title={task.name || undefined} className="truncate font-bold text-slate-900">{task.name || 'Tarefa'}</p><p title={task.inboxText || undefined} className="mt-1 truncate text-xs text-slate-500">{task.inboxText || 'Sem resumo disponível.'}</p></td><td title={task.requester || undefined} className="truncate px-4 py-3 text-slate-500">{task.requester || '—'}</td><td className="px-4 py-3"><DuePill dueAt={task.dueAt} createdAt={task.createdAt} completedAt={task.completedAt} completed={status === 'concluidas'} /></td><td className="px-4 py-3 text-right"><span className="task-access inline-flex items-center gap-1 whitespace-nowrap text-xs font-semibold text-slate-700 opacity-0 transition-opacity group-hover:opacity-100 group-focus:opacity-100">Acessar <ArrowRight size={14} /></span></td></tr>)}</tbody></table></div>;
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
    setPos({ left: r.left, top: place === 'top' ? r.top - 12 : r.bottom + 12, place });
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
      <button ref={btnRef} type="button" aria-describedby={id} className={`inline-flex min-h-7 items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-700 ${state.cls}`}><Clock size={12} />{state.label}</button>
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
        {task.isLoading ? <FormSkeleton /> : <ReactForm ref={fillRef} schema={task.data?.formSchema} data={task.data?.data as Record<string, unknown> | undefined} optionsByField={task.data?.fieldOptions} uploadContext={{ taskId }} extraTabs={messageExtra ? { trailing: [messageExtra] } : undefined} />}
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
