import { useEffect, useRef, useState } from 'react';
import { Download, Info, Printer, RefreshCw } from 'lucide-react';
import {
  Chart,
  ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend, PieController, BarController,
} from 'chart.js';
import { Dialog } from '@/components/ui/Dialog';
import { toast } from '@/stores/toast';
import { ApiError } from '@/lib/api';
import {
  useReportRun, refreshReport, fetchDrilldown, exportReport,
  type GlobalFilterDef, type ReportRunResult, type RunBlock, type RunBlockTable,
  type RunBlockGrouped, type RunBlockStacked, type DrilldownResult,
} from '@/lib/api/reports';

Chart.register(ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend, PieController, BarController);

const PALETTE = ['#0ea5e9', '#22c55e', '#f59e0b', '#a855f7', '#ec4899', '#14b8a6', '#f43f5e', '#6366f1', '#84cc16', '#f97316'];

function fmt(value: number | string | null, format?: string | null, colType?: string): string {
  if (value == null) return '—';
  if (format === 'currency') {
    const n = typeof value === 'number' ? value : Number(String(value).replace(',', '.'));
    return Number.isFinite(n) ? n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : String(value);
  }
  if (format === 'number' || (typeof value === 'number' && format !== 'text')) {
    const n = typeof value === 'number' ? value : Number(String(value).replace(',', '.'));
    return Number.isFinite(n) ? n.toLocaleString('pt-BR') : String(value);
  }
  if (format === 'date' || colType === 'date') {
    const d = new Date(String(value));
    return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleDateString('pt-BR');
  }
  return String(value);
}

/**
 * Viewer do relatório (execução publicada e preview do builder): filtros
 * globais, timestamp do cache + "obter dados mais recentes", blocos
 * (tabela/KPI/pizza/barras/compostas via Chart.js), detalhe de linha quando há
 * coluna oculta, drill-down ao clicar em fatia/barra, exportação CSV/XLSX e
 * impressão (PDF via navegador). Responsivo web+mobile.
 */
