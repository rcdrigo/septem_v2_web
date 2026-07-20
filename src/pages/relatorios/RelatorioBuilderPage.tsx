import { useEffect, useMemo, useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, BarChart3, Eye, Plus, RefreshCcw, Save, Send, Trash2 } from 'lucide-react';
import { useSessionStore } from '@/stores/session';
import { useDocumentTitle } from '@/lib/use-document-title';
import { Field, Checkbox, Select, TextInput } from '@/components/ui/Field';
import { Combobox } from '@/components/ui/Combobox';
import { toast } from '@/stores/toast';
import { ApiError } from '@/lib/api';
import { Toaster } from '@/components/ui/Toaster';
import { ReportRunViewer } from '@/components/reports/ReportViewer';
import { useProcessList } from '@/lib/api/process-definitions';
import { useDataSourcesList } from '@/lib/api/data-sources';
import {
  useReport, useUpdateReport, usePublishReport, useSyncReportSchema, useReportSourceMetadata,
  useReportAccessRules, useSaveReportAccessRules,
  type BlockDef, type BlockFilterDef, type GlobalFilterDef, type ReportDefinition,
  type ReportAccessRule, type TableColumnDef,
} from '@/lib/api/reports';
import { useAccessProfiles } from '@/lib/api/access-profiles';
import { useOrgUnitsFlat } from '@/lib/api/org-units';
import { useUsersList } from '@/lib/api/users';

const AGG_OPTIONS = [
  { value: 'count', label: 'Contagem' },
  { value: 'sum', label: 'Soma' },
  { value: 'avg', label: 'Média' },
  { value: 'min', label: 'Mínimo' },
  { value: 'max', label: 'Máximo' },
  { value: 'percent', label: 'Percentual (%)' },
];

const BLOCK_TYPES = [
  { value: 'table', label: 'Tabela' },
  { value: 'kpi', label: 'KPI / Card' },
  { value: 'pie', label: 'Pizza' },
  { value: 'bars', label: 'Barras' },
  { value: 'stackedBars', label: 'Barras compostas' },
];

/**
 * Builder do relatório (aba própria — /relatorios/editar?key=): staging de
 * blocos (tabela/KPI/pizza/barras/compostas) sobre a origem (fonte de dados ou
 * processo), filtros globais, fórmulas (básicas e NCalc), conjunto de detalhe,
 * cache e preview com dados reais. Salvar = rascunho; Publicar congela o
 * snapshot do schema (mudança na origem exige "Sincronizar schema").
 */
