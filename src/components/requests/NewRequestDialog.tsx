import { useMemo, useState } from 'react';
import { AlertCircle, ArrowRight, Inbox, RotateCw, Search, Tags, Workflow } from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import { FALLBACK_COLOR, groupByCategory, NamedIcon, tintOf } from '@/components/catalog/category-catalog';
import { useProcessList, type ProcessListItem } from '@/lib/api/process-definitions';
import { openTab } from '@/lib/nav';
import { useFavorites, useToggleFavorite } from '@/lib/api/discovery';
import { FavoriteButton } from '@/components/discovery/FavoriteButton';
import { toast } from '@/stores/toast';
import '@/styles/new-request.css';
import { routes } from '@/lib/routes';

const ALL_CATEGORIES = 'all';

export function NewRequestDialog({ onClose }: { onClose: () => void }) {
  const list = useProcessList({ status: 'published', pageSize: 100 });
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState(ALL_CATEGORIES);
  const favorites = useFavorites();
  const toggleFavorite = useToggleFavorite();
  const favoriteKeys = useMemo(() => new Set((favorites.data?.items ?? []).filter((item) => item.type === 'service').map((item) => item.id)), [favorites.data?.items]);
  const items = list.data?.items ?? [];
  const groups = useMemo(() => groupByCategory(items), [items]);
  const normalizedQuery = normalize(query.trim());
  const filtered = useMemo(() => items.filter((service) => {
    if (category !== ALL_CATEGORIES && String(service.categoryId ?? 'none') !== category) return false;
    if (!normalizedQuery) return true;
    return normalize([
      service.name,
      service.category,
      service.area,
      descriptionText(service.description),
    ].filter(Boolean).join(' ')).includes(normalizedQuery);
  }), [category, items, normalizedQuery]);
  const selectedCategory = groups.find((group) => group.key === category);

  function start(service: ProcessListItem) {
    openTab(routes.service(service.key));
    onClose();
  }

  async function toggle(service: ProcessListItem) {
    try {
      await toggleFavorite.mutateAsync({ type: 'service', key: service.key, favorite: !favoriteKeys.has(service.key) });
    } catch (error) {
      const detail = error instanceof Error ? error.message : null;
      toast.error(detail && detail !== 'HTTP 409' ? detail : 'Não foi possível atualizar os favoritos. O limite é de 10 itens.');
    }
  }

  return (
    <Dialog open onClose={onClose} title="Nova requisição" width="2xl" bodyClassName="min-h-0 flex-1 overflow-hidden">
      <div className="grid h-[min(44rem,calc(100dvh-7rem))] min-h-0 grid-rows-[auto_minmax(0,1fr)] md:grid-cols-[17rem_minmax(0,1fr)] md:grid-rows-1">
        <aside className="flex min-h-0 max-h-56 flex-col border-b border-slate-200 bg-slate-50/70 md:max-h-none md:border-b-0 md:border-r">
          <div className="shrink-0 p-4">
            <label htmlFor="new-request-search" className="mb-1.5 block text-xs font-semibold text-slate-700">Buscar serviços</label>
            <div className="relative">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                id="new-request-search"
                autoFocus
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Nome ou descrição"
                className="h-11 w-full rounded-md border border-slate-300 bg-white pl-9 pr-3 text-sm text-slate-800 outline-2 outline-transparent placeholder:text-slate-400 hover:bg-slate-50 focus-visible:outline-slate-700"
              />
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
            <p className="px-2 pb-1.5 text-[0.65rem] font-semibold uppercase tracking-wider text-slate-400">Categorias</p>
            <CategoryButton active={category === ALL_CATEGORIES} label="Todas" count={items.length} onClick={() => setCategory(ALL_CATEGORIES)} />
            {groups.map((group) => (
              <CategoryButton
                key={group.key}
                active={category === group.key}
                label={group.name}
                count={group.items.length}
                color={group.color}
                icon={group.icon}
                onClick={() => setCategory(group.key)}
              />
            ))}
          </div>
        </aside>

        <section className="flex min-h-0 min-w-0 flex-col bg-white" aria-labelledby="new-request-results-title">
          <header className="flex shrink-0 items-end justify-between gap-4 border-b border-slate-100 px-4 py-3 sm:px-5">
            <div className="min-w-0">
              <h3 id="new-request-results-title" className="truncate text-sm font-semibold text-slate-900">{selectedCategory?.name ?? 'Todos os serviços'}</h3>
              <p className="mt-0.5 text-xs text-slate-500" aria-live="polite">{filtered.length} {filtered.length === 1 ? 'serviço encontrado' : 'serviços encontrados'}</p>
            </div>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
            {list.isLoading ? <ServiceSkeletons /> : list.isError ? (
              <div role="alert" className="flex h-full min-h-48 flex-col items-center justify-center text-center">
                <AlertCircle size={22} className="text-rose-600" />
                <p className="mt-2 text-sm font-semibold text-slate-900">Não foi possível carregar os serviços</p>
                <button type="button" disabled={list.isFetching} onClick={() => list.refetch()} className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-700 active:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-55"><RotateCw size={14} />{list.isFetching ? 'Carregando…' : 'Tentar novamente'}</button>
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex h-full min-h-48 flex-col items-center justify-center text-center">
                <Inbox size={24} className="text-slate-400" />
                <p className="mt-2 text-sm font-semibold text-slate-800">Nenhum serviço encontrado</p>
                <p className="mt-1 max-w-xs text-xs leading-5 text-slate-500">Ajuste a busca ou escolha outra categoria.</p>
                {(query || category !== ALL_CATEGORIES) && <button type="button" onClick={() => { setQuery(''); setCategory(ALL_CATEGORIES); }} className="mt-3 min-h-11 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-700 active:bg-slate-100">Limpar filtros</button>}
              </div>
            ) : (
              <div className="grid min-w-0 gap-3 lg:grid-cols-2">
                {filtered.map((service) => <ServiceCard key={service.key} service={service} favorite={favoriteKeys.has(service.key)} favoritePending={toggleFavorite.isPending && toggleFavorite.variables?.key === service.key} onFavorite={() => toggle(service)} onStart={() => start(service)} />)}
              </div>
            )}
          </div>
        </section>
      </div>
    </Dialog>
  );
}

