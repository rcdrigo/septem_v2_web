import { useEffect, useMemo, useRef, useState } from 'react';
import { BarChart3, Grid3x3, Hash, Layers, PieChart, Plus, Table, Trash2, type LucideIcon } from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import { Field, Select, TextInput } from '@/components/ui/Field';
import { PreviewBlockView } from '@/components/reports/ReportViewer';
import { previewBlock, type BlockDef, type BlockFilterDef, type GlobalFilterDef, type RunBlock, type SortDef, type TableColumnDef } from '@/lib/api/reports';
import { KPI_ICON_OPTIONS } from '@/components/reports/kpi-icons';

type ColumnOption = { value: string; label: string };

export const BLOCK_TYPES: { value: BlockDef['type']; label: string; icon: LucideIcon }[] = [
  { value: 'table', label: 'Tabela', icon: Table },
  { value: 'kpi', label: 'KPI / Card', icon: Hash },
  { value: 'pie', label: 'Pizza', icon: PieChart },
  { value: 'bars', label: 'Barras', icon: BarChart3 },
  { value: 'stackedBars', label: 'Barras compostas', icon: Layers },
  { value: 'heatmap', label: 'Mapa de calor', icon: Grid3x3 },
];
export const blockTypeLabel = (t: string) => BLOCK_TYPES.find((b) => b.value === t)?.label ?? t;
export const blockTypeIcon = (t: string) => BLOCK_TYPES.find((b) => b.value === t)?.icon ?? Table;

const AGG_OPTIONS = [
  { value: 'count', label: 'Contagem' }, { value: 'sum', label: 'Soma' }, { value: 'avg', label: 'Média' },
  { value: 'min', label: 'Mínimo' }, { value: 'max', label: 'Máximo' }, { value: 'percent', label: 'Percentual (%)' },
];
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

/**
 * Modal de configuração de um componente do relatório: à ESQUERDA o usuário
 * escolhe o tipo e ajusta parâmetros (colunas, agregações, tamanho no grid,
 * ordenação, filtros); à DIREITA um preview ao vivo é montado a cada mudança
 * (executa só este bloco na fonte, sem salvar). Salvar devolve o bloco ao builder.
 */
