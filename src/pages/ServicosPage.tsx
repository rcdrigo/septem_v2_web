import { useMemo, useState } from 'react';
import { Play, Tags, Workflow } from 'lucide-react';
import { useProcessList } from '@/lib/api/process-definitions';
import {
  FALLBACK_COLOR,
  FilterPill,
  GroupHeader,
  groupByCategory,
  textColorFor,
  tintOf,
} from '@/components/catalog/category-catalog';

/**
 * Geral › Serviços (B3): catálogo de processos publicados, agrupados por
 * categoria — filtro por categoria no topo; ícone e botão "Iniciar" herdam a
 * cor da categoria; o nome da categoria fica no cabeçalho do agrupamento (não
 * no card). "Iniciar" abre NOVA ABA só com o formulário — ver ServicoFormPage.
 */
export function ServicosPage() {
  const list = useProcessList({ status: 'published', pageSize: 100 });
  const [filter, setFilter] = useState<string>('all');

  const groups = useMemo(() => groupByCategory(list.data?.items ?? []), [list.data?.items]);
  const visible = filter === 'all' ? groups : groups.filter((g) => g.key === filter);
  const isEmpty = !list.isLoading && (list.data?.items.length ?? 0) === 0;

  function startService(key: string) {
    window.open(`${import.meta.env.BASE_URL}servico/${key}`, '_blank', 'noopener');
  }

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-slate-200 bg-white px-6 py-4">
        <h1 className="text-lg font-semibold text-slate-900">Serviços</h1>
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
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-400"><Workflow size={26} /></div>
            <p className="text-sm font-medium text-slate-700">Nenhum serviço disponível</p>
            <p className="mt-1 text-sm text-slate-500">Processos publicados aparecem aqui para serem iniciados.</p>
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
                    {g.items.map((p) => (
                      <div key={p.key} className="flex flex-col rounded-md border border-slate-200 bg-white p-4">
                        <div
                          className="mb-2 flex h-9 w-9 items-center justify-center rounded-md"
                          style={{ backgroundColor: tintOf(color), color }}
                        >
                          {p.icon ? <i className={p.icon} /> : <Workflow size={18} />}
                        </div>
                        <p className="font-medium text-slate-800">{p.name}</p>
                        {p.area && <p className="text-xs text-slate-500">{p.area}</p>}
                        {p.description && <div className="mt-1 line-clamp-3 text-xs text-slate-600 [&_a]:text-sky-600 [&_a]:underline [&_ol]:list-decimal [&_ul]:list-disc [&_ol]:pl-4 [&_ul]:pl-4" dangerouslySetInnerHTML={{ __html: p.description }} />}
                        <button
                          type="button"
                          onClick={() => startService(p.key)}
                          className="mt-3 inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-opacity hover:opacity-85"
                          style={{ backgroundColor: color, color: textColorFor(color) }}
                        >
                          <Play size={15} /> Iniciar
                        </button>
                      </div>
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