export function ReportRunViewer({ reportKey, filtersDef, preview }: { reportKey: string; filtersDef: GlobalFilterDef[]; preview?: boolean }) {
  const [values, setValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const f of filtersDef) if (f.default) init[f.id] = f.default;
    return init;
  });
  const [applied, setApplied] = useState(values);
  const run = useReportRun(reportKey, applied, { preview });
  const [data, setData] = useState<ReportRunResult | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [drill, setDrill] = useState<{ title: string; data: DrilldownResult; blockId: string; group: string; stack?: string } | null>(null);
  const [detailRow, setDetailRow] = useState<{ block: RunBlockTable; row: (string | null)[] } | null>(null);

  useEffect(() => { if (run.data) setData(run.data); }, [run.data]);

  async function forceRefresh() {
    setRefreshing(true);
    try { setData(await refreshReport(reportKey, applied, preview)); }
    catch (err) { toast.error(err instanceof ApiError ? (err.detail ?? err.message) : 'Falha ao atualizar.'); }
    finally { setRefreshing(false); }
  }

  async function openDrill(block: RunBlockGrouped | RunBlockStacked, group: string, stack?: string) {
    try {
      const result = await fetchDrilldown(reportKey, block.id, { filters: applied, group, stack });
      setDrill({ title: `${block.title ?? 'Segmento'} — ${group}${stack ? ` / ${stack}` : ''}`, data: result, blockId: block.id, group, stack });
    } catch (err) {
      toast.error(err instanceof ApiError ? (err.detail ?? err.message) : 'Falha no drill-down.');
    }
  }

  const missingRequired = filtersDef.some((f) => f.required && !(values[f.id] ?? f.default));
  const runError = run.error instanceof ApiError ? (run.error.detail ?? run.error.message) : run.isError ? 'Falha ao executar o relatório.' : null;

  return (
    <div className="flex flex-col gap-4 print:gap-2">
      {/* Filtros globais */}
      {filtersDef.length > 0 && (
        <div className="flex flex-wrap items-end gap-3 rounded-md border border-slate-200 bg-white p-3 print:hidden">
          {filtersDef.map((f) => (
            <label key={f.id} className="flex min-w-36 flex-col gap-1 text-xs font-medium text-slate-600">
              {(f.label ?? f.id) + (f.required ? ' *' : '')}
              {f.type === 'select' ? (
                <select
                  value={values[f.id] ?? ''}
                  onChange={(e) => setValues({ ...values, [f.id]: e.target.value })}
                  className="rounded-md border border-slate-300 px-2 py-1.5 text-sm font-normal"
                >
                  <option value="">—</option>
                  {(f.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : f.type === 'date' ? (
                <DateRangeInput value={values[f.id] ?? ''} onChange={(v) => setValues({ ...values, [f.id]: v })} />
              ) : (
                <input
                  type={f.type === 'number' ? 'number' : 'text'}
                  value={values[f.id] ?? ''}
                  onChange={(e) => setValues({ ...values, [f.id]: e.target.value })}
                  className="rounded-md border border-slate-300 px-2 py-1.5 text-sm font-normal"
                />
              )}
            </label>
          ))}
          <button
            type="button"
            disabled={missingRequired}
            onClick={() => setApplied({ ...values })}
            className="rounded-md bg-slate-900 px-3.5 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
          >
            Aplicar filtros
          </button>
        </div>
      )}

      {/* Cache + ações */}
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        {data && (
          <span className="text-xs text-slate-500">
            Dados de {new Date(data.generatedAt).toLocaleString('pt-BR')}
            {data.fromCache ? ' (cache)' : ''} · {data.totalRows} registro{data.totalRows === 1 ? '' : 's'}
          </span>
        )}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <button type="button" onClick={forceRefresh} disabled={refreshing}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50">
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : undefined} /> Obter dados mais recentes
          </button>
          <button type="button" onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50">
            <Printer size={14} /> Imprimir / PDF
          </button>
        </div>
      </div>

      {runError && <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{runError}</p>}
      {run.isLoading && !data && <p className="text-sm text-slate-400">Executando relatório…</p>}

      {/* Blocos */}
      {data && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 print:grid-cols-1">
          {data.blocks.map((b) => (
            <BlockView key={b.id} block={b} reportKey={reportKey} filters={applied}
              onDrill={openDrill} onDetail={(block, row) => setDetailRow({ block, row })} />
          ))}
        </div>
      )}

      {/* Drill-down do segmento clicado — com exportação do próprio recorte */}
      {drill && (
        <Dialog open onClose={() => setDrill(null)} title={drill.title} width="xl">
          <div className="mb-2 flex justify-end gap-1">
            <ExportButton reportKey={reportKey} blockId={drill.blockId} filters={applied} format="csv" group={drill.group} stack={drill.stack} />
            <ExportButton reportKey={reportKey} blockId={drill.blockId} filters={applied} format="xlsx" group={drill.group} stack={drill.stack} />
          </div>
          <DetailTable columns={drill.data.columns.map((c) => ({ key: c.key, label: c.label, colType: c.type }))} rows={drill.data.rows} />
        </Dialog>
      )}

      {/* Detalhe da linha (colunas ocultas) — modal responsivo, sem rolagem lateral */}
      {detailRow && (
        <Dialog open onClose={() => setDetailRow(null)} title={detailRow.block.title ?? 'Detalhe do registro'} width="md">
          <dl className="flex flex-col gap-2">
            {detailRow.block.columns.map((c, i) => (
              <div key={c.key} className="flex flex-col gap-0.5 border-b border-slate-100 pb-2">
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{c.label}</dt>
                <dd className="break-words text-sm text-slate-800">{fmt(detailRow.row[i], c.format, c.colType)}</dd>
              </div>
            ))}
          </dl>
        </Dialog>
      )}
    </div>
  );
}

