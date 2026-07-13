import { useState } from 'react';
import { ChevronLeft, ChevronRight, Pencil, Plus, Search, Send, Tags, Trash2, Workflow, Archive } from 'lucide-react';
import { CategoriesDialog } from './CategoriesDialog';
import {
  useProcessList,
  usePatchProcessStatus,
  useDeleteProcess,
  useDeleteProcessPermanently,
  type ProcessListItem,
  type ProcessStatus,
} from '@/lib/api/process-definitions';
import { confirm } from '@/components/ui/ConfirmDialog';
import { toast } from '@/stores/toast';
import { ApiError } from '@/lib/api';

/**
 * Admin › Processos — IF2. Lista real de `/api/v1/workflow/process-definitions`
 * (última versão por key), com busca/status/paginação e ações publicar/inativar.
 * "Novo" e "Editar" abrem o modelador (este último com `?key=`).
 */
/** Abre o modelador em aba própria (sem menu lateral). `key` omitido = novo processo. */
function openModeler(key?: string) {
  const qs = key ? `?key=${encodeURIComponent(key)}` : '';
  window.open(`${import.meta.env.BASE_URL}processos/editar${qs}`, '_blank', 'noopener');
}

export function ProcessosPage() {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const pageSize = 20;

  const list = useProcessList({ q: q || undefined, status: status || undefined, page, pageSize });
  const total = list.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const patch = usePatchProcessStatus();
  const del = useDeleteProcess();
  const delPerm = useDeleteProcessPermanently();

  // Excluir DE VERDADE (some da lista). Bloqueado quando há solicitações — o
  // histórico não se apaga; nesse caso o caminho é "Inativar".
  async function remove(p: ProcessListItem) {
    const ok = await confirm({
      title: 'Excluir processo?',
      message: `"${p.name}" e todas as suas versões serão removidos permanentemente. Só é possível excluir processos SEM solicitações.`,
      confirmLabel: 'Excluir',
      cancelLabel: 'Cancelar',
      destructive: true,
    });
    if (!ok) return;
    try {
      await delPerm.mutateAsync(p.key);
      toast.success(`"${p.name}" excluído.`);
    } catch (err) {
      toast.error(err instanceof ApiError ? (err.detail ?? err.message) : 'Falha ao excluir.');
    }
  }

  function edit(key: string) {
    openModeler(key);
  }

  async function publish(p: ProcessListItem) {
    try {
      await patch.mutateAsync({ key: p.key, status: 'published' });
      toast.success(`"${p.name}" publicado.`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Falha ao publicar.');
    }
  }

  async function inactivate(p: ProcessListItem) {
    const ok = await confirm({
      title: 'Inativar processo?',
      message: `"${p.name}" deixará de aceitar novas instâncias. As versões e o histórico permanecem.`,
      confirmLabel: 'Inativar',
      cancelLabel: 'Cancelar',
      destructive: true,
    });
    if (!ok) return;
    try {
      await del.mutateAsync(p.key);
      toast.success(`"${p.name}" inativado.`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Falha ao inativar.');
    }
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-white px-6 py-4">
        <h1 className="text-lg font-semibold text-slate-900">Processos</h1>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setCategoriesOpen(true)}
            className="flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
          >
            <Tags size={16} /> Categorias
          </button>
          <button
            type="button"
            onClick={() => openModeler()}
            className="flex items-center gap-2 rounded-md bg-slate-900 px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-700"
          >
            <Plus size={16} /> Novo processo
          </button>
        </div>
      </header>

      {categoriesOpen && <CategoriesDialog onClose={() => setCategoriesOpen(false)} />}

      <div className="flex items-center gap-3 border-b border-slate-200 bg-white px-6 py-3">
        <div className="relative flex-1">
          <Search size={16} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            placeholder="Buscar por nome..."
            value={q}
            onChange={(e) => { setQ(e.target.value); setPage(1); }}
            className="w-full rounded-md border border-slate-300 bg-white py-1.5 pl-8 pr-3 text-sm focus:border-slate-500 focus:outline-none"
          />
        </div>
        <select
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm"
        >
          <option value="">Todos</option>
          <option value="draft">Rascunhos</option>
          <option value="published">Publicados</option>
          <option value="inactive">Inativos</option>
        </select>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {!list.isLoading && total === 0 ? (
          <EmptyState onNew={() => openModeler()} hasFilters={!!q || !!status} />
        ) : (
          <>
            <table className="w-full overflow-hidden rounded-md border border-slate-200 bg-white text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2 text-left">Processo</th>
                  <th className="px-4 py-2 text-left">Categoria</th>
                  <th className="px-4 py-2 text-left">Área</th>
                  <th className="px-4 py-2 text-left">Versão</th>
                  <th className="px-4 py-2 text-left">Status</th>
                  <th className="px-4 py-2 text-left">Atualizado</th>
                  <th className="px-4 py-2 w-28" aria-label="Ações" />
                </tr>
              </thead>
              <tbody>
                {list.isLoading && (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">Carregando...</td></tr>
                )}
                {list.data?.items.map((p) => (
                  <tr key={p.key} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-2 font-medium text-slate-800">
                      <button type="button" onClick={() => edit(p.key)} className="hover:underline">{p.name}</button>
                    </td>
                    <td className="px-4 py-2 text-slate-600">{p.category ?? '—'}</td>
                    <td className="px-4 py-2 text-slate-600">{p.area ?? '—'}</td>
                    <td className="px-4 py-2 text-slate-600">v{p.version}</td>
                    <td className="px-4 py-2"><StatusBadge status={p.status} /></td>
                    <td className="px-4 py-2 text-slate-500">{formatDate(p.updatedAt)}</td>
                    <td className="px-4 py-2">
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => edit(p.key)}
                          className="rounded p-1.5 text-slate-500 hover:bg-slate-200 hover:text-slate-800"
                          title="Editar no modelador"
                        >
                          <Pencil size={15} />
                        </button>
                        {p.status === 'draft' && (
                          <button
                            type="button"
                            onClick={() => publish(p)}
                            className="rounded p-1.5 text-slate-500 hover:bg-emerald-50 hover:text-emerald-700"
                            title="Publicar"
                          >
                            <Send size={15} />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => remove(p)}
                          className="rounded p-1.5 text-slate-500 hover:bg-rose-50 hover:text-rose-700"
                          title="Excluir permanentemente (só sem solicitações)"
                        >
                          <Trash2 size={15} />
                        </button>
                        {p.status !== 'inactive' && (
                          <button
                            type="button"
                            onClick={() => inactivate(p)}
                            className="rounded p-1.5 text-slate-500 hover:bg-rose-50 hover:text-rose-700"
                            title="Inativar"
                          >
                            <Archive size={15} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
              <span>{total} processo{total === 1 ? '' : 's'}</span>
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

function EmptyState({ onNew, hasFilters }: { onNew: () => void; hasFilters: boolean }) {
  return (
    <div className="flex flex-1 items-center justify-center py-16">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-400">
          <Workflow size={26} />
        </div>
        <p className="text-sm font-medium text-slate-700">
          {hasFilters ? 'Nenhum processo encontrado' : 'Nenhum processo ainda'}
        </p>
        <p className="mt-1 text-sm text-slate-500">
          {hasFilters ? 'Ajuste a busca ou o filtro de status.' : 'Crie um fluxo (BPMN + formulário) no modelador.'}
        </p>
        {!hasFilters && (
          <button
            type="button"
            onClick={onNew}
            className="mt-4 inline-flex items-center gap-2 rounded-md border border-slate-300 px-3.5 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
          >
            <Workflow size={16} /> Abrir modelador
          </button>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: ProcessStatus }) {
  const map: Record<ProcessStatus, { label: string; cls: string }> = {
    draft:     { label: 'Rascunho',  cls: 'bg-amber-100 text-amber-700' },
    published: { label: 'Publicado', cls: 'bg-emerald-100 text-emerald-700' },
    inactive:  { label: 'Inativo',   cls: 'bg-slate-200 text-slate-600' },
  };
  const v = map[status];
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${v.cls}`}>{v.label}</span>;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return '—';
  }
}
