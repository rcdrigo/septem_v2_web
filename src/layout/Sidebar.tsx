import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronUp, FileSearch, Plus, Search, Workflow } from 'lucide-react';
import { SidebarUser, ImpersonateDialog } from './SidebarUser';
import { AccessModeToggle } from './AccessModeToggle';
import { MENU } from './menu/menu-config';
import type { MenuAction, MenuGroup, MenuLink, MenuNode } from './menu/types';
import { useSessionStore } from '@/stores/session';
import { useTaskSummary } from '@/lib/api/execution';
import { NewRequestDialog } from '@/components/requests/NewRequestDialog';
import { GlobalSearchDialog } from '@/components/discovery/GlobalSearchDialog';
import { useFavorites, type DiscoveryItem } from '@/lib/api/discovery';
import { openTab } from '@/lib/nav';

export function Sidebar({ mobileOpen = false }: { mobileOpen?: boolean }) {
  const session = useSessionStore();
  const tenant = session.tenant;
  const tenantName = tenant?.clienteNome ?? 'Septem V2';
  const layout = MENU[session.effectiveMode()];
  const [impersonateOpen, setImpersonateOpen] = useState(false);
  const [newRequestOpen, setNewRequestOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    function onShortcut(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setSearchOpen(true);
      }
    }
    window.addEventListener('keydown', onShortcut);
    return () => window.removeEventListener('keydown', onShortcut);
  }, []);

  return (
    <aside
      className={[
        'flex w-64 shrink-0 flex-col border-r border-slate-200 bg-white',
        // Desktop: fixa na grade. Mobile: drawer off-canvas que desliza.
        'fixed inset-y-0 left-0 z-40 shadow-lg transition-transform duration-200',
        'lg:static lg:z-auto lg:shadow-none lg:translate-x-0',
        mobileOpen ? 'translate-x-0' : '-translate-x-full',
      ].join(' ')}
    >
      {/* Logo do cliente */}
      <div className="flex items-center gap-2.5 border-b border-slate-200 px-4 py-3.5">
        {tenant?.logoUrl ? (
          <img src={tenant.logoUrl} alt={tenantName} className="h-8 w-auto" />
        ) : (
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-slate-900 text-sm font-bold text-white">
            {tenantName[0]}
          </div>
        )}
        <span className="truncate text-sm font-semibold tracking-tight text-slate-900">{tenantName}</span>
      </div>

      {/* Usuário + tipo de acesso */}
      <div className="border-b border-slate-200 py-1">
        <SidebarUser />
        <AccessModeToggle />
      </div>

      {/* Navegação principal */}
      <nav className="flex-1 overflow-y-auto px-2 py-3">
        <div className="mb-5 flex flex-col gap-3">
          <button type="button" onClick={() => setSearchOpen(true)} className="flex min-h-8 w-full items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-500 hover:bg-slate-50 hover:text-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-700 active:bg-slate-100">
            <Search size={16} className="shrink-0" />
            <span className="min-w-0 flex-1 truncate text-left">Buscar no Septem</span>
            <kbd className="hidden shrink-0 rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[0.65rem] font-medium text-slate-400 xl:inline">⌘K</kbd>
          </button>
          <button type="button" onClick={() => setNewRequestOpen(true)} className="flex min-h-8 w-full items-center gap-2 whitespace-nowrap rounded-md bg-cyan-700 px-3 text-sm font-semibold text-white hover:bg-cyan-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-700 active:bg-cyan-900">
            <Plus size={16} className="shrink-0" />
            <span className="truncate">Nova requisição</span>
          </button>
        </div>
        <FavoritesGroup />
        {layout.main.map((section, i) => {
          // Item visível = passa na permissão E (link com predicado visible ok |
          // grupo com ao menos um filho permitido). Seção sem itens não renderiza
          // (esconde o título, ex.: "Admin" para quem não tem acesso).
          const items = section.items.filter((node) =>
            session.can(node.perm) &&
            (node.kind === 'link'
              ? (node.visible ? node.visible(session) : true)
              : node.children.some((c) => session.can(c.perm))),
          );
          if (items.length === 0) return null;
          return (
            <div key={section.label ?? i} className={i > 0 ? 'mt-5' : ''}>
              {section.label && (
                <p className="px-3 pb-1.5 text-[0.65rem] font-semibold uppercase tracking-wider text-slate-400">
                  {section.label}
                </p>
              )}
              <ul className="space-y-0.5">
                {items.map((node) => (
                  <NavNode key={nodeKey(node)} node={node} />
                ))}
              </ul>
            </div>
          );
        })}
      </nav>

      {/* Rodapé */}
      <div className="border-t border-slate-200 px-2 py-2">
        <ul className="space-y-0.5">
          {layout.footer
            .filter((item) => session.can(item.perm))
            .filter((item) => !(item.kind === 'action' && item.action === 'impersonate' && session.isImpersonating))
            .map((item) =>
              item.kind === 'link' ? (
                <li key={item.to}>
                  <LinkRow link={item} />
                </li>
              ) : (
                <li key={item.action}>
                  <ActionRow action={item} onImpersonate={() => setImpersonateOpen(true)} />
                </li>
              ),
            )}
        </ul>
      </div>

      {impersonateOpen && session.user && (
        <ImpersonateDialog selfId={session.user.id} onClose={() => setImpersonateOpen(false)} />
      )}
      {newRequestOpen && <NewRequestDialog onClose={() => setNewRequestOpen(false)} />}
      {searchOpen && <GlobalSearchDialog onClose={() => setSearchOpen(false)} />}
    </aside>
  );
}