/** Intervalo de datas: "início..fim" (qualquer lado opcional). */
function DateRangeInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [from = '', to = ''] = value.split('..');
  return (
    <span className="flex items-center gap-1">
      <input type="date" value={from} onChange={(e) => onChange(`${e.target.value}..${to}`)}
        className="rounded-md border border-slate-300 px-2 py-1.5 text-sm font-normal" />
      <span className="text-slate-400">–</span>
      <input type="date" value={to} onChange={(e) => onChange(`${from}..${e.target.value}`)}
        className="rounded-md border border-slate-300 px-2 py-1.5 text-sm font-normal" />
    </span>
  );
}

function BlockView({ block, reportKey, filters, onDrill, onDetail }: {
  block: RunBlock;
  reportKey: string;
  filters: Record<string, string>;
  onDrill: (b: RunBlockGrouped | RunBlockStacked, group: string, stack?: string) => void;
  onDetail: (b: RunBlockTable, row: (string | null)[]) => void;
}) {
  const isTable = block.type === 'table';
  return (
    <section className={`flex flex-col rounded-md border border-slate-200 bg-white p-4 ${isTable ? 'lg:col-span-2' : ''}`}>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold text-slate-800">{block.title ?? (isTable ? 'Tabela' : '')}</h3>
        {isTable && (
          <div className="ml-auto flex gap-1 print:hidden">
            <ExportButton reportKey={reportKey} blockId={block.id} filters={filters} format="csv" />
            <ExportButton reportKey={reportKey} blockId={block.id} filters={filters} format="xlsx" />
          </div>
        )}
      </div>

      {block.type === 'kpi' && (
        <p className="py-4 text-center text-4xl font-semibold text-slate-900">{fmt(block.value, block.format)}</p>
      )}
      {(block.type === 'pie' || block.type === 'bars') && (
        <GroupedChart block={block} onDrill={(g) => onDrill(block, g)} />
      )}
      {block.type === 'stackedBars' && (
        <StackedChart block={block} onDrill={(g, s) => onDrill(block, g, s)} />
      )}
      {block.type === 'table' && <TableBlock block={block} onDetail={(row) => onDetail(block, row)} />}
    </section>
  );
}

function ExportButton({ reportKey, blockId, filters, format, group, stack }: { reportKey: string; blockId: string; filters: Record<string, string>; format: 'csv' | 'xlsx'; group?: string; stack?: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try { await exportReport(reportKey, { blockId, format, filters, group, stack }); }
        catch { toast.error(`Falha ao exportar ${format.toUpperCase()}.`); }
        finally { setBusy(false); }
      }}
      className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
    >
      <Download size={12} /> {format.toUpperCase()}
    </button>
  );
}

const TABLE_PAGE_SIZE = 20;

function TableBlock({ block, onDetail }: { block: RunBlockTable; onDetail: (row: (string | null)[]) => void }) {
  const visible = block.columns.map((c, i) => ({ ...c, index: i })).filter((c) => c.visible);
  const [page, setPage] = useState(1);
  if (block.rows.length === 0) return <p className="text-sm text-slate-400">Sem resultados.</p>;

  // Paginação client-side (impressão mostra tudo — CSS print ignora o recorte).
  const totalPages = Math.max(1, Math.ceil(block.rows.length / TABLE_PAGE_SIZE));
  const current = Math.min(page, totalPages);
  const pageRows = block.rows.slice((current - 1) * TABLE_PAGE_SIZE, current * TABLE_PAGE_SIZE);

  const renderRow = (row: (string | null)[], i: number) => (
    <tr key={i} className="border-t border-slate-100">
      {visible.map((c) => <td key={c.key} className="px-3 py-2 text-slate-700">{fmt(row[c.index], c.format, c.colType)}</td>)}
      {block.hasHiddenColumns && (
        <td className="px-2 py-1.5 text-right print:hidden">
          <button type="button" onClick={() => onDetail(row)} aria-label="Detalhes do registro"
            className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
            <Info size={14} />
          </button>
        </td>
      )}
    </tr>
  );

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            {visible.map((c) => <th key={c.key} className="px-3 py-2 text-left">{c.label}</th>)}
            {block.hasHiddenColumns && <th className="w-10 print:hidden" aria-label="Detalhe" />}
          </tr>
        </thead>
        <tbody className="print:hidden">{pageRows.map(renderRow)}</tbody>
        {/* impressão: todas as linhas */}
        <tbody className="hidden print:table-row-group">{block.rows.map(renderRow)}</tbody>
      </table>
      <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 px-3 py-2 text-xs text-slate-400">
        <span>{block.total} linha{block.total === 1 ? '' : 's'}</span>
        {totalPages > 1 && (
          <span className="ml-auto flex items-center gap-2 print:hidden">
            <button type="button" disabled={current <= 1} onClick={() => setPage(current - 1)}
              className="rounded border border-slate-200 px-2 py-0.5 disabled:opacity-40">‹</button>
            {current} / {totalPages}
            <button type="button" disabled={current >= totalPages} onClick={() => setPage(current + 1)}
              className="rounded border border-slate-200 px-2 py-0.5 disabled:opacity-40">›</button>
          </span>
        )}
      </div>
    </div>
  );
}

