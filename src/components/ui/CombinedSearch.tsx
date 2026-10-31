import { useId, useState } from 'react';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { filterRows, type SearchColumn } from '@/lib/combined-search';
export type { SearchColumn } from '@/lib/combined-search';

export function useCombinedSearch<T>(rows: readonly T[], columns: readonly SearchColumn<T>[]) {
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<Record<string, string>>({});
  const setFilter = (key: string, value: string) => setFilters(current => ({ ...current, [key]: value }));
  const clear = () => { setQuery(''); setFilters({}); };
  return { query, setQuery, filters, setFilter, clear, rows: filterRows(rows, columns, query, filters), activeCount: Object.values(filters).filter(value => value.trim()).length };
}

export function CombinedSearch<T>({ columns, search, loading = false }: {
  columns: readonly SearchColumn<T>[];
  search: ReturnType<typeof useCombinedSearch<T>>;
  loading?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const filtersId = useId();
  return (
    <div className="space-y-3 border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
      <div className="flex flex-wrap items-center gap-3">
        <label className="relative min-w-0 flex-1 basis-52">
          <span className="sr-only">Busca em todas as colunas</span>
          <Search size={16} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input type="search" value={search.query} onChange={event => search.setQuery(event.target.value)} placeholder="Buscar em todas as colunas…"
            className="w-full min-w-0 rounded-md border border-slate-300 py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-600" />
        </label>
        <button type="button" onClick={() => setExpanded(value => !value)} aria-expanded={expanded} aria-controls={filtersId}
          className="inline-flex min-h-10 items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
          <SlidersHorizontal size={16} aria-hidden="true" /> Filtros por coluna{search.activeCount > 0 && ` (${search.activeCount})`}
        </button>
        {(search.query || search.activeCount > 0) && <button type="button" onClick={search.clear} className="inline-flex min-h-10 items-center gap-1.5 px-2 text-sm text-slate-600 hover:text-slate-900"><X size={15} aria-hidden="true" /> Limpar busca</button>}
        <span role="status" className="text-sm text-slate-600">{loading ? 'Carregando…' : `${search.rows.length} resultado${search.rows.length === 1 ? '' : 's'}`}</span>
      </div>
      <div id={filtersId} hidden={!expanded}>
        <p className="mb-3 text-xs text-slate-600">Os filtros são combinados: o registro deve atender a todos os critérios preenchidos.</p>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {columns.map(column => <label key={column.key} className="flex min-w-0 flex-col gap-1.5 text-sm text-slate-700">
            <span>{column.label}</span>
            {column.options ? <select aria-label={`Filtrar por ${column.label}`} value={search.filters[column.key] ?? ''} onChange={event => search.setFilter(column.key, event.target.value)} className="min-h-10 w-full min-w-0 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm">
              <option value="">Todos</option>{column.options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select> : <input type="search" aria-label={`Filtrar por ${column.label}`} value={search.filters[column.key] ?? ''} onChange={event => search.setFilter(column.key, event.target.value)} placeholder={`Filtrar ${column.label.toLocaleLowerCase('pt-BR')}`} className="min-h-10 w-full min-w-0 rounded-md border border-slate-300 px-3 py-2 text-sm placeholder:text-slate-500" />}
          </label>)}
        </div>
      </div>
    </div>
  );
}
