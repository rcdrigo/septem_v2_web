import { useEffect } from 'react';
import { Navigate, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { useInstance } from '@/lib/api/execution';
import { useDocumentTitle } from '@/lib/use-document-title';
import { useSessionStore } from '@/stores/session';
import { InstanceReport } from './InstanciasPage';

/**
 * Relatório/acompanhamento de uma instância em tela cheia (rota
 * /solicitacao/:instanceId, fora do AppShell — sem menus). Aberto em nova aba
 * a partir das listas e da conclusão de tarefa.
 */
export function SolicitacaoPage() {
  const { instanceId } = useParams<{ instanceId: string }>();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const messageAccess = searchParams.get('messageAccess');
  // Rota fora do AppShell (nova aba): bootstrap próprio p/ carregar user+perms,
  // senão can('workflow:write') fica falso e a barra de ações admin some.
  const status = useSessionStore((s) => s.status);
  const bootstrap = useSessionStore((s) => s.bootstrap);
  useEffect(() => { if (status === 'idle') void bootstrap(); }, [status, bootstrap]);
  const inst = useInstance(instanceId ?? '', messageAccess);
  const d = inst.data;
  useDocumentTitle(d?.process ?? 'Solicitação');
  if (!instanceId) return null;
  if (status === 'unauthenticated') {
    const returnUrl = `${location.pathname}${location.search}`;
    return <Navigate to={`/login?returnUrl=${encodeURIComponent(returnUrl)}`} replace />;
  }
  return (
    <div className="flex h-screen flex-col bg-slate-100">
      <header className="border-b border-slate-200 bg-white px-6 py-4">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold text-slate-900">
            Detalhamento do processo{d?.number != null ? ` nº ${d.number}` : ''}
          </h1>
          {d?.process && <p className="mt-1 break-words text-sm text-slate-500 [overflow-wrap:anywhere]">{d.process}</p>}
          {d?.category && <p className="mt-1 truncate text-xs text-slate-400">Categoria: {d.category}</p>}
        </div>
      </header>
      <main className="flex-1 overflow-auto p-6">
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <InstanceReport id={instanceId} messageAccess={messageAccess} />
        </div>
      </main>
    </div>
  );
}
