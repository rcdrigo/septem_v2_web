import { useState } from 'react';
import { ChevronLeft, ChevronRight, Clock, LayoutDashboard, ListTree, Pencil, Search, Trash2, User, Workflow, XCircle } from 'lucide-react';
import { useInstances, useInstance, useCancelInstance, useDeleteInstance, type InstanceListItem } from '@/lib/api/execution';
import { openTab } from '@/lib/nav';
import { ReactForm } from '@/components/form/ReactForm';
import { useSessionStore } from '@/stores/session';
import { confirm } from '@/components/ui/ConfirmDialog';
import { toast } from '@/stores/toast';

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
export function InstanciasPage({ title = 'Tarefas executadas', lockMine = false, initialStatus = '' }: InstanciasPageProps = {}) {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState(initialStatus);
  const [mine, setMine] = useState(lockMine);
  const [page, setPage] = useState(1);
  const pageSize = 20;
  // Relatório da instância abre em nova aba (sem menus), não mais em modal.
  const openReport = (id: string) => openTab(`/solicitacao/${id}`);

  const list = useInstances({ q: q || undefined, status: status || undefined, mine, page, pageSize });
  const total = list.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-slate-200 bg-white px-6 py-4"><h1 className="text-lg font-semibold text-slate-900">{title}</h1></header>
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-white px-6 py-3">
        <div className="relative flex-1 min-w-48">
          <Search size={16} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="search" placeholder="Buscar por processo..." value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} className="w-full rounded-md border border-slate-300 bg-white py-1.5 pl-8 pr-3 text-sm focus:border-slate-500 focus:outline-none" />
        </div>
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm">
          <option value="">Todos os status</option>
          <option value="em_andamento">Em andamento</option>
          <option value="concluido">Concluídos</option>
          <option value="cancelado">Cancelados</option>
        </select>
        {!lockMine && <label className="flex items-center gap-1.5 text-sm text-slate-600"><input type="checkbox" checked={mine} onChange={(e) => { setMine(e.target.checked); setPage(1); }} /> Apenas as que iniciei</label>}
      </div>

      <div className="flex-1 overflow-auto p-6">
        {!list.isLoading && total === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-400"><Workflow size={26} /></div>
            <p className="text-sm font-medium text-slate-700">Nenhuma instância</p>
            <p className="mt-1 text-sm text-slate-500">Processos iniciados aparecem aqui para acompanhamento.</p>
          </div>
        ) : (
          <>
            <table className="w-full overflow-hidden rounded-md border border-slate-200 bg-white text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-2 text-left">Processo</th><th className="px-4 py-2 text-left">Status</th><th className="px-4 py-2 text-left">Pendentes</th><th className="px-4 py-2 text-left">Início</th><th className="px-4 py-2 w-20" /></tr></thead>
              <tbody>
                {list.isLoading && <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">Carregando...</td></tr>}
                {list.data?.items.map((i: InstanceListItem) => (
                  <tr key={i.id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-2 font-medium text-slate-800">{i.process ?? '—'}</td>
                    <td className="px-4 py-2"><StatusBadge status={i.status} /></td>
                    <td className="px-4 py-2 text-slate-600">{i.pendingTasks}</td>
                    <td className="px-4 py-2 text-slate-500">{fmt(i.startedAt)}</td>
                    <td className="px-4 py-2 text-right"><button type="button" onClick={() => openReport(i.id)} className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50">Ver</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
              <span>{total} instância{total === 1 ? '' : 's'}</span>
              <div className="flex items-center gap-2">
                <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded border border-slate-300 p-1 disabled:opacity-40"><ChevronLeft size={14} /></button>
                <span>{page} / {totalPages}</span>
                <button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="rounded border border-slate-300 p-1 disabled:opacity-40"><ChevronRight size={14} /></button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/** Conteúdo do relatório de uma instância: abas Visão geral + Formulário (só-leitura) + Tramitação. */
export function InstanceReport({ id }: { id: string }) {
  const inst = useInstance(id);
  const canWrite = useSessionStore((s) => s.can('workflow:write'));
  const cancel = useCancelInstance();
  const del = useDeleteInstance();
  if (inst.isLoading) return <p className="text-sm text-slate-400">Carregando...</p>;
  const d = inst.data!;
  const data = (d.data ?? {}) as Record<string, unknown>;

  async function doCancel() {
    if (!(await confirm({ title: 'Cancelar processo', message: 'A instância será marcada como cancelada. Continuar?' }))) return;
    try { await cancel.mutateAsync(id); toast.success('Processo cancelado.'); } catch { toast.error('Não foi possível cancelar.'); }
  }
  async function doDelete() {
    if (!(await confirm({ title: 'Excluir processo', message: 'A instância sairá das listagens (histórico preservado). Continuar?' }))) return;
    try { await del.mutateAsync(id); toast.success('Processo excluído.'); window.close(); } catch { toast.error('Não foi possível excluir.'); }
  }

  return (
    <div className="space-y-4">
      {canWrite && (
        <div className="flex flex-wrap items-center gap-2">
          {d.flowKey && (
            <button type="button" onClick={() => openTab(`/processos/editar?key=${encodeURIComponent(d.flowKey!)}`)}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"><Pencil size={14} /> Editar processo</button>
          )}
          {d.status === 'em_andamento' && (
            <button type="button" onClick={doCancel} disabled={cancel.isPending}
              className="inline-flex items-center gap-1.5 rounded-md border border-amber-300 px-3 py-1.5 text-sm font-medium text-amber-700 hover:bg-amber-50 disabled:opacity-60"><XCircle size={14} /> Cancelar</button>
          )}
          <button type="button" onClick={doDelete} disabled={del.isPending}
            className="inline-flex items-center gap-1.5 rounded-md border border-rose-300 px-3 py-1.5 text-sm font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-60"><Trash2 size={14} /> Excluir</button>
        </div>
      )}

      {/* Mesma estrutura do formulário (read-only) com Visão geral (1ª) e Tramitação (última)
          na mesma barra de abas. Sem schema (instâncias legadas) → fallback empilhado. */}
      {d.formSchema ? (
        <ReactForm
          schema={d.formSchema}
          data={data}
          readOnly
          extraTabs={{
            leading: [{ id: 'overview', label: 'Visão geral', icon: <LayoutDashboard size={15} />, render: () => <OverviewTab d={d} /> }],
            trailing: [{ id: 'history', label: 'Tramitação', icon: <ListTree size={15} />, render: () => <TramitacaoTab d={d} /> }],
          }}
        />
      ) : (
        <div className="space-y-4">
          <OverviewTab d={d} />
          <KeyValueData data={data} />
          <TramitacaoTab d={d} />
        </div>
      )}
    </div>
  );
}

function OverviewTab({ d }: { d: import('@/lib/api/execution').InstanceDetail }) {
  const s = STATUS[d.status] ?? { label: d.status, cls: 'bg-slate-100 text-slate-600' };
  return (
    <div className="space-y-3">
      <div className={`flex items-center gap-2 rounded-md px-4 py-3 text-sm font-medium ${s.cls}`}>
        <Clock size={15} /> Status do processo: {s.label}
        {d.number != null ? <span className="font-normal opacity-80">· nº {d.number}</span> : null}
      </div>

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
  return (
    <ol className="relative ml-2 border-l-2 border-slate-200">
      {d.tasks.map((t) => {
        const active = t.status === 'pendente';
        return (
          <li key={t.id} className="ml-4 pb-4 last:pb-0">
            <span className={`absolute -left-[7px] mt-1 h-3 w-3 rounded-full ring-2 ring-white ${active ? 'bg-amber-500' : 'bg-emerald-500'}`} />
            <div className={`rounded-md border px-3 py-2 text-sm ${active ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-white'}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${TASK_STATUS[t.status] ?? 'bg-slate-100 text-slate-600'}`}>{active ? 'em andamento' : t.status}</span>
                  <span className="font-medium text-slate-800">{t.name ?? 'Tarefa'}</span>
                  {t.action && <span className="text-xs text-slate-400">· {t.action}</span>}
                </span>
                <span className="text-right text-xs text-slate-400">
                  {t.completedAt
                    ? (t.completedByImpersonator
                        ? <>concluída {fmt(t.completedAt)} · por {t.completedByImpersonator} em nome de {t.completedBy}</>
                        : <>concluída {fmt(t.completedAt)}{t.completedBy && <> · por {t.completedBy}</>}</>)
                    : <>criada {fmt(t.createdAt)}{t.assignee && <> · com {t.assignee}</>}</>}
                </span>
              </div>
              {t.fieldHistory && t.fieldHistory.length > 0 && (
                <ul className="mt-1.5 space-y-0.5 border-l-2 border-slate-100 pl-3 text-xs text-slate-500">
                  {t.fieldHistory.map((c, i) => (
                    <li key={i}>
                      <span className="font-medium text-slate-700">{c.field}</span>
                      {c.group && <span className="text-slate-400"> ({c.group})</span>}: {' '}
                      <span className="text-rose-600 line-through">{c.oldValue || '—'}</span> → <span className="text-emerald-700">{c.newValue || '—'}</span>
                      {' · '}{c.action === 'complete' ? 'concluiu' : 'salvou'} · {c.impersonator ? <>{c.impersonator} em nome de {c.changedBy}</> : (c.changedBy ?? '—')}
                      {' · '}{fmt(c.changedAt)}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function StatusBadge({ status }: { status: string }) {
  const v = STATUS[status] ?? { label: status, cls: 'bg-slate-100 text-slate-600' };
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${v.cls}`}>{v.label}</span>;
}

function fmt(iso: string): string {
  try { return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }); } catch { return iso; }
}
