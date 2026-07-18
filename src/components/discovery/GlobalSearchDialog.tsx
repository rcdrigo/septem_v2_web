import { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, FileSearch, Inbox, ListChecks, RotateCw, Search, Workflow } from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import { useGlobalSearch, type DiscoveryItem, type DiscoveryType } from '@/lib/api/discovery';
import { openTab } from '@/lib/nav';

const TYPES: { value: DiscoveryType | 'all'; label: string }[] = [
  { value: 'all', label: 'Tudo' },
  { value: 'service', label: 'Serviços' },
  { value: 'request', label: 'Requisições' },
  { value: 'task', label: 'Tarefas' },
  { value: 'query', label: 'Consultas' },
];

export function GlobalSearchDialog({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [type, setType] = useState<DiscoveryType | 'all'>('all');
  const [selected, setSelected] = useState(0);
  const search = useGlobalSearch(debouncedQuery, type);
  const inputRef = useRef<HTMLInputElement>(null);
  const items = search.data?.items ?? [];

  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query), 250);
    return () => window.clearTimeout(timer);
  }, [query]);
  useEffect(() => { setSelected(0); }, [debouncedQuery, type]);
  useEffect(() => { if (selected >= items.length) setSelected(Math.max(0, items.length - 1)); }, [items.length, selected]);

  const grouped = useMemo(() => TYPES.slice(1).map((entry) => ({
    ...entry,
    items: items.filter((item) => item.type === entry.value),
  })).filter((group) => group.items.length > 0), [items]);

  function open(item: DiscoveryItem) {
    openTab(item.href);
    onClose();
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') { event.preventDefault(); setSelected((value) => Math.min(items.length - 1, value + 1)); }
    if (event.key === 'ArrowUp') { event.preventDefault(); setSelected((value) => Math.max(0, value - 1)); }
    if (event.key === 'Enter' && items[selected]) { event.preventDefault(); open(items[selected]); }
  }

  return (
    <Dialog open onClose={onClose} title="Buscar no Septem" width="xl" bodyClassName="min-h-0 flex-1 overflow-hidden">
      <div className="flex h-[min(38rem,calc(100dvh-7rem))] min-h-0 flex-col">
        <div className="border-b border-slate-200 p-4 sm:p-5">
          <label htmlFor="global-search-input" className="mb-1.5 block text-xs font-semibold text-slate-700">O que você procura?</label>
          <div className="relative">
            <Search size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-cyan-700" />
            <input
              ref={inputRef}
              id="global-search-input"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Busque por serviço, requisição, tarefa ou consulta"
              aria-controls="global-search-results"
              aria-activedescendant={items[selected] ? `global-search-${items[selected].type}-${items[selected].id}` : undefined}
              className="h-11 w-full rounded-md border border-slate-300 bg-white pl-10 pr-4 text-sm text-slate-900 outline-2 outline-transparent placeholder:text-slate-400 hover:bg-slate-50 focus-visible:outline-cyan-700"
            />
          </div>
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1" aria-label="Tipos de resultado">
            {TYPES.map((entry) => <button key={entry.value} type="button" aria-pressed={type === entry.value} onClick={() => setType(entry.value)} className={`min-h-10 shrink-0 whitespace-nowrap rounded-full border px-3 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-700 active:opacity-80 ${type === entry.value ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'}`}>{entry.label}</button>)}
          </div>
        </div>

        <div id="global-search-results" role="listbox" aria-label="Resultados da busca" className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
          {query.trim().length < 2 ? <SearchHint /> : search.isLoading || query !== debouncedQuery ? <SearchSkeleton /> : search.isError ? (
            <div role="alert" className="flex h-full min-h-48 flex-col items-center justify-center text-center"><FileSearch className="text-rose-600" /><p className="mt-2 text-sm font-semibold text-slate-900">Não foi possível realizar a busca</p><button type="button" onClick={() => search.refetch()} className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"><RotateCw size={14} />Tentar novamente</button></div>
          ) : items.length === 0 ? (
            <div className="flex h-full min-h-48 flex-col items-center justify-center text-center"><Inbox className="text-slate-400" /><p className="mt-2 text-sm font-semibold text-slate-900">Nenhum resultado acessível</p><p className="mt-1 text-sm text-slate-500">Tente outro termo ou selecione “Tudo”.</p></div>
          ) : grouped.map((group) => (
            <section key={group.value} className="mb-4 last:mb-0">
              <h3 className="px-2 pb-1.5 text-[0.65rem] font-semibold uppercase tracking-wider text-slate-400">{group.label}</h3>
              <div className="space-y-1">{group.items.map((item) => {
                const index = items.indexOf(item);
                return <SearchResult key={`${item.type}:${item.id}`} item={item} selected={selected === index} onFocus={() => setSelected(index)} onOpen={() => open(item)} />;
              })}</div>
            </section>
          ))}
        </div>
        <footer className="hidden shrink-0 items-center gap-4 border-t border-slate-200 bg-slate-50 px-5 py-2.5 text-xs text-slate-500 sm:flex"><span>↑ ↓ navegar</span><span>Enter abrir em nova aba</span><span>Esc fechar</span></footer>
      </div>
    </Dialog>
  );
}

function SearchResult({ item, selected, onFocus, onOpen }: { item: DiscoveryItem; selected: boolean; onFocus: () => void; onOpen: () => void }) {
  const Icon = item.type === 'service' ? Workflow : item.type === 'request' ? FileSearch : item.type === 'task' ? ListChecks : CheckCircle2;
  return (
    <button id={`global-search-${item.type}-${item.id}`} role="option" aria-selected={selected} type="button" onFocus={onFocus} onMouseEnter={onFocus} onClick={onOpen} className={`flex min-h-14 w-full min-w-0 items-center gap-3 rounded-md px-3 text-left focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-cyan-700 active:bg-slate-200 ${selected ? 'bg-slate-100' : 'hover:bg-slate-50'}`}>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-white text-slate-600 ring-1 ring-slate-200"><Icon size={17} /></span>
      <span className="min-w-0 flex-1"><strong className="block truncate text-sm font-semibold text-slate-900">{item.title}</strong><span className="mt-0.5 block truncate text-xs text-slate-500">{item.subtitle}</span></span>
      {item.status && <span className="shrink-0 rounded-full bg-white px-2 py-1 text-[0.65rem] font-semibold text-slate-500 ring-1 ring-slate-200">{statusLabel(item.status)}</span>}
    </button>
  );
}

function SearchHint() { return <div className="flex h-full min-h-48 flex-col items-center justify-center text-center"><Search size={28} className="text-slate-300" /><p className="mt-3 text-sm font-semibold text-slate-800">Busque em tudo o que você pode acessar</p><p className="mt-1 max-w-sm text-sm leading-5 text-slate-500">Digite ao menos dois caracteres para localizar serviços, processos iniciados, tarefas e consultas.</p></div>; }
function SearchSkeleton() { return <div className="space-y-2" aria-label="Buscando"><div className="h-14 animate-pulse rounded-md bg-slate-100" /><div className="h-14 animate-pulse rounded-md bg-slate-100" /><div className="h-14 animate-pulse rounded-md bg-slate-100" /></div>; }
function statusLabel(status: string) { return ({ pendente: 'Pendente', concluida: 'Concluída', em_andamento: 'Em andamento', concluido: 'Concluído', cancelado: 'Cancelado' } as Record<string, string>)[status] ?? status; }
