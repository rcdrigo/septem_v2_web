import { CardHeader } from '@/components/ui/CardHeader';
import { TestBadge } from '@/components/execution/TestBadge';
import { ExecutionSummary } from '@/components/execution/ExecutionSummary';
import { useEffect, useId, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertCircle, ArrowRight, CalendarCheck2, CalendarClock, ChevronDown, ChevronLeft, ChevronRight, CircleCheck, CircleHelp, CircleX, Clock, FileText, History, ListTree, MessageSquare, Pencil, Printer, RotateCw, Save, Trash2, Workflow, X } from 'lucide-react';
import { useInstances, useInstance, useMyTasks, useDeleteInstance, useUpdateInstance, type InstanceListItem, type InstanceTask, type FieldChange, type InstanceDetail } from '@/lib/api/execution';
import { ApiError } from '@/lib/api';
import { appHref, openTab } from '@/lib/nav';
import { Dialog } from '@/components/ui/Dialog';
import { ReactForm, type ReactFormHandle } from '@/components/form/ReactForm';
import { confirm } from '@/components/ui/ConfirmDialog';
import { toast } from '@/stores/toast';
import { useViewMode, ViewToggle } from './TarefasPage';
import { ProcessMessages } from '@/components/execution/ProcessMessages';
import { routes } from '@/lib/routes';
import { AcoesDoProcesso } from '@/components/execution/AcoesDoProcesso';
import { ContextHelp } from '@/components/guide/ContextHelp';
import { TagPills, TagsButton } from '@/components/tags';

import { ExecutionFilters, useExecutionFilters } from '@/components/execution/ExecutionFilters';
import { useTagsAccess } from '@/lib/api/tags';
import { CardAccess, ExecutionIndicators, ExecutionNumber, ExecutionProcessPill } from '@/components/execution/ExecutionListParts';

const STATUS = { em_andamento: { label: 'Em andamento', cls: 'bg-sky-100 text-sky-700' }, concluido: { label: 'Concluído', cls: 'bg-emerald-100 text-emerald-700' }, cancelado: { label: 'Cancelado', cls: 'bg-rose-100 text-rose-700' } } as Record<string, { label: string; cls: string }>;

