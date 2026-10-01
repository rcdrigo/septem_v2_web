import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, ExternalLink, Search } from 'lucide-react';
import { useCatalogInventory, type CatalogInventoryItem } from '@/lib/api/platform-catalog';

const PAGE_SIZE = 10;

export type CatalogSelection = {
  sourceTenantId: string;
  processKey: string;
  version: number;
  clientName: string;
  environmentName: string;
  purpose: string;
  processName: string;
};

type Props = {
  selections: Record<string, CatalogSelection>;
  onToggle: (item: CatalogInventoryItem, checked: boolean) => void;
};

const button = 'inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-slate-700 disabled:cursor-not-allowed disabled:opacity-50';

function selectionKey(tenantId: string, processKey: string) {
  return JSON.stringify([tenantId.toLowerCase(), processKey.toLowerCase()]);
}

function purposeLabel(purpose: string) {
  const value = purpose.toLowerCase();
  if (value === 'staging') return 'Homologação';
  if (value === 'demo' || value === 'demonstration') return 'Demonstração';
  return 'Produção';
}

function previewUrl(item: CatalogInventoryItem) {
  let host = item.host?.trim();
  if (host) {
    try {
      const parsed = new URL(host.includes('://') ? host : `https://${host}`);
      if (parsed.protocol !== 'https:' || parsed.username || parsed.password
        || parsed.pathname !== '/' || parsed.search || parsed.hash) return null;
      host = parsed.host;
    } catch {
      return null;
    }
  } else {
    // Compatibility for older inventory responses which do not include host.
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.tenantId)) return null;
    host = `${item.tenantId}.septemcompliance.com`;
  }
  const url = new URL('/flows/edit', `https://${host}`);
  url.searchParams.set('key', item.key);
  return url.toString();
}

