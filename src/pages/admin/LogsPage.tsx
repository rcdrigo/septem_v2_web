import { useState } from 'react';
import { ChevronLeft, ChevronRight, ScrollText } from 'lucide-react';
import { useAuditLogs, type AuditEntry } from '@/lib/api/audit-logs';

/**
 * Admin › Configurações › Logs — IF1.e. Visualizador da trilha de auditoria
 * (`GET /api/v1/audit-logs`) com filtros por ação, entidade e período + paginação.
 */
export function LogsPage() {
  const [action, setAction] = useState('');
  const [entityType, setEntityType] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 50;

  const list = useAuditLogs({
    action: action || undefined,
    entityType: entityType || undefined,
    from: from || undefined,
    to: to || undefined,
    page,
    pageSize,
  });
  const total = list.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  function resetPage<T>(setter: (v: T) => void) {
    return (v: T) => { setter(v); setPage(1); };
  }

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-slate-200 bg-white px-6 py-4">
        <h1 className="text-lg font-semibold text-slate-900">Logs de auditoria</h1>
      </header>

      <div className="flex flex-wrap items-end gap-3 border-b border-slate-200 bg-white px-6 py-3">
        <FilterField label="Ação">
          <input value={action} onChange={(e) => resetPage(setAction)(e.target.value)} placeholder="create, update, status…" className={inputCls} />
        </FilterField>
        <FilterField label="Entidade">
          <input value={entityType} onChange={(e) => resetPage(setEntityType)(e.target.value)} placeholder="user, flow, org_unit…" className={inputCls} />
        </FilterField>
        <FilterField label="De">
          <input type="date" value={from} onChange={(e) => resetPage(setFrom)(e.target.value)} className={inputCls} />
        </FilterField>
        <FilterField label="Até">
          <input type="date" value={to} onChange={(e) => resetPage(setTo)(e.target.value)} className={inputCls} />
        </FilterField>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {!list.isLoading && total === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-400">
              <ScrollText size={26} />
            </div>
            <p className="text-sm font-medium text-slate-700">Nenhum evento</p>
            <p className="mt-1 text-sm text-slate-500">Ajuste os filtros ou aguarde novas ações no sistema.</p>
          </div>
        ) : (
          <>
            <table className="w-full overflow-hidden rounded-md border border-slate-200 bg-white text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2 text-left">Quando</th>
                  <th className="px-4 py-2 text-left">Ação</th>
                  <th className="px-4 py-2 text-left">Entidade</th>
                  <th className="px-4 py-2 text-left">Usuário</th>
                  <th className="px-4 py-2 text-left">IP</th>
                </tr>
              </thead>
              <tbody>
                {list.isLoading && <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">Carregando...</td></tr>}
                {list.data?.items.map((a) => (
                  <tr key={a.id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-2 text-slate-500">{formatDateTime(a.occurredAt)}</td>
                    <td className="px-4 py-2"><ActionBadge action={a.action} /></td>
                    <td className="px-4 py-2 text-slate-600">
                      {a.entityType ?? '—'}
                      {a.entityId && <code className="ml-1 text-[11px] text-slate-400">{shorten(a.entityId)}</code>}
                    </td>
                    <td className="px-4 py-2 text-slate-600">{a.userId ?? '—'}</td>
                    <td className="px-4 py-2 text-slate-500">{a.ip ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
              <span>{total} evento{total === 1 ? '' : 's'}</span>
              <div className="flex items-center gap-2">
                <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded border border-slate-300 p-1 disabled:opacity-40">
                  <ChevronLeft size={14} />
                </button>
                <span>{page} / {totalPages}</span>
                <button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="rounded border border-slate-300 p-1 disabled:opacity-40">
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const inputCls = 'rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm focus:border-slate-500 focus:outline-none';

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs uppercase tracking-wide text-slate-400">{label}</span>
      {children}
    </label>
  );
}

function ActionBadge({ action }: { action: AuditEntry['action'] }) {
  const cls =
    action === 'create' ? 'bg-emerald-100 text-emerald-700'
    : action === 'delete' ? 'bg-rose-100 text-rose-700'
    : action === 'update' ? 'bg-sky-100 text-sky-700'
    : action === 'impersonate' ? 'bg-amber-100 text-amber-700'
    : 'bg-slate-100 text-slate-600';
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>{action}</span>;
}

function shorten(id: string): string {
  return id.length > 10 ? `${id.slice(0, 8)}…` : id;
}

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return iso;
  }
}
