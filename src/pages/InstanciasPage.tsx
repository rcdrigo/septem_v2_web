import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertCircle, ArrowRight, ChevronDown, ChevronLeft, ChevronRight, Clock, History, LayoutDashboard, ListTree, Pencil, Play, Printer, RotateCw, Save, Search, Trash2, User, Workflow, X, XCircle } from 'lucide-react';
import { useInstances, useInstance, useCancelInstance, useDeleteInstance, useUpdateInstance, type InstanceListItem, type InstanceTask, type FieldChange } from '@/lib/api/execution';
import { openTab } from '@/lib/nav';
import { Dialog } from '@/components/ui/Dialog';
import { ReactForm, type ReactFormHandle } from '@/components/form/ReactForm';
import { confirm } from '@/components/ui/ConfirmDialog';
import { toast } from '@/stores/toast';
import { renderIcon } from '@/lib/icon-catalog';
import { useViewMode, ViewToggle } from './TarefasPage';
import { ProcessMessages, processMessagesExtra } from '@/components/execution/ProcessMessages';

const STATUS = { em_andamento: { label: 'Em andamento', cls: 'bg-sky-100 text-sky-700' }, concluido: { label: 'Concluído', cls: 'bg-emerald-100 text-emerald-700' }, cancelado: { label: 'Cancelado', cls: 'bg-rose-100 text-rose-700' } } as Record<string, { label: string; cls: string }>;
const TASK_STATUS = { pendente: 'bg-amber-100 text-amber-700', concluida: 'bg-emerald-100 text-emerald-700' } as Record<string, string>;

type InstanciasPageProps = {
  /** Título do cabeçalho. */
  title?: string;
  /** Trava em "apenas as que iniciei" (esconde o checkbox) — usado em "Minhas tarefas". */
  lockMine?: boolean;
  /** Status pré-selecionado (ex.: "em_andamento"). */
  initialStatus?: string;
};

/**
 * Acompanhamento de instâncias (B3). Reusada em duas telas:
 *  - "Tarefas executadas": todas as instâncias, com filtros livres.
 *  - "Minhas tarefas": travada nas instâncias que EU iniciei e em andamento.
 */
