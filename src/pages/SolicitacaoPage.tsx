import { useEffect } from 'react';
import { Navigate, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { useInstance } from '@/lib/api/execution';
import { useDocumentTitle } from '@/lib/use-document-title';
import { useSessionStore } from '@/stores/session';
import { InstanceReport } from './InstanciasPage';
import { routes } from '@/lib/routes';
import { Toaster } from '@/components/ui/Toaster';
import { ConfirmDialogHost } from '@/components/ui/ConfirmDialog';

/**
 * Relatório/acompanhamento de uma instância em tela cheia (rota
 * /requests/:instanceId, fora do AppShell — sem menus). Aberto em nova aba
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
  useDocumentTitle(d?.process ?? 'Requisição');
  if (!instanceId) return null;
  if (status === 'unauthenticated') {
    const returnUrl = `${location.pathname}${location.search}`;
    return <Navigate to={`${routes.login}?returnUrl=${encodeURIComponent(returnUrl)}`} replace />;
  }
  return (
    <div className="flex h-dvh flex-col bg-slate-100">
      <main className="min-h-0 flex-1 overflow-auto">
        <InstanceReport id={instanceId} messageAccess={messageAccess} />
      </main>
      <Toaster />
      <ConfirmDialogHost />
    </div>
  );
}
