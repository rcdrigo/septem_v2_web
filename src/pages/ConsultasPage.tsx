import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowLeft, FileSearch, Tags } from 'lucide-react';
import { useReportsList, useReport, type GlobalFilterDef } from '@/lib/api/reports';
import { ReportRunViewer } from '@/components/reports/ReportViewer';
import { useDocumentTitle } from '@/lib/use-document-title';
import {
  FALLBACK_COLOR,
  FilterPill,
  GroupHeader,
  groupByCategory,
  textColorFor,
  tintOf,
} from '@/components/catalog/category-catalog';
import { FavoriteButton } from '@/components/discovery/FavoriteButton';
import { useFavorites, useToggleFavorite } from '@/lib/api/discovery';
import { toast } from '@/stores/toast';

/**
 * Geral › Consultas (item 8): catálogo de relatórios publicados — mesma lógica
 * visual do seletor de requisições: agrupados por categoria (lista própria de relatórios),
 * filtro em pílulas e cores herdadas no ícone e no botão "Abrir". Em vez de
 * iniciar um processo, "abre" o relatório e mostra os dados em página inteira.
 */
export function ConsultasPage() {
  const list = useReportsList({ status: 'published', pageSize: 100 });
  const [params, setParams] = useSearchParams();
  const [open, setOpen] = useState<{ key: string; name: string } | null>(null);
  const [filter, setFilter] = useState<string>('all');
  const favorites = useFavorites();
  const toggleFavorite = useToggleFavorite();
  const favoriteKeys = useMemo(() => new Set((favorites.data?.items ?? []).filter((item) => item.type === 'query').map((item) => item.id)), [favorites.data?.items]);

  const groups = useMemo(() => groupByCategory(list.data?.items ?? []), [list.data?.items]);

  useEffect(() => {
    const key = params.get('consulta');
    if (!key || open || !list.data) return;
    const report = list.data.items.find((item) => item.key === key);
    if (report) setOpen({ key: report.key, name: report.name });
  }, [list.data, open, params]);

  function openReport(key: string, name: string) {
    setParams((current) => { const next = new URLSearchParams(current); next.set('consulta', key); return next; });
    setOpen({ key, name });
  }

  function closeReport() {
    setOpen(null);
    setParams((current) => { const next = new URLSearchParams(current); next.delete('consulta'); return next; }, { replace: true });
  }

  async function toggle(key: string) {
    try { await toggleFavorite.mutateAsync({ type: 'query', key, favorite: !favoriteKeys.has(key) }); }
    catch (error) { toast.error(error instanceof Error && error.message !== 'HTTP 409' ? error.message : 'Não foi possível atualizar os favoritos. O limite é de 10 itens.'); }
  }

  if (open) return <ReportViewer reportKey={open.key} name={open.name} onClose={closeReport} />;

  const visible = filter === 'all' ? groups : groups.filter((g) => g.key === filter);
  const empty = !list.isLoading && (list.data?.items.length ?? 0) === 0;

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-slate-200 bg-white px-6 py-4">
        <h1 className="text-lg font-semibold text-slate-900">Consultas</h1>
      </header>

      {/* Filtro por categoria — pílulas que quebram linha no mobile */}
      {groups.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-white px-6 py-3">
          <FilterPill label="Todas" active={filter === 'all'} color={null} onClick={() => setFilter('all')} />
          {groups.map((g) => (
            <FilterPill
              key={g.key}
              label={g.name}
              active={filter === g.key}
              color={g.color}
              onClick={() => setFilter(filter === g.key ? 'all' : g.key)}
            />
          ))}
        </div>
      )}

      <div className="flex-1 overflow-auto p-6">
        {empty ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-400"><FileSearch size={26} /></div>
            <p className="text-sm font-medium text-slate-700">Nenhum relatório disponível</p>
            <p className="mt-1 text-sm text-slate-500">Relatórios publicados aparecem aqui para consulta.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-8">
            {visible.map((g) => {
              const color = g.color ?? FALLBACK_COLOR;
              return (
                <section key={g.key}>
                  {/* Agrupamento: o nome da categoria vive aqui, não no card */}
                  <GroupHeader name={g.name} color={color} icon={g.icon} count={g.items.length} fallbackIcon={<Tags size={15} />} />

                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {g.items.map((r) => (
                      <article key={r.key} className="relative flex min-w-0 flex-col rounded-md border border-slate-200 bg-white p-4">
                        <div className="mb-2 flex items-start justify-between gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-md" style={{ backgroundColor: tintOf(color), color }}><FileSearch size={18} /></div>
                          <FavoriteButton favorite={favoriteKeys.has(r.key)} disabled={toggleFavorite.isPending && toggleFavorite.variables?.key === r.key} onToggle={() => toggle(r.key)} />
                        </div>
                        <p title={r.name} className="truncate font-medium text-slate-800">{r.name}</p>
                        <p title={r.description || undefined} className="line-clamp-2 min-h-8 text-xs leading-4 text-slate-500">{r.description || 'Relatório'}</p>
                        <button
                          type="button"
                          onClick={() => openReport(r.key, r.name)}
                          className="mt-3 inline-flex min-h-10 items-center justify-center gap-1.5 rounded-md px-3 text-sm font-medium transition-opacity hover:opacity-85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-700 active:opacity-75"
                          style={{ backgroundColor: color, color: textColorFor(color) }}
                        >
                          <FileSearch size={15} /> Abrir
                        </button>
                      </article>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function ReportViewer({ reportKey, name, onClose }: { reportKey: string; name: string; onClose: () => void }) {
  // Filtros globais vêm da definição do relatório publicado.
  const detail = useReport(reportKey);
  useDocumentTitle(name); // título da aba = nome do relatório aberto
  const filtersDef = useMemo<GlobalFilterDef[]>(() => {
    try { return (JSON.parse(detail.data?.definitionJson || '{}') as { filters?: GlobalFilterDef[] }).filters ?? []; }
    catch { return []; }
  }, [detail.data?.definitionJson]);

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-3 border-b border-slate-200 bg-white px-6 py-4 print:border-0">
        <button type="button" onClick={onClose} className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 print:hidden" title="Voltar ao catálogo">
          <ArrowLeft size={18} />
        </button>
        <h1 className="flex-1 text-lg font-semibold text-slate-900">{name}</h1>
      </header>

      <main className="flex-1 overflow-auto p-6">
        {detail.isLoading ? (
          <p className="text-sm text-slate-400">Carregando…</p>
        ) : (
          <ReportRunViewer reportKey={reportKey} filtersDef={filtersDef} />
        )}
      </main>
    </div>
  );
}
