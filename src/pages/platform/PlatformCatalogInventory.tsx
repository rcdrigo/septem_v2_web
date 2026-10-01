import { useEffect, useRef, useState } from 'react';
import { ArrowDownToLine, Check, Loader2, Search } from 'lucide-react';
import { usePlatformClient } from '@/lib/api/platform-clients';
import {
  useApplyCatalogImport, useCatalogInventory, useCompareCatalogImport,
  type CatalogImportPlan, type CatalogInventoryItem,
} from '@/lib/api/platform-catalog';

const purposeName = (value: string) => value === 'staging' ? 'Homologação' : value === 'production' ? 'Produção' : 'Demonstração';
const actionName: Record<string, string> = { new: 'Novo', update: 'Atualizar', conflict: 'Conflito', unchanged: 'Sem alteração' };
const control = 'min-h-11 rounded-md border border-slate-300 bg-white px-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-600';

export function PlatformCatalogInventory({ destinationClientId }: { destinationClientId: string }) {
  const importHeading = useRef<HTMLHeadingElement>(null);
  const inventory = useCatalogInventory();
  const compare = useCompareCatalogImport();
  const apply = useApplyCatalogImport();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<CatalogInventoryItem | null>(null);
  const client = usePlatformClient(destinationClientId);
  const [destination, setDestination] = useState('');
  const [plan, setPlan] = useState<CatalogImportPlan | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  useEffect(() => { if (selected) importHeading.current?.focus(); }, [selected]);
  const busy = compare.isPending || apply.isPending;
  const rows = (inventory.data?.items ?? []).filter(item =>
    `${item.name} ${item.key} ${item.clientName} ${item.tenantId}`.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR')));

  function clearComparison() { setPlan(null); setConfirmed(false); setError(null); setSuccess(null); }
  async function compareSelection() {
    if (!selected || !destination) return;
    clearComparison();
    try { setPlan(await compare.mutateAsync({ source: selected.tenantId, destination, keys: [selected.key] })); }
    catch (err) { setError(err instanceof Error ? err.message : 'Não foi possível comparar. Tente novamente.'); }
  }
  async function importSelection() {
    if (!plan || !selected) return;
    setError(null);
    try {
      await apply.mutateAsync({ id: plan.id, confirmUpdate: confirmed, expectedPlanVersion: plan.planVersion });
      setSuccess(`“${selected.name}” foi importado como rascunho. Revise e publique no ambiente de destino quando estiver pronto.`);
      setPlan(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível importar. Compare novamente antes de tentar.');
      setPlan(null);
    }
  }

  return (
    <section aria-labelledby="inventory-title" className="my-8">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="inventory-title" className="font-semibold text-slate-900">Importar processos do catálogo</h2>
          <p className="mt-1 text-sm text-slate-600">Somente origens autorizadas. Versões publicadas podem ser importadas com suas dependências.</p>
        </div>
        <label className="flex min-h-11 w-full items-center gap-2 rounded-md border border-slate-300 bg-white px-3 focus-within:outline-2 focus-within:outline-slate-600 sm:w-auto">
          <Search aria-hidden="true" className="h-4 w-4 text-slate-500" />
          <input aria-label="Buscar processo ou cliente" value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar processo ou cliente" className="w-full bg-transparent text-sm outline-none sm:w-56" />
        </label>
      </div>
      {inventory.isLoading && <p role="status" className="py-4 text-sm text-slate-600">Carregando processos…</p>}
      {inventory.isError && <div role="alert" className="py-4 text-sm text-red-700">Não foi possível consultar os processos. <button type="button" onClick={() => void inventory.refetch()} className="min-h-11 underline underline-offset-4">Tentar novamente</button></div>}
      {inventory.data && rows.length === 0 && <p className="rounded-md border border-dashed border-slate-300 p-6 text-sm text-slate-600">{search ? 'Nenhum processo corresponde à busca.' : 'Nenhum processo disponível nas origens autorizadas.'}</p>}
      {rows.length > 0 && <ul className="divide-y divide-slate-200 border-y border-slate-200" data-testid="catalog-inventory">
        {rows.map(item => <li key={item.id} className="grid gap-3 py-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-center">
          <div className="min-w-0"><p className="break-words font-medium text-slate-900">{item.name}</p><p className="mt-1 break-all text-xs text-slate-600">{item.key} · v{item.version} · {item.status === 'published' ? 'Publicado' : 'Rascunho'}</p></div>
          <div className="min-w-0 text-sm text-slate-700"><p className="break-words">{item.clientName}</p><p className="mt-1 break-words text-xs text-slate-600">{purposeName(item.purpose)} · {item.tenantId}</p></div>
          <button type="button" disabled={!item.importable || busy} aria-label={`Importar ${item.name} de ${item.tenantId}`} onClick={() => { setSelected(item); setDestination(''); clearComparison(); }} className={`${control} inline-flex items-center justify-center gap-2 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50`}>
            <ArrowDownToLine aria-hidden="true" className="h-4 w-4" /> {item.importable ? 'Importar' : 'Não publicado'}
          </button>
        </li>)}
      </ul>}
      {selected && <div className="mt-5 rounded-lg border border-slate-200 bg-white p-4" data-testid="catalog-import">
        <h3 ref={importHeading} tabIndex={-1} className="font-semibold text-slate-900 outline-none">Importar {selected.name}</h3>
        <p className="mt-1 text-sm text-slate-600">Origem: {selected.clientName} · {purposeName(selected.purpose)} · {selected.tenantId}. O destino receberá um rascunho.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-sm font-medium text-slate-700">Ambiente de destino
            <select value={destination} disabled={busy || client.isLoading} onChange={event => { setDestination(event.target.value); clearComparison(); }} className={control}>
              <option value="">{client.isLoading ? 'Carregando ambientes…' : 'Selecione o ambiente'}</option>
              {client.data?.environments.filter(item => item.tenantId !== selected.tenantId && item.provisioningState === 'ready').map(item => <option key={item.tenantId} value={item.tenantId}>{purposeName(item.purpose)} · {item.tenantId}</option>)}
            </select>
          </label>
        </div>
        {client.isError && <p role="alert" className="mt-3 text-sm text-red-700">Não foi possível carregar os destinos. <button type="button" className="min-h-11 underline" onClick={() => { void client.refetch(); }}>Tentar novamente</button></p>}
        {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
        {success && <p role="status" className="mt-3 flex gap-2 text-sm text-emerald-800"><Check aria-hidden="true" className="h-5 w-5 shrink-0" />{success}</p>}
        {plan && <div className="mt-4">
          <h4 className="text-sm font-semibold text-slate-900">Comparação com o destino</h4>
          <ul className="mt-2 divide-y divide-slate-100">{plan.items.map(item => <li key={`${item.type}:${item.logicalId}`} className="flex flex-wrap justify-between gap-2 py-2 text-sm"><span className="min-w-0 break-words text-slate-700">{item.name}{item.dependency ? ' · dependência' : ''}{item.sourceVersion != null ? ` · origem v${item.sourceVersion}` : ''}{item.targetVersion != null ? ` · destino v${item.targetVersion}` : ''}</span><strong className="text-slate-900">{actionName[item.action] ?? item.action}</strong></li>)}</ul>
          {plan.blockers.length > 0 && <div role="alert" className="mt-3 text-sm text-red-700"><p className="font-medium">Resolva estas pendências antes de importar:</p><ul className="mt-1 list-disc pl-5">{plan.blockers.map(item => <li key={`${item.reason}:${item.detail}`}>{item.detail}</li>)}</ul></div>}
          {plan.requiresConfirmation && <label className="mt-3 flex min-h-11 items-start gap-2 text-sm text-slate-700"><input type="checkbox" checked={confirmed} disabled={busy} onChange={event => setConfirmed(event.target.checked)} className="mt-1 h-4 w-4 shrink-0" /><span>Confirmo a atualização dos processos existentes indicados na comparação. As novas versões permanecerão em rascunho.</span></label>}
        </div>}
        <div className="mt-4 flex flex-wrap gap-2">
          {!plan ? <button type="button" onClick={() => void compareSelection()} disabled={!destination || busy} className="inline-flex min-h-11 items-center gap-2 rounded-md bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50">{compare.isPending && <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />}{compare.isPending ? 'Comparando…' : 'Comparar antes de importar'}</button>
            : <button type="button" onClick={() => void importSelection()} disabled={busy || plan.blockers.length > 0 || (plan.requiresConfirmation && !confirmed)} className="min-h-11 rounded-md bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50">{apply.isPending ? 'Importando…' : 'Importar como rascunho'}</button>}
          <button type="button" disabled={busy} onClick={() => { setSelected(null); clearComparison(); }} className={control}>Fechar importação</button>
        </div>
      </div>}
    </section>
  );
}
