import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, KeyRound, LogOut, User, UserCog, Search } from 'lucide-react';
import { Popover, MenuItem, MenuDivider } from '@/components/ui/Popover';
import { Dialog } from '@/components/ui/Dialog';
import { useSessionStore } from '@/stores/session';
import { useUsersList } from '@/lib/api/users';
import { toast } from '@/stores/toast';

/** Bloco de identidade do usuário no topo da sidebar, com dropdown de conta. */
export function SidebarUser() {
  const user = useSessionStore((s) => s.user);
  const logout = useSessionStore((s) => s.logout);
  const stopImpersonation = useSessionStore((s) => s.stopImpersonation);
  const isImpersonating = useSessionStore((s) => s.isImpersonating);
  const navigate = useNavigate();
  const [leaving, setLeaving] = useState(false);

  if (!user) return null;

  // Sair da personificação NUNCA pode deixar o usuário preso: se o stop falhar
  // (token do ator inválido, backend fora), caímos para o logout — o pior caso é
  // pedir login de novo, nunca continuar personificando.
  async function leaveImpersonation() {
    setLeaving(true);
    try {
      await stopImpersonation();
      navigate('/', { replace: true });
    } catch {
      toast.error('Não foi possível voltar ao seu usuário. Encerrando a sessão.');
      try { await logout(); } finally { navigate('/login', { replace: true }); }
    } finally {
      setLeaving(false);
    }
  }

  const initials = user.name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');

  async function endSession() {
    await logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="px-3 py-2">
      {isImpersonating && (
        <div className="mb-2 flex items-center justify-between gap-2 rounded-md bg-amber-50 px-2.5 py-1.5 text-xs text-amber-800">
          <span className="min-w-0 truncate">
            Personificando <strong className="font-semibold">{user.name}</strong>
          </span>
          <button type="button" disabled={leaving} onClick={leaveImpersonation} className="shrink-0 font-medium underline hover:text-amber-900 disabled:opacity-60">
            Sair
          </button>
        </div>
      )}

      <Popover
        align="left"
        fullWidth
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
            {/* Segunda porta de saída da personificação: o banner pode ficar fora
                da vista (scroll/mobile) — aqui está sempre a um clique. */}
            {isImpersonating && (
              <MenuItem onClick={async () => { close(); await leaveImpersonation(); }}>
                <UserCog size={15} /> Sair da personificação
              </MenuItem>
            )}
            <MenuDivider />
            <MenuItem destructive onClick={async () => { close(); await endSession(); }}>
              <LogOut size={15} /> Sair
            </MenuItem>
          </>
        )}
      </Popover>
    </div>
  );
}

/** Modal de seleção de usuário p/ personificar. Acionado pelo rodapé do sidenav. */
export function ImpersonateDialog({ selfId, onClose }: { selfId: string; onClose: () => void }) {
  const impersonate = useSessionStore((s) => s.impersonate);
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const list = useUsersList({ q: q || undefined, status: 'active', pageSize: 20 });

  async function pick(id: string, name: string) {
    setBusy(true);
    try {
      await impersonate(id);
      toast.success(`Personificando ${name}.`);
      onClose();
      navigate('/', { replace: true });
    } catch {
      toast.error('Não foi possível personificar este usuário.');
      setBusy(false);
    }
  }

  return (
    <Dialog open onClose={onClose} title="Personificar usuário" footer={
      <button onClick={onClose} className="rounded-md border border-slate-300 px-3.5 py-1.5 text-sm">Fechar</button>
    }>
      <p className="mb-3 text-sm text-slate-600">
        Você assumirá a sessão do usuário selecionado. Para voltar, use "Sair da personificação" — você retorna à sua conta sem precisar logar de novo.
      </p>
      <div className="relative mb-3">
        <Search size={16} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          autoFocus
          placeholder="Buscar por nome ou e-mail..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="w-full rounded-md border border-slate-300 bg-white py-1.5 pl-8 pr-3 text-sm focus:border-slate-500 focus:outline-none"
        />
      </div>
      <div className="max-h-72 overflow-auto rounded-md border border-slate-200">
        {list.isLoading && <p className="px-3 py-4 text-center text-sm text-slate-400">Carregando...</p>}
        {list.data?.items.filter((u) => u.id !== selfId).map((u) => (
          <button
            key={u.id}
            type="button"
            disabled={busy}
            onClick={() => pick(u.id, u.name)}
            className="flex w-full items-center justify-between gap-2 border-b border-slate-100 px-3 py-2 text-left text-sm last:border-b-0 hover:bg-slate-50 disabled:opacity-50"
          >
            <span className="min-w-0">
              <span className="block truncate font-medium text-slate-800">{u.name}</span>
              <span className="block truncate text-xs text-slate-500">{u.email}</span>
            </span>
            <UserCog size={15} className="shrink-0 text-slate-400" />
          </button>
        ))}
        {!list.isLoading && (list.data?.items.filter((u) => u.id !== selfId).length ?? 0) === 0 && (
          <p className="px-3 py-4 text-center text-sm text-slate-400">Nenhum usuário encontrado.</p>
        )}
      </div>
    </Dialog>
  );
}
