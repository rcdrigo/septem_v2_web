import { useState } from 'react';
import { ArrowLeft, FileSearch, RefreshCw } from 'lucide-react';
import { useReportsList, useReportData } from '@/lib/api/reports';

/**
 * Geral › Consultas (item 8): catálogo de relatórios publicados — funciona como
 * a tela de Serviços, mas em vez de iniciar um processo, "abre" o relatório e
 * mostra os dados (execução da fonte associada) em página inteira.
 */
export function ConsultasPage() {
  const list = useReportsList({ status: 'published', pageSize: 100 });
  const [open, setOpen] = useState<{ key: string; name: string } | null>(null);

  if (open) return <ReportViewer reportKey={open.key} name={open.name} onClose={() => setOpen(null)} />;

  const empty = !list.isLoading && (list.data?.items.length ?? 0) === 0;

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-slate-200 bg-white px-6 py-4">
        <h1 className="text-lg font-semibold text-slate-900">Consultas</h1>
      </header>
      <div className="flex-1 overflow-auto p-6">
        {empty ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-400"><FileSearch size={26} /></div>
            <p className="text-sm font-medium text-slate-700">Nenhum relatório disponível</p>
            <p className="mt-1 text-sm text-slate-500">Relatórios publicados aparecem aqui para consulta.</p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {list.data?.items.map((r) => (
              <div key={r.key} className="flex flex-col rounded-md border border-slate-200 bg-white p-4">
                <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-md bg-slate-100 text-slate-500"><FileSearch size={18} /></div>
                <p className="font-medium text-slate-800">{r.name}</p>
                <p className="text-xs text-slate-500">{r.description || 'Relatório'}</p>
                <button type="button" onClick={() => setOpen({ key: r.key, name: r.name })} className="mt-3 inline-flex items-center justify-center gap-1.5 rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700">
                  <FileSearch size={15} /> Abrir
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ReportViewer({ reportKey, name, onClose }: { reportKey: string; name: string; onClose: () => void }) {
  const run = useReportData(reportKey);

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-3 border-b border-slate-200 bg-white px-6 py-4">
        <button type="button" onClick={onClose} className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800" title="Voltar ao catálogo">
          <ArrowLeft size={18} />
        </button>
        <h1 className="flex-1 text-lg font-semibold text-slate-900">{name}</h1>
        <button type="button" onClick={() => run.refetch()} disabled={run.isFetching} className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">
          <RefreshCw size={14} className={run.isFetching ? 'animate-spin' : undefined} /> Atualizar
        </button>
      </header>

      {/* Container ocupa toda a largura */}
      <main className="flex-1 overflow-auto p-6">
        {run.isLoading ? (
          <p className="text-sm text-slate-400">Executando relatório…</p>
        ) : run.isError ? (
          <p className="text-sm text-rose-600">Não foi possível executar o relatório.</p>
        ) : (
          <DataTable columns={run.data!.columns} rows={run.data!.rows} />
        )}
      </main>
    </div>
  );
}

function DataTable({ columns, rows }: { columns: string[]; rows: (string | null)[][] }) {
  if (rows.length === 0) return <p className="text-sm text-slate-400">Sem resultados.</p>;
  return (
    <div className="overflow-auto rounded-md border border-slate-200 bg-white">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>{columns.map((c) => <th key={c} className="px-4 py-2 text-left">{c}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-t border-slate-100">
              {row.map((cell, j) => <td key={j} className="px-4 py-2 text-slate-700">{cell ?? '—'}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="border-t border-slate-100 px-4 py-2 text-xs text-slate-400">{rows.length} linha{rows.length === 1 ? '' : 's'}</div>
    </div>
  );
}