/** Requisições feitas pelo usuário ou com uma tarefa concluída por ele. */
export function InstanciasPage({ title = 'Requisições' }: { title?: string } = {}) {
  const [params, setParams] = useSearchParams();
  const canUseTags = useTagsAccess();
  const { filters, patch, clear } = useExecutionFilters('requests', canUseTags);
  const page = Math.max(1, Number(params.get('page')) || 1);
  const [view, setView] = useViewMode('septem.requests.view');
  const pageSize = 20;
  const openReport = (id: string) => openTab(routes.request(id));
  const list = useInstances({ ...filters, scope: 'personal', page, pageSize });
  const total = list.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  function update(next: { page: string }) {
    setParams(current => { const value = new URLSearchParams(current); value.set('page', next.page); return value; });
  }

  return (
    <div className="task-index-root flex h-full min-w-0 flex-col">
      <header className="flex items-center justify-between gap-4 border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <h1 className="text-lg font-semibold text-slate-900">{title}</h1>
            <ContextHelp manual="operacao-tarefas-requisicoes" section="acompanhar-requisicoes" label="Ajuda sobre requisições" />
          </div>
          <p className="mt-0.5 truncate text-sm text-slate-500">Requisições feitas por você ou em que concluiu uma tarefa.</p>
        </div>
        <ViewToggle view={view} setView={setView} />
      </header>
      <div className="border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
        <ExecutionFilters kind="requests" filters={filters} processes={list.data?.processes ?? []} tagNames={canUseTags ? (list.data?.tagNames ?? []) : undefined} busy={list.isFetching} onChange={patch} onClear={clear} />
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

function RequestCards({ items, onOpen }: { items: InstanceListItem[]; onOpen: (id: string) => void }) {
  return <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-3">{items.map((item) => <article key={item.id} data-testid="req-card" role="link" aria-label={`${item.process || 'Requisição'} ${item.number ?? ''}`} tabIndex={0} onClick={() => onOpen(item.id)} onKeyDown={(event) => { if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); onOpen(item.id); } }} className="task-card group relative flex min-w-0 cursor-pointer flex-col rounded-lg border border-slate-200 bg-white p-4 shadow-sm hover:border-slate-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-700">
    <div className="flex min-w-0 items-start justify-between gap-3"><div className="min-w-0"><ExecutionProcessPill item={item} /></div><ExecutionNumber executionId={item.id} number={item.number} /></div>
    <div className="task-card-main relative mt-3 flex-1">
      <h2 className="text-sm font-bold text-slate-900">{STATUS[item.status]?.label || item.status}</h2>
      <ExecutionSummary html={item.inboxHtml} text={item.inboxText} className="mt-1 line-clamp-3 min-h-12 text-xs leading-4 text-slate-500" />
      <CardAccess />
    </div>
    <div data-testid="req-card-footer" className="mt-4 flex min-w-0 items-start justify-between gap-3 text-xs text-slate-500">
      <span className="inline-flex min-w-0 items-center gap-1" title={`Início: ${fmt(item.startedAt)}`}><CalendarClock size={13} className="shrink-0" /><span>Início {fmt(item.startedAt)}</span></span>
      <span className="inline-flex min-w-0 items-center justify-end gap-1 text-right" title={`Conclusão: ${item.endedAt ? fmt(item.endedAt) : 'Não concluída'}`}><CalendarCheck2 size={13} className="shrink-0" /><span>Fim {item.endedAt ? fmt(item.endedAt) : '—'}</span></span>
    </div>
    <ExecutionIndicators isTest={item.isTest} tags={item.tags} className="mt-3 border-t border-slate-100 pt-2" />
  </article>)}</div>;
}
function RequestTable({ items, onOpen }: { items: InstanceListItem[]; onOpen: (id: string) => void }) {
  return <div className="rounded-lg border border-slate-200 bg-white"><table className="w-full table-fixed text-sm">
    <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th scope="col" className="w-28 px-4 py-3 text-left">Nº</th><th scope="col" className="w-[22%] px-4 py-3 text-left">Processo</th><th scope="col" className="px-4 py-3 text-left">Resumo</th><th scope="col" className="w-[16%] px-4 py-3 text-left">Status</th><th scope="col" className="w-[20%] px-4 py-3 text-left">Início / fim</th></tr></thead>
    <tbody>{items.map((item) => <tr key={item.id} tabIndex={0} onClick={() => onOpen(item.id)} onKeyDown={(event) => { if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); onOpen(item.id); } }} className="group cursor-pointer border-t border-slate-100 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-slate-700">
      <td className="px-4 py-3 align-top"><ExecutionNumber executionId={item.id} number={item.number} /></td>
      <td className="px-4 py-3 align-top"><ExecutionProcessPill item={item} /></td>
      <td className="min-w-0 px-4 py-3 align-top"><ExecutionSummary html={item.inboxHtml} text={item.inboxText} className="line-clamp-3 text-xs leading-4 text-slate-500" fallback="—" /><ExecutionIndicators isTest={item.isTest} tags={item.tags} className="mt-2" /></td>
      <td className="px-4 py-3 align-top"><StatusBadge status={item.status} /></td>
      <td className="px-4 py-3 align-top text-xs text-slate-500"><p>Início {fmt(item.startedAt)}</p><p className="mt-1">Fim {item.endedAt ? fmt(item.endedAt) : '—'}</p><span className="task-access mt-2 inline-flex items-center gap-1 whitespace-nowrap font-semibold text-slate-700 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100">Acessar <ArrowRight size={14} /></span></td>
    </tr>)}</tbody>
  </table></div>;
}
function RequestSkeletons() { return <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-label="Carregando requisições">{[0, 1, 2].map((item) => <div key={item} className="h-52 animate-pulse rounded-lg border border-slate-200 bg-white p-4"><div className="h-6 w-32 rounded-full bg-slate-100" /><div className="mt-4 h-10 rounded bg-slate-100" /></div>)}</div>; }
function RequestError({ onRetry }: { onRetry: () => void }) { return <div role="alert" className="mx-auto flex max-w-md flex-col items-center py-16 text-center"><AlertCircle className="text-rose-600" /><p className="mt-3 font-semibold text-slate-900">Não foi possível carregar as requisições</p><button type="button" onClick={onRetry} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-md bg-slate-900 px-4 text-sm font-semibold text-white"><RotateCw size={15} />Tentar novamente</button></div>; }

/** Relatório organizado por resumo, tarefa ativa, formulário e mensagens. */
export function InstanceReport({ id, messageAccess }: { id: string; messageAccess?: string | null }) {
  const inst = useInstance(id, messageAccess);
  const update = useUpdateInstance();
  const del = useDeleteInstance();
  const formRef = useRef<ReactFormHandle>(null);
  const actionsTriggerRef = useRef<HTMLButtonElement>(null);
  const actionsPanelRef = useRef<HTMLDivElement>(null);
  const actionsPanelId = useId();
  const [editing, setEditing] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);

  useEffect(() => {
    if (!actionsOpen) return;
    actionsPanelRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      if (document.querySelector('[role="dialog"], [role="alertdialog"]')) return;
      event.preventDefault();
      setActionsOpen(false);
      actionsTriggerRef.current?.focus();
    }
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [actionsOpen]);

  if (inst.isLoading) return <p role="status" className="text-sm text-slate-500">Carregando requisição…</p>;
  if (inst.isError || !inst.data) {
    const status = inst.error instanceof ApiError ? inst.error.status : null;
    const message = status === 403 ? 'Você não tem acesso a esta requisição.'
      : status === 404 ? 'Esta requisição não foi encontrada.'
        : 'Não foi possível carregar a requisição. Verifique sua conexão e tente novamente.';
    return <div role="alert" className="rounded-md border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"><p>{message}</p>{status !== 403 && status !== 404 && <button type="button" onClick={() => inst.refetch()} className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-md border border-rose-300 bg-white px-3 font-medium hover:bg-rose-100"><RotateCw size={15} /> Tentar novamente</button>}</div>;
  }
  const d = inst.data;
  const data = (d.data ?? {}) as Record<string, unknown>;
  const canEditForm = !!d.canEdit && !!d.formSchema; // edição inline só quando há schema
  const hasActions = canEditForm || !!d.canCancel || !!d.canDelete || !!d.canReturn || !!d.canForward || !!d.canReassign || !!d.canReopen;
  const showMessages = (d.messages?.count ?? 0) > 0 || d.messages?.canPost === true;


  async function doSave() {
    const res = await formRef.current?.submit();
    if (!res) return;
    if (Object.keys(res.errors).length > 0) { toast.error('Corrija os campos destacados antes de salvar.'); return; }
    try { await update.mutateAsync({ id, data: res.data }); toast.success('Alterações salvas.'); setEditing(false); }
    catch { toast.error('Não foi possível salvar as alterações.'); }
  }
  async function doDelete() {
    setActionsOpen(false);
    if (!(await confirm({ title: 'Excluir requisição', message: 'A requisição sairá das listagens. O histórico será preservado.', confirmLabel: 'Excluir requisição', destructive: true }))) return;
    try { await del.mutateAsync(id); toast.success('Requisição excluída.'); window.close(); } catch { toast.error('Não foi possível excluir a requisição.'); }
  }

  return (
    <div className="space-y-4">
      <header className="border-b border-slate-200 bg-white p-4 sm:p-6">
        <div className="flex min-w-0 flex-col justify-between gap-4 lg:flex-row lg:items-start">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3"><h1 className="text-xl font-semibold text-slate-900">Requisição{d.number != null ? ` nº ${d.number}` : ''}</h1><StatusPill status={d.status} />{d.isTest && <TestBadge />}</div>
            <p className="mt-2 break-words text-base font-medium text-slate-700">{d.process ?? 'Processo não informado'}</p>
            <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-3 text-sm">
              <div><dt className="text-xs text-slate-500">Data de início</dt><dd className="mt-1 text-slate-700">{fmt(d.startedAt)}</dd></div>
              <div className="min-w-0"><dt className="text-xs text-slate-500">Requisitante</dt><dd className="mt-1 break-words text-slate-700">{d.requester ?? 'Não informado'}</dd></div>
            </dl>
            {!!d.tags?.length && <div className="mt-3"><TagPills tags={d.tags} /></div>}
          </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2 print:hidden">
        <TagsButton executionId={id} />
        <button type="button" onClick={() => window.print()}
          className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"><Printer size={15} /> Imprimir</button>

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
            <button ref={actionsTriggerRef} type="button" aria-expanded={actionsOpen} aria-controls={actionsPanelId} onClick={() => setActionsOpen((o) => !o)}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">Ações <ChevronDown size={14} /></button>
            {actionsOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setActionsOpen(false)} />
                <div id={actionsPanelId} ref={actionsPanelRef} className="absolute right-0 z-20 mt-1 w-max max-w-[calc(100vw-2rem)] overflow-x-auto rounded-md border border-slate-200 bg-white py-1 shadow-lg">
                  {/* Ações administrativas (Fase 4): cada uma abre um modal com
                      justificativa obrigatória. O menu fecha ao escolher. */}
                  {canEditForm && <button type="button" onClick={() => { setEditing(true); setActionsOpen(false); }} className="flex min-h-11 w-full items-center gap-2 whitespace-nowrap px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"><Pencil size={14} /> Editar</button>}
                  <AcoesDoProcesso id={id} d={d} onFeito={() => setActionsOpen(false)} />
                  {d.canDelete && (
                    <button type="button" onClick={doDelete}
                      className="flex min-h-11 w-full items-center gap-2 whitespace-nowrap px-3 py-2 text-left text-sm text-rose-700 hover:bg-rose-50"><Trash2 size={14} /> Excluir requisição</button>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      </div>
      </header>
      <div className="space-y-6 p-3 sm:p-6">
        {d.inboxHtml && <section aria-labelledby="request-summary-heading" className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm"><CardHeader id="request-summary-heading" title="Resumo do processo" icon={<FileText size={17} />} /><div className="p-4"><ExecutionSummary html={d.inboxHtml} className="text-sm leading-relaxed text-slate-700" /></div></section>}
        <NextStep d={d} onHistory={() => setHistoryOpen(true)} />
        <section aria-labelledby="request-form-heading" className="min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <CardHeader id="request-form-heading" title="Informações do formulário" icon={<FileText size={17} />} />
          <div className="p-4">
          {d.formSchema ? <ReactForm key={`${id}:${editing}`} ref={formRef} automationScripts={d.automationScripts} schema={d.formSchema} data={data} readOnly={!editing} /> : <KeyValueData data={data} />}</div>
        </section>
        {showMessages ? <ProcessMessages executionId={id} originType="report" messageAccess={messageAccess} /> : <section aria-labelledby="request-messages-heading" className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm"><CardHeader id="request-messages-heading" title="Mensagens" icon={<MessageSquare size={17} />} /><p className="p-4 text-sm text-slate-500">Nenhuma mensagem disponível.</p></section>}
      </div>
      <Dialog open={historyOpen} onClose={() => setHistoryOpen(false)} title="Tramitação completa" width="xl">
        <TramitacaoTab d={d} />
      </Dialog>
    </div>
  );
}

function NextStep({ d, onHistory }: { d: InstanceDetail; onHistory: () => void }) {
  const tasks = useMyTasks();
  const ongoing = d.status === 'em_andamento';
  const ownTasks = ongoing && tasks.isSuccess && !tasks.isPlaceholderData && !tasks.isFetching
    ? tasks.data.items.filter((task) => task.executionId === d.id) : [];
  const lastTask = [...d.tasks].filter(task => task.completedAt).sort((a, b) => Date.parse(b.completedAt!) - Date.parse(a.completedAt!))[0];
  const completedBy = lastTask?.completedByImpersonator ? `${lastTask.completedByImpersonator} em nome de ${lastTask.completedBy ?? 'usuário não informado'}` : lastTask?.completedBy;
  return (
    <section aria-labelledby="request-next-step-heading" className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <CardHeader id="request-next-step-heading" title={d.status === 'concluido' ? 'Processo concluído' : d.status === 'cancelado' ? 'Processo cancelado' : 'Tarefa ativa'} icon={<Workflow size={17} />}
        action={<button type="button" onClick={onHistory} className="inline-flex min-h-7 items-center gap-1.5 rounded border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-700"><ListTree size={13} /> Visualizar tramitação completa</button>} />
      <div className="p-4">
        {ongoing && d.activeTask ? <>
          <p className="break-words font-medium text-slate-900">{d.activeTask.name ?? 'Tarefa sem nome'}</p>
          <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-3">
            <div><dt className="text-xs text-slate-500">Data de início</dt><dd className="mt-1 text-slate-700">{d.activeTask.startedAt ? fmt(d.activeTask.startedAt) : 'Não informada'}</dd></div>
            <div><dt className="text-xs text-slate-500">Previsão de conclusão</dt><dd className="mt-1 flex flex-wrap items-center gap-2 text-slate-700">{d.activeTask.dueAt ? <>{fmt(d.activeTask.dueAt)} <DuePill iso={d.activeTask.dueAt} /></> : 'Não informada'}</dd></div>
            <div className="min-w-0"><dt className="text-xs text-slate-500">Responsáveis pela tarefa</dt><dd className="mt-1 break-words text-slate-700">{d.activeTask.assignee ?? 'Não informados'}</dd></div>
          </dl>
        </> : <p className="mt-3 text-sm text-slate-700">{d.status === 'concluido' ? <>Processo concluído{d.endedAt ? ` em ${fmt(d.endedAt)}` : ' em data não informada'}. {completedBy ? `Responsável pela última tarefa: ${completedBy}.` : 'Responsável pela conclusão não informado.'}</> : d.status === 'cancelado' ? <>Processo cancelado{d.endedAt ? ` em ${fmt(d.endedAt)}` : ''}.</> : 'Nenhuma tarefa ativa no momento. Consulte a tramitação para acompanhar o processo.'}</p>}
      </div>
      {ongoing && (tasks.isLoading || tasks.isFetching || tasks.isError || ownTasks.length > 0) && <footer className="border-t border-sky-200 bg-sky-50 px-4 py-4">
        {tasks.isLoading || tasks.isFetching ? <p role="status" className="text-sm text-sky-900">Verificando suas tarefas pendentes…</p> : tasks.isError ? <><p className="text-sm text-sky-900">Não foi possível verificar se há uma tarefa para você nesta requisição.</p><button type="button" onClick={() => tasks.refetch()} className="mt-2 inline-flex min-h-11 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-800"><RotateCw size={15} /> Verificar novamente</button></> : <>
          <p className="text-sm font-medium text-sky-900">{ownTasks.length === 1 ? 'Há uma tarefa pendente sob sua responsabilidade.' : `Há ${ownTasks.length} tarefas pendentes sob sua responsabilidade.`}</p>
          <div className="mt-2 flex flex-wrap gap-3">{ownTasks.map(task => <a key={task.id} href={appHref(routes.task(task.id))} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-sky-800 underline underline-offset-4"><span className="break-words">{ownTasks.length === 1 ? 'Abrir tarefa' : `Abrir tarefa: ${task.name ?? 'sem nome'}`}</span><ArrowRight size={15} className="shrink-0" /></a>)}</div>
        </>}
      </footer>}
    </section>
  );
}

/** Pílula de status do processo (com ícone). Reaproveitada no header do relatório. */
export function StatusPill({ status }: { status: string }) {
  const v = STATUS[status] ?? { label: status, cls: 'bg-slate-100 text-slate-600' };
  const Icon = status === 'concluido' ? CircleCheck : status === 'cancelado' ? CircleX : status === 'em_andamento' ? Clock : CircleHelp;
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm font-medium ${v.cls}`}><Icon size={14} aria-hidden="true" /> {v.label}</span>;
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

/** Rótulos das ações administrativas na tramitação. */
const ROTULO_ACAO: Record<string, string> = {
  cancel: 'Requisição cancelada',
  reopen: 'Requisição reaberta',
  return: 'Devolvido para tarefa já executada',
  forward: 'Encaminhado para nova tarefa',
  reassign: 'Requisição realocada',
};

function TramitacaoTab({ d }: { d: InstanceDetail }) {
  const [hist, setHist] = useState<InstanceTask | null>(null);
  type Entry = { id: string; at: string; title: string; state: string; actor: string; task?: InstanceTask; action?: NonNullable<InstanceDetail['actions']>[number] };
  const entries: Entry[] = d.tasks.map(task => ({
    id: `task:${task.id}`,
    at: task.isStart ? task.completedAt ?? d.startedAt : task.completedAt ?? task.createdAt,
    title: task.isStart ? 'Requisição iniciada' : task.name ?? 'Tarefa sem nome',
    state: task.isStart ? 'Abertura' : task.status === 'pendente' ? 'Em andamento' : task.status === 'concluida' ? 'Concluída' : task.status === 'cancelada' ? 'Cancelada' : task.status,
    actor: task.status === 'pendente' ? task.assignee ?? 'Responsável não informado' : task.completedByImpersonator ? `${task.completedByImpersonator} em nome de ${task.completedBy ?? 'usuário não informado'}` : task.completedBy ?? (task.isStart ? d.requester : null) ?? 'Responsável não informado',
    task,
  }));
  for (const [index, action] of (d.actions ?? []).entries()) entries.push({
    id: `action:${index}`, at: action.at, title: ROTULO_ACAO[action.action] ?? action.action,
    state: 'Ação administrativa', actor: action.onBehalfOf ? `${action.actor ?? 'Usuário não informado'} em nome de ${action.onBehalfOf}` : action.actor ?? 'Responsável não informado', action,
  });
  if (!d.tasks.some(task => task.isStart)) entries.push({ id: 'start', at: d.startedAt, title: 'Requisição iniciada', state: 'Abertura', actor: d.requester ?? 'Requisitante não informado' });
  if (d.endedAt && d.status === 'concluido') entries.push({ id: 'end', at: d.endedAt, title: 'Processo concluído', state: 'Encerramento', actor: '' });
  entries.sort((a, b) => Date.parse(b.at) - Date.parse(a.at) || (a.id === 'end' ? -1 : b.id === 'end' ? 1 : 0));
  return <>
    <p className="mb-5 text-xs text-slate-500">Do evento mais recente ao mais antigo.</p>
    <ol className="divide-y divide-slate-200">
      {entries.map(entry => {
        const task = entry.task;
        return <li key={entry.id} className="min-w-0 py-4 first:pt-0 last:pb-0">
          <div className="min-w-0">
            <p className="break-words text-sm leading-8 text-slate-600">
              {task && !task.isStart ? <>
                <strong className="font-semibold text-slate-900">{entry.title}</strong> recebida{!task.completedAt && <> por <strong className="font-medium text-slate-800">{task.assignee ?? 'responsável não informado'}</strong></>} em <HistoryDate iso={task.createdAt} />
                {task.completedAt ? <> e <span data-testid="completion-action-chip" className="inline-block max-w-full rounded-md px-2 py-1 align-baseline text-xs font-medium leading-normal" style={task.actionPrimaryColor ? { backgroundColor: task.actionPrimaryColor, color: task.actionTextColor ?? '#fff' } : { backgroundColor: '#0f172a', color: '#fff' }}>{task.action ?? (task.status === 'cancelada' ? 'Cancelada' : 'Concluída')}</span> por <strong className="font-medium text-slate-800">{entry.actor}</strong> em <HistoryDate iso={task.completedAt} /></>
                  : task.dueAt ? <>, com previsão de conclusão em <HistoryDate iso={task.dueAt} dateOnly /></> : task.status === 'pendente' ? <>, sem previsão de conclusão informada</> : <>. Status: {entry.state}</>}
              </> : <>
                <strong className="font-semibold text-slate-900">{entry.title}</strong>{entry.actor && <> por <strong className="font-medium text-slate-800">{entry.actor}</strong></>} em <HistoryDate iso={entry.at} />
                {entry.action?.targetTaskName && <>, para a tarefa <strong className="font-medium text-slate-800">{entry.action.targetTaskName}</strong></>}
                {entry.action?.targetUser && <>, para <strong className="font-medium text-slate-800">{entry.action.targetUser}</strong></>}
              </>}
            </p>
            {(task?.justification || entry.action?.justification) && <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-600">{task?.justification || entry.action?.justification}</p>}
            {!!task?.fieldHistory?.length && <button type="button" onClick={() => setHist(task)} className="mt-2 inline-flex min-h-9 items-center gap-1.5 rounded text-left text-xs font-medium text-slate-700 underline underline-offset-4 hover:text-slate-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-700"><History size={14} className="shrink-0" /> Ver histórico de alterações</button>}
          </div>
        </li>;
      })}
    </ol>
    {hist && <FieldHistoryDialog task={hist} onClose={() => setHist(null)} />}
  </>;
}

/** Datas legíveis dentro da narrativa; chips podem quebrar em telas estreitas. */
function HistoryDate({ iso, dateOnly = false }: { iso: string; dateOnly?: boolean }) {
  const date = new Date(iso);
  const label = Number.isNaN(date.getTime()) ? 'Data não informada' : dateOnly
    ? date.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })
    : `${date.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })} às ${date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
  return <time dateTime={Number.isNaN(date.getTime()) ? undefined : iso} className="inline-block max-w-full rounded-md bg-slate-100 px-2 py-1 align-baseline text-xs font-medium leading-normal text-slate-700">{label}</time>;
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
  return <span className={`inline-block rounded-full px-2 py-0.5 text-center text-xs font-medium ${v.cls}`}>{v.label}</span>;
}

function fmt(iso: string): string {
  try { return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }); } catch { return iso; }
}
