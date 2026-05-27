import { useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Toaster } from '@/components/ui/Toaster';
import { ConfirmDialogHost } from '@/components/ui/ConfirmDialog';
import { LoadingSplash } from '@/pages/LoadingSplash';
import { useSessionStore } from '@/stores/session';

/**
 * Shell autenticado. Dispara o bootstrap (`/tenant/config` + `/me`) na 1ª
 * montagem, mostra splash enquanto carrega e redireciona pra <c>/login</c>
 * se a sessão estiver morta.
 */
export function AppShell() {
  const status = useSessionStore((s) => s.status);
  const bootstrap = useSessionStore((s) => s.bootstrap);
  const location = useLocation();

  useEffect(() => {
    if (status === 'idle') void bootstrap();
  }, [status, bootstrap]);

  if (status === 'idle' || status === 'booting') return <LoadingSplash />;
  if (status === 'unauthenticated') return <Navigate to="/login" replace state={{ from: location }} />;
  if (status === 'error') return <LoadingSplash message="Não foi possível conectar ao backend." />;

  return (
    <div className="flex h-screen w-screen bg-slate-100 text-slate-800">
      <Sidebar />
      <main className="flex flex-1 flex-col overflow-hidden">
        <Outlet />
      </main>
      <Toaster />
      <ConfirmDialogHost />
    </div>
  );
}