export function ComponentEditorModal({
  open, onClose, initial, isEdit, columnOptions, reportKey, globalFilters, hasSource, onSave,
}: {
  open: boolean;
  onClose: () => void;
  initial: BlockDef;
  isEdit: boolean;
  columnOptions: ColumnOption[];
  reportKey: string;
  globalFilters: GlobalFilterDef[];
  hasSource: boolean;
  onSave: (block: BlockDef) => void;
}) {
  const [block, setBlock] = useState<BlockDef>(initial);
  useEffect(() => { if (open) setBlock(initial); }, [open, initial]);

  function patch(p: Partial<BlockDef>) { setBlock((b) => ({ ...b, ...p })); }

  // Preview ao vivo: debounce das mudanças + filtros globais no valor padrão.
  const previewFilters = useMemo(() => {
    const f: Record<string, string> = {};
    for (const g of globalFilters) if (g.default) f[g.id] = g.default;
    return f;
  }, [globalFilters]);

  const [preview, setPreview] = useState<{ block: RunBlock | null; error?: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const reqId = useRef(0);
  const blockKey = JSON.stringify(block);

  useEffect(() => {
    if (!open || !hasSource) return;
    const id = ++reqId.current;
    setLoading(true);
    const t = setTimeout(() => {
      previewBlock(reportKey, block, previewFilters)
        .then((r) => { if (id === reqId.current) setPreview(r); })
        .catch(() => { if (id === reqId.current) setPreview({ block: null, error: 'Não foi possível montar o preview.' }); })
        .finally(() => { if (id === reqId.current) setLoading(false); });
    }, 450);
    return () => clearTimeout(t);
    // blockKey cobre todas as mudanças de config do bloco.
  }, [open, hasSource, reportKey, blockKey, previewFilters]); // eslint-disable-line react-hooks/exhaustive-deps

  const w = block.w ?? 6;
  const h = block.h ?? 1;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={isEdit ? 'Editar componente' : 'Adicionar componente'}
      width="2xl"
      bodyClassName="min-h-0 flex-1 overflow-hidden"
      footer={
        <>
          <button type="button" onClick={onClose}
            className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100">Cancelar</button>
          <button type="button" onClick={() => onSave(block)}
            className="rounded-md bg-slate-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-slate-700">Salvar</button>
        </>
      }
    >
      <div className="grid h-[70vh] grid-cols-1 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        {/* ── ESQUERDA: configuração ─────────────────────────────────── */}
        <div className="flex flex-col gap-4 overflow-y-auto border-b border-slate-200 p-4 lg:border-b-0 lg:border-r">
          {/* Tipos de componente (tiles) */}
          <div className="grid grid-cols-3 gap-2">
            {BLOCK_TYPES.map((t) => {
              const Icon = t.icon;
              const active = block.type === t.value;
              return (
                <button key={t.value} type="button" onClick={() => patch({ type: t.value })}
                  aria-pressed={active}
                  className={`flex flex-col items-center gap-1.5 rounded-lg border px-2 py-3 text-xs font-medium ${
                    active ? 'border-sky-500 bg-sky-50 text-sky-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}>
                  <Icon size={20} strokeWidth={1.75} />
                  <span className="text-center leading-tight">{t.label}</span>
                </button>
              );
            })}
          </div>

          <Field label="Título do componente">
            <TextInput value={block.title ?? ''} onChange={(e) => patch({ title: e.target.value })} placeholder={blockTypeLabel(block.type)} />
          </Field>

          {/* Config específica por tipo */}
          {block.type === 'table' ? (
            <div className="flex flex-col gap-3">
              <TableColumnsEditor block={block} onChange={(columns) => patch({ columns })} columnOptions={columnOptions} />
              <MultiSortEditor block={block} onChange={(sorts) => patch({ sorts, sort: undefined })} columnOptions={columnOptions} allowValue={false} />
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {block.type !== 'kpi' && (
                <Field label="Agrupar por">
                  <Select value={block.groupBy ?? ''} onChange={(e) => patch({ groupBy: e.target.value })}
                    options={[{ value: '', label: '—' }, ...columnOptions]} />
                </Field>
              )}
              {block.type === 'stackedBars' && (
                <Field label="Empilhar por (série)">
                  <Select value={block.stackBy ?? ''} onChange={(e) => patch({ stackBy: e.target.value })}
                    options={[{ value: '', label: '—' }, ...columnOptions]} />
                </Field>
              )}
              <div className="grid grid-cols-2 gap-3">
                <Field label="Agregação">
                  <Select value={block.agg ?? 'count'} onChange={(e) => patch({ agg: e.target.value })} options={AGG_OPTIONS} />
                </Field>
                <Field label="Campo de valor">
                  <Select value={block.valueField ?? ''} onChange={(e) => patch({ valueField: e.target.value })}
                    options={[{ value: '', label: '—' }, ...columnOptions]} />
                </Field>
                <Field label="Formatação">
                  <Select value={block.format ?? ''} onChange={(e) => patch({ format: e.target.value || undefined })} options={FORMAT_OPTIONS} />
                </Field>
                <Field label={block.type === 'heatmap' ? 'Nº de cards (top-N)' : 'Limite'}
                  hint={block.type === 'heatmap' ? 'Padrão 5.' : undefined}>
                  <TextInput type="number" value={block.limit ?? ''} placeholder={block.type === 'heatmap' ? '5' : 'Todos'}
                    onChange={(e) => patch({ limit: e.target.value ? Number(e.target.value) : undefined })} />
                </Field>
              </div>

              {block.type === 'kpi' && (
                <div className="grid grid-cols-3 gap-3">
                  <Field label="Ícone">
                    <Select value={block.icon ?? ''} onChange={(e) => patch({ icon: e.target.value || undefined })} options={KPI_ICON_OPTIONS} />
                  </Field>
                  <Field label="Cor">
                    <input type="color" aria-label="Cor do KPI" value={block.color ?? '#0ea5e9'}
                      onChange={(e) => patch({ color: e.target.value })}
                      className="h-9 w-full cursor-pointer rounded-md border border-slate-300" />
                  </Field>
                  <Field label="Evolução por (data)" hint="Sparkline por mês.">
                    <Select value={block.trendField ?? ''} onChange={(e) => patch({ trendField: e.target.value || undefined })}
                      options={[{ value: '', label: '—' }, ...columnOptions]} />
                  </Field>
                </div>
              )}

              <MultiSortEditor block={block} onChange={(sorts) => patch({ sorts, sort: undefined })} columnOptions={columnOptions} allowValue />
              <Field label="Fórmula avançada (opcional)" hint="Expressão por linha, ex.: [valor] * 1.1 — validada, sem SQL.">
                <TextInput value={block.formula ?? ''} onChange={(e) => patch({ formula: e.target.value || undefined })} placeholder="[campo_a] + [campo_b]" />
              </Field>
            </div>
          )}

          <BlockFiltersEditor block={block} onChange={(filters) => patch({ filters })} columnOptions={columnOptions} />

          {/* Tamanho no grid (12 colunas) */}
          <div className="border-t border-slate-100 pt-3">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Tamanho no grid</span>
            <div className="mt-2 grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
                Largura: {w} de 12 colunas
                <input type="range" min={1} max={12} value={w} aria-label="Largura em colunas"
                  onChange={(e) => patch({ w: Number(e.target.value) })} />
              </label>
              <Field label="Altura (linhas)">
                <TextInput type="number" min={1} max={6} value={h} aria-label="Altura em linhas"
                  onChange={(e) => patch({ h: Math.max(1, Number(e.target.value) || 1) })} />
              </Field>
            </div>
          </div>
        </div>

        {/* ── DIREITA: preview ao vivo ────────────────────────────────── */}
        <div className="min-w-0 overflow-y-auto bg-slate-50 p-6">
          {!hasSource ? (
            <PreviewEmpty text="Selecione a fonte de dados e salve o rascunho para ver o preview do componente." />
          ) : loading && !preview ? (
            <p className="text-center text-sm text-slate-400">Montando preview…</p>
          ) : preview?.block ? (
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <PreviewBlockView block={preview.block} />
            </div>
          ) : (
            <PreviewEmpty text={preview?.error ?? 'Sem dados para exibir. Verifique a configuração do componente.'} />
          )}
        </div>
      </div>
    </Dialog>
  );
}

function PreviewEmpty({ text }: { text: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
      <BarChart3 size={44} strokeWidth={1.5} className="text-slate-300" aria-hidden />
      <p className="max-w-xs text-sm leading-relaxed text-slate-500">{text}</p>
    </div>
  );
}

/** Ordenação por VÁRIAS colunas (F7.7): cada nível = campo + direção; a 1ª é a
 *  primária. Migra o `sort` legado (1 nível) para a lista na 1ª edição. */
function MultiSortEditor({ block, onChange, columnOptions, allowValue }: {
  block: BlockDef; onChange: (s: SortDef[]) => void; columnOptions: ColumnOption[]; allowValue: boolean;
}) {
  const sorts: SortDef[] = block.sorts && block.sorts.length ? block.sorts : block.sort ? [block.sort] : [];
  const opts = [
    ...(allowValue ? [{ value: '_value', label: 'Valor agregado' }] : []),
    ...columnOptions,
  ];
  const set = (next: SortDef[]) => onChange(next);
  return (
    <div className="border-t border-slate-100 pt-3">
      <div className="mb-1 flex items-center gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Ordenação</span>
        <button type="button" aria-label="Adicionar ordenação"
          onClick={() => set([...sorts, { field: opts[0]?.value ?? '', desc: true }])}
          className="inline-flex items-center gap-1 rounded border border-slate-300 px-1.5 py-0.5 text-[11px] font-medium text-slate-600 hover:bg-slate-50">
          <Plus size={10} /> coluna
        </button>
      </div>
      {sorts.length === 0 && <p className="text-xs text-slate-400">Sem ordenação.</p>}
      <div className="flex flex-col gap-1.5">
        {sorts.map((s, i) => (
          <div key={i} className="flex items-center gap-1.5">
            {i > 0 && <span className="text-[10px] uppercase text-slate-400">depois</span>}
            <Select value={s.field} aria-label={`Ordenar por ${i + 1}`} options={opts} className="min-w-0 flex-1"
              onChange={(e) => set(sorts.map((x, j) => (j === i ? { ...x, field: e.target.value } : x)))} />
            <button type="button" onClick={() => set(sorts.map((x, j) => (j === i ? { ...x, desc: !x.desc } : x)))}
              className="rounded-md border border-slate-300 px-2 py-1.5 text-xs text-slate-600 hover:bg-slate-50" title="Inverter direção">
              {s.desc ? '↓ desc' : '↑ asc'}
            </button>
            <button type="button" aria-label="Remover ordenação" onClick={() => set(sorts.filter((_, j) => j !== i))}
              className="rounded p-1 text-rose-500 hover:bg-rose-50"><Trash2 size={13} /></button>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Filtros PRÓPRIOS do bloco (além dos globais): campo + operador + valor. */
function BlockFiltersEditor({ block, onChange, columnOptions }: {
  block: BlockDef; onChange: (f: BlockFilterDef[]) => void; columnOptions: ColumnOption[];
}) {
  const filters = block.filters ?? [];
  return (
    <div className="border-t border-slate-100 pt-3">
      <div className="mb-1 flex items-center gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Filtros do componente</span>
        <button type="button"
          onClick={() => onChange([...filters, { field: columnOptions[0]?.value ?? '', op: 'eq', value: '' }])}
          className="inline-flex items-center gap-1 rounded border border-slate-300 px-1.5 py-0.5 text-[11px] font-medium text-slate-600 hover:bg-slate-50">
          <Plus size={10} /> filtro
        </button>
      </div>
      {filters.length === 0 && <p className="text-xs text-slate-400">Sem filtros próprios — usa só os filtros globais.</p>}
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
  block: BlockDef; onChange: (c: TableColumnDef[]) => void; columnOptions: ColumnOption[];
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
