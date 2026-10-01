import { useEffect } from 'react';
import { Navigate, NavLink, Outlet, useLocation } from 'react-router-dom';
import { BookOpen, Building2, Inbox, LifeBuoy, LogOut, ShieldCheck } from 'lucide-react';
import { usePlatformSession } from '@/stores/platform-session';
import { routes } from '@/lib/routes';
import { SinoDeNotificacoes } from '@/components/notifications/SinoDeNotificacoes';
import { Toaster } from '@/components/ui/Toaster';
import { ConfirmDialogHost } from '@/components/ui/ConfirmDialog';

/**
 * Casca da área central. Deliberadamente **não** reaproveita o `AppShell`: aquele
 * roda o bootstrap do tenant (`/api/tenant/config`) e monta o menu a partir das
 * permissões do ambiente. A área central não tem tenant — é isso que permite a ela
 * operar com um ambiente inativado, que é o que a spec exige.
 *
 * A guarda é dupla: sessão central (não a do ambiente) **e** o papel `super_admin`.
 * O servidor decide de novo em toda rota; isto aqui só evita mostrar uma tela que
 * viria vazia.
 */
export function PlatformLayout() {
  const status = usePlatformSession((s) => s.status);
  const identity = usePlatformSession((s) => s.identity);
  const bootstrap = usePlatformSession((s) => s.bootstrap);
  const logout = usePlatformSession((s) => s.logout);
  const location = useLocation();

  useEffect(() => {
    if (status === 'idle') void bootstrap();
  }, [status, bootstrap]);

  if (status === 'idle' || status === 'booting')
    return (
      <div className="grid min-h-screen place-items-center bg-slate-100 text-sm text-slate-500" data-testid="platform-carregando">
        Carregando a área central…
      </div>
    );

  if (status === 'unauthenticated')
    return <Navigate to={`${routes.platformLogin}?returnUrl=${encodeURIComponent(location.pathname)}`} replace />;

  // A área central não é só do super admin desde a Fase 3: quem faz triagem entra, mas apenas
  // nas telas de suporte. Por isso a guarda é POR ROTA — um único "é super admin?" deixaria a
  // triagem de fora do próprio trabalho ou daria a ela o cadastro de clientes.
  const papeis = identity?.roles ?? [];
  const ehSuperAdmin = papeis.includes('super_admin');
  const ehSuporte = papeis.includes('support_triage') || papeis.includes('support_agent');
  const rotaDeSuporte = location.pathname.startsWith('/platform/support');
  const podeEntrar = ehSuperAdmin || (ehSuporte && rotaDeSuporte);

  // Triagem que cai na raiz da área central vai para o próprio lugar, não para uma recusa.
  if (!ehSuperAdmin && ehSuporte && location.pathname === '/platform')
    return <Navigate to={papeis.includes('support_triage') ? routes.platformSupportTriage : routes.platformSupportQueue} replace />;

  if (!podeEntrar)
    return (
      <div className="grid min-h-screen place-items-center bg-slate-100 px-4">
        <div className="max-w-md rounded-lg border border-slate-200 bg-white p-6 text-center shadow-sm" data-testid="platform-sem-permissao">
          <ShieldCheck className="mx-auto mb-3 h-8 w-8 text-slate-400" />
          <h1 className="text-base font-semibold text-slate-900">Sem acesso à área central</h1>
          <p className="mt-1 text-sm text-slate-600">
            Esta conta não tem papel para esta parte da área central. Fale com quem administra a
            plataforma.
          </p>
          <button
            type="button"
            onClick={() => void logout()}
            className="mt-4 rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
          >
            Sair
          </button>
        </div>
      </div>
    );

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="border-b border-slate-800 bg-slate-900 text-slate-100">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-6">
          <span className="flex items-center gap-2 font-semibold">
            <ShieldCheck className="h-5 w-5 text-emerald-400" />
            Septem · área central
          </span>
          {/* flex-wrap: com os itens de suporte a navegação cresce, e no 375 ela precisa quebrar
              linha em vez de empurrar a página para o lado. */}
          <nav className="flex flex-wrap items-center gap-1 text-sm">
            {/* Catálogo e Clientes são do super admin. Quem só faz triagem não vê links que só
                levariam a uma recusa. */}
            {ehSuperAdmin && (<>
            <NavLink
              to={routes.platformCatalog}
              data-testid="platform-nav-catalogo"
              className={({ isActive }) =>
                `rounded-md px-2.5 py-1.5 ${isActive ? 'bg-slate-800 text-white' : 'text-slate-300 hover:bg-slate-800'}`
              }
            >
              <span className="flex items-center gap-1.5">
                <BookOpen className="h-4 w-4" /> Catálogo
              </span>
            </NavLink>
            <NavLink
              to={routes.platformClients}
              className={({ isActive }) =>
                `rounded-md px-2.5 py-1.5 ${isActive ? 'bg-slate-800 text-white' : 'text-slate-300 hover:bg-slate-800'}`
              }
            >
              <span className="flex items-center gap-1.5">
                <Building2 className="h-4 w-4" /> Clientes
              </span>
            </NavLink>
            </>)}
            {(ehSuperAdmin || papeis.includes('support_triage')) && (
              <NavLink
                to={routes.platformSupportTriage}
                data-testid="platform-nav-triagem"
                className={({ isActive }) =>
                  `rounded-md px-2.5 py-1.5 ${isActive ? 'bg-slate-800 text-white' : 'text-slate-300 hover:bg-slate-800'}`
                }
              >
                <span className="flex items-center gap-1.5">
                  <LifeBuoy className="h-4 w-4" /> Triagem
                </span>
              </NavLink>
            )}
            {(ehSuperAdmin || ehSuporte) && (
              <NavLink
                to={routes.platformSupportQueue}
                data-testid="platform-nav-fila"
                className={({ isActive }) =>
                  `rounded-md px-2.5 py-1.5 ${isActive ? 'bg-slate-800 text-white' : 'text-slate-300 hover:bg-slate-800'}`
                }
              >
                <span className="flex items-center gap-1.5">
                  <Inbox className="h-4 w-4" /> Fila
                </span>
              </NavLink>
            )}
            <NavLink
              to={routes.platformSupportTeams}
              data-testid="platform-nav-suporte"
              className={({ isActive }) =>
                `rounded-md px-2.5 py-1.5 ${isActive ? 'bg-slate-800 text-white' : 'text-slate-300 hover:bg-slate-800'}`
              }
            >
              <span className="flex items-center gap-1.5">
                <LifeBuoy className="h-4 w-4" /> Equipes
              </span>
            </NavLink>
          </nav>
          <div className="ml-auto flex items-center gap-3 text-sm">
            <SinoDeNotificacoes lado="septem" tom="escuro" />
            <span className="hidden text-slate-300 sm:inline" data-testid="platform-identidade">
              {identity?.name}
            </span>
            <button
              type="button"
              onClick={() => void logout()}
              data-testid="platform-sair"
              className="flex items-center gap-1.5 rounded-md border border-slate-700 px-2.5 py-1.5 text-slate-200 hover:bg-slate-800"
            >
              <LogOut className="h-4 w-4" /> Sair
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <Outlet />
      </main>
      {/* Avisos e confirmações da área central. Sem eles, todo toast (sucesso, erro, 409) sumia
          em silêncio e todo `confirm()` ficava pendurado — a auditoria de 30/09 achou. */}
      <Toaster />
      <ConfirmDialogHost />
    </div>
  );
}