function useChart(build: (ctx: HTMLCanvasElement) => Chart) {
  const ref = useRef<HTMLCanvasElement>(null);
  const buildRef = useRef(build);
  buildRef.current = build;
  useEffect(() => {
    if (!ref.current) return;
    const chart = buildRef.current(ref.current);
    return () => chart.destroy();
  });
  return ref;
}

function GroupedChart({ block, onDrill }: { block: RunBlockGrouped; onDrill: (group: string) => void }) {
  const ref = useChart((canvas) => new Chart(canvas, {
    type: block.type === 'pie' ? 'pie' : 'bar',
    data: {
      labels: block.items.map((i) => i.label),
      datasets: [{
        data: block.items.map((i) => i.value),
        backgroundColor: block.items.map((_, i) => PALETTE[i % PALETTE.length]),
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: block.type === 'pie', position: 'bottom' } },
      onClick: (_, elements) => {
        const idx = elements[0]?.index;
        if (idx != null) onDrill(block.items[idx].label);
      },
    },
  }));
  if (block.items.length === 0) return <p className="text-sm text-slate-400">Sem dados.</p>;
  return <div className="relative h-64"><canvas ref={ref} /></div>;
}

function StackedChart({ block, onDrill }: { block: RunBlockStacked; onDrill: (group: string, stack: string) => void }) {
  const ref = useChart((canvas) => new Chart(canvas, {
    type: 'bar',
    data: {
      labels: block.labels,
      datasets: block.series.map((s, i) => ({ label: s.name, data: s.values, backgroundColor: PALETTE[i % PALETTE.length] })),
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: { x: { stacked: true }, y: { stacked: true } },
      plugins: { legend: { position: 'bottom' } },
      onClick: (_, elements) => {
        const el = elements[0];
        if (el) onDrill(block.labels[el.index], block.series[el.datasetIndex].name);
      },
    },
  }));
  if (block.labels.length === 0) return <p className="text-sm text-slate-400">Sem dados.</p>;
  return <div className="relative h-64"><canvas ref={ref} /></div>;
}

export function DetailTable({ columns, rows }: { columns: { key: string; label: string; colType?: string }[]; rows: (string | null)[][] }) {
  if (rows.length === 0) return <p className="text-sm text-slate-400">Sem registros.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>{columns.map((c) => <th key={c.key} className="px-3 py-2 text-left">{c.label}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-t border-slate-100">
              {row.map((cell, j) => <td key={j} className="px-3 py-2 text-slate-700">{fmt(cell, undefined, columns[j]?.colType)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="border-t border-slate-100 px-3 py-2 text-xs text-slate-400">{rows.length} registro{rows.length === 1 ? '' : 's'}</p>
    </div>
  );
}
