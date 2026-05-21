import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import { SidebarUser } from './SidebarUser';
import { AccessModeToggle } from './AccessModeToggle';
import { MENU } from './menu/menu-config';
import type { MenuAction, MenuGroup, MenuLink, MenuNode } from './menu/types';
import { useSessionStore } from '@/stores/session';
import { toast } from '@/stores/toast';

export function Sidebar() {
  const session = useSessionStore();
  const tenant = session.tenant;
  const layout = MENU[session.effectiveMode()];

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-slate-200 bg-white">
      {/* Logo do cliente */}
      <div className="flex items-center gap-2.5 border-b border-slate-200 px-4 py-3.5">
        {tenant.logoUrl ? (
          <img src={tenant.logoUrl} alt={tenant.name} className="h-8 w-auto" />
        ) : (
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-slate-900 text-sm font-bold text-white">
            {tenant.name[0]}
          </div>
        )}
        <span className="truncate text-sm font-semibold tracking-tight text-slate-900">{tenant.name}</span>
      </div>

      {/* Usuário + tipo de acesso */}
      <div className="border-b border-slate-200 py-1">
        <SidebarUser />
        <AccessModeToggle />
      </div>

      {/* Navegação principal */}
      <nav className="flex-1 overflow-y-auto px-2 py-3">
        {layout.main.map((section, i) => (
          <div key={section.label ?? i} className={i > 0 ? 'mt-5' : ''}>
            {section.label && (
              <p className="px-3 pb-1.5 text-[0.65rem] font-semibold uppercase tracking-wider text-slate-400">
                {section.label}
              </p>
            )}
            <ul className="space-y-0.5">
              {section.items
                .filter((node) => session.can(node.perm))
                .map((node) => (
                  <NavNode key={nodeKey(node)} node={node} />
                ))}
            </ul>
          </div>
        ))}
      </nav>

      {/* Rodapé */}
      <div className="border-t border-slate-200 px-2 py-2">
        <ul className="space-y-0.5">
          {layout.footer
            .filter((item) => session.can(item.perm))
            .map((item) =>
              item.kind === 'link' ? (
                <li key={item.to}>
                  <LinkRow link={item} />
                </li>
              ) : (
                <li key={item.action}>
                  <ActionRow action={item} />
                </li>
              ),
            )}
        </ul>
      </div>
    </aside>
  );
}

function nodeKey(node: MenuNode): string {
  return node.kind === 'group' ? `g:${node.label}` : node.to;
}

function NavNode({ node }: { node: MenuNode }) {
  const can = useSessionStore((s) => s.can);
  const visible = useSessionStore((s) => (node.kind === 'link' && node.visible ? node.visible(s) : true));
  if (!visible) return null;
  return node.kind === 'group' ? (
    <GroupRow group={{ ...node, children: node.children.filter((c) => can(c.perm)) }} />
  ) : (
    <li>
      <LinkRow link={node} />
    </li>
  );
}

const rowBase = 'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors';

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
      <span className="truncate">{link.label}</span>
    </NavLink>
  );
}

function GroupRow({ group }: { group: MenuGroup }) {
  const { pathname } = useLocation();
  const hasActiveChild = group.children.some((c) => pathname === c.to || pathname.startsWith(c.to + '/'));
  const [open, setOpen] = useState(hasActiveChild);
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
            return (
              <li key={child.to}>
                <NavLink
                  to={child.to}
                  className={({ isActive }) =>
                    [
                      'flex items-center gap-2.5 rounded-md px-3 py-1.5 text-sm transition-colors',
                      isActive ? 'bg-slate-100 font-medium text-slate-900' : 'text-slate-600 hover:bg-slate-50',
                    ].join(' ')
                  }
                >
                  <Ci size={15} className="shrink-0 text-slate-400" />
                  <span className="truncate">{child.label}</span>
                </NavLink>
              </li>
            );
          })}
        </ul>
      )}
    </li>
  );
}

function ActionRow({ action }: { action: MenuAction }) {
  const Icon = action.icon;
  function run() {
    if (action.action === 'logout') toast.info('Sessão encerrada (mock).');
    else if (action.action === 'impersonate') toast.info('Personificar — em construção.');
  }
  return (
    <button type="button" onClick={run} className={[rowBase, 'w-full text-slate-700 hover:bg-slate-100'].join(' ')}>
      <Icon size={18} className="shrink-0" />
      <span className="truncate text-left">{action.label}</span>
    </button>
  );
}