export function InstanciasPage({ title = 'Requisições', initialStatus = 'em_andamento' }: InstanciasPageProps = {}) {
  const [params, setParams] = useSearchParams();
  const status = params.get('status') || initialStatus;
  const q = params.get('q') || '';
  const page = Math.max(1, Number(params.get('page')) || 1);
  const [view, setView] = useViewMode('septem.requests.view');
  const pageSize = 20;
  const openReport = (id: string) => openTab(`/solicitacao/${id}`);
  const list = useInstances({ q: q || undefined, status: status === 'todos' ? undefined : status, mine: true, page, pageSize });
  const total = list.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  useEffect(() => {
    if (!params.has('status') || !params.has('page')) setParams((current) => {
      if (!current.has('status')) current.set('status', initialStatus);
      if (!current.has('page')) current.set('page', '1');
      return current;
    }, { replace: true });
  }, [initialStatus, params, setParams]);

  function update(next: Record<string, string | null>) {
    setParams((current) => { for (const [key, value] of Object.entries(next)) { if (!value) current.delete(key); else current.set(key, value); } return current; });
  }

  return (
    <div className="task-index-root flex h-full min-w-0 flex-col">
      <header className="flex items-center justify-between gap-4 border-b border-slate-200 bg-white px-4 py-4 sm:px-6"><div className="min-w-0"><h1 className="text-lg font-semibold text-slate-900">{title}</h1><p className="mt-0.5 truncate text-sm text-slate-500">Processos iniciados por você.</p></div><ViewToggle view={view} setView={setView} /></header>
      <div className="border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
        <div className="flex flex-wrap gap-2" aria-label="Status das requisições">{([['em_andamento', 'Em andamento'], ['concluido', 'Concluídos'], ['cancelado', 'Cancelados'], ['todos', 'Todos']] as const).map(([value, label]) => <button key={value} type="button" aria-pressed={status === value} onClick={() => update({ status: value, page: '1' })} className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-700 ${status === value ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'}`}>{label}</button>)}</div>
        <label className="relative mt-3 block max-w-xl"><span className="sr-only">Buscar requisições</span><Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input type="search" placeholder="Buscar por processo..." value={q} onChange={(event) => update({ q: event.target.value || null, page: '1' })} className="h-11 w-full rounded-md border border-slate-300 bg-white pl-9 pr-3 text-sm outline-2 outline-transparent hover:bg-slate-50 focus-visible:outline-slate-700" /></label>
      </div>

      <div className="flex-1 overflow-auto p-4 sm:p-6">
        {list.isLoading ? <RequestSkeletons /> : list.isError ? <RequestError onRetry={() => list.refetch()} /> : total === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-400"><Workflow size={26} /></div>
            <p className="text-sm font-medium text-slate-700">Nenhuma requisição encontrada</p>
            <p className="mt-1 max-w-sm text-sm text-slate-500">Ajuste os filtros ou inicie um serviço para acompanhar a solicitação aqui.</p>
          </div>
        ) : (
          <>
            {view === 'cards' ? <RequestCards items={list.data?.items ?? []} onOpen={openReport} /> : <><div className="md:hidden"><RequestCards items={list.data?.items ?? []} onOpen={openReport} /></div><div className="hidden md:block"><RequestTable items={list.data?.items ?? []} onOpen={openReport} /></div></>}
            <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
              <span>{total} requisição{total === 1 ? '' : 'ões'}</span>
              <div className="flex items-center gap-2">
                <button type="button" aria-label="Página anterior" disabled={page <= 1} onClick={() => update({ page: String(page - 1) })} className="flex h-11 w-11 items-center justify-center rounded border border-slate-300 disabled:cursor-not-allowed disabled:opacity-40"><ChevronLeft size={14} /></button>
                <span>{page} / {totalPages}</span>
                <button type="button" aria-label="Próxima página" disabled={page >= totalPages} onClick={() => update({ page: String(page + 1) })} className="flex h-11 w-11 items-center justify-center rounded border border-slate-300 disabled:cursor-not-allowed disabled:opacity-40"><ChevronRight size={14} /></button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function RequestProcess({ item }: { item: InstanceListItem }) { const icon = item.processIcon ? renderIcon(item.processIcon, 13) : null; return <span title={item.categoryName || item.process || undefined} className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700"><span className="h-2 w-2 shrink-0 rounded-full bg-slate-400" style={item.categoryColor ? { backgroundColor: item.categoryColor } : undefined} />{icon}<span className="truncate">{item.process || 'Processo'}</span></span>; }
function RequestCards({ items, onOpen }: { items: InstanceListItem[]; onOpen: (id: string) => void }) { return <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-3">{items.map((item) => <article key={item.id} role="link" tabIndex={0} onClick={() => onOpen(item.id)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onOpen(item.id); } }} className="group min-w-0 cursor-pointer rounded-lg border border-slate-200 bg-white p-4 shadow-sm hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-700"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><RequestProcess item={item} /><p title={item.categoryName || undefined} className="mt-1 truncate text-xs text-slate-500">{item.categoryName || 'Sem categoria'}</p></div><span className="shrink-0 text-xs font-semibold tabular-nums text-slate-500">{item.number != null ? `#${item.number}` : 'Sem número'}</span></div><p title={item.inboxText || undefined} className="mt-3 line-clamp-2 min-h-10 text-sm leading-5 text-slate-500">{item.inboxText || 'Sem resumo disponível.'}</p><div className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-100 pt-3 text-xs"><div><span className="block text-slate-400">Status</span><StatusBadge status={item.status} /></div><div><span className="block text-slate-400">Pendências</span><strong className="text-slate-700">{item.pendingTasks}</strong></div><div><span className="block text-slate-400">Início</span><span className="text-slate-600">{fmt(item.startedAt)}</span></div><div><span className="block text-slate-400">Fim</span><span className="text-slate-600">{item.endedAt ? fmt(item.endedAt) : '—'}</span></div></div><span className="task-access mt-3 flex items-center justify-end gap-1 text-xs font-semibold text-slate-700 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100">Acessar <ArrowRight size={14} /></span></article>)}</div>; }
function RequestTable({ items, onOpen }: { items: InstanceListItem[]; onOpen: (id: string) => void }) { return <div className="rounded-lg border border-slate-200 bg-white"><table className="w-full table-fixed text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="w-[28%] px-4 py-3 text-left">Processo</th><th className="w-[25%] px-4 py-3 text-left">Resumo</th><th className="w-[14%] px-4 py-3 text-left">Status</th><th className="w-[10%] px-4 py-3 text-left">Pendentes</th><th className="w-[15%] px-4 py-3 text-left">Início / fim</th><th className="w-[8%] px-4 py-3" /></tr></thead><tbody>{items.map((item) => <tr key={item.id} tabIndex={0} onClick={() => onOpen(item.id)} onKeyDown={(event) => { if (event.key === 'Enter') onOpen(item.id); }} className="group cursor-pointer border-t border-slate-100 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-slate-700"><td className="px-4 py-3"><RequestProcess item={item} /><p title={item.categoryName || undefined} className="mt-1 truncate text-xs text-slate-500">{item.categoryName || 'Sem categoria'} · {item.number != null ? `#${item.number}` : 'Sem número'}</p></td><td title={item.inboxText || undefined} className="truncate px-4 py-3 text-slate-500">{item.inboxText || '—'}</td><td className="px-4 py-3"><StatusBadge status={item.status} /></td><td className="px-4 py-3 font-semibold text-slate-700">{item.pendingTasks}</td><td className="px-4 py-3 text-xs text-slate-500">{fmt(item.startedAt)}<br />{item.endedAt ? fmt(item.endedAt) : '—'}</td><td className="px-4 py-3"><span className="task-access inline-flex items-center gap-1 whitespace-nowrap text-xs font-semibold opacity-0 group-hover:opacity-100 group-focus:opacity-100">Acessar <ArrowRight size={14} /></span></td></tr>)}</tbody></table></div>; }
function RequestSkeletons() { return <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-label="Carregando requisições">{[0, 1, 2].map((item) => <div key={item} className="h-52 animate-pulse rounded-lg border border-slate-200 bg-white p-4"><div className="h-6 w-32 rounded-full bg-slate-100" /><div className="mt-4 h-10 rounded bg-slate-100" /></div>)}</div>; }
function RequestError({ onRetry }: { onRetry: () => void }) { return <div role="alert" className="mx-auto flex max-w-md flex-col items-center py-16 text-center"><AlertCircle className="text-rose-600" /><p className="mt-3 font-semibold text-slate-900">Não foi possível carregar as requisições</p><button type="button" onClick={onRetry} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-md bg-slate-900 px-4 text-sm font-semibold text-white"><RotateCw size={15} />Tentar novamente</button></div>; }

/** Conteúdo do relatório de uma instância: abas Visão geral + Formulário (só-leitura) + Tramitação. */
export function InstanceReport({ id, messageAccess }: { id: string; messageAccess?: string | null }) {
  const inst = useInstance(id, messageAccess);
  const update = useUpdateInstance();
  const cancel = useCancelInstance();
  const del = useDeleteInstance();
  const formRef = useRef<ReactFormHandle>(null);
  const [editing, setEditing] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);

  if (inst.isLoading) return <p className="text-sm text-slate-400">Carregando...</p>;
  if (inst.isError || !inst.data) {
    return <p className="rounded-md bg-rose-50 px-4 py-3 text-sm text-rose-700">Não foi possível carregar o relatório desta solicitação. Você pode não ter permissão para visualizá-la.</p>;
  }
  const d = inst.data;
  const data = (d.data ?? {}) as Record<string, unknown>;
  const canEditForm = !!d.canEdit && !!d.formSchema; // edição inline só quando há schema
  const hasActions = !!d.canCancel || !!d.canDelete;
  const showMessages = (d.messages?.count ?? 0) > 0 || d.messages?.canPost === true;
  const messageExtra = showMessages ? processMessagesExtra({ executionId: id, originType: 'report', messageAccess }) : null;

  async function doSave() {
    const res = formRef.current?.submit();
    if (!res) return;
    if (Object.keys(res.errors).length > 0) { toast.error('Corrija os campos destacados antes de salvar.'); return; }
    try { await update.mutateAsync({ id, data: res.data }); toast.success('Alterações salvas.'); setEditing(false); }
    catch { toast.error('Não foi possível salvar as alterações.'); }
  }
  async function doCancel() {
    setActionsOpen(false);
    if (!(await confirm({ title: 'Cancelar processo', message: 'A instância será marcada como cancelada. Continuar?' }))) return;
    try { await cancel.mutateAsync(id); toast.success('Processo cancelado.'); } catch { toast.error('Não foi possível cancelar.'); }
  }
  async function doDelete() {
    setActionsOpen(false);
    if (!(await confirm({ title: 'Excluir processo', message: 'A instância sairá das listagens (histórico preservado). Continuar?' }))) return;
    try { await del.mutateAsync(id); toast.success('Processo excluído.'); window.close(); } catch { toast.error('Não foi possível excluir.'); }
  }

  return (
    <div className="space-y-4">
      {/* Barra de ações: Imprimir · Editar/Salvar · Ações (cancelar/excluir) */}
      <div className="flex flex-wrap items-center justify-end gap-2">
        <button type="button" onClick={() => window.print()}
          className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"><Printer size={15} /> Imprimir</button>

        {canEditForm && !editing && (
          <button type="button" onClick={() => setEditing(true)}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"><Pencil size={15} /> Editar</button>
        )}
        {canEditForm && editing && (
          <>
            <button type="button" onClick={() => setEditing(false)}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"><X size={15} /> Cancelar edição</button>
            <button type="button" onClick={doSave} disabled={update.isPending}
              className="inline-flex items-center gap-1.5 rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60"><Save size={15} /> Salvar</button>
          </>
        )}

        {hasActions && !editing && (
          <div className="relative">
            <button type="button" onClick={() => setActionsOpen((o) => !o)}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">Ações <ChevronDown size={14} /></button>
            {actionsOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setActionsOpen(false)} />
                <div className="absolute right-0 z-20 mt-1 w-48 overflow-hidden rounded-md border border-slate-200 bg-white py-1 shadow-lg">
                  {d.canCancel && (
                    <button type="button" onClick={doCancel}
                      className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-amber-700 hover:bg-amber-50"><XCircle size={14} /> Cancelar processo</button>
                  )}
                  {d.canDelete && (
                    <button type="button" onClick={doDelete}
                      className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-rose-700 hover:bg-rose-50"><Trash2 size={14} /> Excluir processo</button>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Mesma estrutura do formulário com Visão geral (1ª) e Tramitação (última) na mesma
          barra de abas. Editável quando "editing"; senão só-leitura. Sem schema (legado) → fallback. */}
      {d.formSchema ? (
        <ReactForm
          ref={formRef}
          schema={d.formSchema}
          data={data}
          readOnly={!editing}
          extraTabs={{
            leading: [{ id: 'overview', label: 'Visão geral', icon: <LayoutDashboard size={15} />, render: () => <OverviewTab d={d} /> }],
            trailing: [
              { id: 'history', label: 'Tramitação', icon: <ListTree size={15} />, render: () => <TramitacaoTab d={d} /> },
              ...(messageExtra ? [messageExtra] : []),
            ],
          }}
        />
      ) : (
        <div className="space-y-4">
          <OverviewTab d={d} />
          <KeyValueData data={data} />
          <TramitacaoTab d={d} />
          {showMessages && <ProcessMessages executionId={id} originType="report" messageAccess={messageAccess} />}
        </div>
      )}
    </div>
  );
}

function OverviewTab({ d }: { d: import('@/lib/api/execution').InstanceDetail }) {
  return (
    <div className="space-y-3">
      {/* O status vive no HEADER do relatório (StatusPill, largura do texto) — aqui
          seria um bloco redundante ocupando a largura da página. */}

      {/* Resumo */}
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <p className="mb-2 text-sm font-semibold text-slate-700">Resumo</p>
        <div className="space-y-1.5 text-sm text-slate-600">
          <p className="flex items-center gap-2"><Workflow size={14} className="shrink-0 text-slate-400" /> {d.process ?? '—'}{d.number != null ? <span className="text-slate-400"> · Sequencial nº {d.number}</span> : null}</p>
          <p className="flex items-center gap-2"><Clock size={14} className="shrink-0 text-slate-400" /> Iniciado em <b className="text-slate-800">{fmt(d.startedAt)}</b></p>
          <p className="flex items-center gap-2"><User size={14} className="shrink-0 text-slate-400" /> Requerente: <b className="text-slate-800">{d.requester ?? '—'}</b></p>
          {d.activeTask?.assignee && <p className="flex items-center gap-2"><User size={14} className="shrink-0 text-slate-400" /> Responsável atual: <b className="text-slate-800">{d.activeTask.assignee}</b></p>}
        </div>
      </div>

      {/* Tarefa atual (destaque verde) */}
      {d.activeTask && (
        <div className="rounded-lg border-2 border-emerald-300 bg-white p-4">
          <p className="mb-2 text-sm font-semibold text-slate-700">Tarefa atual</p>
          <p className="font-medium text-slate-800">{d.activeTask.name ?? 'Tarefa'}</p>
          <p className="mt-0.5 flex items-center gap-2 text-sm text-slate-500"><User size={13} className="text-slate-400" /> {d.activeTask.assignee ?? 'Sem responsável'}</p>
          {d.activeTask.startedAt && <p className="mt-0.5 flex items-center gap-2 text-xs text-slate-400"><Clock size={12} /> Iniciada em {fmt(d.activeTask.startedAt)}</p>}
          {d.activeTask.dueAt && (
            <p className="mt-0.5 flex items-center gap-2 text-xs text-slate-400">
              <Clock size={12} /> Prazo: {fmt(d.activeTask.dueAt)} <DuePill iso={d.activeTask.dueAt} />
            </p>
          )}
        </div>
      )}

      {/* Inbox da requisição */}
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <p className="mb-1 text-sm font-semibold text-slate-700">Inbox da requisição</p>
        {d.inboxHtml
          ? <div className="prose-sm text-sm text-slate-700 [&_a]:text-sky-600 [&_a]:underline" dangerouslySetInnerHTML={{ __html: d.inboxHtml }} />
          : <p className="text-sm text-slate-400">Sem resumo configurado.</p>}
      </div>
    </div>
  );
}

/** Pílula de status do processo (com ícone). Reaproveitada no header do relatório. */
export function StatusPill({ status }: { status: string }) {
  const v = STATUS[status] ?? { label: status, cls: 'bg-slate-100 text-slate-600' };
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm font-medium ${v.cls}`}><Clock size={14} /> {v.label}</span>;
}

/** Pílula de prazo: verde (>24h), laranja (<24h), vermelho (vencido). */
function DuePill({ iso }: { iso: string }) {
  const diff = new Date(iso).getTime() - Date.now();
  const cls = diff < 0 ? 'bg-rose-100 text-rose-700' : diff < 24 * 3600_000 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700';
  const days = Math.round(diff / 86_400_000);
  return <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${cls}`}>{days < 0 ? `${days} dia(s)` : days === 0 ? 'hoje' : `${days} dia(s)`}</span>;
}

function KeyValueData({ data }: { data: Record<string, unknown> }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm">
      {Object.keys(data).length === 0 ? <span className="text-slate-400">Sem dados.</span> : Object.entries(data).map(([k, v]) => (
        <div key={k} className="flex gap-2 py-0.5"><span className="text-slate-500">{k}:</span><span className="text-slate-800">{String(v)}</span></div>
      ))}
    </div>
  );
}

function TramitacaoTab({ d }: { d: import('@/lib/api/execution').InstanceDetail }) {
  const [hist, setHist] = useState<InstanceTask | null>(null);
  // A tarefa do evento de início É a abertura do processo: ela ganha o selo "início"
  // e o nó sintético só entra quando não há tarefa de início (instâncias legadas),
  // senão o mesmo evento apareceria duas vezes seguidas.
  const temTarefaDeInicio = d.tasks.some((t) => t.isStart);
  return (
    <>
      <ol className="relative ml-2 border-l-2 border-slate-200">
        {/* Ordem DECRESCENTE: o mais recente primeiro; a abertura fecha a lista. */}
        {[...d.tasks].reverse().map((t) => {
          const active = t.status === 'pendente';
          const changes = t.fieldHistory?.length ?? 0;
          return (
            <li key={t.id} className="ml-4 pb-4 last:pb-0">
              <span className={`absolute -left-[7px] mt-1 h-3 w-3 rounded-full ring-2 ring-white ${t.isStart ? 'bg-sky-500' : active ? 'bg-amber-500' : 'bg-emerald-500'}`} />
              <div className={`rounded-md border px-3 py-2 text-sm ${active ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-white'}`}>
                <div className="flex items-start justify-between gap-2">
                  <span className="flex items-center gap-2">
                    {t.isStart ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-700"><Play size={11} /> início</span>
                    ) : (
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${TASK_STATUS[t.status] ?? 'bg-slate-100 text-slate-600'}`}>{active ? 'em andamento' : t.status}</span>
                    )}
                    <span className="font-medium text-slate-800">{t.isStart ? 'Processo iniciado' : (t.name ?? 'Tarefa')}</span>
                    {t.isStart && t.name && <span className="text-xs text-slate-400">· {t.name}</span>}
                  </span>
                  {changes > 0 && (
                    <button type="button" onClick={() => setHist(t)}
                      className="inline-flex shrink-0 items-center gap-1 rounded-md border border-slate-300 px-2 py-0.5 text-xs font-medium text-slate-600 hover:bg-slate-50">
                      <History size={12} /> Ver histórico de alterações
                    </button>
                  )}
                </div>
                <dl className="mt-1.5 grid gap-x-6 gap-y-0.5 text-xs text-slate-500 sm:grid-cols-2">
                  <Info label={t.isStart ? 'Por' : active ? 'Com' : 'Concluída por'}>
                    {active
                      ? (t.assignee ?? 'Sem responsável')
                      : (t.completedByImpersonator
                          ? `${t.completedByImpersonator} em nome de ${t.completedBy}`
                          // O requerente só serve de fallback na linha de ABERTURA. Numa tarefa
                          // comum sem autor, cair no requerente atribuiria a ele algo que não fez.
                          : (t.completedBy ?? (t.isStart ? d.requester : null) ?? '—'))}
                  </Info>
                  {t.isStart
                    ? <Info label="Em">{fmt(t.completedAt ?? d.startedAt)}</Info>
                    : <Info label="Recebida em">{fmt(t.createdAt)}</Info>}
                  {!t.isStart && t.completedAt && <Info label="Concluída em">{fmt(t.completedAt)}</Info>}
                  {t.action && <Info label="Ação">{t.action}</Info>}
                  {t.justification && <Info label="Justificativa">{t.justification}</Info>}
                </dl>
              </div>
            </li>
          );
        })}
        {!temTarefaDeInicio && (
        <li className="ml-4 pb-0">
          <span className="absolute -left-[7px] mt-1 h-3 w-3 rounded-full bg-sky-500 ring-2 ring-white" />
          <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm">
            <span className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-700"><Play size={11} /> início</span>
              <span className="font-medium text-slate-800">Processo iniciado</span>
            </span>
            <dl className="mt-1.5 grid gap-x-6 gap-y-0.5 text-xs text-slate-500 sm:grid-cols-2">
              <Info label="Por">{d.requester ?? '—'}</Info>
              <Info label="Em">{fmt(d.startedAt)}</Info>
            </dl>
          </div>
        </li>
        )}
      </ol>
      {hist && <FieldHistoryDialog task={hist} onClose={() => setHist(null)} />}
    </>
  );
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><dt className="inline text-slate-400">{label}: </dt><dd className="inline font-medium text-slate-700">{children}</dd></div>;
}

/** Modal do histórico de alterações de uma tarefa, agrupado por usuário + timestamp (um "salvar"/"concluir"). */
function FieldHistoryDialog({ task, onClose }: { task: InstanceTask; onClose: () => void }) {
  const groups = groupChanges(task.fieldHistory ?? []);
  return (
    <Dialog open onClose={onClose} width="lg" title={`Histórico de alterações — ${task.name ?? 'Tarefa'}`}
      footer={<button type="button" onClick={onClose} className="rounded-md bg-slate-900 px-3.5 py-1.5 text-sm font-medium text-white hover:bg-slate-700">Fechar</button>}>
      {groups.length === 0 ? (
        <p className="text-sm text-slate-400">Sem alterações registradas.</p>
      ) : (
        <div className="space-y-3">
          {groups.map((g, i) => (
            <div key={i} className="overflow-hidden rounded-md border border-slate-200">
              <div className="flex items-center justify-between gap-2 border-b border-slate-100 bg-slate-50 px-3 py-1.5 text-xs">
                <span className="font-medium text-slate-700">{g.impersonator ? `${g.impersonator} em nome de ${g.changedBy}` : (g.changedBy ?? '—')}</span>
                <span className="text-slate-400">{g.action === 'complete' ? 'concluiu' : 'salvou'} · {fmt(g.changedAt)}</span>
              </div>
              <ul className="divide-y divide-slate-100">
                {g.items.map((c, j) => (
                  <li key={j} className="px-3 py-1.5 text-sm text-slate-600">
                    <span className="font-medium text-slate-700">{c.field}</span>
                    {c.group && <span className="text-slate-400"> ({c.group})</span>}:{' '}
                    <span className="text-rose-600 line-through">{c.oldValue || '—'}</span> → <span className="text-emerald-700">{c.newValue || '—'}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </Dialog>
  );
}

type ChangeGroup = { changedBy: string | null; impersonator: string | null; changedAt: string; action: string; items: FieldChange[] };
function groupChanges(items: FieldChange[]): ChangeGroup[] {
  const map = new Map<string, ChangeGroup>();
  for (const c of items) {
    const key = `${c.changedBy}|${c.impersonator}|${c.changedAt}|${c.action}`;
    let g = map.get(key);
    if (!g) { g = { changedBy: c.changedBy, impersonator: c.impersonator, changedAt: c.changedAt, action: c.action, items: [] }; map.set(key, g); }
    g.items.push(c);
  }
  return [...map.values()].sort((a, b) => (a.changedAt < b.changedAt ? 1 : -1));
}

function StatusBadge({ status }: { status: string }) {
  const v = STATUS[status] ?? { label: status, cls: 'bg-slate-100 text-slate-600' };
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${v.cls}`}>{v.label}</span>;
}

function fmt(iso: string): string {
  try { return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }); } catch { return iso; }
}
