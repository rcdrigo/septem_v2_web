import { useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { Toaster } from '@/components/ui/Toaster';
import { ConfirmDialogHost } from '@/components/ui/ConfirmDialog';
import { LoadingSplash } from '@/pages/LoadingSplash';
import { useSessionStore } from '@/stores/session';

/**
 * Shell autenticado. Dispara o bootstrap (`/tenant/config` + `/me`) na 1ª
 * montagem, mostra splash enquanto carrega e redireciona pra <c>/login</c>
 * se a sessão estiver morta. Responsivo: a sidebar é um drawer no mobile
 * (botão hambúrguer) e fixa no desktop (lg+).
 */
export function AppShell() {
  const status = useSessionStore((s) => s.status);
  const bootstrap = useSessionStore((s) => s.bootstrap);
  const tenant = useSessionStore((s) => s.tenant);
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (status === 'idle') void bootstrap();
  }, [status, bootstrap]);

  // Fecha o drawer ao navegar (mobile).
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  if (status === 'idle' || status === 'booting') return <LoadingSplash />;
  if (status === 'unauthenticated') return <Navigate to="/login" replace state={{ from: location }} />;
  if (status === 'error') return <LoadingSplash message="Não foi possível conectar ao backend." />;

  return (
    <div className="flex h-screen w-screen bg-slate-100 text-slate-800">
      <Sidebar mobileOpen={mobileOpen} />

      {/* Backdrop do drawer (só mobile, quando aberto) */}
      {mobileOpen && (
        <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setMobileOpen(false)} aria-hidden />
      )}

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Barra superior só no mobile, com o hambúrguer */}
        <div className="flex items-center gap-2 border-b border-slate-200 bg-white px-3 py-2 lg:hidden">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="rounded-md p-1.5 text-slate-600 hover:bg-slate-100"
            aria-label="Abrir menu"
          >
            <Menu size={20} />
          </button>
          <span className="truncate text-sm font-semibold text-slate-900">{tenant?.clienteNome ?? 'Septem'}</span>
        </div>

        <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <Outlet />
        </main>
      </div>

      <Toaster />
      <ConfirmDialogHost />
    </div>
  );
}