function CategoryButton({ active, label, count, color, icon, onClick }: { active: boolean; label: string; count: number; color?: string | null; icon?: string | null; onClick: () => void }) {
  const tone = color ?? FALLBACK_COLOR;
  return (
    <button type="button" aria-pressed={active} onClick={onClick} className={`mb-1 flex min-h-11 w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-slate-700 active:bg-slate-100 ${active ? 'bg-white font-semibold text-slate-900 shadow-sm ring-1 ring-slate-200' : 'text-slate-600 hover:bg-white hover:text-slate-900'}`}>
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md" style={{ backgroundColor: tintOf(tone), color: tone }}><NamedIcon name={icon} fallback={<Tags size={14} />} /></span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <span className="shrink-0 text-xs tabular-nums text-slate-400">{count}</span>
    </button>
  );
}

function ServiceCard({ service, favorite, favoritePending, onFavorite, onStart }: { service: ProcessListItem; favorite: boolean; favoritePending: boolean; onFavorite: () => void; onStart: () => void }) {
  const color = service.categoryColor ?? FALLBACK_COLOR;
  const description = descriptionText(service.description);
  return (
    <article role="link" tabIndex={0} onClick={onStart} onKeyDown={(event) => { if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); onStart(); } }} className="new-request-card group relative flex min-h-40 min-w-0 cursor-pointer flex-col rounded-lg border border-slate-200 bg-white p-4 text-left shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-700">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md" style={{ backgroundColor: tintOf(color), color }}><NamedIcon name={service.icon} fallback={<Workflow size={17} />} /></span>
        <FavoriteButton favorite={favorite} disabled={favoritePending} onToggle={onFavorite} />
      </div>
      <strong title={service.name} className="mt-3 truncate text-sm font-bold text-slate-900">{service.name}</strong>
      <p title={description || undefined} className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{description || 'Sem descrição disponível.'}</p>
      {service.area && <p title={service.area} className="mt-2 truncate text-xs text-slate-400">{service.area}</p>}
      <div className="mt-auto flex min-w-0 items-end justify-between gap-3 pt-3">
        <span className="inline-flex min-w-0 items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600"><span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} /><span className="truncate">{service.category ?? 'Sem categoria'}</span></span>
        <span className="new-request-action inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-slate-700">Iniciar <ArrowRight size={14} /></span>
      </div>
    </article>
  );
}



function ServiceSkeletons() {
  return <div className="grid gap-3 lg:grid-cols-2" aria-label="Carregando serviços">{[0, 1, 2, 3].map((item) => <div key={item} className="h-40 animate-pulse rounded-lg border border-slate-200 p-4"><div className="h-9 w-9 rounded-md bg-slate-100" /><div className="mt-3 h-4 w-2/3 rounded bg-slate-100" /><div className="mt-2 h-9 rounded bg-slate-100" /></div>)}</div>;
}

function normalize(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
}

function descriptionText(value: string | null) {
  if (!value) return '';
  return new DOMParser().parseFromString(value, 'text/html').body.textContent?.replace(/\s+/g, ' ').trim() ?? '';
}
