import { useNavigate } from 'react-router-dom';
import { ChevronDown, KeyRound, LogOut, User } from 'lucide-react';
import { Popover, MenuItem, MenuDivider } from '@/components/ui/Popover';
import { useSessionStore } from '@/stores/session';
import { toast } from '@/stores/toast';

/** Bloco de identidade do usuário no topo da sidebar, com dropdown de conta. */
export function SidebarUser() {
  const user = useSessionStore((s) => s.user);
  const navigate = useNavigate();

  const initials = user.name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');

  return (
    <div className="px-3 py-2">
      <Popover
        align="left"
        trigger={(open) => (
          <span
            className={[
              'flex w-full cursor-pointer items-center gap-2.5 rounded-md px-2 py-2 text-left transition-colors',
              open ? 'bg-slate-100' : 'hover:bg-slate-100',
            ].join(' ')}
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
              {initials}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-slate-900">{user.name}</span>
              <span className="block truncate text-xs text-slate-500">{user.email}</span>
            </span>
            <ChevronDown size={16} className={`shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
          </span>
        )}
      >
        {(close) => (
          <>
            <MenuItem onClick={() => { close(); navigate('/me'); }}>
              <User size={15} /> Meus dados
            </MenuItem>
            <MenuItem onClick={() => { close(); navigate('/me/senha'); }}>
              <KeyRound size={15} /> Mudar senha
            </MenuItem>
            <MenuDivider />
            <MenuItem destructive onClick={() => { close(); toast.info('Sessão encerrada (mock).'); }}>
              <LogOut size={15} /> Sair
            </MenuItem>
          </>
        )}
      </Popover>
    </div>
  );
}