export function RelatorioBuilderPage() {
  const token = useSessionStore((s) => s.accessToken);
  const [params] = useSearchParams();
  const key = params.get('key');

  const detail = useReport(key);
  const meta = useReportSourceMetadata(key);
  const update = useUpdateReport();
  const publish = usePublishReport();
  const sync = useSyncReportSchema();
  useDocumentTitle(detail.data?.name ? `${detail.data.name} · Editor` : 'Editor de relatório');

  const [def, setDef] = useState<ReportDefinition>({});
  const [sourceType, setSourceType] = useState('dataSource');
  const [processKey, setProcessKey] = useState('');
  const [dataSourceId, setDataSourceId] = useState('');
  const [hydrated, setHydrated] = useState(false);
  const [tab, setTab] = useState<'blocos' | 'filtros' | 'acesso' | 'preview'>('blocos');

  const processes = useProcessList({ pageSize: 100 });
  const sources = useDataSourcesList('report');

  useEffect(() => {
    if (!detail.data || hydrated) return;
    try { setDef(JSON.parse(detail.data.definitionJson || '{}')); } catch { setDef({}); }
    setSourceType(detail.data.sourceType ?? 'dataSource');
    setProcessKey(detail.data.processKey ?? '');
    setDataSourceId(detail.data.dataSourceId ?? '');
    setHydrated(true);
  }, [detail.data, hydrated]);

  const columns = meta.data?.columns ?? [];
  const columnOptions = useMemo(
    () => columns.map((c) => ({ value: c.key, label: c.group ? `${c.group} › ${c.label}` : c.label })),
    [columns],
  );

  if (!token) return <Navigate to="/login" replace />;
  if (!key) return <Navigate to="/admin/relatorios" replace />;

  async function saveDraft(showToast = true) {
    try {
      await update.mutateAsync({
        key: key!,
        body: {
          name: detail.data?.name ?? key!,
          sourceType,
          processKey,
          dataSourceId: dataSourceId || '00000000-0000-0000-0000-000000000000',
          definitionJson: JSON.stringify(def),
        },
      });
      if (showToast) toast.success('Rascunho salvo.');
      return true;
    } catch (err) {
      toast.error(err instanceof ApiError ? (err.detail ?? err.message) : 'Falha ao salvar.');
      return false;
    }
  }

  async function doPublish() {
    if (!(await saveDraft(false))) return;
    try {
      await publish.mutateAsync(key!);
      toast.success('Relatório publicado (schema congelado).');
    } catch (err) {
      const issues = err instanceof ApiError && Array.isArray(err.issues) ? (err.issues as string[]) : null;
      toast.error(issues?.[0] ?? (err instanceof ApiError ? (err.detail ?? err.message) : 'Falha ao publicar.'));
    }
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-slate-100">
      <header className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-white px-4 py-3">
        <button type="button" onClick={() => window.close()} className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100" title="Fechar">
          <ArrowLeft size={18} />
        </button>
        <div className="min-w-0">
          <h1 className="truncate text-base font-semibold text-slate-900">{detail.data?.name ?? '…'}</h1>
          <p className="text-xs text-slate-400">v{detail.data?.version} · {detail.data?.status === 'published' ? 'publicado (editar cria novo rascunho)' : detail.data?.status}</p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => sync.mutateAsync(key!).then(() => toast.success('Schema sincronizado com a origem.')).catch(() => toast.error('Falha ao sincronizar (há versão publicada?).'))}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50" title="Atualiza o snapshot da versão publicada com o schema atual da origem">
            <RefreshCcw size={14} /> Sincronizar schema
          </button>
          <button type="button" onClick={() => setTab('preview')} className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50">
            <Eye size={14} /> Preview
          </button>
          <button type="button" onClick={() => saveDraft()} disabled={update.isPending}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">
            <Save size={14} /> Salvar rascunho
          </button>
          <button type="button" onClick={doPublish} disabled={publish.isPending}
            className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50">
            <Send size={14} /> Publicar
          </button>
        </div>
      </header>

      <nav className="flex gap-1 overflow-x-auto border-b border-slate-200 bg-white px-4 pt-2">
        {(['blocos', 'filtros', 'acesso', 'preview'] as const).map((t) => (
          <button key={t} type="button" onClick={() => setTab(t)}
            className={`whitespace-nowrap rounded-t-md px-3 py-1.5 text-sm font-medium capitalize ${tab === t ? 'border border-b-0 border-slate-200 bg-slate-100 text-slate-900' : 'text-slate-500 hover:text-slate-800'}`}>
            {t === 'blocos' ? 'Blocos' : t === 'filtros' ? 'Filtros e detalhe' : t === 'acesso' ? 'Acesso' : 'Preview'}
          </button>
        ))}
      </nav>

      <main className="flex-1 overflow-auto p-4">
        {tab === 'acesso' && key && (
          <div className="mx-auto max-w-5xl">
            <AccessRulesEditor reportKey={key} />
          </div>
        )}

        {tab !== 'preview' && tab !== 'acesso' && (
          <div className="mx-auto flex max-w-5xl flex-col gap-4">
            {/* Origem */}
            <section className="rounded-md border border-slate-200 bg-white p-4">
              <h2 className="mb-3 text-sm font-semibold text-slate-800">Origem dos dados</h2>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <Field label="Tipo de origem">
                  <Select value={sourceType} onChange={(e) => setSourceType(e.target.value)} options={[
                    { value: 'dataSource', label: 'Fonte de dados (relatório)' },
                    { value: 'process', label: 'Processo (instâncias)' },
                  ]} />
                </Field>
                {sourceType === 'process' ? (
                  <Field label="Processo" hint="Instâncias de todas as versões; só campos marcados como visíveis no relatório.">
                    <Combobox value={processKey} onChange={setProcessKey} placeholder="Selecione o processo…"
                      options={(processes.data?.items ?? []).map((p) => ({ value: p.key, label: p.name }))} clearLabel="— nenhum —" />
                  </Field>
                ) : (
                  <Field label="Fonte de dados" hint="Colunas e tipos inferidos; ajuste manual abaixo.">
                    <Combobox value={dataSourceId} onChange={setDataSourceId} placeholder="Selecione a fonte…"
                      options={(sources.data ?? []).map((d) => ({ value: d.id, label: d.name }))} clearLabel="— nenhuma —" />
                  </Field>
                )}
              </div>
              {meta.isError && <p className="mt-2 text-xs text-amber-600">Origem ainda sem schema — salve o rascunho para carregar os campos.</p>}
              {columns.length > 0 && (
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="text-left uppercase tracking-wide text-slate-400">
                      <tr><th className="py-1 pr-3">Campo</th><th className="py-1 pr-3">Grupo</th><th className="py-1">Tipo</th></tr>
                    </thead>
                    <tbody>
                      {columns.map((c) => (
                        <tr key={c.key} className="border-t border-slate-100">
                          <td className="py-1 pr-3 font-medium text-slate-700">{c.label} <span className="font-normal text-slate-400">({c.key})</span></td>
                          <td className="py-1 pr-3 text-slate-500">{c.group ?? '—'}</td>
                          <td className="py-1">
                            {sourceType === 'dataSource' ? (
                              <select value={def.columnTypes?.[c.key] ?? c.type}
                                onChange={(e) => setDef({ ...def, columnTypes: { ...def.columnTypes, [c.key]: e.target.value } })}
                                className="rounded border border-slate-200 px-1 py-0.5 text-xs">
                                <option value="text">texto</option><option value="number">número</option>
                                <option value="date">data</option><option value="bool">sim/não</option>
                              </select>
                            ) : <span className="text-slate-500">{c.type}</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {tab === 'blocos' && (
              <BlocksEditor def={def} setDef={setDef} columnOptions={columnOptions} />
            )}
            {tab === 'filtros' && (
              <FiltersAndDetailEditor def={def} setDef={setDef} columnOptions={columnOptions} />
            )}
          </div>
        )}

        {tab === 'preview' && key && (
          <div className="mx-auto max-w-6xl">
            <p className="mb-3 text-xs text-slate-500">Preview usa o RASCUNHO salvo com dados reais — salve antes para ver as últimas mudanças.</p>
            <ReportRunViewer reportKey={key} filtersDef={def.filters ?? []} preview />
          </div>
        )}
      </main>
      <Toaster />
    </div>
  );
}

const OP_OPTIONS = [
  { value: 'eq', label: 'igual a' }, { value: 'neq', label: 'diferente de' },
  { value: 'gt', label: 'maior que' }, { value: 'lt', label: 'menor que' },
  { value: 'gte', label: 'maior ou igual' }, { value: 'lte', label: 'menor ou igual' },
  { value: 'contains', label: 'contém' },
];

const FORMAT_OPTIONS = [
  { value: '', label: 'Automático' }, { value: 'number', label: 'Número' },
  { value: 'currency', label: 'Moeda (R$)' }, { value: 'date', label: 'Data' }, { value: 'text', label: 'Texto' },
];

function BlocksEditor({ def, setDef, columnOptions }: {
  def: ReportDefinition; setDef: (d: ReportDefinition) => void;
  columnOptions: { value: string; label: string }[];
}) {
  const blocks = def.blocks ?? [];
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  function patch(i: number, p: Partial<BlockDef>) {
    setDef({ ...def, blocks: blocks.map((b, j) => (j === i ? { ...b, ...p } : b)) });
  }
  function add(type: BlockDef['type']) {
    const id = `b${Date.now().toString(36)}`;
    setDef({ ...def, blocks: [...blocks, { id, type, title: BLOCK_TYPES.find((t) => t.value === type)?.label }] });
  }
  // Reordenação por arrastar-e-soltar (a ordem define o layout do canvas).
  function dropOn(target: number) {
    if (dragIndex === null || dragIndex === target) return;
    const next = [...blocks];
    const [moved] = next.splice(dragIndex, 1);
    next.splice(target, 0, moved);
    setDef({ ...def, blocks: next });
    setDragIndex(null);
  }

  return (
    <section className="rounded-md border border-slate-200 bg-white p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-semibold text-slate-800">Blocos do relatório</h2>
        <span className="text-xs text-slate-400">arraste pelo ícone ⋮⋮ para reordenar</span>
        <div className="ml-auto flex flex-wrap gap-1.5">
          {BLOCK_TYPES.map((t) => (
            <button key={t.value} type="button" onClick={() => add(t.value as BlockDef['type'])}
              className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50">
              <Plus size={12} /> {t.label}
            </button>
          ))}
        </div>
      </div>
      {blocks.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed border-slate-200 bg-slate-50/60 px-6 py-16 text-center">
          <BarChart3 size={48} strokeWidth={1.5} className="text-slate-300" aria-hidden />
          <p className="max-w-sm text-sm leading-relaxed text-slate-500">
            <button type="button" onClick={() => add('table')}
              className="rounded font-medium text-sky-600 underline underline-offset-2 hover:text-sky-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500">
              Adicione um componente
            </button>{' '}
            para visualizar seus dados em tabelas, indicadores (KPI) e gráficos de pizza, barras e barras compostas.
          </p>
        </div>
      )}
      <div className="flex flex-col gap-3">
        {blocks.map((b, i) => (
          <div key={b.id}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => dropOn(i)}
            className={`rounded-md border p-3 ${dragIndex === i ? 'border-sky-400 opacity-60' : 'border-slate-200'}`}
          >
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span
                draggable
                onDragStart={() => setDragIndex(i)}
                onDragEnd={() => setDragIndex(null)}
                title="Arraste para reordenar"
                className="cursor-grab select-none rounded px-1 text-slate-400 hover:bg-slate-100 active:cursor-grabbing"
              >⋮⋮</span>
              <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">{BLOCK_TYPES.find((t) => t.value === b.type)?.label}</span>
              <input value={b.title ?? ''} onChange={(e) => patch(i, { title: e.target.value })} placeholder="Título do bloco"
                className="min-w-0 flex-1 rounded-md border border-slate-300 px-2 py-1 text-sm" />
              <button type="button" onClick={() => setDef({ ...def, blocks: blocks.filter((_, j) => j !== i) })}
                aria-label="Remover bloco" className="rounded p-1.5 text-rose-600 hover:bg-rose-50"><Trash2 size={14} /></button>
            </div>

            {b.type === 'table' ? (
              <div className="flex flex-col gap-2">
                <TableColumnsEditor block={b} onChange={(columns) => patch(i, { columns })} columnOptions={columnOptions} />
                <SortEditor block={b} onChange={(sort) => patch(i, { sort })} columnOptions={columnOptions} allowValue={false} />
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {b.type !== 'kpi' && (
                  <Field label="Agrupar por">
                    <Select value={b.groupBy ?? ''} onChange={(e) => patch(i, { groupBy: e.target.value })}
                      options={[{ value: '', label: '—' }, ...columnOptions]} />
                  </Field>
                )}
                {b.type === 'stackedBars' && (
                  <Field label="Empilhar por (série)">
                    <Select value={b.stackBy ?? ''} onChange={(e) => patch(i, { stackBy: e.target.value })}
                      options={[{ value: '', label: '—' }, ...columnOptions]} />
                  </Field>
                )}
                <Field label="Agregação">
                  <Select value={b.agg ?? 'count'} onChange={(e) => patch(i, { agg: e.target.value })} options={AGG_OPTIONS} />
                </Field>
                <Field label="Campo de valor">
                  <Select value={b.valueField ?? ''} onChange={(e) => patch(i, { valueField: e.target.value })}
                    options={[{ value: '', label: '—' }, ...columnOptions]} />
                </Field>
                <Field label="Formatação">
                  <Select value={b.format ?? ''} onChange={(e) => patch(i, { format: e.target.value || undefined })} options={FORMAT_OPTIONS} />
                </Field>
                <Field label="Limite">
                  <TextInput type="number" value={b.limit ?? ''} onChange={(e) => patch(i, { limit: e.target.value ? Number(e.target.value) : undefined })} placeholder="Todos" />
                </Field>
                <div className="sm:col-span-1 lg:col-span-2">
                  <SortEditor block={b} onChange={(sort) => patch(i, { sort })} columnOptions={columnOptions} allowValue />
                </div>
                <div className="sm:col-span-2 lg:col-span-4">
                  <Field label="Fórmula avançada (opcional)" hint="Expressão por linha, ex.: [valor] * 1.1 — validada, sem SQL.">
                    <TextInput value={b.formula ?? ''} onChange={(e) => patch(i, { formula: e.target.value || undefined })} placeholder="[campo_a] + [campo_b]" />
                  </Field>
                </div>
              </div>
            )}

            <BlockFiltersEditor block={b} onChange={(filters) => patch(i, { filters })} columnOptions={columnOptions} />
          </div>
        ))}
      </div>
    </section>
  );
}

/** Ordenação do bloco: campo (ou valor agregado, nos gráficos) + direção. */
function SortEditor({ block, onChange, columnOptions, allowValue }: {
  block: BlockDef; onChange: (s: BlockDef['sort']) => void;
  columnOptions: { value: string; label: string }[]; allowValue: boolean;
}) {
  const opts = [
    { value: '', label: 'Sem ordenação' },
    ...(allowValue ? [{ value: '_value', label: 'Valor agregado' }] : []),
    ...columnOptions,
  ];
  return (
    <div className="flex items-end gap-2">
      <div className="min-w-0 flex-1">
        <Field label="Ordenação">
          <Select value={block.sort?.field ?? ''} options={opts}
            onChange={(e) => onChange(e.target.value ? { field: e.target.value, desc: block.sort?.desc ?? true } : undefined)} />
        </Field>
      </div>
      {block.sort && (
        <button type="button" onClick={() => onChange({ field: block.sort!.field, desc: !block.sort!.desc })}
          className="rounded-md border border-slate-300 px-2.5 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
          title="Inverter direção">
          {block.sort.desc ? '↓ desc' : '↑ asc'}
        </button>
      )}
    </div>
  );
}

/** Filtros PRÓPRIOS do bloco (além dos globais): campo + operador + valor. */
function BlockFiltersEditor({ block, onChange, columnOptions }: {
  block: BlockDef; onChange: (f: BlockFilterDef[]) => void;
  columnOptions: { value: string; label: string }[];
}) {
  const filters = block.filters ?? [];
  return (
    <div className="mt-2 border-t border-slate-100 pt-2">
      <div className="mb-1 flex items-center gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Filtros do bloco</span>
        <button type="button"
          onClick={() => onChange([...filters, { field: columnOptions[0]?.value ?? '', op: 'eq', value: '' }])}
          className="inline-flex items-center gap-1 rounded border border-slate-300 px-1.5 py-0.5 text-[11px] font-medium text-slate-600 hover:bg-slate-50">
          <Plus size={10} /> filtro
        </button>
      </div>
      {filters.length === 0 && <p className="text-xs text-slate-400">Sem filtros próprios — o bloco usa só os filtros globais.</p>}
      <div className="flex flex-col gap-1.5">
        {filters.map((f, i) => (
          <div key={i} className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_2rem] items-center gap-1.5">
            <Select value={f.field} aria-label="Campo do filtro"
              onChange={(e) => onChange(filters.map((x, j) => (j === i ? { ...x, field: e.target.value } : x)))}
              options={columnOptions} className="min-w-0" />
            <Select value={f.op} aria-label="Operador do filtro"
              onChange={(e) => onChange(filters.map((x, j) => (j === i ? { ...x, op: e.target.value } : x)))}
              options={OP_OPTIONS} className="min-w-0" />
            <TextInput value={f.value ?? ''} placeholder="valor"
              onChange={(e) => onChange(filters.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))}
              className="min-w-0" />
            <button type="button" onClick={() => onChange(filters.filter((_, j) => j !== i))}
              aria-label="Remover filtro do bloco" className="justify-self-end rounded p-1 text-rose-600 hover:bg-rose-50">
              <Trash2 size={13} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function TableColumnsEditor({ block, onChange, columnOptions }: {
  block: BlockDef; onChange: (c: TableColumnDef[]) => void;
  columnOptions: { value: string; label: string }[];
}) {
  const cols = block.columns ?? [];
  const available = columnOptions.filter((o) => !cols.some((c) => c.key === o.value));
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-slate-500">Colunas ocultas continuam no detalhe da linha (botão ℹ por linha).</p>
      <div className="flex flex-wrap gap-2">
        {cols.map((c, i) => (
          <span key={c.key} className="inline-flex flex-wrap items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs">
            {columnOptions.find((o) => o.value === c.key)?.label ?? c.key}
            <label className="inline-flex items-center gap-1 text-slate-500">
              <input type="checkbox" checked={c.visible !== false}
                onChange={(e) => onChange(cols.map((x, j) => (j === i ? { ...x, visible: e.target.checked } : x)))} />
              visível
            </label>
            <select value={c.format ?? ''} aria-label={`Formato de ${c.key}`}
              onChange={(e) => onChange(cols.map((x, j) => (j === i ? { ...x, format: e.target.value || undefined } : x)))}
              className="rounded border border-slate-200 px-1 py-0.5 text-[11px] text-slate-600">
              {FORMAT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <button type="button" onClick={() => onChange(cols.filter((_, j) => j !== i))} aria-label={`Remover ${c.key}`}
              className="text-rose-500 hover:text-rose-700">×</button>
          </span>
        ))}
      </div>
      {available.length > 0 && (
        <select value="" onChange={(e) => e.target.value && onChange([...cols, { key: e.target.value }])}
          className="w-fit rounded-md border border-slate-300 px-2 py-1 text-xs">
          <option value="">+ adicionar coluna…</option>
          {available.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      )}
    </div>
  );
}

function FiltersAndDetailEditor({ def, setDef, columnOptions }: {
  def: ReportDefinition; setDef: (d: ReportDefinition) => void;
  columnOptions: { value: string; label: string }[];
}) {
  const filters = def.filters ?? [];
  function patch(i: number, p: Partial<GlobalFilterDef>) {
    setDef({ ...def, filters: filters.map((f, j) => (j === i ? { ...f, ...p } : f)) });
  }
  const detailFields = def.detail?.fields ?? [];

  return (
    <>
      <section className="rounded-md border border-slate-200 bg-white p-4">
        <div className="mb-3 flex items-center gap-2">
          <h2 className="text-sm font-semibold text-slate-800">Filtros globais</h2>
          <button type="button" onClick={() => setDef({ ...def, filters: [...filters, { id: `f${Date.now().toString(36)}`, type: 'text' }] })}
            className="ml-auto inline-flex items-center gap-1 rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50">
            <Plus size={12} /> Novo filtro
          </button>
        </div>
        {filters.length === 0 && <p className="text-sm text-slate-400">Sem filtros globais.</p>}
        <div className="flex flex-col gap-3">
          {filters.map((f, i) => (
            <div key={f.id} className="grid grid-cols-1 gap-2 rounded-md border border-slate-200 p-3 sm:grid-cols-2 lg:grid-cols-5">
              <Field label="Rótulo"><TextInput value={f.label ?? ''} onChange={(e) => patch(i, { label: e.target.value })} /></Field>
              <Field label="Campo (pós-filtro)">
                <Select value={f.field ?? ''} onChange={(e) => patch(i, { field: e.target.value || undefined })}
                  options={[{ value: '', label: '—' }, ...columnOptions]} />
              </Field>
              <Field label="Tipo">
                <Select value={f.type} onChange={(e) => patch(i, { type: e.target.value as GlobalFilterDef['type'] })} options={[
                  { value: 'text', label: 'Texto (contém)' }, { value: 'number', label: 'Número' },
                  { value: 'date', label: 'Período (datas)' }, { value: 'select', label: 'Seleção' },
                ]} />
              </Field>
              <Field label="Parâmetro da fonte" hint="Alimenta a procedure.">
                <TextInput value={f.mapsToParam ?? ''} onChange={(e) => patch(i, { mapsToParam: e.target.value || undefined })} placeholder="ex: p_setor" />
              </Field>
              <div className="flex flex-col gap-1.5">
                <Field label="Valor padrão"><TextInput value={f.default ?? ''} onChange={(e) => patch(i, { default: e.target.value || undefined })} /></Field>
                <div className="flex items-center justify-between">
                  <Checkbox checked={!!f.required} onChange={(b) => patch(i, { required: b })} label="Obrigatório" />
                  <button type="button" onClick={() => setDef({ ...def, filters: filters.filter((_, j) => j !== i) })}
                    aria-label="Remover filtro" className="rounded p-1.5 text-rose-600 hover:bg-rose-50"><Trash2 size={14} /></button>
                </div>
              </div>
              {f.type === 'select' && (
                <div className="sm:col-span-2 lg:col-span-5">
                  <Field label="Opções (uma por linha)">
                    <TextInput value={(f.options ?? []).join(' | ')} onChange={(e) => patch(i, { options: e.target.value.split('|').map((s) => s.trim()).filter(Boolean) })} placeholder="Obras | Saúde | Educação" />
                  </Field>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-md border border-slate-200 bg-white p-4">
        <h2 className="mb-1 text-sm font-semibold text-slate-800">Detalhe (drill-down e linha)</h2>
        <p className="mb-2 text-xs text-slate-500">Campos exibidos no modal de detalhe e no drill-down dos gráficos. Vazio = todos.</p>
        <div className="flex flex-wrap gap-2">
          {columnOptions.map((o) => (
            <label key={o.value} className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-600">
              <input type="checkbox" checked={detailFields.includes(o.value)}
                onChange={(e) => setDef({
                  ...def,
                  detail: { fields: e.target.checked ? [...detailFields, o.value] : detailFields.filter((x) => x !== o.value) },
                })} />
              {o.label}
            </label>
          ))}
        </div>
      </section>

      <section className="rounded-md border border-slate-200 bg-white p-4">
        <Field label="Cache (segundos)" hint="Execução publicada usa dados ao vivo com cache; 0 desliga. Padrão: 300 (5 min).">
          <TextInput type="number" value={def.cacheTtlSeconds ?? ''} placeholder="300"
            onChange={(e) => setDef({ ...def, cacheTtlSeconds: e.target.value ? Number(e.target.value) : undefined })} />
        </Field>
      </section>
    </>
  );
}

const RULE_TYPE_OPTIONS = [
  { value: 'all', label: 'Todos os usuários' },
  { value: 'user', label: 'Usuário específico' },
  { value: 'profile', label: 'Perfil de acesso' },
  { value: 'orgUnit', label: 'Unidade organizacional' },
];

/**
 * Regras de acesso PRÓPRIAS do relatório — mesmo modelo do controle de acesso
 * de processos: DENY por padrão (sem regra, só admin vê em Consultas); um
 * "negar" que casa vence o "permitir". Ids trafegam como públicos (Guid).
 */
function AccessRulesEditor({ reportKey }: { reportKey: string }) {
  const remote = useReportAccessRules(reportKey);
  const save = useSaveReportAccessRules();
  const profiles = useAccessProfiles();
  const units = useOrgUnitsFlat();
  const users = useUsersList({ pageSize: 100 });

  const [rules, setRules] = useState<ReportAccessRule[] | null>(null);
  useEffect(() => {
    if (remote.data && rules === null) setRules(remote.data.rules);
  }, [remote.data, rules]);
  const list = rules ?? remote.data?.rules ?? [];

  function patch(i: number, p: Partial<ReportAccessRule>) {
    setRules(list.map((r, j) => (j === i ? { ...r, ...p } : r)));
  }

  async function persist() {
    try {
      await save.mutateAsync({ key: reportKey, rules: list });
      toast.success('Regras de acesso salvas.');
    } catch (err) {
      toast.error(err instanceof ApiError ? (err.detail ?? err.message) : 'Falha ao salvar as regras.');
    }
  }

  return (
    <section className="rounded-md border border-slate-200 bg-white p-4">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-semibold text-slate-800">Quem pode ver este relatório em Consultas</h2>
        <div className="ml-auto flex gap-2">
          <button type="button"
            onClick={() => setRules([...list, { ruleType: 'all', action: 'allow' }])}
            className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50">
            <Plus size={12} /> Nova regra
          </button>
          <button type="button" onClick={persist} disabled={save.isPending}
            className="rounded-md bg-slate-900 px-3 py-1 text-xs font-medium text-white hover:bg-slate-700 disabled:opacity-50">
            Salvar regras
          </button>
        </div>
      </div>
      <p className="mb-3 text-xs text-slate-500">
        Sem nenhuma regra, apenas administradores veem o relatório. Uma regra de <b>negar</b> que
        casar com o usuário vence qualquer <b>permitir</b>.
      </p>

      {list.length === 0 && <p className="text-sm text-slate-400">Nenhuma regra — visível só para administradores.</p>}
      <div className="flex flex-col gap-2">
        {list.map((r, i) => (
          <div key={i} className="grid grid-cols-1 items-end gap-2 rounded-md border border-slate-200 p-3 sm:grid-cols-[8rem_minmax(0,1fr)_minmax(0,1.4fr)_2rem]">
            <Field label="Ação">
              <Select value={r.action} onChange={(e) => patch(i, { action: e.target.value as 'allow' | 'deny' })}
                options={[{ value: 'allow', label: 'Permitir' }, { value: 'deny', label: 'Negar' }]} />
            </Field>
            <Field label="Aplicar a">
              <Select value={r.ruleType}
                onChange={(e) => patch(i, { ruleType: e.target.value as ReportAccessRule['ruleType'], userId: null, accessProfileId: null, orgUnitId: null, positionId: null })}
                options={RULE_TYPE_OPTIONS} />
            </Field>
            <div className="min-w-0">
              {r.ruleType === 'user' && (
                <Field label="Usuário">
                  <Combobox value={r.userId ?? ''} onChange={(v) => patch(i, { userId: v || null })}
                    options={(users.data?.items ?? []).map((u) => ({ value: u.id, label: `${u.name} (${u.email})` }))}
                    placeholder="Selecione…" clearLabel="— nenhum —" />
                </Field>
              )}
              {r.ruleType === 'profile' && (
                <Field label="Perfil">
                  <Combobox value={r.accessProfileId ?? ''} onChange={(v) => patch(i, { accessProfileId: v || null })}
                    options={(profiles.data ?? []).map((p) => ({ value: p.id, label: p.name }))}
                    placeholder="Selecione…" clearLabel="— nenhum —" />
                </Field>
              )}
              {r.ruleType === 'orgUnit' && (
                <Field label="Unidade">
                  <Combobox value={r.orgUnitId ?? ''} onChange={(v) => patch(i, { orgUnitId: v || null })}
                    options={(units.data ?? []).map((u) => ({ value: u.id, label: u.name }))}
                    placeholder="Selecione…" clearLabel="— nenhuma —" />
                </Field>
              )}
              {r.ruleType === 'all' && <p className="pb-1.5 text-xs text-slate-400">Vale para qualquer usuário autenticado.</p>}
            </div>
            <button type="button" onClick={() => setRules(list.filter((_, j) => j !== i))}
              aria-label="Remover regra de acesso" className="justify-self-end rounded p-1.5 text-rose-600 hover:bg-rose-50">
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