function FavoritesGroup() {
  const favorites = useFavorites();
  const [expanded, setExpanded] = useState(false);
  const items = favorites.data?.items ?? [];
  if (favorites.isLoading || favorites.isError || items.length === 0) return null;
  const visible = expanded ? items : items.slice(0, 3);
  return (
    <section className="mb-5" aria-labelledby="sidebar-favorites-title">
      <p id="sidebar-favorites-title" className="px-3 pb-1.5 text-[0.65rem] font-semibold uppercase tracking-wider text-slate-400">Favoritos</p>
      <ul className="space-y-0.5">
        {visible.map((item) => <li key={`${item.type}:${item.id}`}><FavoriteLink item={item} /></li>)}
      </ul>
      {items.length > 3 && <button type="button" onClick={() => setExpanded((value) => !value)} className="mt-1 flex min-h-10 w-full items-center gap-2 rounded-md px-3 text-xs font-semibold text-slate-500 hover:bg-slate-50 hover:text-slate-700 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-cyan-700 active:bg-slate-100">{expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}<span>{expanded ? 'Exibir menos' : `Exibir mais (${items.length - 3})`}</span></button>}
    </section>
  );
}

function FavoriteLink({ item }: { item: DiscoveryItem }) {
  const Icon = item.type === 'service' ? Workflow : FileSearch;
  if (item.type === 'service') return (
    <button type="button" title={item.title} onClick={() => openTab(item.href)} className="flex min-h-10 w-full min-w-0 items-center gap-2.5 rounded-md px-3 text-sm text-slate-700 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-cyan-700 active:bg-slate-200">
      <Icon size={15} className="shrink-0 text-slate-400" /><span className="truncate">{item.title}</span>
    </button>
  );
  return (
    <Link to={item.href} title={item.title} className="flex min-h-10 min-w-0 items-center gap-2.5 rounded-md px-3 text-sm text-slate-700 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-cyan-700 active:bg-slate-200">
      <Icon size={15} className="shrink-0 text-slate-400" /><span className="truncate">{item.title}</span>
    </Link>
  );
}

function nodeKey(node: MenuNode): string {
  return node.kind === 'group' ? `g:${node.label}` : node.to;
}

function NavNode({ node }: { node: MenuNode }) {
  const can = useSessionStore((s) => s.can);
  const visible = useSessionStore((s) => (node.kind === 'link' && node.visible ? node.visible(s) : true));
  if (!visible) return null;
  if (node.kind === 'group') {
    const children = node.children.filter((c) => can(c.perm));
    return children.length ? <GroupRow group={{ ...node, children }} /> : null;
  }
  return (
    <li>
      <LinkRow link={node} />
    </li>
  );
}

const rowBase = 'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors';

/**
 * Ativo = mesmo pathname E mesma query string (comparadas de forma canônica).
 * Itens irmãos podem compartilhar o pathname e divergir só na query — ex.:
 * "Fontes de dados" de Processos (/admin/data-sources) vs de Relatórios
 * (/admin/data-sources?scope=report). O NavLink ignora a query no match, então
 * ambos acenderiam juntos.
 */
