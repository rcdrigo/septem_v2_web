import { useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Menu, UserCog } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { Toaster } from '@/components/ui/Toaster';
import { ConfirmDialogHost } from '@/components/ui/ConfirmDialog';
import { LoadingSplash } from '@/pages/LoadingSplash';
import { useSessionStore } from '@/stores/session';
import { useDocumentTitle } from '@/lib/use-document-title';
import { MENU } from './menu/menu-config';

/** Busca recursiva do rótulo do menu que casa com o pathname (p/ título da aba). */
function findMenuLabel(node: unknown, path: string): string | null {
  if (Array.isArray(node)) {
    for (const it of node) { const f = findMenuLabel(it, path); if (f) return f; }
    return null;
  }
  if (!node || typeof node !== 'object') return null;
  const n = node as Record<string, unknown>;
  if (n.to === path && typeof n.label === 'string') return n.label;
  for (const [k, v] of Object.entries(n)) { if (k === 'icon') continue; const f = findMenuLabel(v, path); if (f) return f; }
  return null;
}

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

  // Título da aba conforme a seção do menu.
  useDocumentTitle(findMenuLabel(MENU, location.pathname));

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
        <ImpersonationBanner />
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

/** Faixa fixa indicando sessão personificada, com botão para sair. */
function ImpersonationBanner() {
  const isImpersonating = useSessionStore((s) => s.isImpersonating);
  const user = useSessionStore((s) => s.user);
  const stop = useSessionStore((s) => s.stopImpersonation);
  const [leaving, setLeaving] = useState(false);
  if (!isImpersonating) return null;
  // Só no mobile (sem sidenav visível). No desktop o aviso fica no rodapé do sidenav.
  return (
    <div className="flex items-center justify-between gap-2 bg-amber-500 px-4 py-1.5 text-sm text-white lg:hidden">
      <span className="inline-flex items-center gap-2">
        <UserCog size={15} />
        Você está personificando <b>{user?.name}</b>{user?.impersonatedBy ? <> (como {user.impersonatedBy})</> : null}
      </span>
      <button type="button" disabled={leaving}
        onClick={async () => { setLeaving(true); try { await stop(); } finally { setLeaving(false); } }}
        className="rounded-md bg-white/20 px-2.5 py-0.5 text-xs font-medium hover:bg-white/30 disabled:opacity-60">
        Sair da personificação
      </button>
    </div>
  );
}
