import { useState } from 'react';
import { Archive, ChevronLeft, ChevronRight, FileSearch, LayoutDashboard, Pencil, Plus, Search, Send, Tags } from 'lucide-react';
import {
  useReportsList,
  useReport,
  useCreateReport,
  useUpdateReport,
  usePatchReportStatus,
  useDeleteReport,
  useReportCategories,
  useCreateReportCategory,
  useUpdateReportCategory,
  useDeleteReportCategory,
  type ReportListItem,
  type ReportStatus,
} from '@/lib/api/reports';
import { CategoryManagerDialog } from '@/components/categories/CategoryManagerDialog';
import { useDataSourcesList } from '@/lib/api/data-sources';
import { Dialog } from '@/components/ui/Dialog';
import { Field, TextInput } from '@/components/ui/Field';
import { Combobox } from '@/components/ui/Combobox';
import { confirm } from '@/components/ui/ConfirmDialog';
import { toast } from '@/stores/toast';
import { ApiError } from '@/lib/api';

/**
 * Admin › Relatórios (item 8). Espelha Admin › Processos: lista com
 * busca/status/paginação e ações publicar/inativar. Um relatório aponta para uma
 * fonte de dados (scope=report) e, publicado, aparece na tela de Consultas.
 */
export function RelatoriosPage() {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [editKey, setEditKey] = useState<string | null | undefined>(undefined); // undefined=fechado, null=novo
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const pageSize = 20;

  const list = useReportsList({ q: q || undefined, status: status || undefined, page, pageSize });
  const total = list.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const patch = usePatchReportStatus();
  const del = useDeleteReport();

  async function publish(r: ReportListItem) {
    try {
      await patch.mutateAsync({ key: r.key, status: 'published' });
      toast.success(`"${r.name}" publicado.`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Falha ao publicar.');
    }
  }

  async function inactivate(r: ReportListItem) {
    const ok = await confirm({
      title: 'Inativar relatório?',
      message: `"${r.name}" deixará de aparecer em Consultas.`,
      confirmLabel: 'Inativar',
      cancelLabel: 'Cancelar',
      destructive: true,
    });
    if (!ok) return;
    try {
      await del.mutateAsync(r.key);
      toast.success(`"${r.name}" inativado.`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Falha ao inativar.');
    }
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-white px-6 py-4">
        <h1 className="text-lg font-semibold text-slate-900">Relatórios</h1>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => setCategoriesOpen(true)} className="flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50">
            <Tags size={16} /> Categorias
          </button>
          <button type="button" onClick={() => setEditKey(null)} className="flex items-center gap-2 rounded-md bg-slate-900 px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-700">
            <Plus size={16} /> Novo relatório
          </button>
        </div>
      </header>

      {categoriesOpen && (
        <CategoryManagerDialog
          title="Categorias de relatórios"
          inUseHint="Relatórios vinculados impedem a exclusão."
          api={{
            useList: useReportCategories,
            useCreate: useCreateReportCategory,
            useUpdate: useUpdateReportCategory,
            useDelete: useDeleteReportCategory,
          }}
          onClose={() => setCategoriesOpen(false)}
        />
      )}

      <div className="flex items-center gap-3 border-b border-slate-200 bg-white px-6 py-3">
        <div className="relative flex-1">
          <Search size={16} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="search" placeholder="Buscar por nome..." value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} className="w-full rounded-md border border-slate-300 bg-white py-1.5 pl-8 pr-3 text-sm focus:border-slate-500 focus:outline-none" />
        </div>
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm">
          <option value="">Todos</option>
          <option value="draft">Rascunhos</option>
          <option value="published">Publicados</option>
          <option value="inactive">Inativos</option>
        </select>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {!list.isLoading && total === 0 ? (
          <div className="flex flex-1 items-center justify-center py-16">
            <div className="max-w-md text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-400"><FileSearch size={26} /></div>
              <p className="text-sm font-medium text-slate-700">{q || status ? 'Nenhum relatório encontrado' : 'Nenhum relatório ainda'}</p>
              <p className="mt-1 text-sm text-slate-500">{q || status ? 'Ajuste a busca ou o filtro.' : 'Crie um relatório a partir de uma fonte de dados.'}</p>
            </div>
          </div>
        ) : (
          <>
            <table className="w-full overflow-hidden rounded-md border border-slate-200 bg-white text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2 text-left">Relatório</th>
                  <th className="px-4 py-2 text-left">Status</th>
                  <th className="px-4 py-2 text-left">Atualizado</th>
                  <th className="px-4 py-2 w-28" aria-label="Ações" />
                </tr>
              </thead>
              <tbody>
                {list.isLoading && <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400">Carregando...</td></tr>}
                {list.data?.items.map((r) => (
                  <tr key={r.key} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-2 font-medium text-slate-800">
                      <button type="button" onClick={() => setEditKey(r.key)} className="hover:underline">{r.name}</button>
                      {r.description && <p className="text-xs font-normal text-slate-400">{r.description}</p>}
                    </td>
                    <td className="px-4 py-2"><StatusBadge status={r.status} /></td>
                    <td className="px-4 py-2 text-slate-500">{formatDate(r.updatedAt)}</td>
                    <td className="px-4 py-2">
                      <div className="flex justify-end gap-1">
                        <button type="button" onClick={() => window.open(`${import.meta.env.BASE_URL}relatorios/editar?key=${encodeURIComponent(r.key)}`, '_blank', 'noopener')} className="rounded p-1.5 text-slate-500 hover:bg-slate-200 hover:text-slate-800" title="Abrir no builder (blocos, filtros, preview)"><LayoutDashboard size={15} /></button>
                        <button type="button" onClick={() => setEditKey(r.key)} className="rounded p-1.5 text-slate-500 hover:bg-slate-200 hover:text-slate-800" title="Editar dados básicos"><Pencil size={15} /></button>
                        {r.status === 'draft' && <button type="button" onClick={() => publish(r)} className="rounded p-1.5 text-slate-500 hover:bg-emerald-50 hover:text-emerald-700" title="Publicar"><Send size={15} /></button>}
                        {r.status !== 'inactive' && <button type="button" onClick={() => inactivate(r)} className="rounded p-1.5 text-slate-500 hover:bg-rose-50 hover:text-rose-700" title="Inativar"><Archive size={15} /></button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
              <span>{total} relatório{total === 1 ? '' : 's'}</span>
              <div className="flex items-center gap-2">
                <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded border border-slate-300 p-1 disabled:opacity-40"><ChevronLeft size={14} /></button>
                <span>{page} / {totalPages}</span>
                <button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="rounded border border-slate-300 p-1 disabled:opacity-40"><ChevronRight size={14} /></button>
              </div>
            </div>
          </>
        )}
      </div>

      {editKey !== undefined && <RelatorioDialog editKey={editKey} onClose={() => setEditKey(undefined)} />}
    </div>
  );
}

function RelatorioDialog({ editKey, onClose }: { editKey: string | null; onClose: () => void }) {
  const isNew = editKey === null;
  const detail = useReport(editKey);
  const sources = useDataSourcesList('report');
  const categories = useReportCategories();
  const create = useCreateReport();
  const update = useUpdateReport();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [dataSourceId, setDataSourceId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [hydrated, setHydrated] = useState(isNew);

  if (!isNew && detail.data && !hydrated) {
    setName(detail.data.name);
    setDescription(detail.data.description ?? '');
    setDataSourceId(detail.data.dataSourceId ?? '');
    setCategoryId(detail.data.categoryId != null ? String(detail.data.categoryId) : '');
    setHydrated(true);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    // No PUT, campo ausente/null MANTÉM o valor da versão anterior; limpar usa
    // sentinela (Guid vazio / 0) — ver ReportsEndpoints.
    const body = {
      name,
      description,
      dataSourceId: dataSourceId || '00000000-0000-0000-0000-000000000000',
      categoryId: categoryId ? Number(categoryId) : 0,
    };
    try {
      if (isNew) await create.mutateAsync(body);
      else await update.mutateAsync({ key: editKey, body });
      toast.success(isNew ? 'Relatório criado.' : 'Alterações salvas.');
      onClose();
    } catch (err) {
      toast.error(err instanceof ApiError && err.status === 409 ? 'Já existe um relatório com esse nome.' : 'Não foi possível salvar.');
    }
  }

  const pending = create.isPending || update.isPending;

  return (
    <Dialog open onClose={onClose} title={isNew ? 'Novo relatório' : 'Editar relatório'} width="lg" footer={
      <>
        <button onClick={onClose} className="rounded-md border border-slate-300 px-3.5 py-1.5 text-sm">Cancelar</button>
        <button form="report-form" type="submit" disabled={pending || (!isNew && !detail.data)} className="rounded-md bg-slate-900 px-3.5 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60">
          {isNew ? 'Criar' : 'Salvar'}
        </button>
      </>
    }>
      {!isNew && !detail.data ? <p className="text-sm text-slate-500">Carregando...</p> : (
        <form id="report-form" className="flex flex-col gap-3" onSubmit={submit}>
          <Field label="Nome"><TextInput required minLength={2} value={name} onChange={(e) => setName(e.target.value)} autoFocus /></Field>
          <Field label="Descrição"><TextInput value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
          <Field label="Categoria" hint="Agrupa e colore o relatório em Consultas.">
            <Combobox
              value={categoryId}
              options={(categories.data ?? []).map((c) => ({ value: String(c.id), label: c.name }))}
              onChange={setCategoryId}
              clearLabel="— nenhuma —"
              placeholder="Selecione…"
            />
          </Field>
          <Field label="Fonte de dados (relatório)">
            <Combobox
              value={dataSourceId}
              options={(sources.data ?? []).map((d) => ({ value: d.id, label: d.name }))}
              onChange={setDataSourceId}
              clearLabel="— nenhuma —"
              placeholder="Selecione…"
            />
            {sources.data && sources.data.length === 0 && <span className="mt-0.5 block text-xs text-slate-400">Nenhuma fonte com escopo "relatório". Crie em Configurações › Fontes de dados.</span>}
          </Field>
        </form>
      )}
    </Dialog>
  );
}

function StatusBadge({ status }: { status: ReportStatus }) {
  const map: Record<ReportStatus, { label: string; cls: string }> = {
    draft: { label: 'Rascunho', cls: 'bg-amber-100 text-amber-700' },
    published: { label: 'Publicado', cls: 'bg-emerald-100 text-emerald-700' },
    inactive: { label: 'Inativo', cls: 'bg-slate-200 text-slate-600' },
  };
  const v = map[status];
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${v.cls}`}>{v.label}</span>;
}

function formatDate(iso: string): string {
  try { return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }); } catch { return '—'; }
}
