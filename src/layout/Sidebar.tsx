import { NavLink } from 'react-router-dom';
import { Workflow } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

type Item = { to: string; label: string; icon: LucideIcon };

const items: Item[] = [
  { to: '/modelador', label: 'Modelador', icon: Workflow },
];

export function Sidebar() {
  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-5 py-4">
        <h1 className="text-lg font-semibold tracking-tight text-slate-900">Septem V2</h1>
        <p className="text-xs text-slate-500">SGI headless</p>
      </div>
      <nav className="flex-1 overflow-y-auto p-2">
        <ul className="space-y-1">
          {items.map(({ to, label, icon: Icon }) => (
            <li key={to}>
              <NavLink
                to={to}
                className={({ isActive }) =>
                  [
                    'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-700 hover:bg-slate-100',
                  ].join(' ')
                }
              >
                <Icon size={18} />
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <div className="border-t border-slate-200 px-4 py-3 text-xs text-slate-400">
        v0.1 — em desenvolvimento
      </div>
    </aside>
  );
}