export function ClientCatalogSelector({ selections, onToggle }: Props) {
  const [input, setInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    const timeout = window.setTimeout(() => setSearch(input.trim()), 250);
    return () => window.clearTimeout(timeout);
  }, [input]);

  const inventory = useCatalogInventory({ search, page, pageSize: PAGE_SIZE, enabled: true });
  const rows = inventory.data?.items ?? [];
  const total = inventory.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const selected = Object.values(selections);

  useEffect(() => {
    if (!inventory.isPlaceholderData && inventory.data && page > pageCount) setPage(pageCount);
  }, [inventory.data, inventory.isPlaceholderData, page, pageCount]);

  return (
    <section aria-labelledby="catalog-selection-title" className="space-y-4">
      <div>
        <h2 id="catalog-selection-title" className="font-semibold text-slate-900">Processos do catálogo</h2>
        <p className="mt-1 max-w-3xl text-sm text-slate-600">
          Busque processos nas origens autorizadas e marque uma versão publicada para incluir em produção e homologação.
          Uma mesma chave de processo só pode vir de uma origem.
        </p>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <label className="min-w-0 flex-1 space-y-1 text-sm font-medium text-slate-700 sm:max-w-xl">
          <span>Buscar cliente, ambiente ou processo</span>
          <span className="relative block">
            <Search aria-hidden="true" size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={input}
              onChange={event => { setInput(event.target.value); setPage(1); }}
              placeholder="Nome do cliente, ambiente ou processo"
              className="min-h-11 w-full rounded-md border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 outline-none focus:border-slate-600 focus:ring-2 focus:ring-slate-200"
            />
          </span>
        </label>
        <p role="status" aria-live="polite" className="text-sm text-slate-600">
          {selected.length} {selected.length === 1 ? 'processo selecionado' : 'processos selecionados'}
        </p>
      </div>

      {inventory.isError && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <span>Não foi possível carregar o catálogo. Tente novamente.</span>
          <button type="button" className={button} onClick={() => void inventory.refetch()}>Tentar novamente</button>
        </div>
      )}

      {inventory.isLoading ? (
        <div className="space-y-3 rounded-md border border-slate-200 bg-white p-4" role="status" aria-label="Carregando processos">
          <span className="sr-only">Carregando processos…</span>
          {[0, 1, 2, 3].map(row => <div key={row} className="grid grid-cols-[1fr_1fr_auto] gap-4 border-b border-slate-100 pb-3 last:border-0 last:pb-0" aria-hidden="true">
            <span className="h-4 animate-pulse rounded bg-slate-100" />
            <span className="h-4 animate-pulse rounded bg-slate-100" />
            <span className="h-4 w-10 animate-pulse rounded bg-slate-100" />
          </div>)}
        </div>
      ) : inventory.data && rows.length === 0 ? (
        <p className="rounded-md border border-slate-200 bg-white p-5 text-sm text-slate-600">
          {search ? 'Nenhum processo corresponde à busca.' : 'Nenhum processo publicado está disponível nas origens autorizadas.'}
        </p>
      ) : rows.length > 0 && (
        <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-600">
                <tr>
                  <th scope="col" className="px-4 py-3">Origem</th>
                  <th scope="col" className="px-4 py-3">Processo</th>
                  <th scope="col" className="px-4 py-3">Fluxo</th>
                  <th scope="col" className="px-4 py-3 text-right">Importar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {rows.map(item => {
                  const key = selectionKey(item.tenantId, item.key);
                  const chosen = selections[key];
                  const checked = chosen?.version === item.version;
                  const conflicting = selected.find(selection =>
                    selection.processKey.toLowerCase() === item.key.toLowerCase()
                    && (selection.sourceTenantId.toLowerCase() !== item.tenantId.toLowerCase() || selection.version !== item.version),
                  );
                  const disabled = !item.importable || (!!conflicting && !checked) || (!!chosen && !checked);
                  const sourceLabel = `${item.clientName} — ${purposeLabel(item.purpose)}`;
                  const href = previewUrl(item);

                  return (
                    <tr key={`${item.tenantId}:${item.key}:${item.version}`} className="align-top">
                      <td className="px-4 py-3">
                        <span className="block font-medium text-slate-900">{item.clientName}</span>
                        <span className="mt-0.5 block text-xs text-slate-600">
                          {purposeLabel(item.purpose)}{item.environmentName ? ` · ${item.environmentName}` : ''}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="block font-medium text-slate-900">{item.name}</span>
                        <span className="mt-0.5 block text-xs text-slate-600">Versão {item.version} · {item.importable ? 'Publicada' : 'Rascunho'}</span>
                      </td>
                      <td className="px-4 py-3">
                        {href ? (
                          <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-9 items-center gap-1.5 font-medium text-slate-700 underline decoration-slate-300 underline-offset-4 hover:text-slate-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-slate-700">
                            <ExternalLink size={15} aria-hidden="true" /> Visualizar fluxo
                          </a>
                        ) : <span className="text-xs text-slate-500">Ambiente indisponível</span>}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <input
                          type="checkbox"
                          aria-label={`Importar ${item.name} de ${sourceLabel}`}
                          checked={checked}
                          disabled={disabled}
                          onChange={event => onToggle(item, event.target.checked)}
                          className="h-4 w-4 rounded border-slate-300 accent-slate-900 disabled:cursor-not-allowed"
                        />
                        {conflicting && !checked && <span className="mt-1 block max-w-44 text-right text-xs text-amber-800">A chave “{item.key}” já foi escolhida de outra origem ou versão.</span>}
                        {!item.importable && <span className="mt-1 block text-right text-xs text-slate-500">Somente versões publicadas podem ser importadas.</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-4 py-3">
            <span className="text-sm text-slate-600">{total} {total === 1 ? 'resultado' : 'resultados'} · Página {Math.min(page, pageCount)} de {pageCount}</span>
            <nav aria-label="Paginação dos processos" className="flex gap-2">
              <button type="button" className={button} disabled={page <= 1 || inventory.isFetching} onClick={() => setPage(current => current - 1)}>
                <ArrowLeft size={15} aria-hidden="true" /> Anterior
              </button>
              <button type="button" className={button} disabled={page >= pageCount || inventory.isFetching} onClick={() => setPage(current => current + 1)}>
                Próxima <ArrowRight size={15} aria-hidden="true" />
              </button>
            </nav>
          </div>
        </div>
      )}
    </section>
  );
}