function isMenuLinkActive(to: string, pathname: string, search: string): boolean {
  const q = to.indexOf('?');
  const toPath = q === -1 ? to : to.slice(0, q);
  if (pathname !== toPath) return false;
  const current = new URLSearchParams(search);
  const target = new URLSearchParams(q === -1 ? '' : to.slice(q));
  current.sort();
  target.sort();
  return current.toString() === target.toString();
}

function LinkRow({ link }: { link: MenuLink }) {
  const Icon = link.icon;
  return (
    <NavLink
      to={link.to}
      end={link.to === '/'}
      className={({ isActive }) =>
        [rowBase, isActive ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'].join(' ')
      }
    >
      <Icon size={18} className="shrink-0" />
      <span className="min-w-0 flex-1 truncate">{link.label}</span>
      {link.badge === 'pendingTasks' && <PendingTasksBadge />}
    </NavLink>
  );
}

function PendingTasksBadge() {
  const summary = useTaskSummary();
  if (summary.isLoading || summary.isError || !summary.data) return null;
  return (
    <span aria-label={`${summary.data.pendingCount} tarefas pendentes`} className="shrink-0 tabular-nums text-xs font-semibold opacity-75">
      {summary.data.pendingCount}
    </span>
  );
}

function GroupRow({ group }: { group: MenuGroup }) {
  const { pathname, search } = useLocation();
  const hasActiveChild = group.children.some((c) => isMenuLinkActive(c.to, pathname, search));
  const [open, setOpen] = useState(hasActiveChild);
  // Abre (nunca fecha) quando um filho fica ativo após o mount — ex.: chegar por
  // redirect (/admin/flows/categories → /admin/flows) ou por outro link.
  useEffect(() => {
    if (hasActiveChild) setOpen(true);
  }, [hasActiveChild]);
  const Icon = group.icon;

  return (
    <li>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={[rowBase, 'w-full', hasActiveChild ? 'text-slate-900' : 'text-slate-700 hover:bg-slate-100'].join(' ')}
      >
        <Icon size={18} className="shrink-0" />
        <span className="flex-1 truncate text-left">{group.label}</span>
        <ChevronDown size={15} className={`shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <ul className="mt-0.5 space-y-0.5 border-l border-slate-200 pl-3">
          {group.children.map((child) => {
            const Ci = child.icon;
            // Match manual (pathname + query exatos) em vez do isActive do NavLink:
            // resolve tanto irmãos por prefixo (/admin/flows vs .../categories)
            // quanto irmãos que divergem só na query (?scope=report).
            const active = isMenuLinkActive(child.to, pathname, search);
            return (
              <li key={child.to}>
                <Link
                  to={child.to}
                  aria-current={active ? 'page' : undefined}
                  className={[
                    'flex items-center gap-2.5 rounded-md px-3 py-1.5 text-sm transition-colors',
                    active ? 'bg-slate-100 font-medium text-slate-900' : 'text-slate-600 hover:bg-slate-50',
                  ].join(' ')}
                >
                  <Ci size={15} className="shrink-0 text-slate-400" />
                  <span className="truncate">{child.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </li>
  );
}

function ActionRow({ action, onImpersonate }: { action: MenuAction; onImpersonate?: () => void }) {
  const Icon = action.icon;
  const navigate = useNavigate();
  const logout = useSessionStore((s) => s.logout);
  const [busy, setBusy] = useState(false);

  // "Sair" era um mock (toast) — nunca encerrava a sessão de fato.
  async function run() {
    if (action.action === 'logout') {
      if (busy) return;
      setBusy(true);
      try {
        await logout(); // revoga o refresh no backend e limpa os tokens
      } finally {
        setBusy(false);
        navigate('/login', { replace: true });
      }
      return;
    }
    if (action.action === 'impersonate') onImpersonate?.();
  }
  return (
    <button type="button" onClick={run} disabled={busy} className={[rowBase, 'w-full text-slate-700 hover:bg-slate-100 disabled:opacity-60'].join(' ')}>
      <Icon size={18} className="shrink-0" />
      <span className="truncate text-left">{action.label}</span>
    </button>
  );
}
