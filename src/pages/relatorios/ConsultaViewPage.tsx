import { useMemo } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useReport, type GlobalFilterDef } from '@/lib/api/reports';
import { ReportRunViewer } from '@/components/reports/ReportViewer';
import { useDocumentTitle } from '@/lib/use-document-title';
import { useSessionStore } from '@/stores/session';

/**
 * Consulta (relatório publicado) em ABA PRÓPRIA — link direto /consultas/ver?key=,
 * aberta a partir do catálogo de Consultas (F7.1). Antes o viewer era embutido na
 * página do catálogo; agora é uma aba dedicada (compartilhável, imprimível).
 */
export function ConsultaViewPage() {
  const user = useSessionStore((s) => s.user);
  const [params] = useSearchParams();
  const key = params.get('key');
  const detail = useReport(key);
  useDocumentTitle(detail.data?.name ?? 'Consulta');

  const filtersDef = useMemo<GlobalFilterDef[]>(() => {
    try { return (JSON.parse(detail.data?.definitionJson || '{}') as { filters?: GlobalFilterDef[] }).filters ?? []; }
    catch { return []; }
  }, [detail.data?.definitionJson]);

  if (!user) return <Navigate to="/login" replace />;
  if (!key) return <Navigate to="/consultas" replace />;

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center gap-3 border-b border-slate-200 bg-white px-6 py-4 print:border-0">
        <button type="button" onClick={() => window.close()}
          className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 print:hidden" title="Fechar">
          <ArrowLeft size={18} />
        </button>
        <h1 className="flex-1 truncate text-lg font-semibold text-slate-900">{detail.data?.name ?? '…'}</h1>
      </header>

      <main className="flex-1 overflow-auto p-6">
        {detail.isLoading ? (
          <p className="text-sm text-slate-400">Carregando…</p>
        ) : (
          <ReportRunViewer reportKey={key} filtersDef={filtersDef} />
        )}
      </main>
    </div>
  );
}
